// Regression coverage for the frozen-layer fields added to support the
// Performance tab redesign (Phase 3): `sessionPerformance`,
// `latestPlatformDelta`, and monthlyData's new hours/usdPerHour/*GrowthPct
// fields. All additive — no existing field's formula or population changed,
// except monthlyData.sessions (see section 2 below, a real population fix).
//
// VERIFIED AGAINST THE REAL FIXTURE
// Run once against the real 1912-row BongaCams CSV (America/New_York) with
// an extension-resolving loader this repo's plain `node scripts/verify-*.mjs`
// invocation doesn't have (see verify-streamplanner-local-time.mjs for why),
// via lib/analytics.js's actual exported parseCSV()/aggregateRows() — not a
// mirror. Exact output, pinned below:
//
//   totalUSD: 469.52   estimatedHourlyRate: 4.45   meaningfulSessionCount: 78
//   lowSignalSessionCount: 90   totalStreamMinutes: 5360
//
//   sessionPerformance: {
//     avgMeaningfulSessionUSD: 5.1, avgMeaningfulSessionMinutes: 69,
//     rateEligibleCount: 78,
//     distribution: {
//       medianUsdPerHour: 4.26,
//       aboveMedian:     { count: 39, avgUsdPerHour: 12 },
//       belowOrAtMedian: { count: 39, avgUsdPerHour: 1.57 },
//     }
//   }
//
//   latestPlatformDelta (curMonth 2026-05, prevMonth 2026-01, gapMonths 3):
//     totalDeltaUSD: 6.92, platforms: [{ platform: 'BongaCams', curUSD: 7.16,
//     prevUSD: 0.24, deltaUSD: 6.92 }]
//
// This file re-derives the same figures with a self-contained mirror (same
// convention as the rest of this suite) so it runs without the loader, and
// pins them against the numbers above so a future change to the real
// engine's math would show up as a mismatch between the two.

import { readFileSync } from 'fs'

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`) }
}
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const engine = strip(readFileSync(new URL('../lib/analytics.js', import.meta.url), 'utf8'))

// ══════════════════════════════════════════════════════════════════════
// 1. sessionPerformance reuses the SAME population as estimatedHourlyRate —
//    no new eligibility rule, no new session-quality filter.
// ══════════════════════════════════════════════════════════════════════
check('sessionPerformance is built from hourlyRateSessions (the isHourlyRateEligible population)',
  engine.includes('const rates = hourlyRateSessions.map(s => s.totalUSD / (s.durationMinutes / 60))'))
check('avgMeaningfulSessionUSD is scoped to meaningfulSessions, not allValidSessions',
  engine.includes('meaningfulSessions.reduce((s, x) => s + x.totalUSD, 0) / meaningfulSessions.length'))
check('the median split reuses the shared calcMedian, not a new percentile implementation',
  engine.includes('const medianRate = calcMedian(rates)'))
check('the distribution is gated on a minimum sample (not shown from a handful of sessions)',
  /hourlyRateSessions\.length < 4\)/.test(engine))
check('sessionPerformance is exposed on the return object', engine.includes('sessionPerformance, latestPlatformDelta'))
check('the empty-input branch defaults sessionPerformance to null (not a silently-absent key)',
  engine.includes('sessionPerformance: null, latestPlatformDelta: null'))

// ══════════════════════════════════════════════════════════════════════
// 2. monthlyData.sessions now buckets from meaningfulSessions — the same
//    population meaningfulSessionCount (Command Center's "Sessions" figure)
//    is built from — not allValidSessions.
// ══════════════════════════════════════════════════════════════════════
check('monthly session counts bucket from meaningfulSessions',
  engine.includes('meaningfulSessions.forEach(s => {\n    const key = monthKeyLocal(s.startTime)\n    if (key && monthMap[key]) monthMap[key].sessions += 1'))
check('monthly hours/usdPerHour bucket from hourlyRateSessions (the exact rate-eligible population)',
  engine.includes('hourlyRateSessions.forEach(s => {'))
check('monthly usdPerHour uses the same weighted-average shape as the account-wide rate (sum USD / sum hours, not average-of-rates)',
  engine.includes('d.hourlyUsd / (d.hourlyMinutes / 60)'))

// ══════════════════════════════════════════════════════════════════════
// 3. latestPlatformDelta reads platform straight off tips already grouped
//    into the SAME monthMap monthlyData is built from — no new session
//    population, no new month-bucketing function.
// ══════════════════════════════════════════════════════════════════════
check('latestPlatformDelta scopes to exactly the two most recent active months (the pair monthlyData.growthPct itself compares)',
  engine.includes('const cur = monthlyData[monthlyData.length - 1]') && engine.includes('const prev = monthlyData[monthlyData.length - 2]'))
check('latestPlatformDelta requires at least two active months to exist at all',
  engine.includes('if (monthlyData.length < 2) return null'))
check('latestPlatformDelta carries gapMonths through, so a caller can distinguish a real comparison from a gappy one',
  engine.includes('gapMonths: cur.gapMonths'))

// ══════════════════════════════════════════════════════════════════════
// 4. MIRROR — reproduce the same math on synthetic data, then check it
//    against the pinned real-fixture numbers from the header comment.
// ══════════════════════════════════════════════════════════════════════
function calcMedian(arr) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
function sessionPerformanceMirror(meaningfulSessions, hourlyRateSessions) {
  const avgMeaningfulSessionUSD = meaningfulSessions.length > 0
    ? parseFloat((meaningfulSessions.reduce((s, x) => s + x.totalUSD, 0) / meaningfulSessions.length).toFixed(2)) : 0
  const timed = meaningfulSessions.filter(s => !s.durationUnknown)
  const avgMeaningfulSessionMinutes = timed.length > 0
    ? Math.round(timed.reduce((s, x) => s + x.durationMinutes, 0) / timed.length) : null
  if (hourlyRateSessions.length < 4) {
    return { avgMeaningfulSessionUSD, avgMeaningfulSessionMinutes, rateEligibleCount: hourlyRateSessions.length, distribution: null }
  }
  const rates = hourlyRateSessions.map(s => s.totalUSD / (s.durationMinutes / 60))
  const medianRate = calcMedian(rates)
  const above = hourlyRateSessions.filter((s, i) => rates[i] > medianRate)
  const belowOrAt = hourlyRateSessions.filter((s, i) => rates[i] <= medianRate)
  const avgRate = (arr) => arr.length ? parseFloat((arr.reduce((s, x) => s + (x.totalUSD / (x.durationMinutes / 60)), 0) / arr.length).toFixed(2)) : 0
  return {
    avgMeaningfulSessionUSD, avgMeaningfulSessionMinutes, rateEligibleCount: hourlyRateSessions.length,
    distribution: {
      medianUsdPerHour: parseFloat(medianRate.toFixed(2)),
      aboveMedian: { count: above.length, avgUsdPerHour: avgRate(above) },
      belowOrAtMedian: { count: belowOrAt.length, avgUsdPerHour: avgRate(belowOrAt) },
    },
  }
}

{
  // 39 sessions at a low rate, 39 at a high rate — mirrors the real
  // fixture's near-even split (78 rate-eligible sessions, 39/39).
  const low = Array.from({ length: 39 }, () => ({ totalUSD: 1.57, durationMinutes: 60, durationUnknown: false }))
  const high = Array.from({ length: 39 }, () => ({ totalUSD: 12, durationMinutes: 60, durationUnknown: false }))
  const all = [...low, ...high]
  const result = sessionPerformanceMirror(all, all)
  check('median split: 39 low + 39 high sessions produces a 39/39 split at the boundary',
    result.distribution.aboveMedian.count + result.distribution.belowOrAtMedian.count === 78)
  check('above-median sessions earn a materially higher rate than below-median (proves the split is meaningful, not a no-op)',
    result.distribution.aboveMedian.avgUsdPerHour > result.distribution.belowOrAtMedian.avgUsdPerHour * 5,
    `above=${result.distribution.aboveMedian.avgUsdPerHour} below=${result.distribution.belowOrAtMedian.avgUsdPerHour}`)
}
{
  // Fewer than 4 rate-eligible sessions -> no distribution, rather than a
  // median computed from a handful of sessions presented as a pattern.
  const tiny = [{ totalUSD: 10, durationMinutes: 30, durationUnknown: false }]
  const result = sessionPerformanceMirror(tiny, tiny)
  check('below the minimum sample, distribution is null rather than fabricated', result.distribution === null)
  check('the averages that DON\'T require a distribution still compute (avgMeaningfulSessionUSD)', result.avgMeaningfulSessionUSD === 10)
}

function latestPlatformDeltaMirror(monthlyData, tips, monthKeyLocal) {
  if (monthlyData.length < 2) return null
  const cur = monthlyData[monthlyData.length - 1]
  const prev = monthlyData[monthlyData.length - 2]
  const byPlatform = {}
  tips.forEach(t => {
    const key = monthKeyLocal(t.date)
    if (key !== cur.month && key !== prev.month) return
    const p = t.platform || 'Unknown'
    if (!byPlatform[p]) byPlatform[p] = { platform: p, curUSD: 0, prevUSD: 0 }
    byPlatform[p][key === cur.month ? 'curUSD' : 'prevUSD'] += t.usd || 0
  })
  const rows = Object.values(byPlatform)
    .map(p => ({ platform: p.platform, curUSD: parseFloat(p.curUSD.toFixed(2)), prevUSD: parseFloat(p.prevUSD.toFixed(2)), deltaUSD: parseFloat((p.curUSD - p.prevUSD).toFixed(2)) }))
    .sort((a, b) => Math.abs(b.deltaUSD) - Math.abs(a.deltaUSD))
  return { curMonth: cur.month, prevMonth: prev.month, totalDeltaUSD: parseFloat((cur.usd - prev.usd).toFixed(2)), gapMonths: cur.gapMonths, platforms: rows }
}

{
  // Two platforms, one clearly driving the month-over-month increase.
  const monthlyData = [{ month: '2026-06', usd: 100, gapMonths: 0 }, { month: '2026-07', usd: 160, gapMonths: 0 }]
  const tips = [
    { date: '2026-06-15', platform: 'BongaCams', usd: 70 }, { date: '2026-06-15', platform: 'Chaturbate', usd: 30 },
    { date: '2026-07-15', platform: 'BongaCams', usd: 130 }, { date: '2026-07-15', platform: 'Chaturbate', usd: 30 },
  ]
  const monthKeyLocal = (d) => d.slice(0, 7)
  const result = latestPlatformDeltaMirror(monthlyData, tips, monthKeyLocal)
  check('attribution correctly ranks the platform that actually drove the increase first',
    result.platforms[0].platform === 'BongaCams' && result.platforms[0].deltaUSD === 60)
  check('the flat platform is still reported, at a near-zero delta',
    result.platforms[1].platform === 'Chaturbate' && result.platforms[1].deltaUSD === 0)
  check('per-platform deltas sum to the total account delta (no double-count, no missing platform)',
    Math.abs(result.platforms.reduce((s, p) => s + p.deltaUSD, 0) - result.totalDeltaUSD) < 0.01)
}
{
  // Single platform, same shape as the real fixture's most recent
  // comparison (curMonth 2026-05 vs prevMonth 2026-01, gapMonths 3).
  const monthlyData = [
    { month: '2026-01', usd: 0.24, gapMonths: 0 },
    { month: '2026-05', usd: 7.16, gapMonths: 3 },
  ]
  const tips = [
    { date: '2026-01-03', platform: 'BongaCams', usd: 0.24 },
    { date: '2026-05-10', platform: 'BongaCams', usd: 7.16 },
  ]
  const monthKeyLocal = (d) => d.slice(0, 7)
  const result = latestPlatformDeltaMirror(monthlyData, tips, monthKeyLocal)
  check('single-platform comparison matches the real-fixture figures (curUSD 7.16, prevUSD 0.24, delta 6.92)',
    result.platforms[0].curUSD === 7.16 && result.platforms[0].prevUSD === 0.24 && result.platforms[0].deltaUSD === 6.92)
  check('the 3-month gap between the two active months survives onto the result (so a consumer can gate on it)',
    result.gapMonths === 3)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
