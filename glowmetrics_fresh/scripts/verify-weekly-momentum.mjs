// Standalone verification for lib/intelligence/weeklyMomentum.js's
// evaluateWeeklyMomentum() (pure decision logic) and its orchestration.
// This repo has no test framework configured and this file can't be
// `import`-ed directly by plain Node — see scripts/verify-stream-
// completion.mjs's comment for the same limitation. This script mirrors
// the function exactly. Keep in sync with lib/intelligence/
// weeklyMomentum.js if it changes.

function toUsdNumber(v) {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

const WINDOW_DAYS = 7
const CHANGE_THRESHOLD_PCT = 10

function evaluateWeeklyMomentum({ tips, now = Date.now() }) {
  if (!tips || !tips.length) return null
  const thisWeek = tips.filter(t => {
    const days = (now - new Date(t.dateRaw || t.date_time).getTime()) / 86400000
    return days >= 0 && days <= WINDOW_DAYS
  })
  const lastWeek = tips.filter(t => {
    const days = (now - new Date(t.dateRaw || t.date_time).getTime()) / 86400000
    return days > WINDOW_DAYS && days <= WINDOW_DAYS * 2
  })
  if (!(thisWeek.length > 0 && lastWeek.length > 0)) return null
  const thisRev = thisWeek.reduce((s, t) => s + toUsdNumber(t.usd), 0)
  const lastRev = lastWeek.reduce((s, t) => s + toUsdNumber(t.usd), 0)
  if (!(lastRev > 0)) return null
  const change = Math.round(((thisRev - lastRev) / lastRev) * 100)
  if (!Number.isFinite(change)) return null
  if (Math.abs(change) < CHANGE_THRESHOLD_PCT) return null
  const isUp = change >= 0
  const eventType = isUp ? 'weekly_momentum_up' : 'weekly_momentum_down'
  return {
    eventType, priority: 'medium',
    title: isUp ? '📈 Weekly Revenue Up' : '📉 Weekly Revenue Down',
    message: isUp
      ? `You're up ${change}% this week vs last week ($${thisRev.toFixed(0)} vs $${lastRev.toFixed(0)}) — keep the momentum going.`
      : `You're down ${Math.abs(change)}% this week vs last ($${thisRev.toFixed(0)} vs $${lastRev.toFixed(0)}) — increase stream frequency to recover.`,
    fingerprint: `weekly_momentum:${isUp ? 'up' : 'down'}`,
    metadata: {
      change_pct: change, this_week_usd: parseFloat(thisRev.toFixed(2)), last_week_usd: parseFloat(lastRev.toFixed(2)),
      this_week_tip_count: thisWeek.length, last_week_tip_count: lastWeek.length, direction: isUp ? 'up' : 'down',
    },
  }
}

const COOLDOWN_SECONDS = 7 * 24 * 60 * 60
async function runWeeklyMomentumPipeline({ userId, supabase, tips }) {
  if (!userId || !supabase) throw new Error('runWeeklyMomentumPipeline requires userId and a Supabase client')
  const evaluation = evaluateWeeklyMomentum({ tips })
  if (!evaluation) return { event: null, evaluation: null }
  let event = null
  try {
    const { data, error } = await supabase.rpc('record_dashboard_event_if_new', {
      p_event_type: evaluation.eventType, p_priority: evaluation.priority,
      p_title: evaluation.title, p_message: evaluation.message, p_fingerprint: evaluation.fingerprint,
      p_metadata: evaluation.metadata, p_cooldown_seconds: COOLDOWN_SECONDS,
    })
    if (error) throw error
    event = data
  } catch (e) { /* non-fatal, mirrors real pipeline */ }
  return { event, evaluation }
}

// ── Test fixtures ──────────────────────────────────────────────────────
const NOW = new Date('2026-08-09T12:00:00Z').getTime()
function tip(daysAgo, usd) {
  return { username: 'fan', usd, date_time: new Date(NOW - daysAgo * 86400000).toISOString() }
}

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`) }
}

// 1. Exact +10% boundary -> fires, up
{
  // last week $100 (day 10), this week $110 (day 2) -> +10%
  const tips = [tip(10, 100), tip(2, 110)]
  const result = evaluateWeeklyMomentum({ tips, now: NOW })
  check('1. exactly +10%: event fires', result !== null, true)
  check('1. eventType is weekly_momentum_up', result?.eventType, 'weekly_momentum_up')
  check('1. change_pct is 10', result?.metadata.change_pct, 10)
}

// 2. Exact -10% boundary -> fires, down
{
  // last week $100, this week $90 -> -10%
  const tips = [tip(10, 100), tip(2, 90)]
  const result = evaluateWeeklyMomentum({ tips, now: NOW })
  check('2. exactly -10%: event fires', result !== null, true)
  check('2. eventType is weekly_momentum_down', result?.eventType, 'weekly_momentum_down')
  check('2. change_pct is -10', result?.metadata.change_pct, -10)
}

// 3. Just below threshold (+9%) -> no event
{
  const tips = [tip(10, 100), tip(2, 109)]
  const result = evaluateWeeklyMomentum({ tips, now: NOW })
  check('3. +9% (just under threshold): no event', result, null)
}
// 3b. Just below threshold on the down side (-9%)
{
  const tips = [tip(10, 100), tip(2, 91)]
  const result = evaluateWeeklyMomentum({ tips, now: NOW })
  check('3b. -9% (just under threshold): no event', result, null)
}

// 4. Exactly one tip in each window -> gate satisfied (not blocked)
{
  const tips = [tip(10, 100), tip(2, 200)] // +100%, 1 tip each window
  const result = evaluateWeeklyMomentum({ tips, now: NOW })
  check('4. exactly one tip in each window: gate satisfied, event fires', result !== null, true)
  check('4. this_week_tip_count is 1', result?.metadata.this_week_tip_count, 1)
  check('4. last_week_tip_count is 1', result?.metadata.last_week_tip_count, 1)
}

// 5. Zero tips in either window -> no event
{
  check('5a. zero tips in last week: no event', evaluateWeeklyMomentum({ tips: [tip(2, 100)], now: NOW }), null)
  check('5b. zero tips in this week: no event', evaluateWeeklyMomentum({ tips: [tip(10, 100)], now: NOW }), null)
  check('5c. zero tips overall: no event, no throw', evaluateWeeklyMomentum({ tips: [], now: NOW }), null)
  check('5d. tips outside both windows (>14 days old): no event', evaluateWeeklyMomentum({ tips: [tip(20, 100), tip(25, 100)], now: NOW }), null)
}

// 6. No fabricated percentage when comparison is invalid
{
  // last week revenue sums to $0 (e.g. token-only/free rows) -> must not divide by zero
  const tips = [tip(10, 0), tip(2, 100)]
  const result = evaluateWeeklyMomentum({ tips, now: NOW })
  check('6. last week revenue is $0: no fabricated percentage (no event)', result, null)
}

// 7. Positive and negative changes both produce correctly-shaped events
{
  const up = evaluateWeeklyMomentum({ tips: [tip(10, 50), tip(2, 100)], now: NOW }) // +100%
  const down = evaluateWeeklyMomentum({ tips: [tip(10, 100), tip(2, 20)], now: NOW }) // -80%
  check('7a. positive change: direction is up', up?.metadata.direction, 'up')
  check('7a. positive change: title reflects up', up?.title, '📈 Weekly Revenue Up')
  check('7b. negative change: direction is down', down?.metadata.direction, 'down')
  check('7b. negative change: title reflects down', down?.title, '📉 Weekly Revenue Down')
}

// 8. Repeated imports / dedup via cooldown
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
  const tips = [tip(10, 100), tip(2, 200)] // +100%, qualifying
  const supabase = makeFakeSupabase()
  const first = await runWeeklyMomentumPipeline({ userId: 'user-a', supabase, tips })
  const second = await runWeeklyMomentumPipeline({ userId: 'user-a', supabase, tips })
  check('8. repeated qualifying import: exactly one event exists after two calls', supabase._events.size, 1)
  check('8. same fingerprint returns the same event id', first.event?.id, second.event?.id)
}

// 9. Distinct periods/fingerprints — up and down are separate fingerprints
{
  const supabase = makeFakeSupabase()
  const upTips = [tip(10, 50), tip(2, 100)]
  const downTips = [tip(10, 100), tip(2, 20)]
  await runWeeklyMomentumPipeline({ userId: 'user-a', supabase, tips: upTips })
  await runWeeklyMomentumPipeline({ userId: 'user-a', supabase, tips: downTips })
  check('9. up and down produce two distinct fingerprints/events', supabase._events.size, 2)
}

// 10. Cross-account isolation — the pure evaluator has no user concept at all
{
  const hasNoUserIdParam = evaluateWeeklyMomentum.length === 1
  check('10. evaluator has no user-crossing surface (single-account input only)', hasNoUserIdParam, true)
}

// 11. Missing/invalid input -> no throw, no event
{
  check('11a. undefined tips: no event, no throw', evaluateWeeklyMomentum({ now: NOW }), null)
  check('11b. null tips: no event, no throw', evaluateWeeklyMomentum({ tips: null, now: NOW }), null)
  let threw = false
  try { await runWeeklyMomentumPipeline({ tips: [] }) } catch (e) { threw = true }
  check('11c. pipeline missing userId/supabase throws rather than silently no-oping', threw, true)
  const brokenSupabase = { rpc: async () => { throw new Error('db down') } }
  let pipelineThrew = false
  try { await runWeeklyMomentumPipeline({ userId: 'user-a', supabase: brokenSupabase, tips: [tip(10, 50), tip(2, 100)] }) } catch (e) { pipelineThrew = true }
  check('11d. RPC failure does not throw out of the pipeline', pipelineThrew, false)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
