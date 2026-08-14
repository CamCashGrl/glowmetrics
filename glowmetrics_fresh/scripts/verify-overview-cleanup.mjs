// Phase 2 regression: the Overview is ONE Command Center, not a Command
// Center with the old dashboard stacked underneath.
//
// The redesign added CommandCenter above the Overview's eight legacy
// sections without removing them, so the tab rendered the new hierarchy and
// then repeated most of it in the old KPI-first form. This file pins where
// each section ended up, so a later edit cannot quietly re-stack them:
//
//   "Make Money Right Now"    -> CommandCenter (nowActions prop)
//   "What's Working"          -> Performance (platforms tab)
//   "Your Top Earners"        -> Fans (whales tab)
//   "You're Losing Money"     -> Performance (platforms tab)
//   "Revenue Dependency Risk" -> Performance (platforms tab)
//   "Smart Insights"          -> removed (every insight restated a claim
//                                already rendered by the card that owns it)
//
// It also pins the two defects found while relocating: a browser-timezone
// bucket in the platform-by-day heatmap, and a fabricated probability badge
// on the "Likely Online Now" fan list.

import { readFileSync } from 'fs'

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`) }
}

const raw = readFileSync(new URL('../app/dashboard/page.js', import.meta.url), 'utf8')
const cc = readFileSync(new URL('../app/dashboard/CommandCenter.js', import.meta.url), 'utf8')

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
// 1. NOTHING WAS DELETED WITHOUT A DESTINATION — each relocated section
//    still exists in the file, exactly once.
// ══════════════════════════════════════════════════════════════════════
const RELOCATED = [
  ["What's Working", 'PLATFORMS', ">What's Working<"],
  ["You're Losing Money", 'PLATFORMS', ">You're Losing Money<"],
  ['Your Top Earners', 'FANS', '>Your Top Earners<'],
  // This heading interpolates its level, so it has no closing '<' after the
  // literal text.
  ['Revenue Dependency Risk', 'PLATFORMS', '>Revenue Dependency Risk —'],
]
const REGIONS = { PLATFORMS, FANS }
for (const [title, dest, needle] of RELOCATED) {
  check(`"${title}" still renders somewhere (not deleted)`, src.includes(needle))
  check(`"${title}" renders in ${dest}`, (REGIONS[dest] || '').includes(needle))
  check(`"${title}" no longer renders on Overview`, !(OVERVIEW || '').includes(needle))
}

// ══════════════════════════════════════════════════════════════════════
// 2. THE SUPPORTING LOGIC MOVED WITH THE SECTION — a title in the right
//    place with its body left behind would pass the checks above.
// ══════════════════════════════════════════════════════════════════════
check('Platform ROI cards moved to Performance', PLATFORMS.includes('Platform ROI ($/hr streamed)'))
check('platform-by-day heatmap moved to Performance', PLATFORMS.includes('Platform by Day of Week'))
check('heatmap drill-down moved with it', PLATFORMS.includes('setExpandedHeatCell'))
check('missed-revenue ranking moved to Performance', PLATFORMS.includes('missedRevenueByPlat'))
check('dependency-risk figures moved to Performance', PLATFORMS.includes('dependencyRisk.top1Pct'))
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
  PLATFORMS.includes('TOP ROI'))
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
  // 6a. The heatmap bucketed sessions with the BROWSER zone while every
  //     other day/hour bucket uses the creator's saved zone.
  check('the heatmap no longer buckets with the browser timezone',
    !PLATFORMS.includes("Intl.DateTimeFormat().resolvedOptions().timeZone"))
  check('the heatmap buckets with the creator timezone', PLATFORMS.includes('const userTz = _momTz'))
  check('no analytical bucket anywhere reads the browser zone directly',
    !/toLocal(Hour|Dow|DateStr)\([^)]*Intl\.DateTimeFormat\(\)/.test(src))

  // The two zones genuinely disagree, so this was a real defect and not a
  // cosmetic one: a creator saved as America/New_York whose browser reports
  // Asia/Tokyo lands on a different weekday for the same instant.
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
