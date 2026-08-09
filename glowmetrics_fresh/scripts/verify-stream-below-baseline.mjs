// Standalone verification for lib/intelligence/streamBelowBaseline.js's
// evaluateStreamBelowBaseline() (pure decision logic) and its integration
// into runStreamCompletionPipeline() (lib/intelligence/streamCompletion.js).
// This repo has no test framework configured and these files can't be
// `import`-ed directly by plain Node — see scripts/verify-stream-
// completion.mjs's comment for the same limitation. This script mirrors
// both functions exactly. Keep in sync with lib/intelligence/
// streamBelowBaseline.js and streamCompletion.js's pipeline if they change.

// ── Mirrors lib/analytics/velocity.js's computeRevenueVelocity exactly ────
function computeRevenueVelocity(currentUPM, sessions) {
  const valid = (sessions || []).filter(s => !s.durationUnknown && (s.totalUSD || 0) > 0 && (s.durationMinutes || 0) >= 15)
  if (!valid.length || !currentUPM) {
    return { currentUPM: currentUPM || 0, currentUPH: (currentUPM || 0) * 60, avgUPM: 0, avgUPH: 0, bestUPM: 0, bestUPH: 0, pctVsAvg: null, pctVsBest: null, label: 'No baseline yet', trend: 'unknown' }
  }
  const upms = valid.map(s => (s.totalUSD || 0) / Math.max(s.durationMinutes || 1, 1))
  const avgUPM = upms.reduce((a, v) => a + v, 0) / upms.length
  const bestUPM = Math.max(...upms)
  const pctVsAvg = avgUPM > 0 ? Math.round(((currentUPM - avgUPM) / avgUPM) * 100) : null
  const pctVsBest = bestUPM > 0 ? Math.round(((currentUPM - bestUPM) / bestUPM) * 100) : null
  let trend
  if (pctVsAvg === null) trend = 'unknown'
  else if (pctVsAvg >= 30) trend = 'excellent'
  else if (pctVsAvg >= 10) trend = 'good'
  else if (pctVsAvg >= -10) trend = 'neutral'
  else if (pctVsAvg >= -30) trend = 'slow'
  else trend = 'poor'
  return {
    currentUPM, currentUPH: parseFloat((currentUPM * 60).toFixed(2)),
    avgUPM: parseFloat(avgUPM.toFixed(4)), avgUPH: parseFloat((avgUPM * 60).toFixed(2)),
    bestUPM: parseFloat(bestUPM.toFixed(4)), bestUPH: parseFloat((bestUPM * 60).toFixed(2)),
    pctVsAvg, pctVsBest, trend,
  }
}

// ── Mirrors lib/intelligence/streamCompletion.js's positive evaluator ─────
const MIN_DURATION_MINUTES = 15
const MIN_TIP_COUNT = 2
const MIN_HISTORICAL_SESSIONS = 3
const RELIABLE_RESOLUTION_TYPES = new Set(['normal_stop', 'auto_ended_inactivity', 'end_at_last_heartbeat'])

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}

function evaluateStreamCompletion({ session, historicalSessions }) {
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
  const validHistorical = (historicalSessions || []).filter(s => !s.durationUnknown && (s.totalUSD || 0) > 0 && (s.durationMinutes || 0) >= MIN_DURATION_MINUTES)
  if (validHistorical.length < MIN_HISTORICAL_SESSIONS) return null
  const currentUPM = earnings / activeMinutes
  const velocity = computeRevenueVelocity(currentUPM, historicalSessions)
  if (velocity.pctVsAvg === null) return null
  if (velocity.trend !== 'excellent' && velocity.trend !== 'good') return null
  const priority = velocity.trend === 'excellent' ? 'high' : 'medium'
  const durationLabel = formatDuration(activeMinutes)
  return {
    priority, title: '🔥 Stream Outperformed Your Baseline',
    message: `Your ${durationLabel} stream earned $${velocity.currentUPH.toFixed(2)}/hr — ${velocity.pctVsAvg}% above your usual rate.`,
    fingerprint: `stream_outperformed_baseline:${session.id}`,
    metadata: { session_id: session.id, duration_minutes: parseFloat(activeMinutes.toFixed(1)), session_earnings_usd: earnings, tip_count: tipCount, current_uph: velocity.currentUPH, baseline_avg_uph: velocity.avgUPH, baseline_best_uph: velocity.bestUPH, pct_vs_avg: velocity.pctVsAvg, pct_vs_best: velocity.pctVsBest, historical_session_count: validHistorical.length, comparison_type: 'historical_average_uph', trend: velocity.trend },
  }
}

// ── Mirrors lib/intelligence/streamBelowBaseline.js exactly ───────────────
function evaluateStreamBelowBaseline({ session, historicalSessions }) {
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
  const validHistorical = (historicalSessions || []).filter(s => !s.durationUnknown && (s.totalUSD || 0) > 0 && (s.durationMinutes || 0) >= MIN_DURATION_MINUTES)
  if (validHistorical.length < MIN_HISTORICAL_SESSIONS) return null
  const currentUPM = earnings / activeMinutes
  const velocity = computeRevenueVelocity(currentUPM, historicalSessions)
  if (velocity.pctVsAvg === null) return null
  if (velocity.trend !== 'slow' && velocity.trend !== 'poor') return null
  const priority = velocity.trend === 'poor' ? 'medium' : 'low'
  const durationLabel = formatDuration(activeMinutes)
  return {
    priority, title: '📉 Stream Below Your Baseline',
    message: `Your ${durationLabel} stream earned $${velocity.currentUPH.toFixed(2)}/hr — ${Math.abs(velocity.pctVsAvg)}% below your usual rate.`,
    fingerprint: `stream_below_baseline:${session.id}`,
    metadata: { session_id: session.id, duration_minutes: parseFloat(activeMinutes.toFixed(1)), session_earnings_usd: earnings, tip_count: tipCount, current_uph: velocity.currentUPH, baseline_avg_uph: velocity.avgUPH, baseline_best_uph: velocity.bestUPH, pct_vs_avg: velocity.pctVsAvg, pct_vs_best: velocity.pctVsBest, historical_session_count: validHistorical.length, comparison_type: 'historical_average_uph', trend: velocity.trend },
  }
}

// ── Mirrors runStreamCompletionPipeline()'s extended orchestration ────────
async function runStreamCompletionPipeline({ session, supabase, getAnalytics }) {
  if (!session) return { event: null, evaluation: null, belowBaselineEvent: null, belowBaselineEvaluation: null }
  const analytics = await getAnalytics()
  const historicalSessions = analytics?.sessions || []
  const evaluation = evaluateStreamCompletion({ session, historicalSessions })
  const belowBaselineEvaluation = evaluateStreamBelowBaseline({ session, historicalSessions })

  let event = null
  if (evaluation) {
    const { data } = await supabase.rpc('record_dashboard_event_if_new', { p_event_type: 'stream_outperformed_baseline', p_fingerprint: evaluation.fingerprint, ...evaluation })
    event = data
  }
  let belowBaselineEvent = null
  if (belowBaselineEvaluation) {
    const { data } = await supabase.rpc('record_dashboard_event_if_new', { p_event_type: 'stream_below_baseline', p_fingerprint: belowBaselineEvaluation.fingerprint, ...belowBaselineEvaluation })
    belowBaselineEvent = data
  }
  return { event, evaluation, belowBaselineEvent, belowBaselineEvaluation }
}

// ── Test fixtures ──────────────────────────────────────────────────────
const BASELINE_SESSIONS = [
  { totalUSD: 60, durationMinutes: 60, durationUnknown: false },
  { totalUSD: 45, durationMinutes: 60, durationUnknown: false },
  { totalUSD: 75, durationMinutes: 60, durationUnknown: false },
] // avg = $60/hr, best = $75/hr

function makeSession(overrides = {}) {
  const startedAt = new Date('2026-08-01T20:00:00Z')
  const endedAt = new Date(startedAt.getTime() + 90 * 60000) // 90 min
  return {
    id: 'session-1', session_resolution_type: 'normal_stop', is_inaccurate: false,
    started_at: startedAt.toISOString(), ended_at: endedAt.toISOString(), total_paused_seconds: 0,
    tip_count: 10, session_earnings_usd: 90, // exactly baseline avg by default
    ...overrides,
  }
}

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`) }
}

// 1. Deep below baseline (poor, < -30%) — fires with medium priority
{
  const session = makeSession({ session_earnings_usd: 30 }) // 90min @ $20/hr = -67% vs $60 avg
  const result = evaluateStreamBelowBaseline({ session, historicalSessions: BASELINE_SESSIONS })
  check('1. deep underperformance: event fires', result !== null, true)
  check('1. priority is medium for poor trend', result?.priority, 'medium')
  check('1. trend is poor', result?.metadata.trend, 'poor')
}

// 2. Moderately below baseline (slow, -30%..-10%) — fires with low priority
{
  const session = makeSession({ session_earnings_usd: 67.5 }) // $45/hr = -25% vs $60 avg
  const result = evaluateStreamBelowBaseline({ session, historicalSessions: BASELINE_SESSIONS })
  check('2. moderate underperformance: event fires', result !== null, true)
  check('2. priority is low for slow trend', result?.priority, 'low')
  check('2. trend is slow', result?.metadata.trend, 'slow')
}

// 3. Boundary: exactly -10% -> neutral, no event (matches computeRevenueVelocity's own >= -10 rule)
{
  const session = makeSession({ session_earnings_usd: 81 }) // 90min @ $54/hr = -10% vs $60 avg
  const result = evaluateStreamBelowBaseline({ session, historicalSessions: BASELINE_SESSIONS })
  check('3. exactly -10% (neutral boundary): no event', result, null)
}

// 3b. Boundary: exactly -30% -> still 'slow' (>=-30 rule), fires with low priority
{
  const session = makeSession({ session_earnings_usd: 63 }) // 90min @ $42/hr = -30% vs $60 avg
  const result = evaluateStreamBelowBaseline({ session, historicalSessions: BASELINE_SESSIONS })
  check('3b. exactly -30% (still slow, inclusive boundary): event fires', result !== null, true)
  check('3b. trend is slow at exactly -30%', result?.metadata.trend, 'slow')
}

// 3c. Boundary: -31% -> poor, medium priority
{
  const session = makeSession({ session_earnings_usd: 62.1 }) // 90min @ $41.4/hr ≈ -31% vs $60 avg
  const result = evaluateStreamBelowBaseline({ session, historicalSessions: BASELINE_SESSIONS })
  check('3c. -31% (just past slow/poor boundary): trend is poor', result?.metadata.trend, 'poor')
  check('3c. -31%: priority is medium', result?.priority, 'medium')
}

// 4. Neutral band overall (-10%..+10%) -> no event
{
  const session = makeSession({ session_earnings_usd: 90 }) // exactly at avg = 0%
  const result = evaluateStreamBelowBaseline({ session, historicalSessions: BASELINE_SESSIONS })
  check('4. at baseline (0%): no below-baseline event', result, null)
}

// 5. Insufficient historical data (<3 valid sessions) -> no event even with a huge apparent underperformance
{
  const session = makeSession({ session_earnings_usd: 10 })
  const result = evaluateStreamBelowBaseline({ session, historicalSessions: BASELINE_SESSIONS.slice(0, 2) })
  check('5. insufficient historical sample (2 sessions): no event', result, null)
}

// 6. Insufficient stream duration (< 15 min) -> no event regardless of earnings
{
  const session = makeSession({ started_at: '2026-08-01T20:00:00Z', ended_at: '2026-08-01T20:10:00Z', session_earnings_usd: 5, tip_count: 5 })
  const result = evaluateStreamBelowBaseline({ session, historicalSessions: BASELINE_SESSIONS })
  check('6. stream under 15 minutes: no event', result, null)
}

// 6b. Insufficient tip count / zero earnings
check('6b. tip_count < 2: no event', evaluateStreamBelowBaseline({ session: makeSession({ session_earnings_usd: 30, tip_count: 1 }), historicalSessions: BASELINE_SESSIONS }), null)
check('6c. zero earnings: no event', evaluateStreamBelowBaseline({ session: makeSession({ session_earnings_usd: 0, tip_count: 0 }), historicalSessions: BASELINE_SESSIONS }), null)

// 7. is_inaccurate / unreliable resolution type -> no event
check('7a. is_inaccurate session: no event regardless of underperformance', evaluateStreamBelowBaseline({ session: makeSession({ session_earnings_usd: 10, is_inaccurate: true }), historicalSessions: BASELINE_SESSIONS }), null)
check('7b. chosen_end_time resolution (self-reported precision): no event', evaluateStreamBelowBaseline({ session: makeSession({ session_earnings_usd: 10, session_resolution_type: 'chosen_end_time' }), historicalSessions: BASELINE_SESSIONS }), null)
check('7c. marked_invalid resolution: no event', evaluateStreamBelowBaseline({ session: makeSession({ session_earnings_usd: 10, session_resolution_type: 'marked_invalid', is_inaccurate: true }), historicalSessions: BASELINE_SESSIONS }), null)

// 8. Mutual exclusivity — a session can never qualify for both events
{
  const goodSession = makeSession({ session_earnings_usd: 117 }) // +30% -> excellent
  check('8a. excellent session: positive evaluator fires', evaluateStreamCompletion({ session: goodSession, historicalSessions: BASELINE_SESSIONS }) !== null, true)
  check('8a. excellent session: negative evaluator does NOT fire', evaluateStreamBelowBaseline({ session: goodSession, historicalSessions: BASELINE_SESSIONS }), null)

  const badSession = makeSession({ session_earnings_usd: 30 }) // -67% -> poor
  check('8b. poor session: negative evaluator fires', evaluateStreamBelowBaseline({ session: badSession, historicalSessions: BASELINE_SESSIONS }) !== null, true)
  check('8b. poor session: positive evaluator does NOT fire', evaluateStreamCompletion({ session: badSession, historicalSessions: BASELINE_SESSIONS }), null)

  const neutralSession = makeSession({ session_earnings_usd: 90 }) // 0% -> neutral
  check('8c. neutral session: neither evaluator fires', [evaluateStreamCompletion({ session: neutralSession, historicalSessions: BASELINE_SESSIONS }), evaluateStreamBelowBaseline({ session: neutralSession, historicalSessions: BASELINE_SESSIONS })], [null, null])
}

// 9. Fingerprint format and determinism
{
  const session = makeSession({ id: 'abc-123', session_earnings_usd: 30 })
  const a = evaluateStreamBelowBaseline({ session, historicalSessions: BASELINE_SESSIONS })
  const b = evaluateStreamBelowBaseline({ session, historicalSessions: BASELINE_SESSIONS })
  check('9. fingerprint is deterministic for the same session', a.fingerprint, b.fingerprint)
  check('9. fingerprint format is stream_below_baseline:<session_id>', a.fingerprint, 'stream_below_baseline:abc-123')
}

// 10. Pipeline-level: duplicate finalization / dedup via fingerprint (mirrors record_dashboard_event_if_new's contract)
function makeFakeSupabase() {
  const events = new Map()
  let nextId = 1
  return {
    _events: events,
    rpc: async (name, params) => {
      const key = params.p_fingerprint
      if (events.has(key)) return { data: events.get(key), error: null }
      const row = { id: nextId++, status: 'new', ...params }
      events.set(key, row)
      return { data: row, error: null }
    },
  }
}
{
  const session = makeSession({ session_earnings_usd: 30 }) // qualifying poor
  const getAnalytics = async () => ({ sessions: BASELINE_SESSIONS })
  const supabase = makeFakeSupabase()
  const first = await runStreamCompletionPipeline({ session, supabase, getAnalytics })
  const second = await runStreamCompletionPipeline({ session, supabase, getAnalytics })
  check('10. duplicate finalization: exactly one below-baseline event exists after two calls', supabase._events.size, 1)
  check('10. same stream processed twice returns the same event id', first.belowBaselineEvent?.id, second.belowBaselineEvent?.id)
  check('10. positive event never recorded for a poor session', first.event, null)
}

// 11. Distinct sessions -> distinct events/fingerprints, no cross-contamination
{
  const getAnalytics = async () => ({ sessions: BASELINE_SESSIONS })
  const supabase = makeFakeSupabase()
  const sessionA = makeSession({ id: 'session-A', session_earnings_usd: 30 })
  const sessionB = makeSession({ id: 'session-B', session_earnings_usd: 20 })
  await runStreamCompletionPipeline({ session: sessionA, supabase, getAnalytics })
  await runStreamCompletionPipeline({ session: sessionB, supabase, getAnalytics })
  check('11. two distinct underperforming sessions produce two distinct events', supabase._events.size, 2)
}

// 12. Only one call to getAnalytics per pipeline run — no duplicate analytics fetch
{
  let fetchCount = 0
  const getAnalytics = async () => { fetchCount++; return { sessions: BASELINE_SESSIONS } }
  const supabase = makeFakeSupabase()
  const session = makeSession({ session_earnings_usd: 30 })
  await runStreamCompletionPipeline({ session, supabase, getAnalytics })
  check('12. exactly one analytics fetch evaluates both positive and negative outcomes', fetchCount, 1)
}

// 13. No fabricated metadata
{
  const session = makeSession({ session_earnings_usd: 30 })
  const result = evaluateStreamBelowBaseline({ session, historicalSessions: BASELINE_SESSIONS })
  check('13. metadata.pct_vs_avg matches real computed value, not fabricated', result.metadata.pct_vs_avg, -67)
  check('13. metadata.historical_session_count reflects real sample size', result.metadata.historical_session_count, 3)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
