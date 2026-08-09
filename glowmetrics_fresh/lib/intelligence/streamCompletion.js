// ============================================================
// CAMCASH DASHBOARD INTELLIGENCE — STREAM COMPLETION (Phase 2)
// ============================================================
//
// Proves ONE meaningful event: stream_outperformed_baseline. Fires only
// when a just-finalized live session's $/hour meaningfully exceeds the
// account's own historical baseline — never merely because a stream earned
// money. Every threshold below is REUSED from an existing canonical rule,
// never invented:
//
//   - MIN_DURATION_MINUTES (15)  — the exact "valid session" floor already
//     used by lib/analytics/velocity.js's computeRevenueVelocity/
//     computeLiveComparison for both the current stream AND the historical
//     baseline it's compared against.
//   - MIN_TIP_COUNT (2) + earnings > 0 — the exact hourly-rate eligibility
//     rule from lib/analytics.js (isHourlyRateEligible), reused so a
//     finalized stream is held to the same "is this a real measurement"
//     bar the rest of the canonical engine already uses.
//   - MIN_HISTORICAL_SESSIONS (3) — the project's general confidence floor
//     (calculateConfidence, bestHour/bestDay's own >=3-sample rule).
//   - The 'excellent'/'good' trend bands (>=30%, >=10%) are
//     computeRevenueVelocity's OWN classification, not a new formula —
//     this event fires only for those two bands; 'neutral' and below never
//     fire (that is the anti-noise gate, not a priority difference).
//
// As of the live-session-finalization audit (see supabase/migrations/
// 20260809_centralize_live_session_finalization.sql), all four termination
// paths — stop_live_session(), sweep_stale_live_session(),
// sweep_all_stale_live_sessions(), and resolve_live_session() — compute
// session_earnings_usd/tip_count/etc. through one shared helper
// (_finalize_live_session_metrics), so the data is no longer missing for
// any resolution type. This gate is still kept, but now reflects timestamp
// PRECISION, not data availability:
//   - normal_stop / auto_ended_inactivity: system-observed end time
//     (explicit stop click, or last heartbeat before the inactivity
//     deadline) — high confidence.
//   - end_at_last_heartbeat (resolve_live_session's 'ended' and
//     'end_at_last_heartbeat' choices): also derived from the same
//     extension/website heartbeat timestamps, same precision basis as
//     auto_ended_inactivity — included for the same reason.
//   - chosen_end_time: the user manually picks an end time — real data,
//     but self-reported precision, deliberately excluded to avoid a
//     user-adjustable value feeding a "you outperformed your baseline"
//     claim.
//   - marked_invalid: already excluded via the is_inaccurate check below,
//     regardless of this set.
//
// live_session_analysis_context is NOT used here — confirmed empty (0
// rows) in production, nothing populates it, and everything this event
// needs (session_earnings_usd, tip_count, started_at/ended_at,
// total_paused_seconds) already lives directly on the live_sessions row
// itself, computed by the same finalization helper.

import { computeRevenueVelocity } from '../analytics/velocity'
import { getServerAnalytics } from '../serverAnalytics'

const MIN_DURATION_MINUTES = 15
const MIN_TIP_COUNT = 2
const MIN_HISTORICAL_SESSIONS = 3
const RELIABLE_RESOLUTION_TYPES = new Set(['normal_stop', 'auto_ended_inactivity', 'end_at_last_heartbeat'])

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}

// Pure decision function — no I/O, no database, no network. Takes the
// finalized live_sessions row and the account's historical sessions (from
// aggregateRows()'s output, unmodified) and returns either a fully-formed
// event payload or null. Never fabricates a comparison: returns null at
// every stage where the data isn't reliable enough to say anything.
export function evaluateStreamCompletion({ session, historicalSessions }) {
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
  if (velocity.trend !== 'excellent' && velocity.trend !== 'good') return null

  const priority = velocity.trend === 'excellent' ? 'high' : 'medium'
  const durationLabel = formatDuration(activeMinutes)

  return {
    priority,
    title: '🔥 Stream Outperformed Your Baseline',
    message: `Your ${durationLabel} stream earned $${velocity.currentUPH.toFixed(2)}/hr — ${velocity.pctVsAvg}% above your usual rate.`,
    fingerprint: `stream_outperformed_baseline:${session.id}`,
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

// Orchestration — calls the canonical server-side analytics
// (lib/serverAnalytics.js -> aggregateRows(), unmodified), runs the pure
// evaluator above, and records the event via the existing dashboard_events
// RPC (unmodified shape from Phase 1). Never fails or blocks the caller —
// every step is independently non-fatal, matching the import pipeline's
// established pattern.
export async function runStreamCompletionPipeline({ userId, supabase, session }) {
  if (!session) return { event: null, evaluation: null }
  if (!userId || !supabase) throw new Error('runStreamCompletionPipeline requires userId and a Supabase client')

  let analytics = null
  try {
    analytics = await getServerAnalytics(userId, supabase)
  } catch (analyticsErr) {
    console.warn('[intelligence] Failed to load server analytics for stream completion:', analyticsErr.message)
    return { event: null, evaluation: null }
  }

  const evaluation = evaluateStreamCompletion({ session, historicalSessions: analytics?.sessions || [] })
  if (!evaluation) return { event: null, evaluation: null }

  let event = null
  try {
    const { data, error } = await supabase.rpc('record_dashboard_event_if_new', {
      p_event_type: 'stream_outperformed_baseline',
      p_source: 'live_session',
      p_priority: evaluation.priority,
      p_title: evaluation.title,
      p_message: evaluation.message,
      p_fingerprint: evaluation.fingerprint,
      p_metadata: evaluation.metadata,
      p_related_entity_type: 'live_session',
      p_related_entity_id: session.id,
    })
    if (error) throw error
    event = data
  } catch (eventErr) {
    console.warn('[intelligence] Failed to record stream_outperformed_baseline event:', eventErr.message)
  }

  return { event, evaluation }
}
