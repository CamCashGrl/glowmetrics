// The Creator Report, and the readiness model behind it.
//
// It used to open with `if (!hasEnoughData) return <warming up/>`, where
// hasEnoughData meant 10+ tips AND 2+ sessions. A creator who had just
// finished their first import was shown a wall telling them to come back
// later — at the exact moment they were deciding whether the product was
// worth anything.
//
// The model is now per-capability: the report always renders, states what is
// ready in the creator's real counts, and names the ONE nearest unlock. These
// checks EXECUTE that model rather than pattern-matching it, because the
// thresholds are the product decision worth protecting.

import { readFileSync } from 'fs'
import { assessReadiness, nextUnlock, unlockCopy, isBaseline, CAPABILITIES } from '../lib/readiness.js'

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`) }
}
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const reportRaw = read('../app/dashboard/CreatorReport.js')
const report = strip(reportRaw)
// JSX copy wraps across lines, so prose assertions read a whitespace-collapsed
// view; structural assertions keep the raw-ish `report`.
const copy = report.replace(/\s+/g, ' ')
const dash = strip(read('../app/dashboard/page.js'))
const sidebar = strip(read('../app/dashboard/Sidebar.js'))

const at = (tips, sessions) => assessReadiness({ tips, sessions })
const ready = (r, id) => r.find(x => x.id === id).ready

// ══════════════════════════════════════════════════════════════════════
// 1. THE ALL-OR-NOTHING WALL IS GONE.
// ══════════════════════════════════════════════════════════════════════
check('the report no longer refuses to render below a data threshold',
  !/if \(!hasEnoughData\) \{/.test(report) && !/Creator Report is warming up/.test(report))
check('nothing claims the creator needs "all" the data',
  !/all the data needed/i.test(report) && !/all data needed/i.test(reportRaw))
check('the report states that more data improves it, not that it is unusable',
  /More data makes this smarter/.test(copy))

// ══════════════════════════════════════════════════════════════════════
// 2. THRESHOLDS, EXECUTED AT EACH SESSION COUNT THE SPEC NAMES.
// ══════════════════════════════════════════════════════════════════════
{
  const r0 = at(0, 0), r1 = at(12, 1), r3 = at(40, 3), r5 = at(60, 5), r7 = at(90, 7), r10 = at(150, 10)
  check('0 sessions: nothing is claimed ready', r0.every(x => !x.ready))
  check('1 session: totals and top fans only — no best time, no planner',
    ready(r1, 'totals') && ready(r1, 'topFans') &&
    !ready(r1, 'bestTime') && !ready(r1, 'planner') && !ready(r1, 'peakWindow'))
  check('20 tips unlocks whale detection, 19 does not',
    ready(at(20, 1), 'whales') && !ready(at(19, 1), 'whales'))
  check('3 sessions: peak window, still no planner',
    ready(r3, 'peakWindow') && !ready(r3, 'planner') && !ready(r3, 'bestTime'))
  check('5 sessions: planner, best time and session comparisons',
    ready(r5, 'planner') && ready(r5, 'bestTime') && ready(r5, 'sessionCompare'))
  // The boundary matters more than the pass: asserting only "ready at 5" stays
  // true if the threshold is quietly lowered to 1.
  check('4 sessions does NOT unlock planner, best time or comparisons',
    !ready(at(60, 4), 'planner') && !ready(at(60, 4), 'bestTime') &&
    !ready(at(60, 4), 'sessionCompare'))
  check('6 sessions does NOT yet unlock day-and-time recommendations',
    !ready(at(90, 6), 'dayTime'))
  check('9 sessions does NOT yet unlock long-term trends',
    !ready(at(150, 9), 'trends'))
  check('2 sessions does NOT unlock the peak window',
    !ready(at(40, 2), 'peakWindow'))
  check('7 sessions: day-and-time recommendations, still no long-term trends',
    ready(r7, 'dayTime') && !ready(r7, 'trends'))
  check('10 sessions: long-term trends', ready(r10, 'trends'))
  check('every capability is ready at high data', at(500, 40).every(x => x.ready))
}

// ══════════════════════════════════════════════════════════════════════
// 3. THE NEXT UNLOCK IS THE NEAREST ONE, IN REAL COUNTS.
// ══════════════════════════════════════════════════════════════════════
{
  const r = at(12, 1)
  const n = nextUnlock(r)
  check('the nearest unmet threshold is offered, not a wall of everything',
    n.id === 'peakWindow' && n.remaining === 2)
  check('the unlock copy uses the creator\'s own remaining count',
    unlockCopy(n) === '2 more completed sessions unlocks peak earning window.')
  check('it pluralises against the real remainder',
    unlockCopy(nextUnlock(at(12, 2))).startsWith('1 more completed session '))
  check('a fully-ready creator has no next unlock', nextUnlock(at(500, 40)) === null)
}

// ══════════════════════════════════════════════════════════════════════
// 4. BASELINE HONESTY — ONE SESSION IS NOT A PATTERN.
// ══════════════════════════════════════════════════════════════════════
check('one session counts as baseline', isBaseline({ tips: 50, sessions: 1 }))
check('thin tip history counts as baseline', isBaseline({ tips: 4, sessions: 3 }))
check('a real history does not', !isBaseline({ tips: 80, sessions: 6 }))
check('the baseline state is rendered, and says so',
  /baseline && \(/.test(report) && /This is your baseline/.test(copy))
check('the baseline state refuses to name a best window',
  /still learning your best streaming window/.test(copy))

// ══════════════════════════════════════════════════════════════════════
// 5. REAL COUNTS ONLY — NOTHING INVENTED.
// ══════════════════════════════════════════════════════════════════════
check('the snapshot reads canonical analytics counts',
  /analytics\?\.meaningfulSessionCount \|\| 0/.test(report) &&
  /analytics\?\.uniqueFanCount \?\? 0/.test(report) &&
  /tips\.length/.test(report))
check('progress is shown as counts, never an invented percentage or score',
  /\$\{r\.have\} \/ \$\{r\.need\}/.test(report) &&
  !/confidence/i.test(report) && !/\bscore\b/i.test(report))
check('single-platform creators are not shown an empty comparison',
  /platformCount/.test(report))
check('the report never fabricates a peak window for a low-data creator',
  copy.indexOf('baseline') > -1 &&
  copy.indexOf('baseline') < copy.indexOf('still learning your best streaming window'))

// ══════════════════════════════════════════════════════════════════════
// 6. THE STICKY GO LIVE BANNER SURVIVES.
// ══════════════════════════════════════════════════════════════════════
check('the sticky command bar still exists',
  /className="sticky-command-bar/.test(dash) && /position: 'sticky', top: 0/.test(dash))
check('it is dashboard-level, not rendered per tab',
  (dash.match(/className="sticky-command-bar/g) || []).length === 1 &&
  !/activeTab === '[a-z]+' && [\s\S]{0,80}sticky-command-bar/.test(dash))
check('it carries the offline state, the peak window and Go Live',
  /OFFLINE/.test(dash) && /Peak Window/.test(dash) && /⚡ Go Live/.test(dash))
check('it shows an em dash rather than inventing a peak window without data',
  /_eiPeakLabel \? `\$\{_eiPeakLabel\}/.test(dash) && /: '—'/.test(dash))

// ══════════════════════════════════════════════════════════════════════
// 7. CLAIMS WE WERE TOLD TO KEEP ARE STILL THERE.
// ══════════════════════════════════════════════════════════════════════
check('the Room Titles claims are untouched',
  /3,000\+ titles generated/.test(dash) && /~30% more tips rotating titles/.test(dash))
check('the AI coach claim is untouched',
  /AI coach with 6 strategy modes/.test(strip(read('../app/live/page.js'))))

// ══════════════════════════════════════════════════════════════════════
// 8. THE PRO TEASER — VALUE WITHOUT THE ANSWER.
// ══════════════════════════════════════════════════════════════════════
check('a Free creator is told what CamCash already worked out',
  /data-testid="pro-teaser"/.test(report) &&
  /has already worked out \{readyCount\}/.test(report))
check('the count is real — it is what the readiness model says is ready',
  /const readyCount = readiness\.filter\(r => r\.ready\)\.length/.test(report))
check('the teaser never renders for Pro, or with nothing to tease',
  /if \(isPro \|\| readyCount === 0\) return null/.test(report))
// The whole point: communicate value, never leak the locked answer.
// Scoped to the teaser, and to CONTENT blurring specifically: `backdropFilter:
// blur(20px)` is the card material every surface uses, not a redacted value.
check('no locked VALUE is placed in the DOM — no blur, no redacted placeholder',
  (() => {
    const i = report.indexOf('const ProTeaser = ')
    const block = report.slice(i, report.indexOf('  const Readiness =', i))
    return i > -1 && !/<LockedValue/.test(block) &&
      !/(^|[^k])filter: *[`'"]?blur/.test(block) && !/textShadow/.test(block)
  })())
check('one restrained CTA, not a column of upgrade buttons',
  (report.match(/See what CamCash found →/g) || []).length === 1)
check('the teaser CTA meets the 44px touch target',
  /minHeight: 44, padding: '11px 18px'/.test(report))
check('clicking it is tracked as its own funnel step',
  /track\('pro_teaser_clicked', \{ surface: 'creator_report'/.test(report))

// ══════════════════════════════════════════════════════════════════════
// 9. SESSIONS ARE ONE GROUPED DROPDOWN, NOT FOUR FLAT TABS.
// ══════════════════════════════════════════════════════════════════════
check('the session tabs are nested under one parent',
  /id: "sessions", icon: "\ud83c\udfa5", label: "Sessions", children: \[/.test(sidebar))
check('all three session records are children of it',
  /id: "sessions",      icon: "\ud83c\udfa5", label: "Free Chat"/.test(sidebar) &&
  /id: "live-sessions", icon: "\ud83d\udccb", label: "Live Mode"/.test(sidebar) &&
  /id: "private",       icon: "\ud83d\udc8e", label: "Private"/.test(sidebar))
check('Live Mode stays a peer — it is the engine, not a past record',
  /\{ id: "live",     icon: "\ud83d\udd34", label: "Live Mode" \},/.test(sidebar))
check('the group renders through its own disclosure, not renderItem',
  /renderGroupItem\(id, icon, label, children\)/.test(sidebar) &&
  /const renderGroupItem = /.test(sidebar))
// Deep-linking to a child must not land on a collapsed rail.
check('the dropdown opens when one of its children is the active tab',
  /const activeChild = childIds\.includes\(activeTab\)/.test(sidebar) &&
  /const open = openGroups\[id\] \?\? activeChild/.test(sidebar))
check('the disclosure is togglable and reports its state to assistive tech',
  /setOpenGroups\(g => \(\{ \.\.\.g, \[id\]: !open \}\)\)/.test(sidebar) &&
  /aria-expanded=\{open\}/.test(sidebar))
check('no session tab was dropped in the regrouping',
  ['sessions', 'live-sessions', 'private', 'live'].every(id => sidebar.includes(`id: "${id}"`)))

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
