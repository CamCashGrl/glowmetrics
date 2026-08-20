// Phase 4 regression: the Fans tab is an action queue, and it computes
// nothing.
//
// The old tab led with a filterable CRM grid — the creator had to do the
// prioritising themselves. Fans.js leads with PRIORITY FANS, where each row
// states WHY it is listed and WHAT to do, both derived from canonical
// per-fan fields.
//
// THREE DEFECTS CLOSED BY THIS REBUILD, all pinned below:
//
// 1. "This fan's peak hour" had THREE independent implementations:
//    identifyWhales() (canonical), the relocated Fans block, and
//    buildRealTimeAlerts(). The latter two are gone; both now read the
//    canonical peakLocalHour.
//
// 2. buildRealTimeAlerts() bucketed with new Date(...).getHours() — the
//    BROWSER's zone — then compared the result against
//    toLocalHour(now, creatorTz), the CREATOR's zone. `hoursAway` was
//    therefore a difference between two different clocks. Verified against
//    the real CSV: fan `sambo70123` peaks at hour 6 in America/New_York and
//    hour 19 in Asia/Tokyo — a 13-hour swing on identical data.
//
// 3. Two fabricated probabilities were rendered: "{n}% likely" on the fan
//    list and "{n}% confidence" in the whale alert, both from
//    peakFraction * 200 * proximityDecay clamped to 25-90, with nothing
//    calibrating either. Both replaced by the observation behind them.

import { readFileSync } from 'fs'

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`) }
}

const raw = readFileSync(new URL('../app/dashboard/Fans.js', import.meta.url), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const src = strip(raw)
const pageRaw = readFileSync(new URL('../app/dashboard/page.js', import.meta.url), 'utf8')
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const page = strip(pageRaw)
const engine = strip(readFileSync(new URL('../lib/analytics.js', import.meta.url), 'utf8'))

// ══════════════════════════════════════════════════════════════════════
// 1. NO LOCAL AGGREGATION.
// ══════════════════════════════════════════════════════════════════════
check('no .reduce() over raw tips', !/\btips\s*\.\s*reduce/.test(src))
check('does not receive raw tips as a prop', !/^\s*tips[,\s=]/m.test(src.split('export default')[1] || ''))
check('does not import the analytics engine (reads props only)', !src.includes("from '../../lib/analytics"))
check('does not import timezone primitives — it never touches a raw date',
  !src.includes('toLocalHour') && !src.includes('toLocalDow') && !src.includes('localTime'))
check('does not re-bucket a fan\'s tips to find their peak hour',
  !src.includes('hourCounts') && !/\.tips\s*\.\s*forEach/.test(src))
check('does not compute churn or return intervals itself',
  !src.includes('daysSinceLastTip =') && !src.includes('avgDaysBetweenTips ='))

// ══════════════════════════════════════════════════════════════════════
// 2. READS THE CANONICAL FIELDS, BY NAME.
// ══════════════════════════════════════════════════════════════════════
for (const field of [
  'analytics?.whales',
  'analytics?.canonicalBestTimes?.bestWindow',
  'analytics?.bestWindowFanOverlap',
  'analytics?.uniqueFanCount',
  'analytics?.dependencyRisk',
]) {
  check(`reads ${field}`, src.includes(field))
}
for (const f of ['expectedNextTip', 'churnRisk', 'avgDaysBetweenTips', 'daysSinceLastTip', 'peakLocalHour', 'tipCount', 'totalUSD']) {
  check(`uses the canonical per-fan field ${f}`, src.includes(f))
}

// ══════════════════════════════════════════════════════════════════════
// 3. ONE IMPLEMENTATION OF "THIS FAN'S PEAK HOUR".
// ══════════════════════════════════════════════════════════════════════
check('the engine exposes the numeric peak hour canonically',
  engine.includes('peakLocalHour: mostActiveHour ? parseInt(mostActiveHour[0]) : null'))
check('the engine derives it from the SAME hourCounts that build typicalOnlineHours',
  engine.includes('typicalOnlineHours: mostActiveHour ?') && engine.includes('peakHourTipCount: mostActiveHour ? mostActiveHour[1] : 0'))
check('the engine buckets that hour with the creator timezone, not the browser',
  engine.includes('const h = toLocalHour(t.dateRaw || t.date_time, tz)'))
check('no page-level re-bucketing of fan tips by hour remains', !page.includes('hourCounts'))
check('no fan surface reads the browser clock for an hour bucket',
  !/getHours\(\)/.test(page) && !/getHours\(\)/.test(src))
check('Fans.js reads the canonical peak hour', src.includes('fan.peakLocalHour'))

// The two zones genuinely disagree, so this was a real defect. Same instant,
// two creator timezones, different local hour — mirrors the real-fixture
// result quoted in this file's header (hour 6 vs hour 19 for sambo70123).
{
  const instant = '2026-07-08T10:30:00.000Z'
  const hourIn = (tz) => parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(new Date(instant)))
  check('a fan\'s peak hour differs by creator timezone, so bucketing with the browser clock was a real bug',
    hourIn('America/New_York') !== hourIn('Asia/Tokyo'),
    `NY=${hourIn('America/New_York')} Tokyo=${hourIn('Asia/Tokyo')}`)
}

// ══════════════════════════════════════════════════════════════════════
// 4. NO FABRICATED PROBABILITIES ANYWHERE.
// ══════════════════════════════════════════════════════════════════════
check('no "% likely" probability rendered', !src.includes('% likely') && !page.includes('% likely'))
check('no "% confidence" probability rendered', !page.includes('% confidence`') && !src.includes('% confidence'))
check('the uncalibrated peakFraction * 200 score is gone from the page',
  !page.includes('* 200 *') && !/proximityDecay/.test(page))
check('calcTipProbability\'s fixed percentage is never displayed',
  !src.includes('tipProbability') && !/tipProbability\?\.\s*percentage/.test(page))
check('the whale alert states the observation instead of a score',
  pageRaw.includes('of their ${w.tipCount} tips land in that hour'))
check('no hardcoded percentage claims in Fans copy', !/\d{1,3}%\s*(likely|chance|confident)/.test(src))

// ══════════════════════════════════════════════════════════════════════
// 5. EVERY PRIORITY ROW STATES A REASON AND AN ACTION, FROM REAL FIELDS.
// ══════════════════════════════════════════════════════════════════════
check('priority rules are declared as data, not scattered conditionals', src.includes('const PRIORITY_RULES = ['))
check('every rule carries a reason and an action',
  (src.match(/reason:/g) || []).length === (src.match(/action:/g) || []).length &&
  (src.match(/reason:/g) || []).length >= 5)
check('a fan can only appear once across the bands', src.includes('claimed.add(f.username.toLowerCase())'))
check('timing claims require at least 3 tips (matching calcChurnRisk\'s own floor)',
  (src.match(/f\.tipCount >= 3/g) || []).length >= 4)
check('the engine agrees that below 3 tips there is no churn signal',
  engine.includes("if (count < 3) return { level: 'Unknown'"))
check('rows show the return interval and last-seen, not a score',
  src.includes('every ~') && src.includes('last seen'))

// ══════════════════════════════════════════════════════════════════════
// 6. HONEST EMPTY / SPARSE STATES.
// ══════════════════════════════════════════════════════════════════════
check('no-fans state is explicit', raw.includes('No supporters imported yet'))
check('no-signal state explains the 3-tip requirement rather than showing an empty box',
  raw.includes('at least 3 tips from someone before their return pattern means anything'))
check('the best-window card is gated on a real window AND real overlap',
  src.includes('bestWindow && overlap?.count > 0'))
check('dependency risk only renders above the low band', src.includes('dependencyRisk.level !== "low"'))

// ══════════════════════════════════════════════════════════════════════
// 6b. RESTORED CREATOR TOOLS — notes and profile.
//
// The Phase 4 Fans rebuild dropped the per-fan action buttons. The features
// themselves never died: viewFanProfile(), the profile drawer,
// noteTarget/saveTipperNote() and the tipper_notes table were all still live —
// but their ONLY surviving entry point was the Private Sessions tab, so from
// the Fans tab a creator could not open a profile or reach a note they had
// already written. Notes saved before the rebuild became unreachable.
//
// These checks exist so that cannot silently happen again.
// ══════════════════════════════════════════════════════════════════════
check('fan rows expose a note action', /Add note/.test(src) && /onAddNote/.test(src))
check('fan rows expose a profile action', /View profile/.test(src) && /onViewFan/.test(src))
check('the note action reaches the EXISTING note flow, not a new one',
  /onAddNote=\{\(username\) => setNoteTarget\(username\)\}/.test(page))
check('the profile action reaches the EXISTING profile drawer',
  /viewFanProfile\(username, w\?\.platform\)/.test(page))
check('the existing note state and handler remain connected',
  /const \[noteTarget, setNoteTarget\]/.test(page) &&
  /const saveTipperNote = async/.test(page) &&
  /from\('tipper_notes'\)/.test(page))
check('NO duplicate notes implementation was created',
  !/tipper_notes/.test(src) && !/saveTipperNote/.test(src) &&
  (page.match(/const saveTipperNote/g) || []).length === 1)
check('NO duplicate profile implementation was created',
  !/setSelectedWhale/.test(src) &&
  (page.match(/const viewFanProfile/g) || []).length === 1)
check('a fan who already has a note is distinguishable',
  /Edit note/.test(src) && /hasNote/.test(src) && /notedFans/.test(src))
check('the noted-fan set is derived from existing state, not re-fetched',
  /notedUsernames = useMemo/.test(page) && /Object\.entries\(tipperNotes/.test(page))
check('locked rows expose no creator tools',
  /\{!dimmed && \(\s*<div className="fan-row-actions">/.test(src))
check('the component still works when the handlers are not supplied',
  /onViewFan && \(/.test(src) && /onAddNote && \(/.test(src))
check('tools are restrained, not a third loud button',
  /className="fan-row-tool/.test(src) && /\.fan-row-tool \{/.test(css))

// ══════════════════════════════════════════════════════════════════════
// 7. FREE vs PRO.
// ══════════════════════════════════════════════════════════════════════
// The rule is a CTA HIERARCHY, not a raw count: exactly one PRIMARY (the
// signature gradient UnlockButton on the fan-opportunity section) plus at
// most one quiet secondary inside the Fan Intelligence module. Counting
// onUpgrade calls conflated the two and failed the moment a restrained
// secondary was added, which is the behaviour the design actually wants.
check('exactly one PRIMARY upgrade CTA in the component',
  (src.match(/<UnlockButton/g) || []).length === 1)
check('any additional upgrade affordance is a quiet secondary',
  (src.match(/onUpgrade\?\./g) || []).length <= 2 &&
  src.includes('<LockedModule'))
check('the free limit is supplied by the dashboard, not redefined here', src.includes('freeFanLimit = 3'))
check('the dashboard passes its own FREE_FAN_LIMIT', page.includes('freeFanLimit={FREE_FAN_LIMIT}'))
// Still real fans from this account — but previewed, not blurred. The row
// keeps its rank and rule label and redacts the identity and every figure,
// matching what /api/insights withholds from Free.
check('the locked preview uses REAL fans from this account — never placeholders',
  src.includes('hidden.slice(0, 2).map') && src.includes('dimmed'))
check('locked rows redact per-value instead of blurring the card',
  src.includes('<LockedValue') && !/filter: dimmed \? "blur/.test(src))
check('locked rows are not interactive', src.includes('pointerEvents: dimmed ? "none" : "auto"'))
check('the upsell describes this account with real counts',
  src.includes('hiddenSummary.lifetimeUSD') && src.includes('hiddenSummary.overdue'))
check('the CTA is outcome-oriented, not a generic upgrade prompt',
  raw.includes('Find My Highest-Value Fans') && !raw.includes('>Upgrade to Pro<'))
check('the Pro-preview impression event still fires', page.includes("trackProPreviewViewed('whale_intelligence')"))
check('the impression condition matches what Fans.js actually renders',
  page.includes("whales.length > FREE_FAN_LIMIT"))

// ══════════════════════════════════════════════════════════════════════
// 8. WIRING + DEAD CODE REMOVED WITH ITS UI.
// ══════════════════════════════════════════════════════════════════════
check('Fans is imported by the dashboard', page.includes("import Fans from './Fans'"))
check('Fans is rendered on the whales tab', page.includes('<Fans'))
check('the old filterable Top Fans grid state is gone',
  !page.includes('const [whaleFilter') && !page.includes('const [platformFilter'))
check('the orphaned filteredWhales/visibleWhales/lockedFanStats chain is gone',
  !page.includes('const filteredWhales') && !page.includes('const visibleWhales') && !page.includes('const lockedFanStats'))
check('the orphaned alert builders are gone',
  !page.includes('const buildWhatsNextAlerts') && !page.includes('const buildReengageList'))
check('the message modal still has its own templates (it never used the removed builder)',
  page.includes('const currentMsg = messages[messageIndex % messages.length]'))
check('removals are documented rather than silent', pageRaw.includes('REMOVED with the Phase 4 Fans rebuild'))

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
