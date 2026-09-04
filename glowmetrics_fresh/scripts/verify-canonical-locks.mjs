// Standalone verification for lib/intelligence/locks.js (Phase 2C-1).
//
// Same convention as the other verify-*.mjs scripts: no test framework in this
// repo, so the rules under test are mirrored here and run against constructed
// intelligence fixtures. Keep in sync with lib/intelligence/locks.js.
//
// What this asserts:
//   1. Every legacy gate key resolves to a canonical insight + ladder floor.
//      No gate key carries a counter threshold of its own.
//   2. A gate is open iff its insight is at or above its floor.
//   3. Lock messages are generated from the insight's own nextMilestone, so
//      the UI can never quote a requirement that no longer governs the gate.
//   4. Readiness is derived from ladder positions, never from tips/fans/$.
//   5. Plan gating (Pro) still wins over data gating, and Money Map / Stream
//      Planner are never paywalled.
//   6. Live Mode Score is the only non-analytics data gate that remains.

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`) }
}

// ── mirrored from lib/intelligence/states.js ────────────────────────────────
const S = {
  NOT_AVAILABLE: 'NOT_AVAILABLE', CALIBRATING: 'CALIBRATING', EARLY_SIGNAL: 'EARLY_SIGNAL',
  DEVELOPING: 'DEVELOPING', SUPPORTED: 'SUPPORTED', HIGH_CONFIDENCE: 'HIGH_CONFIDENCE',
  ESTABLISHED: 'ESTABLISHED',
}
const ORDER = [S.NOT_AVAILABLE, S.CALIBRATING, S.EARLY_SIGNAL, S.DEVELOPING, S.SUPPORTED, S.HIGH_CONFIDENCE, S.ESTABLISHED]
const rank = s => { const i = ORDER.indexOf(s); return i === -1 ? 0 : i }
const atLeast = (s, f) => rank(s) >= rank(f)
const CLAIMABLE_FLOOR = S.SUPPORTED

// ── mirrored from lib/intelligence/locks.js ─────────────────────────────────
const GATE_MAP = {
  bestStreamingTimes:     { insight: 'peak_window',     floor: CLAIMABLE_FLOOR, label: 'Peak Earning Windows' },
  streamPlanner:          { insight: 'peak_window',     floor: CLAIMABLE_FLOOR, label: 'Stream Planner' },
  crossPlatformBestTimes: { insight: 'cross_platform',  floor: CLAIMABLE_FLOOR, label: 'Cross-Platform Best Times' },
  avgHourlyRate:          { insight: 'hourly_rate',     floor: S.EARLY_SIGNAL,  label: 'Average $/Hour' },
  averageHourly:          { insight: 'hourly_rate',     floor: S.EARLY_SIGNAL,  label: 'Average $/Hour' },
  sessionBreakdown:       { insight: 'session_history', floor: CLAIMABLE_FLOOR, label: 'Session Breakdown' },
  sessionPerformance:     { insight: 'session_history', floor: CLAIMABLE_FLOOR, label: 'Session Performance' },
  topFans:                { insight: 'top_supporters',  floor: S.EARLY_SIGNAL,  label: 'Top Fans' },
  whales:                 { insight: 'top_supporters',  floor: CLAIMABLE_FLOOR, label: 'Fan value ranking' },
  fanRecovery:            { insight: 'churn_risk',      floor: CLAIMABLE_FLOOR, label: 'Fan Recovery' },
  retention:              { insight: 'churn_risk',      floor: CLAIMABLE_FLOOR, label: 'Retention' },
  platformROI:            { insight: 'cross_platform',  floor: CLAIMABLE_FLOOR, label: 'Platform ROI' },
  platformComparison:     { insight: 'cross_platform',  floor: CLAIMABLE_FLOOR, label: 'Platform Comparison' },
  moneyMap:               { insight: 'money_map',       floor: CLAIMABLE_FLOOR, label: 'Money Map' },
  forecasting:            { insight: 'forecast',        floor: S.DEVELOPING,    label: 'Forecasting' },
}
const READINESS_INSIGHTS = ['peak_window', 'hourly_rate', 'top_supporters']
const stateOf = (intel, id) => intel?.insights?.[id]?.state || S.NOT_AVAILABLE
const gateOpen = (intel, key) => {
  const g = GATE_MAP[key]
  if (!g) return true
  return atLeast(stateOf(intel, g.insight), g.floor)
}
function lockMessage(intel, key) {
  const g = GATE_MAP[key]
  if (!g) return null
  const step = intel?.insights?.[g.insight]?.nextMilestone?.label
  return step ? `${g.label} unlocks after ${step}.`
    : `${g.label} unlocks once CamCash has enough evidence to state it.`
}
function resolveReadiness(intel) {
  const hasData = rank(stateOf(intel, 'earnings_total')) > rank(S.NOT_AVAILABLE)
  if (!hasData) return 'setup'
  const states = READINESS_INSIGHTS.map(id => stateOf(intel, id))
  const anySignal = states.some(s => atLeast(s, S.EARLY_SIGNAL))
  const claimable = states.filter(s => atLeast(s, CLAIMABLE_FLOOR)).length
  if (!anySignal) return 'building'
  if (claimable === 0) return 'starter'
  if (claimable < states.length) return 'warming'
  return 'ready'
}
function planLock(key, { isPro, platformCount, FREE_MAX_PLATFORMS = 3 }) {
  if (key === 'multiPlatformTracking' && !isPro && platformCount >= FREE_MAX_PLATFORMS) {
    return { locked: true, lockType: 'requires_pro', message: `Free tracks up to ${FREE_MAX_PLATFORMS} platforms. Upgrade to Pro to add more.` }
  }
  if ((key === 'platformComparison' || key === 'platformROI' || key === 'crossPlatformBestTimes') && !isPro) {
    return { locked: true, lockType: 'requires_pro', message: 'Upgrade to Pro to compare earnings across platforms.' }
  }
  return null
}
function liveScoreLock(n) {
  return n < 1
    ? { locked: true, lockType: 'needs_data', message: 'Unlocks after your first Live Mode stream.' }
    : { locked: false, lockType: null, message: null }
}
function moduleLock({ module, isPro = false, importedPlatformCount = 0, liveModeSessions = 0, intel }) {
  if (module === 'liveScore') return liveScoreLock(liveModeSessions)
  const pro = planLock(module, { isPro, platformCount: importedPlatformCount })
  if (pro) return pro
  if (module === 'multiPlatformTracking') return { locked: false, lockType: null, message: null }
  if (!GATE_MAP[module]) return { locked: false, lockType: null, message: null }
  if (gateOpen(intel, module)) return { locked: false, lockType: null, message: null }
  return { locked: true, lockType: 'needs_data', message: lockMessage(intel, module) }
}

// ── fixtures ────────────────────────────────────────────────────────────────
const mk = (states, extra = {}) => ({
  insights: Object.fromEntries(Object.entries(states).map(([id, state]) => [id, { state, ...(extra[id] || {}) }])),
})
const EMPTY = mk({})
const FRESH = mk({ earnings_total: S.ESTABLISHED, session_history: S.DEVELOPING, peak_window: S.CALIBRATING, hourly_rate: S.CALIBRATING, top_supporters: S.CALIBRATING })
const EARLY = mk({ earnings_total: S.ESTABLISHED, session_history: S.ESTABLISHED, peak_window: S.EARLY_SIGNAL, hourly_rate: S.EARLY_SIGNAL, top_supporters: S.EARLY_SIGNAL })
const MID   = mk({ earnings_total: S.ESTABLISHED, session_history: S.ESTABLISHED, peak_window: S.SUPPORTED, hourly_rate: S.EARLY_SIGNAL, top_supporters: S.SUPPORTED, cross_platform: S.EARLY_SIGNAL, churn_risk: S.DEVELOPING, money_map: S.SUPPORTED, forecast: S.CALIBRATING })
const FULL  = mk({ earnings_total: S.ESTABLISHED, session_history: S.ESTABLISHED, peak_window: S.HIGH_CONFIDENCE, hourly_rate: S.HIGH_CONFIDENCE, top_supporters: S.HIGH_CONFIDENCE, cross_platform: S.SUPPORTED, churn_risk: S.SUPPORTED, money_map: S.SUPPORTED, forecast: S.SUPPORTED })

console.log('\n1. Every gate key maps to a canonical insight + ladder floor')
const KNOWN_INSIGHTS = new Set(['peak_window','cross_platform','hourly_rate','session_history','top_supporters','churn_risk','money_map','forecast'])
for (const [key, g] of Object.entries(GATE_MAP)) {
  check(`${key} -> known insight`, KNOWN_INSIGHTS.has(g.insight), true)
  check(`${key} -> real ladder floor`, ORDER.includes(g.floor), true)
}

console.log('\n2. A gate is open iff its insight is at or above its floor')
check('bestStreamingTimes closed at EARLY_SIGNAL', gateOpen(EARLY, 'bestStreamingTimes'), false)
check('bestStreamingTimes open at SUPPORTED',      gateOpen(MID,   'bestStreamingTimes'), true)
check('streamPlanner tracks the same insight',     gateOpen(MID,   'streamPlanner'), true)
check('avgHourlyRate open at EARLY_SIGNAL',        gateOpen(EARLY, 'avgHourlyRate'), true)
check('avgHourlyRate closed at CALIBRATING',       gateOpen(FRESH, 'avgHourlyRate'), false)
check('topFans open at EARLY_SIGNAL',              gateOpen(EARLY, 'topFans'), true)
check('whales still closed at EARLY_SIGNAL',       gateOpen(EARLY, 'whales'), false)
check('whales open once ranking is claimable',     gateOpen(MID,   'whales'), true)
check('sessionPerformance closed at DEVELOPING',   gateOpen(FRESH, 'sessionPerformance'), false)
check('sessionPerformance open at ESTABLISHED',    gateOpen(EARLY, 'sessionPerformance'), true)
check('retention closed while churn is DEVELOPING',gateOpen(MID,   'retention'), false)
check('retention open at SUPPORTED',               gateOpen(FULL,  'retention'), true)
check('moneyMap open at SUPPORTED',                gateOpen(MID,   'moneyMap'), true)
check('forecasting closed at CALIBRATING',         gateOpen(MID,   'forecasting'), false)
check('forecasting open at SUPPORTED',             gateOpen(FULL,  'forecasting'), true)
check('unknown key is never gated',                gateOpen(EMPTY, 'somethingElse'), true)

console.log('\n3. Messages come from the insight, never from a hard-coded threshold')
const WITH_STEP = mk({ peak_window: S.EARLY_SIGNAL }, { peak_window: { nextMilestone: { label: '2 more sessions in this window' } } })
check('message quotes the canonical next step', lockMessage(WITH_STEP, 'bestStreamingTimes'),
  'Peak Earning Windows unlocks after 2 more sessions in this window.')
check('message falls back without inventing a number', lockMessage(EARLY, 'bestStreamingTimes'),
  'Peak Earning Windows unlocks once CamCash has enough evidence to state it.')
check('no message contains a bare tip threshold',
  Object.keys(GATE_MAP).every(k => !/\d+\+? tips/.test(lockMessage(EARLY, k) || '')), true)

console.log('\n4. Readiness is a ladder position, not a counter')
check('no data -> setup',                 resolveReadiness(EMPTY), 'setup')
check('data but no signal -> building',   resolveReadiness(FRESH), 'building')
check('signal but nothing claimable -> starter', resolveReadiness(EARLY), 'starter')
check('some claimable -> warming',        resolveReadiness(MID),   'warming')
check('all claimable -> ready',           resolveReadiness(FULL),  'ready')
check('readiness ignores earnings size',
  resolveReadiness(mk({ earnings_total: S.ESTABLISHED, peak_window: S.HIGH_CONFIDENCE, hourly_rate: S.HIGH_CONFIDENCE, top_supporters: S.HIGH_CONFIDENCE })), 'ready')

console.log('\n5. Plan gating wins; Money Map and Stream Planner are never paywalled')
check('free user: platformComparison is a Pro lock',
  moduleLock({ module: 'platformComparison', isPro: false, intel: FULL }).lockType, 'requires_pro')
check('pro user: platformComparison falls through to data gate',
  moduleLock({ module: 'platformComparison', isPro: true, intel: MID }).lockType, 'needs_data')
check('pro user with 2 qualifying platforms is open',
  moduleLock({ module: 'platformROI', isPro: true, intel: FULL }).locked, false)
check('moneyMap is never requires_pro',
  moduleLock({ module: 'moneyMap', isPro: false, intel: FRESH }).lockType, 'needs_data')
check('streamPlanner is never requires_pro',
  moduleLock({ module: 'streamPlanner', isPro: false, intel: FRESH }).lockType, 'needs_data')
check('free user under the platform limit is not blocked',
  moduleLock({ module: 'multiPlatformTracking', isPro: false, importedPlatformCount: 2, intel: FULL }).locked, false)
check('free user at the platform limit is blocked',
  moduleLock({ module: 'multiPlatformTracking', isPro: false, importedPlatformCount: 3, intel: FULL }).lockType, 'requires_pro')

console.log('\n6. Live Mode Score is the only remaining non-analytics data gate')
check('locked with zero live sessions', moduleLock({ module: 'liveScore', liveModeSessions: 0, intel: EMPTY }).lockType, 'needs_data')
check('open after one live session',    moduleLock({ module: 'liveScore', liveModeSessions: 1, intel: EMPTY }).locked, false)
check('liveScore is not in GATE_MAP',   'liveScore' in GATE_MAP, false)

console.log(`\n  ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
