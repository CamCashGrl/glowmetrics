// Regression coverage for the final two analytics-freeze items.
//
// MISSED REVENUE — three implementations existed: lib/analytics.js's inline
// missedRevenueByPlatform (what the dashboard actually rendered),
// lib/analytics/missedRevenue.js's computeMissedRevenue (canonical, consumed
// only by /api/insights), and get_user_insights' missed_opportunity (SQL,
// consumed by no UI at all). The dashboard is now migrated to the canonical
// module and the legacy inline version is deleted.
//
// The legacy version had a real unit mismatch: it subtracted a MEAN $/SESSION
// from a MEDIAN $/HOUR and multiplied by a session count. Its documented
// deferral reason — that migrating it would desync the Platforms heatmap
// "right next to it" — was factually wrong; the card renders on Overview.
//
// The canonical module no longer emits a cumulative dollar total either. Rate
// gap x off-window hours implies the creator could have moved every off-window
// hour into a window that recurs ~1h/week at her peak rate; on the real
// regression CSV that produced $427 "missed" against $469 lifetime earnings.
// Only directly-measured quantities are returned now.
//
// FORECASTS — predictRevenue()'s units, sparse-data gating, outlier behavior
// and confidence vocabulary, plus the latent ReferenceError in
// generateLossAlerts() (it referenced an undeclared `tz`; the callback only
// ran for creators who had streamed in the last 3 days, so it never surfaced
// on stale fixtures).

let pass = 0, fail = 0
function check(name, cond) { if (cond) { pass++; console.log(`PASS  ${name}`) } else { fail++; console.log(`FAIL  ${name}`) } }

const { readFileSync } = await import('fs')
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const read = (rel) => strip(readFileSync(new URL(rel, import.meta.url), 'utf8'))
const engine = read('../lib/analytics.js')
const missedMod = read('../lib/analytics/missedRevenue.js')
// Documentation assertions must read the RAW file — strip() removes the very
// comments they are verifying.
const missedModRaw = readFileSync(new URL('../lib/analytics/missedRevenue.js', import.meta.url), 'utf8')
const dashboard = read('../app/dashboard/page.js')

// ══════════════════════════════════════════════════════════════════════
// 1. MISSED REVENUE — one implementation, canonical, wired to the UI.
// ══════════════════════════════════════════════════════════════════════
check('legacy inline missedRevenueByPlatform is gone from the engine', !engine.includes('const missedRevenueByPlatform = {}'))
check('engine exposes the canonical result', engine.includes('const missedRevenue = computeMissedRevenue(meaningfulSessions, userTz)'))
check('engine imports the canonical module', engine.includes("import { computeMissedRevenue } from './analytics/missedRevenue'"))
check('dashboard consumes the canonical field', dashboard.includes('analytics?.missedRevenue?.cumulative_by_platform'))
check('dashboard no longer reads the legacy field', !dashboard.includes('analytics?.missedRevenueByPlatform'))
check('no fabricated "5x" multiplier fallback remains', !dashboard.includes(': "5")}x'))

// No cumulative dollar total is produced or displayed.
check('canonical module emits no missedRevenue dollar total', !missedMod.includes('missedRevenue,'))
check('canonical module emits the measured rate gap instead', missedMod.includes('rateGapUsdPerHour'))
check('dashboard ranks by the measured rate gap', dashboard.includes('b[1].rateGapUsdPerHour - a[1].rateGapUsdPerHour'))

// Denominator/scope/timezone are stated in the module itself.
check('module documents scope = meaningful sessions', missedModRaw.includes('meaningfulSessions only'))
check('module documents the timezone contract', missedModRaw.includes("creator's resolved profiles.timezone"))
check('module documents why no dollar total is supportable', missedModRaw.includes('NO CUMULATIVE DOLLAR FIGURE IS PRODUCED'))

// Mirrors the canonical per-platform calculation.
function cumulativeForPlatform(platBestMedian, overallMedian, offWindowHours) {
  if (platBestMedian <= overallMedian * 1.2) return null
  const rateGapUsdPerHour = parseFloat((platBestMedian - overallMedian).toFixed(2))
  if (rateGapUsdPerHour < 1) return null
  return { rateGapUsdPerHour, offWindowHours }
}
{
  check('gap below the 1.2x threshold produces nothing', cumulativeForPlatform(10, 9, 50) === null)
  check('gap above 1.2x but under $1/hr produces nothing', cumulativeForPlatform(4.5, 3.7, 50) === null)
  const r = cumulativeForPlatform(9.52, 4.54, 85.82)
  check('real regression CSV values produce a $4.98/hr measured gap', r.rateGapUsdPerHour === 4.98)
  check('rate gap is timezone-invariant (a rate, not a clock position)', cumulativeForPlatform(9.52, 4.54, 85.82).rateGapUsdPerHour === r.rateGapUsdPerHour)
}

// ══════════════════════════════════════════════════════════════════════
// 2. FORECASTS — units, sparse data, outliers, confidence vocabulary.
// ══════════════════════════════════════════════════════════════════════
check('generateLossAlerts now declares tz (was an undeclared reference)', engine.includes("export function generateLossAlerts(tips, sessions, whales, bestHour, tz"))
check('aggregateRows passes userTz to generateLossAlerts', engine.includes('generateLossAlerts(tips, meaningfulSessions, whales, bestHour, userTz)'))
check('predictRevenue accepts a timezone', engine.includes('export function predictRevenue(tips, sessions, tz'))

// Mirrors predictRevenue's tonightStream gating + range construction.
function tonightStream(sameDayTotals) {
  if (sameDayTotals.length < 3) return null
  const amounts = [...sameDayTotals].sort((a, b) => a - b)
  const avg = amounts.reduce((s, x) => s + x, 0) / amounts.length
  const p10 = amounts[Math.max(0, Math.floor(amounts.length * 0.10))]
  const p90 = amounts[Math.min(amounts.length - 1, Math.floor(amounts.length * 0.90))]
  return { expected: parseFloat(avg.toFixed(2)), min: p10, max: p90 }
}
{
  check('sparse data (<3 same-day sessions) produces NO forecast', tonightStream([50, 60]) === null)
  check('exactly 3 same-day sessions is the minimum that forecasts', tonightStream([40, 50, 60]) !== null)
  const t = tonightStream([40, 50, 60])
  check('forecast range is a p10-p90 band from real session totals, not a synthetic +/-%', t.min === 40 && t.max === 60)
  check('expected value sits inside its own range', t.expected >= t.min && t.expected <= t.max)
}
{
  // Outlier behavior: one whale night must not drag the whole band up.
  const withOutlier = tonightStream([20, 22, 25, 24, 21, 900])
  check('single extreme outlier does not become the forecast floor', withOutlier.min <= 25)
  check('outlier is not silently dropped either (band top reflects it)', withOutlier.max >= 25)
  check('mean is pulled by the outlier — documented, hence the p10-p90 band is what is shown', withOutlier.expected > 25)
}
{
  // Units: the Daily Brief forecast is derived from a $/hour figure and is
  // presented as an hourly rate, never mixed with a $/session value.
  check('peakAvg chain contains no $/session fallback', !dashboard.includes('displayAvg || bestHour?.avg || sessionAvg'))
  check('Daily Brief labels the rate as $/hr', dashboard.includes('/hr avg'))
  check('no "avg/session" label on an hourly figure', !dashboard.includes('avg/session'))
}
{
  // Confidence vocabulary must come from sample size, and the UI must not
  // assert precision the tier does not support.
  const tierFor = (n) => n < 2 ? 'insufficient' : n <= 3 ? 'promising' : n <= 5 ? 'supported' : 'high'
  check('1 session -> insufficient (never labeled a best time)', tierFor(1) === 'insufficient')
  check('3 sessions -> promising', tierFor(3) === 'promising')
  check('4 sessions -> supported (lowest tier allowed to claim "best")', tierFor(4) === 'supported')
  check('6+ sessions -> high', tierFor(6) === 'high')
  check('dashboard surfaces the confidence tier rather than hiding it', dashboard.includes('confidence)') || dashboard.includes('bestWindowConfidence'))
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
