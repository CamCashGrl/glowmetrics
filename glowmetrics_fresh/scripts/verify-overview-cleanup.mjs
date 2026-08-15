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
const OVERVIEW = region('{activeTab === "overview" && (', ['{activeTab === "platforms"'])
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
check('"Your Top Earners" still renders (not deleted)', src.includes('>Your Top Earners<'))
check('"Your Top Earners" renders in Fans', FANS.includes('>Your Top Earners<'))
check('"Your Top Earners" no longer renders on Overview', !(OVERVIEW || '').includes('>Your Top Earners<'))

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
check('"Likely Online Now" fan list moved to Fans', FANS.includes('Likely Online Now'))
check('"Close to Milestone" moved to Fans', FANS.includes('Close to Milestone'))
check('"At Risk — Re-engage" moved to Fans', FANS.includes('At Risk — Re-engage'))
check('the fan message action moved with the list', FANS.includes('setMessageTarget'))

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
check('its top-supporter claim is still owned by the Fans tab', FANS.includes('lifetime'))
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
  check('no fabricated "% likely" probability is rendered', !src.includes('% likely`'))
  check('the badge states the observation instead', src.includes('tips at this hour'))
  check('the heuristic still gates the list (behaviour preserved)',
    src.includes('w.confidence >= 35'))
  check('the badge figures come from the fan\'s own tips',
    src.includes('peakTips: sorted[0][1]') && src.includes('peakOfTips: fanTips.length'))
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
