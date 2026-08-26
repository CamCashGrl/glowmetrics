// Regression coverage for the Command Center redesign.
//
// The single most important property of this component is that it computes
// NOTHING. The audit that preceded the redesign existed because UI components
// were aggregating metrics locally and disagreeing with each other; the new
// Command Center is the most metric-dense surface in the product, so it is the
// most likely place for that to creep back in. These checks fail the build if
// it starts aggregating.

import { readFileSync } from 'fs'

let pass = 0, fail = 0
function check(name, cond) { if (cond) { pass++; console.log(`PASS  ${name}`) } else { fail++; console.log(`FAIL  ${name}`) } }

const raw = readFileSync(new URL('../app/dashboard/CommandCenter.js', import.meta.url), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const src = strip(raw)
const page = strip(readFileSync(new URL('../app/dashboard/page.js', import.meta.url), 'utf8'))

// ══════════════════════════════════════════════════════════════════════
// 1. NO LOCAL AGGREGATION — the component may sort/slice/filter for
//    presentation, but must never sum or average raw tips/sessions.
// ══════════════════════════════════════════════════════════════════════
check('no .reduce() over tips', !/tips\s*\.\s*reduce/.test(src))
check('no .reduce() over sessions', !/sessions\s*\.\s*reduce/.test(src))
check('does not receive raw tips as a prop', !/\btips\s*[,}]/.test(src.split('export default')[1] || ''))
check('does not import the analytics engine (reads props only)', !src.includes("from '../../lib/analytics"))
check('does not import session detection', !src.includes('detectSessions'))
check('does not re-derive an hourly rate', !/totalUSD\s*\/\s*.*hours/i.test(src))

// ══════════════════════════════════════════════════════════════════════
// 2. READS THE CANONICAL FIELDS — the frozen layer, by name.
// ══════════════════════════════════════════════════════════════════════
for (const field of [
  'canonicalBestTimes?.bestWindow',
  'canonicalBestTimes?.earlySignal',
  'bestWindowFanOverlap',
  'estimatedHourlyRate',
  'totalUSD',
  'uniqueFanCount',
  'meaningfulSessionCount',
  'totalStreamMinutes',
  'missedRevenue?.cumulative_by_platform',
]) {
  check(`reads analytics.${field}`, src.includes(field))
}

// ══════════════════════════════════════════════════════════════════════
// 3. NO FABRICATED STATISTICS — the failure mode this whole engagement
//    kept surfacing (hardcoded "+101%", "2x", "5x" multipliers).
// ══════════════════════════════════════════════════════════════════════
check('no hardcoded percentage claims in copy', !/\+\d{1,3}%\s*(more|higher|better)/.test(src))
check('no hardcoded "Nx" multiplier claims in copy', !/>\s*\d+x\s*</.test(src))
// 2C-2: the local TIER_COPY table is retired. Confidence wording now comes
// from the ONE canonical ladder via <ConfidenceBadge>, which reads
// computeIntelligence()'s peak_window state — a stronger version of the same
// guarantee this check has always been for (the word beside a claim is never
// invented locally).
check('confidence wording comes from the canonical intelligence state',
  /<ConfidenceBadge[^>]*insight="peak_window"/.test(src))
check('no local confidence vocabulary remains', !src.includes('TIER_COPY'))
check('the badge is fed the canonical intelligence object', src.includes('intelligence={intelligence}'))
check('does not claim a tier the engine calls insufficient', !src.includes('insufficient:'))

// ══════════════════════════════════════════════════════════════════════
// 4. EMPTY / SPARSE STATES — never a broken or fabricated card.
//    Verified against the engine: a 12-tip account yields bestWindow=null
//    and bestWindowFanOverlap=null, so every consumer must be guarded.
// ══════════════════════════════════════════════════════════════════════
check('hero is gated on a real window', src.includes('const hasWindow = !!bestWindow'))
check('evidence chips are gated on hasWindow', /hasWindow\s*&&\s*\(\s*<div style=\{\{ display: "grid"/.test(src))
check('fan overlap chip handles the null case', src.includes('overlap?.count'))
// The hero's right column is gated on hasWindow, and the opportunity figure
// inside it is separately gated on a real measured topGap — so neither can
// render without the canonical value behind it.
check('hero right column is gated on a real window', /\{hasWindow && \(/.test(src))
check('opportunity figure is separately gated on a measured gap', /\{topGap && \(/.test(src))
check('opportunity is quoted for the recommended 2-hour window', src.includes('const WINDOW_HOURS = 2'))
check('falls back to earlySignal rather than inventing a window', src.includes('earlySignal ?'))
check('states plainly when there is not enough history', raw.includes('Not enough history for a reliable window yet'))

// ══════════════════════════════════════════════════════════════════════
// 5. FREE vs PRO — one contextual upsell, not a paywall per section.
// ══════════════════════════════════════════════════════════════════════
check('Pro footer only renders for non-Pro', src.includes('!isPro && hasWindow'))
check('exactly one upgrade CTA in the component', (src.match(/onUpgrade\?\./g) || []).length === 1)
check('Free still sees the real window (not blurred out)', src.includes('fmtWindow(bestWindow.localHour)'))
check('Free still sees real totals', src.includes('fmtUsd(totalUSD)'))

// ══════════════════════════════════════════════════════════════════════
// 6. BRAND — uses the dashboard's own tokens, not a new scheme.
// ══════════════════════════════════════════════════════════════════════
check('inherits the dashboard palette values', src.includes('"#05070f"') && src.includes('"#22D3EE"') && src.includes('"#7C5CFF"'))
check('uses the CamCash cyan->purple->pink gradient', src.includes('#22D3EE 0%,#7C5CFF 48%,#EC4899 100%'))
check('uses the shared glass card treatment', src.includes('rgba(15,20,32,0.75)'))

// ══════════════════════════════════════════════════════════════════════
// 7. WIRING — mounted on Overview, old sections replaced not duplicated.
// ══════════════════════════════════════════════════════════════════════
check('CommandCenter is imported by the dashboard', page.includes("import CommandCenter from './CommandCenter'"))
check('CommandCenter is rendered', page.includes('<CommandCenter'))
check('old Money Snapshot section is gone', !page.includes('1. MONEY SNAPSHOT'))
check('old Daily Brief block is gone', !page.includes('DAILY BRIEF — always visible'))
check('growth charts were relocated, not deleted', page.includes('<DashboardGrowthCharts'))

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
