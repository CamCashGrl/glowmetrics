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
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')

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
check('confidence wording is driven by the canonical tier', src.includes('TIER_COPY[bestWindow.tier]'))
check('tier map covers exactly the canonical tiers', ['high', 'supported', 'promising'].every(t => new RegExp(`\\b${t}:`).test(src)))
check('does not claim a tier the engine calls insufficient', !src.includes('insufficient:'))

// ══════════════════════════════════════════════════════════════════════
// 4. EMPTY / SPARSE STATES — never a broken or fabricated card.
//    Verified against the engine: a 12-tip account yields bestWindow=null
//    and bestWindowFanOverlap=null, so every consumer must be guarded.
// ══════════════════════════════════════════════════════════════════════
check('hero is gated on a real window', src.includes('const hasWindow = !!bestWindow'))
check('the evidence strip is gated on hasWindow', /hasWindow && \(\s*<div className="cc-evidence"/.test(src))
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
// The rule is "at most ONE upsell visible at a time", and one in the source,
// so the guarantee survives but is not defeated by a copy/paste second CTA.
// The contextual "your history is locked" argument now lives in
// ConversionBand.js, above the Command Center, so this component is back to a
// single upgrade CTA gated on a real measured window.
check('exactly one upgrade CTA renders in the Command Center',
  (src.match(/onUpgrade\?\./g) || []).length === 1 &&
  src.includes('!isPro && hasWindow'))
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


// ══════════════════════════════════════════════════════════════════════
// LOW-DATA STATES (P0)
//
// The Command Center used to be weakest exactly when a creator was newest:
// below the window threshold the hero's right half was gated off entirely and
// rendered ~50% blank, and the fan card degraded into a paragraph explaining
// it had nothing to say. Both are the first thing a new creator sees.
// ══════════════════════════════════════════════════════════════════════
check('the low-data hero fills its right half instead of rendering blank',
  src.includes('{!hasWindow && <LearningPanel') && src.includes('function LearningPanel'))
check('the rich hero is untouched — still gated on hasWindow',
  src.includes('{hasWindow && (') && src.includes('<WindowProof'))
check('the learning progress uses the CANONICAL window threshold, not a guess',
  /const SESSIONS_FOR_WINDOW = 4/.test(src) &&
  /bestTimes\.js/.test(raw))
check('progress is only shown against a real slot count, never invented',
  /const have = earlySignal\?\.sessionCount \?\? 0/.test(src) &&
  /earlySignal \? \(/.test(src))
check('with no earlySignal it states counts and the rule, no fake denominator',
  /cc-learn-stats/.test(src) && /streams in the same day and hour/.test(src))
check('the learning panel invents no metric of its own',
  (() => {
    const i = src.indexOf('function LearningPanel')
    const j = src.indexOf('export default function CommandCenter')
    return i > 0 && j > i && !/aggregateRows|\.reduce\(|Math\.random/.test(src.slice(i, j))
  })())

check('the fan apology paragraph is gone',
  !/This fills in as your fans build a repeat pattern/.test(src))
check('with supporters but none due, it states a real fact compactly',
  /supporter\{whales\.length === 1 \? "" : "s"\} tracked/.test(src) &&
  /MIN_TIPS_FOR_TIMING/.test(src))
check('with NO supporters at all the section is hidden, not apologetic',
  /\{whales\.length > 0 && \(/.test(src))
check('the timing threshold in the copy cannot drift from the filter',
  /const MIN_TIPS_FOR_TIMING = 3/.test(src) &&
  /w\.tipCount >= MIN_TIPS_FOR_TIMING/.test(src))
check('meaningful fan data still renders the existing attention rows',
  /returningSoon\.length > 0 \?/.test(src) && /returningSoon\.map/.test(src))

check('the money-story value can no longer be truncated',
  !/whiteSpace: "nowrap", overflow: "hidden", textOverflow/.test(src) &&
  /fontSize: "clamp\(16px, 1\.55vw, 26px\)"/.test(src))

// ── Conversion: reuse, never duplicate ───────────────────────────────
// The low-data conversion moment is ALREADY handled above the Command Center
// by ConversionBand, whose context (buildConversionContext in page.js) does
// not depend on hasWindow at all — it fires on lockedHistory, platformCap or
// sparseRecent. Adding a second CTA here would double up on one screen.
check('no second conversion CTA was added for the low-data state',
  (src.match(/onUpgrade\?\./g) || []).length === 1)
check('the Pro footer still requires a real measured window',
  /\{!isPro && hasWindow && \(/.test(src))
check('the dashboard still renders ConversionBand above the Command Center',
  page.indexOf('<ConversionBand') > 0 &&
  page.indexOf('<ConversionBand') < page.indexOf('<CommandCenter'))
check('that band does not depend on hasWindow',
  !/bestWindow|hasWindow/.test(page.slice(page.indexOf('function buildConversionContext'), page.indexOf('function buildConversionContext') + 1800)))
check('no new paywall was applied to existing free data',
  (src.match(/isPro/g) || []).length <= 3)

// ══════════════════════════════════════════════════════════════════════
// EVIDENCE STRIP — additive only.
// The row under the hero used to carry four cards, two of which restated
// the hero verbatim: "Best window" repeated the day+hour the hero already
// names, and "Sample behind it" repeated the session count already printed
// inside the hero's proof line. Repetition reads as padding, so the row is
// now a divided strip of items that each say something the hero does not.
// ══════════════════════════════════════════════════════════════════════
check('the "Best window" chip that restated the hero is gone',
  !/title="Best window"/.test(src) && !/Best window/.test(src))
check('the "Sample behind it" chip that restated the proof line is gone',
  !/Sample behind it/.test(src))
check('the hero still names the window itself — the fact was not lost with the chip',
  /<WindowProof/.test(src) &&
  /Go live \{fmtWindow\(bestWindow\.localHour\)\}/.test(src) &&
  /\{bestWindow\.localDay\}s are your highest-earning window/.test(src))
check('the hero still carries the sample size — the fact was not lost with the chip',
  /\{bestWindow\.sessionCount\} qualifying session/.test(src))

check('the surviving items render as a strip, not as separate cards',
  /className="cc-evidence"/.test(src) &&
  /function EvidenceItem/.test(src) && !/function Chip\b/.test(src))
check('the strip is styled and can collapse its divider on narrow screens',
  /\.cc-evidence\s*\{[^}]*grid-template-columns/.test(css) &&
  /\.cc-evidence-item \+ \.cc-evidence-item\s*\{ box-shadow: inset 1px 0 0/.test(css) &&
  /@media \(max-width: 560px\)\s*\{[\s\S]{0,400}\.cc-evidence\s*\{[^}]*minmax\(0, 1fr\)/.test(css))
check('fan overlap is retained — it is the one fact the hero never states',
  /"Fans active in it"/.test(src) && /bestWindowFanOverlap/.test(src))
check('platform evidence is retained with its own rate and sample',
  /topPlatform\.usdPerHour/.test(src) && /topPlatform\.sessions/.test(src))
check('the "#1" claim is only made when there is something to rank against',
  /platforms\.length > 1 \? `\$\{topPlatform\.platform\} is #1`/.test(src))
check('a single-platform creator is never told their only platform is #1',
  / : topPlatform\.platform/.test(src))
check('removing the chips added no new CTA to the strip',
  (src.match(/onUpgrade\?\./g) || []).length === 1)

// ══════════════════════════════════════════════════════════════════════
// ONE SIGNATURE CTA TREATMENT.
// The Command Center defined its own BrandButton with its own gradient and
// hover, so its two primary CTAs did not match the signature Button used on
// the landing page, Performance, Sessions and the Live Mode Pro state.
// ══════════════════════════════════════════════════════════════════════
check('the local BrandButton duplicate is gone', !/BrandButton/.test(src))
check('both primary CTAs use the canonical signature Button',
  (src.match(/<Button /g) || []).length === 2 &&
  /import Button from "\.\.\/\.\.\/components\/ui\/Button"/.test(src))
check('the Plan-My-Stream CTA survived the swap',
  /<Button onClick=\{onPlanStream\}/.test(src))
check('the single contextual upsell survived the swap',
  /<Button onClick=\{\(\) => onUpgrade\?\.\("command_center_strategy"\)\}/.test(src))
check('both CTAs meet the 44px touch target',
  (src.match(/minHeight: 44/g) || []).length === 2)
check('still exactly ONE upsell — no paywall was added to other sections',
  (src.match(/onUpgrade\?\./g) || []).length === 1)
check('that upsell is still gated on a real measured window',
  /\{!isPro && hasWindow && \(/.test(src))

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
