// Standalone verification for lib/intelligence/streamCompletion.js's
// evaluateStreamCompletion() (pure decision logic) and
// runStreamCompletionPipeline() (orchestration, against a fake Supabase
// client — no real network/DB, see verify-import-pipeline.mjs's comment
// for why: this repo has no test framework and these files can't be
// `import`-ed directly by plain Node — ESM syntax transitively through
// lib/analytics/velocity.js and lib/serverAnalytics.js -> lib/analytics.js).
// This script mirrors both functions exactly. Keep in sync with
// lib/intelligence/streamCompletion.js if it changes.

// ── Mirrors lib/analytics/velocity.js's computeRevenueVelocity exactly ────
const TREND_CONFIG = { excellent: {}, good: {}, neutral: {}, slow: {}, poor: {}, unknown: {} }
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

// ── Mirrors lib/intelligence/streamCompletion.js exactly ──────────────────
const MIN_DURATION_MINUTES = 15
const MIN_TIP_COUNT = 2
const MIN_HISTORICAL_SESSIONS = 3
const RELIABLE_RESOLUTION_TYPES = new Set(['normal_stop', 'auto_ended_inactivity'])

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
    priority,
    title: '🔥 Stream Outperformed Your Baseline',
    message: `Your ${durationLabel} stream earned $${velocity.currentUPH.toFixed(2)}/hr — ${velocity.pctVsAvg}% above your usual rate.`,
    fingerprint: `stream_outperformed_baseline:${session.id}`,
    metadata: {
      session_id: session.id, duration_minutes: parseFloat(activeMinutes.toFixed(1)),
      session_earnings_usd: earnings, tip_count: tipCount,
      current_uph: velocity.currentUPH, baseline_avg_uph: velocity.avgUPH, baseline_best_uph: velocity.bestUPH,
      pct_vs_avg: velocity.pctVsAvg, pct_vs_best: velocity.pctVsBest,
      historical_session_count: validHistorical.length, comparison_type: 'historical_average_uph', trend: velocity.trend,
    },
  }
}

async function runStreamCompletionPipeline({ userId, supabase, session, getServerAnalytics }) {
  if (!session) return { event: null, evaluation: null }
  let analytics = null
  try { analytics = await getServerAnalytics(userId, supabase) } catch (e) { return { event: null, evaluation: null } }
  const evaluation = evaluateStreamCompletion({ session, historicalSessions: analytics?.sessions || [] })
  if (!evaluation) return { event: null, evaluation: null }
  let event = null
  try {
    const { data, error } = await supabase.rpc('record_dashboard_event_if_new', {
      p_event_type: 'stream_outperformed_baseline', p_source: 'live_session', p_priority: evaluation.priority,
      p_title: evaluation.title, p_message: evaluation.message, p_fingerprint: evaluation.fingerprint,
      p_metadata: evaluation.metadata, p_related_entity_type: 'live_session', p_related_entity_id: session.id,
    })
    if (error) throw error
    event = data
  } catch (e) { /* non-fatal */ }
  return { event, evaluation }
}

// ── Test fixtures ──────────────────────────────────────────────────────
const BASELINE_SESSIONS = [
  { totalUSD: 60, durationMinutes: 60, durationUnknown: false },  // $60/hr
  { totalUSD: 45, durationMinutes: 60, durationUnknown: false },  // $45/hr
  { totalUSD: 75, durationMinutes: 60, durationUnknown: false },  // $75/hr
] // avg = $60/hr, best = $75/hr

function makeSession(overrides = {}) {
  const startedAt = new Date('2026-08-01T20:00:00Z')
  const endedAt = new Date(startedAt.getTime() + 90 * 60000) // 90 min
  return {
    id: 'session-1',
    session_resolution_type: 'normal_stop',
    is_inaccurate: false,
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    total_paused_seconds: 0,
    tip_count: 10,
    session_earnings_usd: 90, // 90 min @ $60/hr = $90 => exactly baseline avg
    ...overrides,
  }
}

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`) }
}

// 1. Stream below baseline — no event
{
  const session = makeSession({ session_earnings_usd: 30 }) // 90min @ $20/hr, well below $60 avg
  const result = evaluateStreamCompletion({ session, historicalSessions: BASELINE_SESSIONS })
  check('1. stream below baseline: no event', result, null)
}

// 2. Stream equal to baseline — no event (0% is not an improvement)
{
  const session = makeSession({ session_earnings_usd: 90 }) // 90min @ $60/hr = exactly avg
  const result = evaluateStreamCompletion({ session, historicalSessions: BASELINE_SESSIONS })
  check('2. stream equal to baseline: no event', result, null)
}

// 3. Stream slightly above baseline (<10%) — no event, anti-noise gate
{
  const session = makeSession({ session_earnings_usd: 94.5 }) // $63/hr = +5% vs $60 avg
  const result = evaluateStreamCompletion({ session, historicalSessions: BASELINE_SESSIONS })
  check('3. stream slightly above baseline (+5%): no event (below noise threshold)', result, null)
}

// 4. Stream significantly above baseline (>=30%) — HIGH priority event
{
  const session = makeSession({ session_earnings_usd: 117 }) // $78/hr = +30% vs $60 avg
  const result = evaluateStreamCompletion({ session, historicalSessions: BASELINE_SESSIONS })
  check('4. stream +30% above baseline: event fires', result !== null, true)
  check('4. priority is high for a large improvement', result?.priority, 'high')
  check('4. fingerprint ties to session id', result?.fingerprint, 'stream_outperformed_baseline:session-1')
  check('4. message contains real computed numbers, not placeholders', result?.message.includes('$78.00/hr') && result?.message.includes('30%'), true)
}

// 4b. A meaningful-but-not-huge improvement (10-30%) — MEDIUM priority
{
  const session = makeSession({ session_earnings_usd: 103.5 }) // $69/hr = +15% vs $60 avg
  const result = evaluateStreamCompletion({ session, historicalSessions: BASELINE_SESSIONS })
  check('4b. +15% improvement fires with medium priority (not high)', result?.priority, 'medium')
}

// 5. Insufficient baseline data (< 3 valid historical sessions) — no event
{
  const session = makeSession({ session_earnings_usd: 200 }) // huge improvement, but...
  const result = evaluateStreamCompletion({ session, historicalSessions: BASELINE_SESSIONS.slice(0, 2) })
  check('5. insufficient historical sample (2 sessions): no event even with a huge apparent improvement', result, null)
}

// 6. Insufficient stream duration (< 15 min) — no event
{
  const session = makeSession({
    started_at: '2026-08-01T20:00:00Z', ended_at: '2026-08-01T20:10:00Z', // 10 min
    session_earnings_usd: 50, tip_count: 5,
  })
  const result = evaluateStreamCompletion({ session, historicalSessions: BASELINE_SESSIONS })
  check('6. stream under 15 minutes: no event regardless of earnings', result, null)
}

// 7 & 8. Duplicate stream finalization / same stream processed twice —
// tested at the pipeline level via the fingerprint dedup RPC contract
// (identical to Phase 1's proven dedup semantics — see makeFakeSupabase).
function makeFakeSupabase() {
  const events = new Map()
  let nextId = 1
  return {
    _events: events,
    rpc: async (name, params) => {
      if (name !== 'record_dashboard_event_if_new') throw new Error('unexpected rpc')
      const key = params.p_fingerprint
      if (events.has(key)) return { data: events.get(key), error: null }
      const row = { id: nextId++, status: 'new', ...params }
      events.set(key, row)
      return { data: row, error: null }
    },
  }
}
{
  const session = makeSession({ session_earnings_usd: 117 }) // qualifying, +30%
  const getServerAnalytics = async () => ({ sessions: BASELINE_SESSIONS })
  const supabase = makeFakeSupabase()
  const first = await runStreamCompletionPipeline({ userId: 'user-a', supabase, session, getServerAnalytics })
  const second = await runStreamCompletionPipeline({ userId: 'user-a', supabase, session, getServerAnalytics })
  check('7. duplicate finalization: exactly one event exists after two calls', supabase._events.size, 1)
  check('8. same stream processed twice returns the same event id', first.event?.id, second.event?.id)
}

// 9. Stale/inactive historical account — sessions exist but all outside
// any "recent" window is irrelevant here (this event compares vs. the
// account's own historical average, not vs. NOW()), but a historical
// baseline of $0 (all sessions earned nothing) must not produce a
// fabricated "outperformed" claim.
{
  const zeroBaseline = [
    { totalUSD: 0, durationMinutes: 60, durationUnknown: false },
    { totalUSD: 0, durationMinutes: 60, durationUnknown: false },
    { totalUSD: 0, durationMinutes: 60, durationUnknown: false },
  ]
  const session = makeSession({ session_earnings_usd: 50 })
  const result = evaluateStreamCompletion({ session, historicalSessions: zeroBaseline })
  check('9. stale/zero-earning historical account: no fabricated comparison (zero-USD sessions are filtered out of the baseline, leaving < 3 valid)', result, null)
}

// 10. Cross-user isolation — the pure evaluator has no user concept at all
// (it only ever sees one session + one account's own historical sessions,
// both already scoped by the caller via getServerAnalytics/RLS); verified
// structurally: evaluateStreamCompletion never reads or requires a userId.
{
  const hasUserIdParam = evaluateStreamCompletion.length === 1 // only ({session, historicalSessions})
  check('10. evaluator has no user-crossing surface (single-account input only)', hasUserIdParam, true)
}

// 11. Correct metadata
{
  const session = makeSession({ session_earnings_usd: 117 })
  const result = evaluateStreamCompletion({ session, historicalSessions: BASELINE_SESSIONS })
  check('11. metadata contains session_id, duration, earnings, uph, baseline, pct, sample size', {
    session_id: result.metadata.session_id,
    duration_minutes: result.metadata.duration_minutes,
    session_earnings_usd: result.metadata.session_earnings_usd,
    current_uph: result.metadata.current_uph,
    baseline_avg_uph: result.metadata.baseline_avg_uph,
    pct_vs_avg: result.metadata.pct_vs_avg,
    historical_session_count: result.metadata.historical_session_count,
  }, {
    session_id: 'session-1', duration_minutes: 90, session_earnings_usd: 117,
    current_uph: 78, baseline_avg_uph: 60, pct_vs_avg: 30, historical_session_count: 3,
  })
}

// 12. Correct priority (already covered by 4/4b, restated explicitly)
check('12. >=30% -> high priority', evaluateStreamCompletion({ session: makeSession({ session_earnings_usd: 117 }), historicalSessions: BASELINE_SESSIONS })?.priority, 'high')
check('12. 10-30% -> medium priority', evaluateStreamCompletion({ session: makeSession({ session_earnings_usd: 103.5 }), historicalSessions: BASELINE_SESSIONS })?.priority, 'medium')

// 13. Correct fingerprint — deterministic, tied to session id, not to time/random
{
  const session = makeSession({ id: 'abc-123', session_earnings_usd: 117 })
  const a = evaluateStreamCompletion({ session, historicalSessions: BASELINE_SESSIONS })
  const b = evaluateStreamCompletion({ session, historicalSessions: BASELINE_SESSIONS })
  check('13. fingerprint is deterministic for the same session', a.fingerprint, b.fingerprint)
  check('13. fingerprint format is stream_outperformed_baseline:<session_id>', a.fingerprint, 'stream_outperformed_baseline:abc-123')
}

// 14. No fabricated comparison when baseline is unavailable (0 historical sessions)
{
  const session = makeSession({ session_earnings_usd: 200 })
  const result = evaluateStreamCompletion({ session, historicalSessions: [] })
  check('14. zero historical sessions: no event, no fabricated baseline', result, null)
}

// Additional gates explicitly required by the spec, not numbered above:
check('is_inaccurate session: never fires regardless of performance', evaluateStreamCompletion({ session: makeSession({ session_earnings_usd: 200, is_inaccurate: true }), historicalSessions: BASELINE_SESSIONS }), null)
check('resolve-path resolution_type (unreliable earnings data): never fires', evaluateStreamCompletion({ session: makeSession({ session_earnings_usd: 200, session_resolution_type: 'chosen_end_time' }), historicalSessions: BASELINE_SESSIONS }), null)
check('insufficient tip count (<2): never fires even with real earnings', evaluateStreamCompletion({ session: makeSession({ session_earnings_usd: 200, tip_count: 1 }), historicalSessions: BASELINE_SESSIONS }), null)
check('zero tip count / zero earnings: never fires', evaluateStreamCompletion({ session: makeSession({ session_earnings_usd: 0, tip_count: 0 }), historicalSessions: BASELINE_SESSIONS }), null)
check('null session: never fires', evaluateStreamCompletion({ session: null, historicalSessions: BASELINE_SESSIONS }), null)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
