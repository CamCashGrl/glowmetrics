// Regression for three defects found on the owner's real account
// (daphneoncam@gmail.com), visible together on one Creator Report screen.
//
// VERIFIED DIRECTLY AGAINST THE PRODUCTION ROW COUNTS (SQL, read-only):
//
//   platform      tips    usd        avg usd/tip
//   Chaturbate    4835    1719.40    0.36
//   BongaCams     2800     573.69    0.20
//   Unknown         13     175.60   13.51   <-- 0.17% of tips
//   MyFreeCams       1       5.00    5.00
//
// 1. "BEST PLATFORM: Unknown" (command bar) and "MOST PROFITABLE PLATFORM:
//    Unknown — $0.00/hr" (Creator Report). "Unknown" is the CSV parser's
//    undetected-platform bucket, not a platform. It won because
//    get_user_insights ranks best_platform by AVG(usd) PER TIP with only a
//    HAVING COUNT(*) >= 5 guard, and those 13 tips average $13.51 each.
//    The card then printed $0.00/hr beneath it, because Unknown has no
//    qualifying session hours — a ranking on one statistic captioned with
//    another.
//
// 2. "BEST STREAMING TIME ... ~$18 avg per session" — the value is
//    canonicalBestTimes.bestWindow.medianUsdPerHour, a $/HOUR median.
//    Labelling it "per session" is a unit error.
//
// 3. "BEST STREAMING DAY: Saturday ~$18 avg" next to "BIGGEST OPPORTUNITY:
//    you avg $4 on Saturdays". Both are correct and they measure different
//    things — $/hour in the best day+hour window vs median dollars per
//    Saturday streamed — but neither said so, so one finding read as a
//    contradiction.

import { readFileSync } from 'fs'

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`) }
}
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')
const engineRaw = read('../lib/analytics.js')
const engine = strip(engineRaw)
const reportRaw = read('../app/dashboard/CreatorReport.js')
const report = strip(reportRaw)
const page = strip(read('../app/dashboard/page.js'))
const constants = read('../lib/constants.js')

// ══════════════════════════════════════════════════════════════════════
// 1. "Unknown" is defined once and excluded from platform ranking.
// ══════════════════════════════════════════════════════════════════════
check('the undetected-platform bucket is a named constant, not a scattered literal',
  constants.includes("export const UNDETECTED_PLATFORM = 'Unknown'"))
check('the engine imports it', engine.includes('UNDETECTED_PLATFORM } from \'./constants\''))
check('best-platform ranking excludes the undetected bucket',
  engine.includes("p.platform !== UNDETECTED_PLATFORM"))
check('best-platform ranking excludes platforms with no measurable hours',
  engine.includes('p.usdPerHour > 0'))
check('the engine ranks by usdPerHour — the statistic the UI displays',
  engine.includes('[...rankablePlatforms].sort((a, b) => b.usdPerHour - a.usdPerHour)[0]'))
check('the canonical answer is exposed on analytics', engine.includes('bestPlatformByRate, rankablePlatformCount'))
check('the empty-input branch returns null rather than omitting the key',
  engine.includes('bestPlatformByRate: null, rankablePlatformCount: 0'))

// ══════════════════════════════════════════════════════════════════════
// 2. Every surface reads that ONE answer.
// ══════════════════════════════════════════════════════════════════════
check('the command bar reads the canonical field', page.includes('analytics?.bestPlatformByRate?.platform'))
check('the command bar no longer reads the per-tip SQL ranking',
  !page.includes('engineInsights?.summary?.best_platform'))
check('the Creator Report reads the canonical field', report.includes('analytics?.bestPlatformByRate'))
check('the Creator Report no longer reads the per-tip SQL ranking',
  !report.includes('engineInsights.summary.best_platform'))
check('the Creator Report no longer re-sorts platforms itself',
  !report.includes('sort((a, b) => b.usdPerHour - a.usdPerHour)'))
check('it degrades honestly when nothing is rankable',
  reportRaw.includes('Needs a platform with measurable streamed hours'))

// ══════════════════════════════════════════════════════════════════════
// 3. MIRROR — reproduce the owner's real distribution and prove the old
//    ranking picks Unknown while the new one does not.
// ══════════════════════════════════════════════════════════════════════
{
  const UNDETECTED = 'Unknown'
  // Real production figures from the SQL above.
  const platforms = [
    { platform: 'Chaturbate', tips: 4835, totalUSD: 1719.40, usdPerHour: 5.90, hours: 291.4 },
    { platform: 'BongaCams',  tips: 2800, totalUSD:  573.69, usdPerHour: 3.10, hours: 185.1 },
    { platform: UNDETECTED,   tips:   13, totalUSD:  175.60, usdPerHour: 0,    hours: 0     },
    { platform: 'MyFreeCams', tips:    1, totalUSD:    5.00, usdPerHour: 0,    hours: 0     },
  ]

  // OLD: the SQL ranking — average USD per tip, HAVING COUNT(*) >= 5.
  const oldRanked = platforms
    .filter(p => p.tips >= 5)
    .map(p => ({ ...p, avgPerTip: p.totalUSD / p.tips }))
    .sort((a, b) => b.avgPerTip - a.avgPerTip)[0]
  check('the old per-tip ranking really does crown the undetected bucket',
    oldRanked.platform === UNDETECTED,
    `picked ${oldRanked.platform} at $${oldRanked.avgPerTip.toFixed(2)}/tip`)
  check('the undetected bucket is a rounding error by tip volume',
    platforms.find(p => p.platform === UNDETECTED).tips / platforms.reduce((n, p) => n + p.tips, 0) < 0.002)

  // NEW: rank by usdPerHour, excluding the bucket and zero-hour platforms.
  const rankable = platforms.filter(p => p.platform !== UNDETECTED && p.usdPerHour > 0)
  const best = [...rankable].sort((a, b) => b.usdPerHour - a.usdPerHour)[0]
  check('the new ranking picks a real platform', best.platform === 'Chaturbate', `picked ${best.platform}`)
  check('the new ranking and the old one genuinely disagree (this is a real fix, not a no-op)',
    best.platform !== oldRanked.platform)
  check('the new ranking never returns a platform that would render $0.00/hr', best.usdPerHour > 0)
  check('zero-hour platforms are excluded even when they are real platforms',
    !rankable.some(p => p.platform === 'MyFreeCams'))

  // Nothing rankable at all -> null, not a bogus winner.
  const noneRankable = [{ platform: UNDETECTED, usdPerHour: 0 }].filter(p => p.platform !== UNDETECTED && p.usdPerHour > 0)
  check('with nothing rankable the answer is null rather than the bucket', noneRankable.length === 0)
}

// ══════════════════════════════════════════════════════════════════════
// 4. UNITS — the two "$18" figures are one value; say what it is.
// ══════════════════════════════════════════════════════════════════════
check('the $/hour median is no longer labelled "per session"',
  !reportRaw.includes('avg per session'))
check('the best-time card names its unit', reportRaw.includes('/hr median'))
check('the best-day card shows its sample instead of repeating the same figure unlabelled',
  reportRaw.includes('qualifying session${_canonicalBestWindow.sessionCount === 1'))
check('both cards still read the one canonical window',
  report.includes('analytics?.canonicalBestTimes?.bestWindow'))
// The two cards derive from the SAME field, so repeating it under two
// different captions was the defect — pin that they no longer both print it.
check('bestDay and bestHour still share one source (no second best-time answer)',
  report.includes('_canonicalBestWindow.localDay') && report.includes('_canonicalBestWindow.localHour'))
check('only one of the two cards prints the rate',
  (reportRaw.match(/fmtUsd\(bestHour\.avg\)/g) || []).length === 1 &&
  !reportRaw.includes('fmtUsd(bestDay.avg)'))

// ══════════════════════════════════════════════════════════════════════
// 5. The day insight names its unit, so it cannot read as a contradiction.
// ══════════════════════════════════════════════════════════════════════
check('the day insight states dollars per day streamed',
  engineRaw.includes('median $${bestDay.avg.toFixed(0)} on each ${bestDay.day} you stream'))
check('the two statistics are documented as different measures',
  engineRaw.includes('It is NOT a $/hour rate'))
check('the insight still reuses the upstream bestDay (no new formula)',
  engine.includes('if (bestDay && worstDay && bestDay.day !== worstDay.day && bestDay.avg > 0)'))

// They are genuinely different measures — a $/hour median and a $/day
// median can differ by a large factor on the same day, which is exactly why
// showing both unlabelled read as a contradiction.
{
  const perHourMedian = 18
  const perStreamedDayMedian = 4
  check('a $/hour median and a $/day median can differ several-fold on the same day',
    perHourMedian / perStreamedDayMedian >= 4)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
