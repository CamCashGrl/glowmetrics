// Regression guard: the Platforms tab (app/dashboard/Performance.js) is the
// per-platform evidence layer, and it computes nothing.
//
// This tab is the most metric-dense surface in the product — denser than the
// Command Center — so it is the likeliest place for local aggregation to creep
// back in. That is the failure mode the whole analytics audit existed to
// remove: components independently recomputing metrics and disagreeing with
// each other. These checks fail the build if it starts aggregating, if it
// invents a second best-time answer, or if it hardcodes a ranking.
//
// The tab was rebuilt around one question — "how is each platform doing?" —
// so the account-wide snapshot strip, the earnings/$-per-hour trend charts,
// the session-performance split and the day-of-week chart are gone (they
// answer "how am I doing overall?", which is the Overview/Command Center's
// question). The checks below track the sections that exist now; the honesty
// rules they enforce are unchanged.

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
const engine = strip(readFileSync(new URL('../lib/analytics.js', import.meta.url), 'utf8'))

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
// Revenue share is the one ratio computed here. It is a presentational split
// of canonical platform totals against THEIR OWN sum — using the account-wide
// analytics.totalUSD as the denominator would silently mix two populations
// (that figure counts tips outside any qualifying session), so the shares
// would understate every platform and never reach 100%.
check('revenue share divides canonical platform totals by their own sum',
  src.includes('platforms.reduce((s, p) => s + (p.totalUSD || 0), 0)') &&
  src.includes('p.totalUSD / platformTotal'))
check('revenue share does not divide by the account-wide total',
  !/analytics\?\.totalUSD/.test(src))

// ══════════════════════════════════════════════════════════════════════
// 2. READS THE CANONICAL FIELDS, BY NAME.
// ══════════════════════════════════════════════════════════════════════
for (const field of [
  'analytics?.platforms',
  'analytics?.latestPlatformDelta',
  'analytics?.missedRevenue?.cumulative_by_platform',
]) {
  check(`reads ${field}`, src.includes(field))
}
for (const field of ['totalUSD', 'usdPerHour', 'avgTipSize', 'uniqueFans', 'sessions', 'hours', 'tips']) {
  check(`platform cards read the canonical platforms[].${field}`, new RegExp(`p\\.${field}\\b`).test(src))
}
// The per-platform fan count must stay a single canonical field. Summing
// sessions[].uniqueFans in a component would double-count every returning
// supporter — the engine dedupes them once, over the same meaningfulSessions
// population every other platforms[] figure is built from.
check('per-platform unique fans is produced by the engine, not the component',
  engine.includes('uniqueFans:    _fans.size') && !/uniqueFans\s*\+=/.test(src))

// ══════════════════════════════════════════════════════════════════════
// 3. ONE BEST-TIME ANSWER. The tab must never rank its own.
// ══════════════════════════════════════════════════════════════════════
check('the per-platform window comes from the canonical platforms[] fields',
  src.includes('p.bestLocalDay') && src.includes('p.bestLocalHour'))
check('confidence wording is driven by the canonical tier', src.includes('TIER_COPY[p.bestWindowConfidence]'))
check('the best window is never shown without its confidence tier',
  !/bestLocalDay[\s\S]{0,900}?<\/div>\s*\)\}/.test(src) || src.includes('p.bestWindowConfidence'))
check('does not claim a tier the engine calls insufficient', !src.includes('insufficient:'))
// The account-wide day view may RESHAPE the canonical grid for display, but
// never rebuild it: it drops the tier the engine calls insufficient and sums
// canonical totals/counts, and it must not re-rank days by a rate it computed
// itself (that would be a second best-time answer).
check('the day view filters out the tier the engine calls insufficient',
  src.includes('grid.filter(g => g.tier !== "insufficient")'))
check('the day view sums canonical totals/counts, it does not re-rank by a computed rate',
  src.includes('map[g.localDay].totalUsd += g.totalUsd') && !/byDay[\s\S]{0,200}usdPerHour/.test(src))
check('the total-$ day chart explicitly states its unit', raw.includes('Total earned by day of week'))
check('the chart explains why the biggest bar is not necessarily the best window',
  raw.includes("biggest bar isn&apos;t always your best window"))
check('the explanation names the actual ranking statistic ($/hour median)',
  raw.includes('highest median') && raw.includes('$/hour'))
check('no per-platform hour grid is rebuilt here',
  !/\b(bestHourByDay|platHourUSD|platDayHourUSD)\b/.test(src))

// ══════════════════════════════════════════════════════════════════════
// 4. NO FABRICATED STATISTICS — the failure mode this engagement kept
//    surfacing (hardcoded "+101%", "2x", "5x", a hand-declared "best").
// ══════════════════════════════════════════════════════════════════════
check('no hardcoded percentage claims in copy', !/\+\d{1,3}%\s*(more|higher|better)/.test(src))
check('no hardcoded "Nx" multiplier literals in copy', !/>\s*\d+(\.\d+)?x\s*</.test(src))
check('every multiplier shown is computed from two canonical values',
  src.includes('top.usdPerHour / bottom.usdPerHour'))
// The comparison table highlights a leader per row. It must be derived from
// the current values — a hand-declared winner goes stale the moment the
// underlying data moves.
check('the comparison table computes its leader from the current values',
  src.includes('[...eligible].sort((a, b) => row.get(b) - row.get(a))[0]'))
check('rows whose figure is not measurable cannot win their row',
  src.includes('platforms.filter(row.eligible)'))
check('volume rows are not ranked as if they were performance',
  src.includes('noLeader: true'))
// Insights are generated from the platform numbers, never written by hand.
check('insights are generated from sorted canonical values',
  src.includes('sort((a, b) => b.usdPerHour - a.usdPerHour)') &&
  src.includes('sort((a, b) => b.totalUSD - a.totalUSD)'))
check('insights are capped so the section cannot become a wall', src.includes('.slice(0, 4)'))
check('insights are suppressed when there is nothing to compare against',
  src.includes('if (platforms.length < 2) return []'))

// ══════════════════════════════════════════════════════════════════════
// 5. HONEST EMPTY / SPARSE STATES — never a fabricated or broken section.
// ══════════════════════════════════════════════════════════════════════
check('the tab degrades to an honest message with no imported platforms',
  raw.includes('Import your tip history to see how each of your platforms is performing.'))
check('attribution uses the required honest fallback wording',
  raw.includes('Not enough history to attribute this change.'))
check('attribution distinguishes a single-platform account from missing history',
  raw.includes('Single-platform account'))
check('attribution is gated on having at least two platforms AND a material delta',
  src.includes('delta.platforms.length >= 2') && src.includes('Math.abs(delta.totalDeltaUSD) >= 1'))
check('comparison and distribution are suppressed for a single platform',
  (src.match(/platforms\.length > 1 &&/g) || []).length >= 2)
check('a platform with no measurable hours shows no hourly rate rather than $0.00/hr',
  src.includes('p.hours > 0 ? `${fmtUsd(p.usdPerHour)}/hr` : "—"'))

// ══════════════════════════════════════════════════════════════════════
// 6. SCOPE LABELLING — the session-scoped platform total must never read
//    as an account-wide total (the exact ambiguity flagged in the audit).
// ══════════════════════════════════════════════════════════════════════
check('per-platform earnings are labeled "in qualifying sessions", not "total"',
  raw.includes('in qualifying sessions'))
check('platform hourly rate carries an explicit /hr unit and label',
  src.includes('usdPerHour)}/hr') && raw.includes('Hourly average'))
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

// ══════════════════════════════════════════════════════════════════════
// 7. FREE vs PRO — evidence stays free; one contextual strategy CTA.
// ══════════════════════════════════════════════════════════════════════
check('exactly one upgrade CTA in the component', (src.match(/onUpgrade\?\./g) || []).length === 1)
check('the Pro footer only renders for non-Pro', src.includes('!isPro &&'))
check('the Pro footer is gated on there being something real to build on',
  src.includes('!isPro && hasPlatforms'))
check('the CTA is outcome-oriented, not a generic upgrade prompt',
  raw.includes('Build My Strategy') && !raw.includes('>Upgrade to Pro<'))
check('no chart or section is hidden behind the paywall (Free sees the evidence)',
  !/isPro\s*\?[\s\S]{0,120}(blur|locked|🔒)/i.test(src))

// ══════════════════════════════════════════════════════════════════════
// 8. WIRING + NO DUPLICATION WITH THE COMMAND CENTER.
// ══════════════════════════════════════════════════════════════════════
check('Performance is imported by the dashboard', page.includes("import Performance from './Performance'"))
check('Performance is rendered on the platforms tab', page.includes('<Performance'))
// The account-wide trend charts answer "how am I doing overall", so they are
// still passed in (they need raw tips/sessions this component never receives)
// but must render inside the clearly-labelled account-wide block at the
// bottom — never as the first thing on a per-platform page.
check('the growth charts are passed in rather than re-mounted separately',
  page.includes('earningsTrend={') && page.includes('<DashboardGrowthCharts'))
check('the growth charts render inside the account-wide block, not above the platform cards',
  src.indexOf('Your platforms') < src.indexOf('{earningsTrend}') &&
  src.indexOf('Account-wide context') < src.indexOf('{earningsTrend}'))
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
