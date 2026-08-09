// Standalone verification for lib/intelligence/snapshot.js's
// buildAnalyticsSnapshot() — the pure function that picks the small subset
// of aggregateRows()'s output future diff-based dashboard-intelligence
// events will compare against.
//
// This repo has no test framework configured and lib/intelligence/
// snapshot.js can't be `import`-ed directly by plain Node (ESM `export
// function` syntax inside a package.json with no "type": "module" — see
// scripts/verify-estimated-hourly-rate.mjs's comment for the same
// limitation). This script mirrors the function exactly (it computes
// nothing — just field selection/filtering, so mirroring it is not a
// second analytics engine) and runs the required cases against that
// mirror. Keep in sync with lib/intelligence/snapshot.js if it changes.

const WHALE_SNAPSHOT_TIERS = new Set(['Whale', 'Shark'])

function buildAnalyticsSnapshot(analytics) {
  if (!analytics) return null
  return {
    totalUSD: analytics.totalUSD ?? 0,
    totalTokens: analytics.totalTokens ?? 0,
    totalTips: analytics.totalTips ?? 0,
    bestDay: analytics.bestDay ? { day: analytics.bestDay.day, avg: analytics.bestDay.avg } : null,
    bestHour: analytics.bestHour ? { hour: analytics.bestHour.hour, avg: analytics.bestHour.avg } : null,
    estimatedHourlyRate: analytics.estimatedHourlyRate ?? 0,
    momentum: analytics.momentum ? { pct: analytics.momentum.pct, label: analytics.momentum.label } : null,
    streakDays: analytics.streakDays ?? 0,
    platformTotals: (analytics.platforms || []).map(p => ({
      platform: p.platform, totalUSD: p.totalUSD, usdPerHour: p.usdPerHour,
    })),
    whales: (analytics.whales || [])
      .filter(w => WHALE_SNAPSHOT_TIERS.has(w.tier))
      .map(w => ({ username: w.username, tier: w.tier, totalUSD: w.totalUSD })),
    computedAt: new Date().toISOString(),
  }
}

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`) }
}

check('null analytics -> null snapshot', buildAnalyticsSnapshot(null), null)
check('undefined analytics -> null snapshot', buildAnalyticsSnapshot(undefined), null)

// Empty-account shape (matches aggregateRows()'s own empty-tips default object)
{
  const empty = { totalUSD: 0, totalTokens: 0, totalTips: 0, bestDay: null, bestHour: null, estimatedHourlyRate: 0, momentum: null, streakDays: 0, platforms: [], whales: [] }
  const snap = buildAnalyticsSnapshot(empty)
  check('empty account: totals are 0', { usd: snap.totalUSD, tokens: snap.totalTokens, tips: snap.totalTips }, { usd: 0, tokens: 0, tips: 0 })
  check('empty account: bestDay/bestHour/momentum are null, not fabricated', { bestDay: snap.bestDay, bestHour: snap.bestHour, momentum: snap.momentum }, { bestDay: null, bestHour: null, momentum: null })
  check('empty account: no platforms/whales', { platforms: snap.platformTotals, whales: snap.whales }, { platforms: [], whales: [] })
}

// Realistic populated account
{
  const analytics = {
    totalUSD: 1680.05, totalTokens: 33601, totalTips: 220,
    bestDay: { day: 'Friday', avg: 60.85, total: 398, count: 7 },
    bestHour: { hour: '12', avg: 11.8, total: 165.25, count: 9 },
    estimatedHourlyRate: 6.22,
    momentum: { pct: -100, label: 'Inactive', emoji: '💤', last30USD: 0, prior30USD: 914.5 },
    streakDays: 46,
    platforms: [
      { platform: 'Chaturbate', totalUSD: 835.1, totalTokens: 16702, sessions: 50, hours: 86.47, tips: 113, usdPerHour: 9.66, tokensPerHour: 193, avgTipSize: 7.39 },
      { platform: 'BongaCams', totalUSD: 723.2, totalTokens: 14464, sessions: 23, hours: 1.17, tips: 25, usdPerHour: 618.12, tokensPerHour: 12362, avgTipSize: 28.93 },
    ],
    whales: [
      { username: 'bigwhale_tom', tier: 'Whale', totalUSD: 500 },
      { username: 'shark_dave', tier: 'Shark', totalUSD: 300 },
      { username: 'regular_sam', tier: 'Regular', totalUSD: 40 },
      { username: 'dormant_joe', tier: 'Dormant', totalUSD: 10 },
    ],
  }
  const snap = buildAnalyticsSnapshot(analytics)
  check('populated account: totals carried through exactly', { usd: snap.totalUSD, tokens: snap.totalTokens, tips: snap.totalTips }, { usd: 1680.05, tokens: 33601, tips: 220 })
  check('populated account: bestDay/bestHour trimmed to {day/hour, avg} only', { bestDay: snap.bestDay, bestHour: snap.bestHour }, { bestDay: { day: 'Friday', avg: 60.85 }, bestHour: { hour: '12', avg: 11.8 } })
  check('populated account: momentum trimmed to {pct, label}, "Inactive" preserved (not fabricated as Declining)', snap.momentum, { pct: -100, label: 'Inactive' })
  check('populated account: streakDays carried through', snap.streakDays, 46)
  check('populated account: platformTotals trimmed to {platform, totalUSD, usdPerHour}', snap.platformTotals, [
    { platform: 'Chaturbate', totalUSD: 835.1, usdPerHour: 9.66 },
    { platform: 'BongaCams', totalUSD: 723.2, usdPerHour: 618.12 },
  ])
  // The core filtering behavior this function exists for: only Whale/Shark
  // tiers are remembered — Regular/Dormant fans are noise for diffing.
  check('populated account: whales snapshot excludes Regular/Dormant tiers', snap.whales, [
    { username: 'bigwhale_tom', tier: 'Whale', totalUSD: 500 },
    { username: 'shark_dave', tier: 'Shark', totalUSD: 300 },
  ])
  check('populated account: computedAt is a valid ISO timestamp', !isNaN(Date.parse(snap.computedAt)), true)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
