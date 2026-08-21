// Phase 3 regression: the Performance tab is the evidence layer, and it
// computes nothing.
//
// Performance is the most metric-dense surface in the product — denser than
// the Command Center — so it is the likeliest place for local aggregation to
// creep back in. That is the failure mode the whole analytics audit existed
// to remove: components independently recomputing metrics and disagreeing
// with each other. These checks fail the build if it starts aggregating, if
// it invents a second best-time answer, or if it draws a chart that argues
// against the canonical one.

import { readFileSync } from 'fs'

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`) }
}

const raw = readFileSync(new URL('../app/dashboard/Performance.js', import.meta.url), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const src = strip(raw)
const page = strip(readFileSync(new URL('../app/dashboard/page.js', import.meta.url), 'utf8'))
const cc = strip(readFileSync(new URL('../app/dashboard/CommandCenter.js', import.meta.url), 'utf8'))

// ══════════════════════════════════════════════════════════════════════
// 1. NO LOCAL AGGREGATION.
//    The component may sort/slice/filter and may reshape an ALREADY-
//    CANONICAL array for presentation, but must never sum or average raw
//    tips or sessions into a new metric.
// ══════════════════════════════════════════════════════════════════════
check('no .reduce() over raw tips', !/\btips\s*\.\s*reduce/.test(src))
check('no .reduce() over raw sessions', !/\bsessions\s*\.\s*reduce/.test(src))
check('does not receive raw tips as a prop', !/^\s*tips[,\s=]/m.test(src.split('export default')[1] || ''))
check('does not receive raw sessions as a prop', !/^\s*sessions[,\s=]/m.test(src.split('export default')[1] || ''))
check('does not import the analytics engine (reads props only)', !src.includes("from '../../lib/analytics"))
check('does not import session detection', !src.includes('detectSessions'))
check('does not re-derive an hourly rate from a total and an hour count',
  !/totalUSD\s*\/\s*[^)]*hours/i.test(src))
check('does not compute a median itself (the engine owns every median)', !/calcMedian|function\s+median/i.test(src))

// ══════════════════════════════════════════════════════════════════════
// 2. READS THE CANONICAL FIELDS, BY NAME.
// ══════════════════════════════════════════════════════════════════════
for (const field of [
  'analytics?.totalUSD',
  'analytics?.estimatedHourlyRate',
  'analytics?.meaningfulSessionCount',
  'analytics?.lowSignalSessionCount',
  'analytics?.totalStreamMinutes',
  'analytics?.uniqueFanCount',
  'analytics?.monthlyData',
  'analytics?.sessionPerformance',
  'analytics?.latestPlatformDelta',
  'analytics?.platforms',
  'analytics?.canonicalBestTimes?.bestWindow',
  'analytics?.canonicalBestTimes?.grid',
  'analytics?.missedRevenue?.cumulative_by_platform',
  'analytics?.bestWindowFanOverlap',
  'analytics?.dependencyRisk',
]) {
  check(`reads ${field}`, src.includes(field))
}

// ══════════════════════════════════════════════════════════════════════
// 3. ONE BEST-TIME ANSWER. Performance must never rank its own.
// ══════════════════════════════════════════════════════════════════════
check('the best window comes from canonicalBestTimes.bestWindow, not a local ranking',
  src.includes('analytics?.canonicalBestTimes?.bestWindow || null'))
check('the day-of-week view filters out the tier the engine calls insufficient',
  src.includes("grid.filter(g => g.tier !== \"insufficient\")"))
check('the day-of-week view sums canonical totals/counts, it does not re-rank by a computed rate',
  src.includes('map[g.localDay].totalUsd += g.totalUsd') && !/byDay[\s\S]{0,200}usdPerHour/.test(src))
check('falls back to the canonical earlySignal rather than promoting a weak bucket',
  src.includes('analytics?.canonicalBestTimes?.earlySignal'))
check('confidence wording is driven by the canonical tier', src.includes('TIER_COPY[bestWindow.tier]'))
check('does not claim a tier the engine calls insufficient', !src.includes('insufficient:'))

// A chart that visually contradicts the headline is the exact defect the
// Command Center's 24-bar chart was replaced for. Here the bars are TOTAL $
// while bestWindow ranks by MEDIAN $/hour, so the longest bar often is NOT
// the best window — the page must say so in words rather than let the reader
// infer a contradiction.
check('the total-$ day chart explicitly states its unit', raw.includes('Total earned by day of week'))
check('the chart explains why the biggest bar is not necessarily the best window',
  raw.includes("biggest bar isn&apos;t always your best window"))
check('the explanation names the actual ranking statistic ($/hour median)',
  raw.includes('highest median') && raw.includes('$/hour'))

// ══════════════════════════════════════════════════════════════════════
// 4. NO FABRICATED STATISTICS — the failure mode this engagement kept
//    surfacing (hardcoded "+101%", "2x", "5x").
// ══════════════════════════════════════════════════════════════════════
check('no hardcoded percentage claims in copy', !/\+\d{1,3}%\s*(more|higher|better)/.test(src))
check('no hardcoded "Nx" multiplier literals in copy', !/>\s*\d+(\.\d+)?x\s*</.test(src))
check('every multiplier shown is computed from two canonical values',
  src.includes('aboveMedian.avgUsdPerHour / belowOrAtMedian.avgUsdPerHour') &&
  src.includes('top.usdPerHour / bottom.usdPerHour'))
check('findings are capped so the section cannot become a wall', src.includes('.slice(0, 5)'))

// ══════════════════════════════════════════════════════════════════════
// 5. HONEST EMPTY / SPARSE STATES — never a fabricated or broken section.
// ══════════════════════════════════════════════════════════════════════
check('"what changed" degrades to an honest message', raw.includes('Not enough month-over-month history yet'))
check('attribution uses the required honest fallback wording',
  raw.includes('Not enough history to attribute this change.'))
check('attribution distinguishes a single-platform account from missing history',
  raw.includes('Single-platform account'))
check('attribution is gated on having at least two platforms AND a material delta',
  src.includes('delta.platforms.length >= 2') && src.includes('Math.abs(delta.totalDeltaUSD) >= 1'))
check('the session split is gated on the engine having produced a distribution',
  src.includes('sp?.distribution ?') || src.includes('sp?.distribution &&'))
check('the $/hour chart refuses to draw from a single point',
  src.includes('points.length < 2'))
check('months with no rate-eligible sessions are dropped, not charted as $0',
  src.includes('m.usdPerHour != null'))
check('best-window section degrades honestly when nothing qualifies',
  raw.includes('Not enough qualifying sessions yet to identify a best window'))

// ══════════════════════════════════════════════════════════════════════
// 6. SCOPE LABELLING — the session-scoped platform total must never read
//    as an account-wide total (the exact ambiguity flagged in the audit).
// ══════════════════════════════════════════════════════════════════════
check('per-platform earnings are labeled "in qualifying sessions", not "total"',
  raw.includes('in qualifying sessions'))
check('platform hourly rate carries an explicit /hr unit and label',
  src.includes('usdPerHour)}/hr') && raw.includes('hourly rate'))
// Caught by the rendered review: the platform-efficiency banner and the
// platform finding both read "$$5.50/hr" because a literal "$" was prefixed
// onto fmtUsd(), which already emits one. Cheap to reintroduce, invisible in
// code review, obvious on screen.
// `$${someRawNumber}` is CORRECT (fmtUsd is not involved) — only a literal
// "$" glued onto fmtUsd/fmtUsd0, which already emit one, is the defect.
check('no "$$" prefixed onto an fmtUsd() interpolation inside a template literal',
  !/\$\$\{fmtUsd0?\(/.test(raw))
// The JSX form of the same bug: `— ${fmtUsd(x)}/hr` in JSX text renders a
// literal "$" then fmtUsd's own "$". In JSX the correct form is `{fmtUsd(x)}`
// with no "$". Distinguished from the legitimate template-literal usage by
// the absence of a backtick on the line.
{
  const jsxDollarBug = raw.split('\n').filter(l => l.includes('${fmtUsd') && !l.includes('`'))
  check('no "$" prefixed onto an fmtUsd() expression in JSX text',
    jsxDollarBug.length === 0, jsxDollarBug.map(l => l.trim().slice(0, 90)).join('\n      '))
}

check('the month-gap disclosure is present so a gappy comparison cannot read as consecutive',
  raw.includes('inactive month') && src.includes('curMonth.gapMonths > 0'))
check('the gap disclosure states the comparison is between ACTIVE months',
  raw.includes('not consecutive calendar months'))

// ══════════════════════════════════════════════════════════════════════
// 7. FREE vs PRO — evidence stays free; one contextual strategy CTA.
// ══════════════════════════════════════════════════════════════════════
check('exactly one upgrade CTA in the component', (src.match(/onUpgrade\?\./g) || []).length === 1)
check('the Pro footer only renders for non-Pro', src.includes('!isPro &&'))
check('the Pro footer is gated on there being something real to build on',
  src.includes('!isPro && (bestWindow || platforms.length > 0)'))
check('the CTA is outcome-oriented, not a generic upgrade prompt',
  raw.includes('Build My Strategy') && !raw.includes('>Upgrade to Pro<'))
check('no chart or section is hidden behind the paywall (Free sees the evidence)',
  !/isPro\s*\?[\s\S]{0,120}(blur|locked|🔒)/i.test(src))

// ══════════════════════════════════════════════════════════════════════
// 8. WIRING + NO DUPLICATION WITH THE COMMAND CENTER.
// ══════════════════════════════════════════════════════════════════════
check('Performance is imported by the dashboard', page.includes("import Performance from './Performance'"))
check('Performance is rendered on the platforms tab', page.includes('<Performance'))
check('the growth charts are passed in rather than re-mounted separately',
  page.includes('earningsTrend={') && page.includes('<DashboardGrowthCharts'))
check('the legacy inline Platform Comparison card is gone', !page.includes('🎯 Platform Comparison'))
check('the legacy per-platform hourly heatmap is gone', !page.includes('Earnings by hour of day (your local time)'))
// The legacy card ranked a platform's "Peak time" by RAW TOTAL $ earned in an
// hour bucket — precisely what canonical-analytics-rules.md forbids, and a
// second answer to a question canonicalBestTimes already owns. Not reintroduced.
check('the retired total-$ "Peak time" ranking is not reintroduced anywhere',
  !page.includes('total earned)') && !src.includes('total earned)'))
check('Performance does not repeat the Command Center\'s recommendation language',
  !src.includes('Your next best move') && !src.includes('Go live'))
check('the Command Center still owns the recommendation', cc.includes('Your next best move'))

// ══════════════════════════════════════════════════════════════════════
// SINGLE-PLATFORM STATE
//
// A creator with one platform used to get the heading "Platform performance"
// above exactly one card — a comparison of one thing. The data was correct and
// the grid already collapsed to one column; the FRAMING was the defect, and it
// made the product read as a multi-platform dashboard the creator was seeing a
// stripped-down version of.
// ══════════════════════════════════════════════════════════════════════
check('one platform gets its own section, not a comparison',
  src.includes('platforms.length === 1 ? (') && src.includes('<SinglePlatformPerformance'))
check('the section is named from the creator\'s real platform, never hard-coded',
  /Your \{p\.platform\} performance/.test(src) &&
  !/Your Chaturbate performance/.test(src))
// Scoped to the single-platform COMPONENT BODY. An earlier version of this
// check sliced between the ternary and the comparison branch, which contains
// only the JSX call — so it passed no matter what the component rendered.
check('one platform never renders the comparison heading',
  (() => {
    const i = src.indexOf('function SinglePlatformPerformance')
    const j = src.indexOf('export default function Performance')
    return i > 0 && j > i && !src.slice(i, j).includes('Platform performance')
  })())
check('the comparison branch is still reached for 2+ platforms',
  src.includes('Platform performance') && src.includes('platformEfficiencyGap'))
check('zero platforms keeps the existing empty state',
  src.includes('Import your tip history to see how your platforms compare.'))
check('low data shows a threshold state, never a chart',
  /still learning your pattern/.test(src) && /MIN_TREND_SESSIONS/.test(src))
check('the low-data threshold is a named constant, not a magic number',
  /const MIN_TREND_SESSIONS = \d/.test(src))
check('momentum requires a real prior month AND a measurable delta',
  /momentum && platDelta != null && Math\.abs\(platDelta\) >= 1/.test(src))
check('momentum does not restate the percentage "What changed" already shows',
  (() => {
    const i = src.indexOf('perf-solo-row-k')
    const blk = src.slice(i, i + 1200)
    return !/Math\.abs\(momentum\.pct\)/.test(blk)
  })())
check('an earning window is only named when the canonical tier backs it',
  /p\.bestWindowConfidence !== "low"/.test(src))
check('the single-platform section computes nothing of its own',
  (() => {
    const i = src.indexOf('function SinglePlatformPerformance')
    const blk = src.slice(i, src.indexOf('export default function Performance'))
    return i > 0 && !/aggregateRows|\.reduce\(|detectSessions/.test(blk)
  })())
check('no new paywall was added to this page',
  (src.match(/isPro/g) || []).length <= 3 &&
  !/SinglePlatformPerformance[\s\S]{0,3000}isPro/.test(src))
check('no fabricated numbers or urgency on this page',
  !/\d{1,3}%\s*(more|increase|boost)\b/i.test(src) &&
  !/limited time|act now|expires/i.test(src))
// ── Button consolidation ──────────────────────────────────────────────
check('the bespoke local BrandButton is gone',
  !/function BrandButton/.test(src))
check('the page uses the shared signature UnlockButton',
  /import \{ UnlockButton \}/.test(src) && /<UnlockButton/.test(src))
check('the gradient that remains is for bars, not a second button style',
  /const BAR_GRADIENT/.test(src) && !/CTA_GRADIENT/.test(src))
check('the existing conversion CTA is intact',
  /performance_strategy/.test(src) && /Build My Strategy/.test(src))

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
