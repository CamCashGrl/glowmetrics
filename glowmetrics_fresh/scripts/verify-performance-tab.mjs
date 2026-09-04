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
// 2C-2: the local TIER_COPY table is retired. The window's confidence word now
// comes from the ONE canonical ladder via <ConfidenceBadge> — the account-level
// peak_window state for the section heading, and fromConfidenceTier() for each
// platform's own bucket tier. Same guarantee, one vocabulary instead of four.
check('confidence wording comes from the canonical intelligence state',
  /<ConfidenceBadge[^>]*insight="peak_window"/.test(src))
check('per-platform tiers are mapped onto the canonical ladder',
  src.includes('fromConfidenceTier(p.bestWindowConfidence)'))
check('no local confidence vocabulary remains', !src.includes('TIER_COPY'))
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
// 2C-6 moved the conversion on this tab. The generic "Build My Strategy"
// footer is gone: it was a second undifferentiated upsell beneath the
// contextual platform discovery, and it sold "a forecast" that is held and
// unshipped. The guard's intent — exactly one, outcome-oriented, evidence-
// gated CTA on this tab — is unchanged and now checked against that block.
const read = (rel) => readFileSync(new URL('../' + rel, import.meta.url), 'utf8')
check('exactly one upgrade CTA in the component', (src.match(/onUpgrade\?\./g) || []).length === 1)
check('the conversion is the contextual platform discovery', src.includes('<PlatformOpportunity'))
check('it is gated on the plan', src.includes('isPro={isPro}'))
check('it is gated on there being a real comparison behind it',
  read('app/dashboard/PlatformOpportunity.jsx').includes('if (rankable.length < 2)'))
check('the CTA is outcome-oriented, not a generic upgrade prompt',
  read('app/dashboard/PlatformOpportunity.jsx').includes('Compare my platforms →')
  && !raw.includes('>Upgrade to Pro<'))
check('the retired footer no longer promises a forecast',
  !src.includes('and a forecast into one personalized weekly schedule'))
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

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
