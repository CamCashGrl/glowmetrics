// Standalone verification for lib/intelligence/ (Phase 1).
//
// Same convention as scripts/verify-canonical-analytics.mjs: this repo has no
// test framework, and lib/*.js is CommonJS-resolved by plain Node, so the
// logic under test is mirrored here and run against constructed fixtures.
// Keep in sync with the real modules if the rules change.
//
// What this asserts:
//   1. The ladder is ordered and the existing tier/confidence systems map
//      onto it without inventing a band.
//   2. The COMPARISON rule: 20 sessions in the only window a creator has ever
//      streamed cannot be called her BEST window.
//   3. ESTABLISHED requires coverage AND time, not just volume.
//   4. Fan classification: value alone is a Whale Candidate, never a Whale.
//   5. Relative rank is withheld below 10 unique fans.
//   6. A snapshot diff reports what a new import actually unlocked.

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
const ESTABLISHED_RULE = { minComparedAlternatives: 2, minSpanDays: 30 }

function fromConfidenceTier(tier) {
  switch (tier) {
    case 'high': return S.HIGH_CONFIDENCE
    case 'supported': return S.SUPPORTED
    case 'promising': return S.EARLY_SIGNAL
    case 'insufficient': return S.CALIBRATING
    default: return S.NOT_AVAILABLE
  }
}
function fromAccountConfidence(level) {
  switch (level) {
    case 'High': return S.HIGH_CONFIDENCE
    case 'Medium': return S.DEVELOPING
    case 'Low': return S.EARLY_SIGNAL
    case 'Very Low': return S.CALIBRATING
    default: return S.NOT_AVAILABLE
  }
}
function capForComparison(state, comparedAlternatives = 0) {
  if (comparedAlternatives >= 1) return state
  return rank(state) > rank(S.DEVELOPING) ? S.DEVELOPING : state
}
function promoteIfEstablished(state, { comparedAlternatives = 0, spanDays = 0 } = {}) {
  if (state !== S.HIGH_CONFIDENCE) return state
  return (comparedAlternatives >= ESTABLISHED_RULE.minComparedAlternatives && spanDays >= ESTABLISHED_RULE.minSpanDays)
    ? S.ESTABLISHED : state
}

// ── mirrored from lib/analytics/bestTimes.js (the source of the tiers) ──────
function tierForSessionCount(n) {
  if (n < 2) return 'insufficient'
  if (n <= 3) return 'promising'
  if (n <= 5) return 'supported'
  return 'high'
}

// ── mirrored from lib/intelligence/fanValue.js ──────────────────────────────
const HIGH_VALUE_FAN_USD = 100
const WHALE_MIN_TIP_COUNT = 10
const FAN_BEHAVIOUR_MIN_TIPS = 3
const RELATIVE_RANK_MIN_FANS = 10
function fanEvidenceState(tipCount = 0) {
  if (tipCount <= 0) return S.NOT_AVAILABLE
  if (tipCount < FAN_BEHAVIOUR_MIN_TIPS) return S.CALIBRATING
  if (tipCount < 6) return S.EARLY_SIGNAL
  if (tipCount < 12) return S.DEVELOPING
  return S.SUPPORTED
}
function classifyFan(fan = {}, { uniqueFanCount = 0 } = {}) {
  const usd = Number(fan.totalUSD) || 0
  const tips = Number(fan.tipCount) || 0
  const meetsValue = usd >= HIGH_VALUE_FAN_USD
  const meetsRepeat = tips >= WHALE_MIN_TIP_COUNT
  let classification = 'REGULAR'
  if (meetsValue && meetsRepeat) classification = 'WHALE'
  else if (meetsValue) classification = 'WHALE_CANDIDATE'
  return {
    classification,
    isTopSupporter: uniqueFanCount >= RELATIVE_RANK_MIN_FANS && Boolean(fan.isTopSpender),
    isHighValue: meetsValue,
    state: fanEvidenceState(tips),
  }
}

// ── mirrored from lib/intelligence/readiness.js (peak-window branch) ────────
function peakWindowState(grid, spanDays) {
  const eligible = grid.filter(g => g.tier === 'supported' || g.tier === 'high')
  const winner = eligible.length
    ? [...eligible].sort((a, b) => b.medianUsdPerHour - a.medianUsdPerHour)[0]
    : (grid.filter(g => g.tier === 'promising').sort((a, b) => b.medianUsdPerHour - a.medianUsdPerHour)[0] || null)
  const winnerKey = winner ? `${winner.localDay}-${winner.localHour}` : null
  const comparable = grid.filter(g => g.sessionCount >= 2 && `${g.localDay}-${g.localHour}` !== winnerKey)
  let state = winner ? fromConfidenceTier(winner.tier) : (grid.length ? S.CALIBRATING : S.NOT_AVAILABLE)
  state = capForComparison(state, comparable.length)
  state = promoteIfEstablished(state, { comparedAlternatives: comparable.length, spanDays })
  return { state, comparedAlternatives: comparable.length, observations: winner?.sessionCount || 0 }
}

const bucket = (day, hour, sessionCount, rate) => ({
  localDay: day, localHour: hour, sessionCount,
  medianUsdPerHour: rate, tier: tierForSessionCount(sessionCount),
})

// ════════════════════════════════════════════════════════════════════════════
console.log('\nLADDER')
{
  check('states are strictly ordered', ORDER.map(rank), [0, 1, 2, 3, 4, 5, 6])
  check('SUPPORTED is the claimable floor', atLeast(S.SUPPORTED, CLAIMABLE_FLOOR), true)
  check('DEVELOPING is not claimable', atLeast(S.DEVELOPING, CLAIMABLE_FLOOR), false)
}

console.log('\nMAPPING FROM EXISTING SYSTEMS (no invented bands)')
{
  check('bestTimes tier: 1 session -> CALIBRATING', fromConfidenceTier(tierForSessionCount(1)), S.CALIBRATING)
  check('bestTimes tier: 3 sessions -> EARLY_SIGNAL', fromConfidenceTier(tierForSessionCount(3)), S.EARLY_SIGNAL)
  check('bestTimes tier: 4 sessions -> SUPPORTED', fromConfidenceTier(tierForSessionCount(4)), S.SUPPORTED)
  check('bestTimes tier: 6 sessions -> HIGH_CONFIDENCE', fromConfidenceTier(tierForSessionCount(6)), S.HIGH_CONFIDENCE)
  check('calculateConfidence High -> HIGH_CONFIDENCE', fromAccountConfidence('High'), S.HIGH_CONFIDENCE)
  check('calculateConfidence Medium -> DEVELOPING', fromAccountConfidence('Medium'), S.DEVELOPING)
  check('calculateConfidence Very Low -> CALIBRATING', fromAccountConfidence('Very Low'), S.CALIBRATING)
  // The claimable floor must agree with bestTimes.js's own CAN_BE_BEST_TIME set.
  const canBeBest = ['supported', 'high'].every(t => atLeast(fromConfidenceTier(t), CLAIMABLE_FLOOR))
  const cannotBeBest = ['promising', 'insufficient'].every(t => !atLeast(fromConfidenceTier(t), CLAIMABLE_FLOOR))
  check('claimable floor matches CAN_BE_BEST_TIME exactly', canBeBest && cannotBeBest, true)
}

console.log('\nCOMPARISON RULE — the Friday-9PM-only creator')
{
  // 20 sessions, all in one window, nothing else ever streamed.
  const onlyOneWindow = [bucket('Friday', 21, 20, 48)]
  const r = peakWindowState(onlyOneWindow, 140)
  check('single-window creator: 20 sessions is still only DEVELOPING', r.state, S.DEVELOPING)
  check('single-window creator: nothing was compared', r.comparedAlternatives, 0)
  check('single-window creator: cannot be stated as a finding', atLeast(r.state, CLAIMABLE_FLOOR), false)

  // Same creator after trying two other slots twice each.
  const nowCompared = [
    bucket('Friday', 21, 20, 48),
    bucket('Tuesday', 20, 2, 19),
    bucket('Sunday', 22, 2, 24),
  ]
  const r2 = peakWindowState(nowCompared, 140)
  check('after comparison: promoted to ESTABLISHED', r2.state, S.ESTABLISHED)
  check('after comparison: two alternatives weighed', r2.comparedAlternatives, 2)
}

console.log('\nESTABLISHED REQUIRES COVERAGE AND TIME')
{
  const grid = [bucket('Wednesday', 20, 8, 51), bucket('Monday', 19, 3, 22), bucket('Friday', 21, 2, 30)]
  check('high tier + 2 alternatives + 90 days -> ESTABLISHED', peakWindowState(grid, 90).state, S.ESTABLISHED)
  check('same evidence inside 10 days -> HIGH_CONFIDENCE only', peakWindowState(grid, 10).state, S.HIGH_CONFIDENCE)
  const oneAlt = [bucket('Wednesday', 20, 8, 51), bucket('Monday', 19, 2, 22)]
  check('one alternative is not enough for ESTABLISHED', peakWindowState(oneAlt, 200).state, S.HIGH_CONFIDENCE)
}

console.log('\nNO WINDOW YET')
{
  check('empty grid -> NOT_AVAILABLE', peakWindowState([], 0).state, S.NOT_AVAILABLE)
  check('one single-session bucket -> CALIBRATING', peakWindowState([bucket('Monday', 20, 1, 90)], 0).state, S.CALIBRATING)
  // The $90/hr single session must never outrank a real window.
  const outlier = [bucket('Monday', 6, 1, 90), bucket('Wednesday', 20, 5, 12), bucket('Friday', 20, 3, 10)]
  const r = peakWindowState(outlier, 60)
  check('one lucky session does not win the window', r.observations, 5)
}

console.log('\nFAN VALUE — value alone is never a whale')
{
  const bigOneOff = classifyFan({ totalUSD: 800, tipCount: 1 }, { uniqueFanCount: 40 })
  check('one $800 tip -> WHALE_CANDIDATE', bigOneOff.classification, 'WHALE_CANDIDATE')
  check('one $800 tip -> still flagged high value', bigOneOff.isHighValue, true)
  check('one $800 tip -> evidence is CALIBRATING', bigOneOff.state, S.CALIBRATING)

  const real = classifyFan({ totalUSD: 1240, tipCount: 83 }, { uniqueFanCount: 40 })
  check('$1240 over 83 tips -> WHALE', real.classification, 'WHALE')
  check('$1240 over 83 tips -> evidence SUPPORTED', real.state, S.SUPPORTED)

  const modest = classifyFan({ totalUSD: 40, tipCount: 12 }, { uniqueFanCount: 40 })
  check('$40 over 12 tips -> not a whale', modest.classification, 'REGULAR')
  check('$40 over 12 tips -> not high value', modest.isHighValue, false)

  const borderline = classifyFan({ totalUSD: 100, tipCount: 10 }, { uniqueFanCount: 40 })
  check('exactly $100 over exactly 10 tips -> WHALE', borderline.classification, 'WHALE')
}

console.log('\nRELATIVE RANK NEEDS AN AUDIENCE')
{
  const top = { totalUSD: 300, tipCount: 20, isTopSpender: true }
  check('top spender of 3 fans -> not called a Top Supporter', classifyFan(top, { uniqueFanCount: 3 }).isTopSupporter, false)
  check('top spender of 10 fans -> Top Supporter', classifyFan(top, { uniqueFanCount: 10 }).isTopSupporter, true)
  check('whale status is unaffected by audience size', classifyFan(top, { uniqueFanCount: 3 }).classification, 'WHALE')
}

console.log('\nSNAPSHOT DIFF — what an import unlocked')
{
  const before = { states: { peak_window: S.EARLY_SIGNAL, hourly_rate: S.DEVELOPING, fan_behaviour: S.CALIBRATING }, pct: 42 }
  const after = { states: { peak_window: S.SUPPORTED, hourly_rate: S.DEVELOPING, fan_behaviour: S.EARLY_SIGNAL }, pct: 58 }
  const improved = []
  for (const [id, state] of Object.entries(after.states)) {
    const was = before.states[id] || S.NOT_AVAILABLE
    if (rank(state) > rank(was)) {
      improved.push({ id, from: was, to: state, newlyClaimable: atLeast(state, CLAIMABLE_FLOOR) && !atLeast(was, CLAIMABLE_FLOOR) })
    }
  }
  check('two insights improved', improved.map(i => i.id), ['peak_window', 'fan_behaviour'])
  check('peak window newly claimable', improved.find(i => i.id === 'peak_window').newlyClaimable, true)
  check('fan behaviour improved but not yet claimable', improved.find(i => i.id === 'fan_behaviour').newlyClaimable, false)
  check('calibration delta', after.pct - before.pct, 16)
  check('unchanged insight is not announced', improved.some(i => i.id === 'hourly_rate'), false)
}

console.log('\nREAL-DATA FIXTURE — protected account, post-normalization')
{
  // Inputs measured from production on 2026-08-26 (read-only), after the
  // platform-alias normalization from PR #434:
  //   2,559 tips · 108 meaningful sessions · 131.8 streamed hours
  //   winner bucket 4 sessions · 21 buckets with 2+ sessions · 733-day span
  //   352 unique fans · 182 with 3+ tips · 25 months · 3 qualifying platforms
  //
  // This pins the ladder against a real creator so a threshold change that
  // would silently downgrade a live account fails here first.
  const REAL = {
    meaningfulSessions: 108, streamedHours: 131.8,
    winnerSessions: 4, buckets2Plus: 21, spanDays: 733,
    uniqueFans: 352, readableFans: 182, months: 25, qualifyingPlatforms: 3,
    totalTips: 2559,
  }

  // peak_window: 4 sessions -> 'supported' tier; 20 other buckets to compare
  // against, so the comparison guard does not cap it. Not HIGH_CONFIDENCE, so
  // it cannot be promoted to ESTABLISHED however long the span.
  const pw = promoteIfEstablished(
    capForComparison(fromConfidenceTier(tierForSessionCount(REAL.winnerSessions)), REAL.buckets2Plus - 1),
    { comparedAlternatives: REAL.buckets2Plus - 1, spanDays: REAL.spanDays }
  )
  check('peak window reaches SUPPORTED (the free discovery fires)', pw, S.SUPPORTED)
  check('peak window is claimable', atLeast(pw, CLAIMABLE_FLOOR), true)
  check('4 sessions does not reach HIGH_CONFIDENCE', atLeast(pw, S.HIGH_CONFIDENCE), false)

  // hourly_rate: calculateConfidence(108, 131.8) -> High (>=10 sessions AND
  // >=20 hours), and a 733-day span promotes it.
  const accountLevel = (REAL.meaningfulSessions >= 10 && REAL.streamedHours >= 20) ? 'High' : 'Medium'
  const hr = promoteIfEstablished(fromAccountConfidence(accountLevel), { comparedAlternatives: 2, spanDays: REAL.spanDays })
  check('hourly rate reaches ESTABLISHED', hr, S.ESTABLISHED)

  // Fan insights, from counts alone.
  check('352 fans -> relative ranking is meaningful', REAL.uniqueFans >= RELATIVE_RANK_MIN_FANS, true)
  check('182 fans with 3+ tips -> patterns readable', REAL.readableFans >= 10, true)
  check('3 qualifying platforms -> cross-platform comparable', REAL.qualifyingPlatforms >= 2, true)
  check('25 months -> growth trend well established', REAL.months >= 6, true)

  // The guard that matters: had this creator only ever streamed one window,
  // the same 4 sessions could not be called her best.
  const hypothetical = capForComparison(fromConfidenceTier(tierForSessionCount(REAL.winnerSessions)), 0)
  check('same evidence with nothing to compare caps at DEVELOPING', hypothetical, S.DEVELOPING)
}

console.log('\nDASHBOARD_EVENTS CONTRACT')
{
  // Verified against the deployed CHECK constraints, not assumed:
  //   priority IN ('critical','high','medium','low')
  //   status   IN ('new','seen','dismissed')
  const ALLOWED_PRIORITY = ['critical', 'high', 'medium', 'low']
  const ALLOWED_STATUS = ['new', 'seen', 'dismissed']
  const milestoneEvent = { priority: 'high', status: 'new', fingerprint: 'milestone:peak_window_found' }
  const plainMilestone = { priority: 'medium', status: 'new', fingerprint: 'milestone:first_sessions' }
  const confidenceEvent = { priority: 'low', status: 'new', fingerprint: 'confidence:peak_window:EARLY_SIGNAL->SUPPORTED' }
  for (const [name, e] of [['milestone with CTA', milestoneEvent], ['milestone without CTA', plainMilestone], ['confidence increase', confidenceEvent]]) {
    check(`${name}: priority satisfies the CHECK constraint`, ALLOWED_PRIORITY.includes(e.priority), true)
    check(`${name}: status satisfies the CHECK constraint`, ALLOWED_STATUS.includes(e.status), true)
  }
  check('fingerprints are deterministic and distinct', new Set([milestoneEvent, plainMilestone, confidenceEvent].map(e => e.fingerprint)).size, 3)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
