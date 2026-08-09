// ============================================================
// CAMCASH DASHBOARD INTELLIGENCE — PEAK WINDOW / BEST-TIME (Phase 3)
// ============================================================
//
// Proves ONE event: peak_window. Fires only when the creator's own
// canonical bestHour (lib/analytics.js's aggregateRows()) is either
// currently active or close enough to be actionable — never a new peak-hour
// formula. Every input here is something the canonical engine or an
// existing helper already computed:
//
//   - bestHour            — aggregateRows()'s own median-per-local-hour
//     calculation, unmodified. earlySignalHour is never accepted as a
//     substitute (see below) — the same rule that already governs its
//     dashboard display ("Early Signal", never "Best Time").
//   - confidenceLevel     — calculateConfidence()'s own band, unmodified.
//     Caller passes the already-computed level string; this file never
//     calls calculateConfidence() itself or invents a new band.
//   - nowHour/nowMinute   — the CURRENT local hour/minute, computed by the
//     caller using the exact same IANA timezone string already being
//     passed to aggregateRows() for this page load (see the dashboard
//     wiring in app/dashboard/page.js). This is the one hard requirement:
//     bestHour.hour was bucketed in that tz, so "is it currently that
//     hour" must be evaluated in that same tz — never
//     new Date().getUTCHours(), never a server process tz, never
//     profiles.timezone (which is never populated by any code path — see
//     lib/serverAnalytics.js's own comment). Reproducing that mismatch is
//     the exact bug already sitting in generateNextMoves()
//     (lib/analytics.js) — documented there as a separate, pre-existing
//     issue, deliberately NOT fixed by this file.
//
// This module has NO database/network access and is safe to import in the
// browser (same category as lib/analytics/velocity.js) — evaluatePeakWindow
// is a pure function; runPeakWindowPipeline is the only part that talks to
// Supabase, and only ever via the RPC already used by every other
// dashboard-intelligence event.

const APPROACH_WINDOW_MINUTES = 60 // see design report: matches bestHour's own
// hour-level bucket resolution — a lead-in finer or coarser than the single
// hour the data itself is bucketed at would imply false precision.

const RELIABLE_CONFIDENCE_LEVELS = new Set(['Medium', 'High'])

function fmt12Hour(h) {
  const hh = ((h % 24) + 24) % 24
  return hh === 0 ? '12 AM' : hh < 12 ? `${hh} AM` : hh === 12 ? '12 PM' : `${hh - 12} PM`
}

// Pure decision function — no I/O. Mirrors evaluateStreamCompletion()'s
// shape (lib/intelligence/streamCompletion.js): takes already-computed
// canonical values, returns either a fully-formed event payload or a null
// event with an explicit reason. Never fabricates a peak when confidence is
// insufficient, and never treats earlySignalHour as bestHour.
export function evaluatePeakWindow({ bestHour, confidenceLevel, nowHour, nowMinute, historicalSessionCount }) {
  if (!bestHour || bestHour.hour === undefined || bestHour.hour === null) {
    return { event: null, reason: 'no_best_hour' }
  }
  if (!RELIABLE_CONFIDENCE_LEVELS.has(confidenceLevel)) {
    return { event: null, reason: 'insufficient_confidence' }
  }
  if (!Number.isFinite(nowHour) || nowHour < 0 || nowHour > 23 ||
      !Number.isFinite(nowMinute) || nowMinute < 0 || nowMinute > 59) {
    return { event: null, reason: 'invalid_current_time' }
  }

  const startHour = parseInt(bestHour.hour, 10)
  if (!Number.isFinite(startHour) || startHour < 0 || startHour > 23) {
    return { event: null, reason: 'invalid_best_hour' }
  }

  // Same 2-hour peak-window notion already shown to users today by
  // app/live/page.js's "Peak Hour Countdown" card (peakHour and
  // peakHour+1) — reused verbatim, not redefined.
  const inPeak = nowHour === startHour || nowHour === (startHour + 1) % 24

  const minutesUntilStart = ((startHour * 60 - (nowHour * 60 + nowMinute)) + 1440) % 1440
  const approaching = !inPeak && minutesUntilStart > 0 && minutesUntilStart <= APPROACH_WINDOW_MINUTES

  if (!inPeak && !approaching) {
    return { event: null, reason: 'outside_trigger_window' }
  }

  const label = fmt12Hour(startHour)
  const avg = parseFloat(bestHour.avg) || 0
  const minutesUntilPeak = inPeak ? 0 : minutesUntilStart

  const title = inPeak
    ? "You're in your usual peak earning window"
    : 'Your peak earning window is coming up'
  const message = inPeak
    ? `${label} has historically been one of your best times to stream — you've typically earned about $${avg.toFixed(2)} during this hour. Past pattern, not a guarantee.`
    : `In about ${minutesUntilPeak} minute${minutesUntilPeak === 1 ? '' : 's'}, you'll enter ${label} — historically one of your best times to stream (about $${avg.toFixed(2)} typical). Past pattern, not a guarantee.`

  // How many minutes from "now" until this event's own relevant window (the
  // same 2-hour inPeak block checked above: startHour through startHour+2)
  // actually ends — derived from startHour/nowHour/nowMinute already
  // computed above, not a new number. Elapsed-minutes math is timezone-
  // invariant (both sides are "local" in the same sense), so no tz
  // conversion is needed here beyond what evaluatePeakWindow already does.
  // Used only to set the RPC's existing p_expires_at parameter — never
  // stored in metadata, never displayed, never affects inPeak/approaching.
  const windowEndHour = (startHour + 2) % 24
  const expiresInMinutes = ((windowEndHour * 60 - (nowHour * 60 + nowMinute)) + 1440) % 1440

  return {
    event: {
      priority: 'medium',
      title,
      message,
      fingerprint: `peak_window:${startHour}`,
      metadata: {
        peak_hour: startHour,
        peak_hour_avg_usd: avg,
        confidence_level: confidenceLevel,
        minutes_until_peak: minutesUntilPeak,
        currently_in_peak: inPeak,
        historical_session_count: historicalSessionCount ?? bestHour.count ?? null,
      },
    },
    expiresInMinutes,
    reason: null,
  }
}

// Orchestration — records the event via the existing dashboard_events RPC
// (unmodified shape), using a ~24h cooldown so the same peak hour can
// generate at most one event per day while still recurring daily. Never
// fails or blocks the caller — matches the established non-fatal pattern
// from runStreamCompletionPipeline/runImportCompletedPipeline.
//
// p_expires_at (added post-UI-surfacing): peak_window is the one event type
// whose usefulness is inherently time-boxed — "you're in/approaching your
// peak window" stops being a current, actionable insight once that window
// (the same 2-hour inPeak block evaluatePeakWindow already checks) has
// passed, regardless of the 24h dedup cooldown above. Without an expiry the
// event would keep showing status='new' — and get presented by the UI as a
// current insight — for up to 24h after the window it was actually about
// had ended (found via real production data once the UI actually surfaced
// these events for the first time). Uses evaluatePeakWindow's own
// expiresInMinutes (derived from the same startHour/nowHour/nowMinute
// already used for inPeak/approaching, not a new number) so the event
// expires exactly when its own window ends — never earlier, never a fixed
// arbitrary duration. record_dashboard_event_if_new's p_expires_at
// parameter already existed and was simply never populated by this caller;
// no RPC or schema change.
const COOLDOWN_SECONDS = 24 * 60 * 60

export async function runPeakWindowPipeline({ supabase, bestHour, confidenceLevel, nowHour, nowMinute, historicalSessionCount }) {
  if (!supabase) throw new Error('runPeakWindowPipeline requires a Supabase client')

  const evaluation = evaluatePeakWindow({ bestHour, confidenceLevel, nowHour, nowMinute, historicalSessionCount })
  if (!evaluation.event) return { event: null, evaluation }

  let event = null
  try {
    const { data, error } = await supabase.rpc('record_dashboard_event_if_new', {
      p_event_type: 'peak_window',
      p_source: 'analytics',
      p_priority: evaluation.event.priority,
      p_title: evaluation.event.title,
      p_message: evaluation.event.message,
      p_fingerprint: evaluation.event.fingerprint,
      p_metadata: evaluation.event.metadata,
      p_cooldown_seconds: COOLDOWN_SECONDS,
      p_expires_at: new Date(Date.now() + evaluation.expiresInMinutes * 60000).toISOString(),
    })
    if (error) throw error
    event = data
  } catch (eventErr) {
    console.warn('[intelligence] Failed to record peak_window event:', eventErr.message)
  }

  return { event, evaluation }
}
