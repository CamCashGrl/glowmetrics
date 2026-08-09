// ============================================================
// CAMCASH DASHBOARD INTELLIGENCE — STREAM BELOW BASELINE (Phase 5)
// ============================================================
//
// Proves ONE event: stream_below_baseline — the negative-band complement to
// Phase 2's stream_outperformed_baseline (lib/intelligence/streamCompletion.js).
// Same evaluator shape, same gates, same computeRevenueVelocity() call —
// the only difference is which trend bands qualify. Every threshold here is
// the exact same one Phase 2 already established, never a new formula:
//
//   - MIN_DURATION_MINUTES (15), MIN_TIP_COUNT (2) + earnings > 0,
//     MIN_HISTORICAL_SESSIONS (3), RELIABLE_RESOLUTION_TYPES — identical
//     values to streamCompletion.js, copied rather than imported only
//     because they're primitive constants, not logic; if Phase 2's values
//     ever change, this file's copies must be updated to match (same
//     "single source of truth" caveat applies to the constant values here
//     as anywhere else — see review guidance before changing either file).
//   - The 'slow'/'poor' trend bands (<=-10%, <-30%) are
//     computeRevenueVelocity()'s OWN classification, unmodified — this
//     event fires only for those two bands; 'neutral' and above never fire.
//     'excellent'/'good' are Phase 2's exclusive territory; a session can
//     never qualify for both events (the trend value is a single mutually
//     exclusive classification per session).
//
// This does NOT overlap with the live pace_below/pace_above coaching
// triggers (lib/coaching/triggers.js): those fire mid-session, comparing
// the session's own first half against its second half, written to the
// separate coaching_events table. This event only ever evaluates AFTER a
// session is finalized, comparing the whole session against cross-session
// historical baseline, written to dashboard_events. Different timing,
// different comparison basis, different table — not a duplicate signal.

import { computeRevenueVelocity } from '../analytics/velocity'

const MIN_DURATION_MINUTES = 15
const MIN_TIP_COUNT = 2
const MIN_HISTORICAL_SESSIONS = 3
const RELIABLE_RESOLUTION_TYPES = new Set(['normal_stop', 'auto_ended_inactivity', 'end_at_last_heartbeat'])

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}

// Pure decision function — no I/O, no database, no network. Mirrors
// evaluateStreamCompletion()'s exact gates; the only divergence is the
// trend check at the end (slow/poor instead of excellent/good) and the
// resulting priority mapping. Never fabricates a comparison: returns null
// at every stage where the data isn't reliable enough to say anything.
export function evaluateStreamBelowBaseline({ session, historicalSessions }) {
  if (!session) return null
  if (session.is_inaccurate) return null
  if (!RELIABLE_RESOLUTION_TYPES.has(session.session_resolution_type)) return null
  if (!session.started_at || !session.ended_at) return null

  const totalSeconds = (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000
  const activeSeconds = totalSeconds - (session.total_paused_seconds || 0)
  const activeMinutes = activeSeconds / 60
  if (!Number.isFinite(activeMinutes) || activeMinutes < MIN_DURATION_MINUTES) return null

  const tipCount = session.tip_count || 0
  const earnings = parseFloat(session.session_earnings_usd) || 0
  if (tipCount < MIN_TIP_COUNT || earnings <= 0) return null

  const validHistorical = (historicalSessions || []).filter(s =>
    !s.durationUnknown && (s.totalUSD || 0) > 0 && (s.durationMinutes || 0) >= MIN_DURATION_MINUTES
  )
  if (validHistorical.length < MIN_HISTORICAL_SESSIONS) return null

  const currentUPM = earnings / activeMinutes
  const velocity = computeRevenueVelocity(currentUPM, historicalSessions)
  if (velocity.pctVsAvg === null) return null
  if (velocity.trend !== 'slow' && velocity.trend !== 'poor') return null

  // Deliberately never 'high'/'critical' — a retrospective negative finding
  // reads as informational, not an alarm.
  const priority = velocity.trend === 'poor' ? 'medium' : 'low'
  const durationLabel = formatDuration(activeMinutes)

  return {
    priority,
    title: '📉 Stream Below Your Baseline',
    message: `Your ${durationLabel} stream earned $${velocity.currentUPH.toFixed(2)}/hr — ${Math.abs(velocity.pctVsAvg)}% below your usual rate.`,
    fingerprint: `stream_below_baseline:${session.id}`,
    metadata: {
      session_id: session.id,
      duration_minutes: parseFloat(activeMinutes.toFixed(1)),
      session_earnings_usd: earnings,
      tip_count: tipCount,
      current_uph: velocity.currentUPH,
      baseline_avg_uph: velocity.avgUPH,
      baseline_best_uph: velocity.bestUPH,
      pct_vs_avg: velocity.pctVsAvg,
      pct_vs_best: velocity.pctVsBest,
      historical_session_count: validHistorical.length,
      comparison_type: 'historical_average_uph',
      trend: velocity.trend,
    },
  }
}
