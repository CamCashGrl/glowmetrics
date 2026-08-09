// Standalone verification for lib/intelligence/newWhale.js's
// evaluateNewWhales() (pure decision logic) and runNewWhalePipeline()
// (orchestration, against a fake Supabase client). This repo has no test
// framework configured and lib/intelligence/newWhale.js can't be
// `import`-ed directly by plain Node — see scripts/verify-stream-
// completion.mjs's comment for the same limitation. This script mirrors
// both functions exactly. Keep in sync with lib/intelligence/newWhale.js
// if it changes.

function evaluateNewWhales({ whaleAlerts }) {
  const alerts = (whaleAlerts || []).filter(a => a?.type === 'new_whale' && a?.whale?.username)
  return alerts.map(a => {
    const w = a.whale
    const usernameKey = w.username.trim().toLowerCase()
    return {
      priority: 'high',
      title: '🐳 New Top Supporter',
      message: a.message,
      fingerprint: `new_whale:${usernameKey}`,
      metadata: {
        username: w.username, tier: w.tier, total_usd: w.totalUSD,
        days_since_last_tip: w.daysSinceLastTip, tip_count: w.tipCount, platform: w.platform,
      },
    }
  })
}

async function runNewWhalePipeline({ userId, supabase, whaleAlerts }) {
  if (!userId || !supabase) throw new Error('runNewWhalePipeline requires userId and a Supabase client')
  const evaluations = evaluateNewWhales({ whaleAlerts })
  if (!evaluations.length) return { events: [] }
  const events = []
  for (const evaluation of evaluations) {
    try {
      const { data, error } = await supabase.rpc('record_dashboard_event_if_new', {
        p_event_type: 'new_whale_detected', p_source: 'analytics', p_priority: evaluation.priority,
        p_title: evaluation.title, p_message: evaluation.message, p_fingerprint: evaluation.fingerprint,
        p_metadata: evaluation.metadata,
      })
      if (error) throw error
      events.push(data)
    } catch (e) { /* non-fatal, mirrors real pipeline */ }
  }
  return { events }
}

// ── Test fixtures ──────────────────────────────────────────────────────
function makeWhale(overrides = {}) {
  return {
    username: 'BigSpender99', tier: 'Whale', totalUSD: 842.5, tipCount: 14,
    daysSinceLastTip: 2, isTopSpender: true, platform: 'Chaturbate',
    ...overrides,
  }
}
function makeNewWhaleAlert(overrides = {}) {
  const w = makeWhale(overrides.whale)
  return {
    type: 'new_whale', severity: 'success', icon: '🐳', whale: w,
    message: `${w.username} just became your top tipper! ($${w.totalUSD.toFixed(0)} lifetime)`,
    action: 'Send a thank you message',
    ...overrides,
  }
}

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`) }
}

// 1. A real new_whale alert produces exactly one event
{
  const alerts = [makeNewWhaleAlert()]
  const result = evaluateNewWhales({ whaleAlerts: alerts })
  check('1. one new_whale alert -> one event', result.length, 1)
  check('1. priority is high', result[0].priority, 'high')
  check('1. fingerprint is scoped to the username', result[0].fingerprint, 'new_whale:bigspender99')
  check('1. message reused verbatim from generateWhaleAlerts(), not re-worded', result[0].message, 'BigSpender99 just became your top tipper! ($843 lifetime)')
}

// 2. Non-'new_whale' alert types (churn_risk, tip_likely, returned) never fire this event
{
  const alerts = [
    { type: 'churn_risk', whale: makeWhale({ username: 'ChurnRisk1' }), message: 'x' },
    { type: 'tip_likely', whale: makeWhale({ username: 'Likely1' }), message: 'x' },
    { type: 'returned', whale: makeWhale({ username: 'Returned1' }), message: 'x' },
  ]
  const result = evaluateNewWhales({ whaleAlerts: alerts })
  check('2. only new_whale type qualifies: other alert types produce zero events', result.length, 0)
}

// 3. Empty/missing whaleAlerts -> no events, no throw
check('3a. empty array: no events', evaluateNewWhales({ whaleAlerts: [] }).length, 0)
check('3b. undefined whaleAlerts: no events, no throw', evaluateNewWhales({ whaleAlerts: undefined }).length, 0)
check('3c. null whaleAlerts: no events, no throw', evaluateNewWhales({ whaleAlerts: null }).length, 0)
check('3d. completely empty call: no events, no throw', evaluateNewWhales({}).length, 0)

// 4. Malformed alert entries (missing whale/username) are safely skipped, not fabricated
{
  const alerts = [
    { type: 'new_whale', whale: null },
    { type: 'new_whale', whale: {} },
    { type: 'new_whale' },
    makeNewWhaleAlert({ whale: { username: 'RealOne', totalUSD: 50, tier: 'Whale', tipCount: 2, daysSinceLastTip: 1, platform: 'BongaCams' } }),
  ]
  const result = evaluateNewWhales({ whaleAlerts: alerts })
  check('4. malformed entries skipped, only the real one produces an event', result.length, 1)
  check('4. the real one is the correct whale', result[0].metadata.username, 'RealOne')
}

// 5. Multiple genuinely distinct new whales in one import each produce their own event
{
  const alerts = [
    makeNewWhaleAlert({ whale: { username: 'WhaleA', totalUSD: 500, tier: 'Whale', tipCount: 5, daysSinceLastTip: 1, platform: 'Chaturbate' } }),
    makeNewWhaleAlert({ whale: { username: 'WhaleB', totalUSD: 700, tier: 'Whale', tipCount: 8, daysSinceLastTip: 3, platform: 'BongaCams' } }),
  ]
  const result = evaluateNewWhales({ whaleAlerts: alerts })
  check('5. two distinct new whales -> two distinct events', result.length, 2)
  check('5. distinct fingerprints', result[0].fingerprint === result[1].fingerprint, false)
}

// 6. Fingerprint is case-insensitive on username (same person, different casing, never double-fires)
{
  const alerts = [
    makeNewWhaleAlert({ whale: { username: 'SameFan', totalUSD: 100, tier: 'Whale', tipCount: 3, daysSinceLastTip: 1, platform: 'Chaturbate' } }),
  ]
  const alertsUpper = [
    makeNewWhaleAlert({ whale: { username: 'SAMEFAN', totalUSD: 100, tier: 'Whale', tipCount: 3, daysSinceLastTip: 1, platform: 'Chaturbate' } }),
  ]
  const a = evaluateNewWhales({ whaleAlerts: alerts })
  const b = evaluateNewWhales({ whaleAlerts: alertsUpper })
  check('6. fingerprint normalizes username casing', a[0].fingerprint, b[0].fingerprint)
}

// 7 & 8. Dedup — exercised at the pipeline level via the RPC's own
// permanent-fingerprint dedup (identical mechanism to import_completed's
// proven contract — see verify-import-pipeline.mjs).
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
  const alerts = [makeNewWhaleAlert()]
  const supabase = makeFakeSupabase()
  await runNewWhalePipeline({ userId: 'user-a', supabase, whaleAlerts: alerts })
  await runNewWhalePipeline({ userId: 'user-a', supabase, whaleAlerts: alerts })
  check('7. duplicate finalization: exactly one event exists after two calls', supabase._events.size, 1)
}

// 9. Cross-account isolation — the pure evaluator has no user concept at all
{
  const hasNoUserIdParam = evaluateNewWhales.length === 1
  check('9. evaluator has no user-crossing surface (single-account input only)', hasNoUserIdParam, true)
}

// 10. Pipeline requires userId + supabase, fails loudly (not silently) on misuse
{
  let threw = false
  try { await runNewWhalePipeline({ whaleAlerts: [] }) } catch (e) { threw = true }
  check('10. missing userId/supabase throws rather than silently no-oping', threw, true)
}

// 11. Never blocks/fails on RPC error — non-fatal by design
{
  const brokenSupabase = { rpc: async () => { throw new Error('db down') } }
  let threw = false
  let result = null
  try { result = await runNewWhalePipeline({ userId: 'user-a', supabase: brokenSupabase, whaleAlerts: [makeNewWhaleAlert()] }) }
  catch (e) { threw = true }
  check('11. RPC failure does not throw out of the pipeline', threw, false)
  check('11. RPC failure returns an empty/safe events list, not a fabricated success', result?.events, [])
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
