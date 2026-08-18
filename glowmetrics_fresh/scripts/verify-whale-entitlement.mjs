// Regression tests for app/api/insights/whales/route.js — closes the audit
// checklist's "premium fan intelligence... verify server-side" item. Proves
// the computed whale intelligence layer (churnRisk, tipProbability,
// lifetimeValue, expectedNextTip) never reaches a Free response, while the
// already-free basic top-3 identity is never MORE restricted than the
// current product. Same mirror-logic convention as the repo's other
// verify-*.mjs scripts.

function redact({ isPro, category, summary, count, data }) {
  if (!isPro) return { unlocked: false, preview: { category, summary, count } }
  return { unlocked: true, data }
}

const FREE_WHALE_COUNT = 3
function basicShape(w) { return { username: w.username, totalUSD: w.totalUSD, tipCount: w.tipCount, tier: w.tier } }

function buildWhalesResponse(isPro, whales) {
  const hiddenCount = Math.max(whales.length - FREE_WHALE_COUNT, 0)
  const topFansBasic = whales.slice(0, FREE_WHALE_COUNT).map(basicShape)
  const fans = redact({
    isPro, category: 'fan_intelligence',
    summary: hiddenCount > 0 ? `You have ${hiddenCount} more fans with intelligence.` : 'Not enough fan history yet.',
    count: hiddenCount,
    data: whales.map(w => ({ ...basicShape(w), churnRisk: w.churnRisk, tipProbability: w.tipProbability, lifetimeValue: w.lifetimeValue, expectedNextTip: w.expectedNextTip })),
  })
  return { topFansBasic, fans }
}

let pass = 0, fail = 0
function check(name, cond) { if (cond) { pass++; console.log(`PASS  ${name}`) } else { fail++; console.log(`FAIL  ${name}`) } }

const WHALES = [
  { username: 'whale1', totalUSD: 500, tipCount: 20, tier: 'Whale', churnRisk: { level: 'Low' }, tipProbability: { level: 'High', percentage: 80 }, lifetimeValue: 900, expectedNextTip: '2026-08-16' },
  { username: 'whale2', totalUSD: 300, tipCount: 15, tier: 'Whale', churnRisk: { level: 'Medium' }, tipProbability: { level: 'Medium', percentage: 50 }, lifetimeValue: 600, expectedNextTip: '2026-08-18' },
  { username: 'shark1', totalUSD: 150, tipCount: 10, tier: 'Shark', churnRisk: { level: 'High' }, tipProbability: { level: 'Low', percentage: 20 }, lifetimeValue: 250, expectedNextTip: '2026-08-25' },
  { username: 'shark2', totalUSD: 100, tipCount: 8, tier: 'Shark', churnRisk: { level: 'Critical' }, tipProbability: { level: 'Low', percentage: 10 }, lifetimeValue: 150, expectedNextTip: '2026-09-01' },
  { username: 'regular1', totalUSD: 50, tipCount: 3, tier: 'Regular', churnRisk: { level: 'Low' }, tipProbability: { level: 'Low', percentage: 15 }, lifetimeValue: 60, expectedNextTip: null },
]

{ // Free
  const resp = buildWhalesResponse(false, WHALES)
  check('Free: fans.unlocked === false', resp.fans.unlocked === false)
  check('Free: fans has NO data key (no intelligence leak)', !('data' in resp.fans))
  check('Free: topFansBasic present with top 3', resp.topFansBasic.length === 3)
  check('Free: topFansBasic contains only basic fields, no churnRisk/tipProbability', resp.topFansBasic.every(w => !('churnRisk' in w) && !('tipProbability' in w)))
  check('Free: topFansBasic matches the top-3-by-spend already shown unlocked today', resp.topFansBasic.map(w => w.username).join(',') === 'whale1,whale2,shark1')
  check('Free: preview.count reflects the 2 hidden fans (5 total - 3 free)', resp.fans.preview.count === 2)
  const respStr = JSON.stringify(resp)
  check('Free: full response JSON never contains a churnRisk level string', !respStr.includes('"Critical"') && !respStr.includes('"Medium"'))
}

{ // Pro
  const resp = buildWhalesResponse(true, WHALES)
  check('Pro: fans.unlocked === true', resp.fans.unlocked === true)
  check('Pro: fans.data has all 5 fans with full intelligence', resp.fans.data.length === 5 && resp.fans.data.every(w => 'churnRisk' in w && 'tipProbability' in w))
  check('Pro: shark2 (Critical churn risk) is visible in the full data', resp.fans.data.find(w => w.username === 'shark2')?.churnRisk.level === 'Critical')
}

{ // Sparse — fewer fans than the free cutoff, no crash, no phantom hidden count
  const sparse = WHALES.slice(0, 2)
  const respFree = buildWhalesResponse(false, sparse)
  check('sparse (2 fans, cutoff 3): topFansBasic has exactly 2, not padded', respFree.topFansBasic.length === 2)
  check('sparse: hiddenCount is 0, not negative', respFree.fans.preview.count === 0)
}

{ // Missing data — zero fans
  const respFree = buildWhalesResponse(false, [])
  const respPro = buildWhalesResponse(true, [])
  check('missing data (Free): topFansBasic is empty, no crash', respFree.topFansBasic.length === 0)
  check('missing data (Pro): fans.data is empty array, not null/undefined', Array.isArray(respPro.fans.data) && respPro.fans.data.length === 0)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
