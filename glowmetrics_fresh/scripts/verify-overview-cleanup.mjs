// Overview/Fans cleanup regression, covering two passes:
//
// PHASE 2 pinned where the old Overview's eight legacy sections ended up
// once CommandCenter stopped sitting above them unchanged:
//
//   "Make Money Right Now"    -> CommandCenter (nowActions prop)
//   "Your Top Earners"        -> Fans (whales tab)
//   "Smart Insights"          -> removed (every insight restated a claim
//                                already rendered by the card that owns it)
//
// "What's Working", "You're Losing Money", and "Revenue Dependency Risk"
// were ALSO relocated to the platforms tab in Phase 2, as raw JSX moved
// verbatim out of Overview. PHASE 3 then replaced that raw JSX with
// app/dashboard/Performance.js, a dedicated component reading the same
// canonical fields through props rather than a local block — so section 1/2
// below now pin CAPABILITY (the equivalent evidence exists in Performance,
// reading the same canonical field), not literal string relocation. This is
// why the old heatmap's browser-timezone defect (6a) can't recur structurally:
// Performance.js never touches a raw date or timezone at all, it only reads
// analytics.canonicalBestTimes.grid, which is timezone-correct by construction.
//
// This file also pins the fabricated-probability-badge fix on the "Likely
// Online Now" fan list (6b, unrelated to Performance, still Fans-tab work).

import { readFileSync } from 'fs'

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`) }
}

const raw = readFileSync(new URL('../app/dashboard/page.js', import.meta.url), 'utf8')
const cc = readFileSync(new URL('../app/dashboard/CommandCenter.js', import.meta.url), 'utf8')
const perf = readFileSync(new URL('../app/dashboard/Performance.js', import.meta.url), 'utf8')
const fans = readFileSync(new URL('../app/dashboard/Fans.js', import.meta.url), 'utf8')

// Assertions about what REACHES THE SCREEN must not be satisfied by the
// explanatory comments the relocation deliberately left behind.
const strip = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')
const src = strip(raw)

// ── Carve the file into per-tab regions so "which tab renders this?" is an
//    actual containment question rather than a whole-file grep.
function region(startMarker, endMarkers) {
  const i = src.indexOf(startMarker)
  if (i === -1) return null
  let end = src.length
  for (const m of endMarkers) {
    const j = src.indexOf(m, i + startMarker.length)
    if (j !== -1 && j < end) end = j
  }
  return src.slice(i, end)
}
// The overview tab is now two sibling blocks: the post-stream report takes
// the tab over when opened, and everything else renders when it is not. The
// second block is the Overview proper — CommandCenter, ConversionBand and
// the checklist all live there — so that is the region these checks slice.
const OVERVIEW = region('{activeTab === "overview" && !viewingReport && (', ['{activeTab === "platforms"'])
const PLATFORMS = region('{activeTab === "platforms" && (', ['{activeTab === "whales"'])
const FANS = region('{activeTab === "whales" && (', ['{activeTab === "live"'])

check('the overview region is identifiable', !!OVERVIEW)
check('the platforms (Performance) region is identifiable', !!PLATFORMS)
check('the whales (Fans) region is identifiable', !!FANS)

// ══════════════════════════════════════════════════════════════════════
// 1. NOTHING WAS DELETED WITHOUT A DESTINATION.
//    "Your Top Earners" is still a literal relocation (Phase 2, unchanged
//    by Phase 3) — checked against the raw string. "What's Working" /
//    "You're Losing Money" / "Revenue Dependency Risk" no longer exist as
//    literal headings anywhere (Phase 3 replaced that JSX with
//    Performance.js) — checked as CAPABILITY below instead: the platforms
//    tab renders <Performance>, and Performance.js contains the equivalent
//    evidence, reading the same canonical fields.
// ══════════════════════════════════════════════════════════════════════
// "Your Top Earners" was relocated to the whales tab in Phase 2, then
// replaced in Phase 4 by app/dashboard/Fans.js — so, like the Performance
// sections above, it is now checked as CAPABILITY rather than literal markup.
check('the whales tab renders the Fans component (not the old inline sections)',
  FANS.includes('<Fans'))
check('"Your Top Earners" no longer renders on Overview', !(OVERVIEW || '').includes('>Your Top Earners<'))
check('the top-earner ranking survived into Fans, reading the canonical whales array',
  fans.includes('analytics?.whales') && fans.includes('b.totalUSD - a.totalUSD'))

check('the platforms tab renders the Performance component (not the old inline sections)',
  PLATFORMS.includes('<Performance'))
check('the platforms tab no longer contains the old inline "What\'s Working" heading',
  !PLATFORMS.includes(">What's Working<"))
check('the platforms tab no longer contains the old inline "You\'re Losing Money" heading',
  !PLATFORMS.includes(">You're Losing Money<"))

// ══════════════════════════════════════════════════════════════════════
// 2. THE SUPPORTING EVIDENCE EXISTS IN PERFORMANCE.JS, READING THE SAME
//    CANONICAL FIELDS — capability preserved, not the exact old markup.
// ══════════════════════════════════════════════════════════════════════
check('platform ROI/rate evidence exists in Performance (analytics.platforms, usdPerHour)',
  perf.includes('analytics?.platforms') && perf.includes('p.usdPerHour'))
check('a day/time evidence view exists in Performance, sourced from the canonical grid (not a new bucketing)',
  perf.includes('analytics?.canonicalBestTimes?.grid'))
check('missed-revenue ranking exists in Performance, reading the canonical module\'s field',
  perf.includes('analytics?.missedRevenue?.cumulative_by_platform') && perf.includes('rateGapUsdPerHour'))
check('dependency-risk figures exist in Performance, reading the canonical field',
  perf.includes('analytics?.dependencyRisk') && perf.includes('dep.top1Pct'))
// The old three fixed buckets (Likely Online / Close to Milestone / At Risk)
// became rule-driven priority bands in Fans.js, each stating its own reason
// and action. Checked as capability: the equivalent timing, churn and
// best-window signals all still drive the list, from canonical fields.
check('a returning-soon signal still drives the list', fans.includes('returning_soon') && fans.includes('expectedNextTip'))
check('an at-risk/cooling signal still drives the list', fans.includes('cooling_off') && fans.includes('churnRisk'))
check('an overdue signal still drives the list', fans.includes('overdue_high_value'))
check('best-window overlap still drives the list', fans.includes('best_window') && fans.includes('bestWindowUsernames'))
check('the fan message action survived the rebuild', FANS.includes('setMessageTarget') && fans.includes('onMessage'))

// ══════════════════════════════════════════════════════════════════════
// 3. "MAKE MONEY RIGHT NOW" LANDED INSIDE THE COMMAND CENTER, and the
//    Command Center still computes nothing — the merge stayed in the
//    dashboard where its sources already live.
// ══════════════════════════════════════════════════════════════════════
check('the merged action list is passed to CommandCenter as a prop', src.includes('nowActions={'))
check('the go-live signal survived the move', src.includes('engineInsights?.go_live_status?.status'))
check('nextMoves survived the move', src.includes('(nextMoves || []).forEach'))
check('realTimeAlerts survived the move', src.includes('(realTimeAlerts || []).slice(0, 3)'))
check('the fan-message action survived the move', src.includes('onMessageFan={'))
check('CommandCenter renders the prepared list', cc.includes('nowActions.map'))
check('CommandCenter does not merge or rank it itself',
  !/nowActions[\s\S]{0,80}\.(sort|reduce|filter)\(/.test(strip(cc)))
check('the old standalone "Make Money Right Now" card is gone from Overview',
  !src.includes('>Make Money Right Now<'))

// ══════════════════════════════════════════════════════════════════════
// 4. SMART INSIGHTS — removed, not relocated. Every claim it made is
//    still on screen, owned by exactly one card.
// ══════════════════════════════════════════════════════════════════════
check('the Smart Insights card no longer renders', !src.includes('>Smart Insights<'))
check('its peak-window claim is still owned by the Command Center hero',
  cc.includes('bestWindow.medianUsdPerHour'))
check('its highest-ROI-platform claim is still owned by Performance',
  perf.includes('platformEfficiencyGap'))
check('its top-supporter claim is still owned by the Fans tab', fans.includes('lifetime'))
check('the unsupported "60-minute sessions earn disproportionately more" claim is gone',
  !src.includes('earn disproportionately more'))
check('the removal is documented rather than silent',
  raw.includes('"Smart Insights" was NOT relocated'))

// ══════════════════════════════════════════════════════════════════════
// 5. THE OVERVIEW IS NOW ONE SURFACE.
// ══════════════════════════════════════════════════════════════════════
check('Overview renders the Command Center', OVERVIEW.includes('<CommandCenter'))
check('Overview has no leftover legacy section dividers',
  !OVERVIEW.includes('{/* section divider */}'))
check('Overview renders no second stack of glass cards after the Command Center',
  (OVERVIEW.match(/\.\.\.glassCard/g) || []).length === 0,
  `found ${(OVERVIEW.match(/\.\.\.glassCard/g) || []).length}`)

// ══════════════════════════════════════════════════════════════════════
// 6. DEFECTS FOUND WHILE RELOCATING.
// ══════════════════════════════════════════════════════════════════════
{
  // 6a. The old inline heatmap bucketed sessions with the BROWSER zone
  //     while every other day/hour bucket used the creator's saved zone.
  //     That whole card no longer exists (Phase 3 replaced it with
  //     Performance.js's day-of-week distribution, sourced from
  //     analytics.canonicalBestTimes.grid — already bucketed server-side
  //     in the creator's resolved timezone by lib/analytics/bestTimes.js,
  //     so Performance.js never touches a raw date/timezone at all). The
  //     defect class is therefore structurally closed, not just patched.
  check('no analytical bucket anywhere reads the browser zone directly',
    !/toLocal(Hour|Dow|DateStr)\([^)]*Intl\.DateTimeFormat\(\)/.test(src) &&
    !/toLocal(Hour|Dow|DateStr)\([^)]*Intl\.DateTimeFormat\(\)/.test(perf))
  check('Performance\'s day/time evidence reads the pre-bucketed canonical grid, not a raw date',
    perf.includes('analytics?.canonicalBestTimes?.grid') && !perf.includes('getTimezoneOffset'))

  // The two zones genuinely disagree, so the original bug was real and not
  // cosmetic — kept here as evidence for why "reads the canonical grid" is
  // the fix, not merely a style preference.
  const instant = '2026-07-08T02:00:00.000Z'
  const dow = (tz) => new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(new Date(instant))
  check('creator zone vs a differing browser zone can name a DIFFERENT day for one instant',
    dow('America/New_York') !== dow('Asia/Tokyo'),
    `${dow('America/New_York')} vs ${dow('Asia/Tokyo')}`)
}
{
  // 6b. "{n}% likely" was peakFraction * 200 * proximityDecay clamped to
  //     25-90 — a hand-rolled score shown as a probability. The score still
  //     ranks and gates the list; only the fabricated claim is gone.
  // Phase 4 removed the hand-rolled score entirely rather than relabelling
  // it: Fans.js shows no probability at all, and the row states the
  // canonical observation ("usually every ~7d, last seen 12d ago"). The
  // defect class is structurally closed, not patched.
  check('no fabricated "% likely" probability is rendered anywhere',
    !src.includes('% likely') && !fans.includes('% likely'))
  check('no fan surface renders calcTipProbability\'s uncalibrated percentage',
    !fans.includes('tipProbability?.percentage') && !fans.includes('tipProbability.percentage'))
  check('the fan row states the canonical return interval instead',
    fans.includes('avgDaysBetweenTips') && fans.includes('daysSinceLastTip'))
  check('the peak hour comes from the canonical field, not a re-bucketing in the page',
    fans.includes('peakLocalHour') && !src.includes('hourCounts[h] = (hourCounts[h] || 0) + 1'))
}


// ══════════════════════════════════════════════════════════════════════
// FABRICATED STAT CHIPS — Title Generator.
//
// Two static chips sat beside the real, measured peak-hour chip:
// "3,000+ titles generated" (nothing in this codebase counts generations)
// and "~30% more tips rotating titles" (an uplift figure with no
// measurement behind it — titles are never A/B'd and tips are never
// attributed to a title). Both are gone; the measured chip stays.
{
  const i = src.indexOf('const chips = []')
  const block = src.slice(i, i + 700)
  check('the invented generation-count chip is gone',
    i > -1 && !/titles generated/.test(src))
  check('the invented tip-uplift chip is gone',
    !/more tips rotating titles/.test(src) && !/30%/.test(block))
  check('the measured peak-hour chip survives — the honest one was not thrown out',
    /chips\.push\(\{ label: `\ud83d\udd34 Peak NOW/.test(block))
  check('the removal is explained in place rather than silently dropped',
    /fabrications presented next to a real, measured peak-hour chip/.test(raw))
}


// ══════════════════════════════════════════════════════════════════════
// LOADING GATE vs HOOK ORDER.
//
// Browser QA caught the dashboard rendering completely blank: React threw
// "Rendered more hooks than during the previous render". The `if (loading)`
// early return sat ABOVE four hooks (notedUsernames and Task D's
// streamReport / liveReportsBySessionKey / openStreamReport), so the first
// render returned before them and the second ran four more. Any hook added
// below that gate reintroduces it, and no unit test would notice — the page
// just goes white.
{
  const gate = src.indexOf('if (loading) {')
  check('the loading gate still exists', gate > -1)
  const hookRe = /\b(useState|useMemo|useEffect|useCallback|useRef)\s*\(/g
  let m, last = -1, lastName = ''
  while ((m = hookRe.exec(src)) !== null) { last = m.index; lastName = m[1] }
  check('every hook is declared ABOVE the loading gate',
    gate > -1 && last < gate,
    `last hook ${lastName}() at ${last}, gate at ${gate} — a hook below the gate makes the first (loading) render call fewer hooks than the second, and React blanks the page`)
  check('the ordering requirement is documented at the gate',
    /MUST STAY BELOW EVERY HOOK/.test(raw))
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
