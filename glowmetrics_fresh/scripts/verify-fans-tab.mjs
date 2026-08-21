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
// CHANGED (Phase 3D): concentration now renders at EVERY level, including
// 'low'. Previously a creator with a healthily spread fan base never learned
// their concentration — the number only appeared once it had become a
// problem. The metric is untouched; analytics.dependencyRisk already
// computed top1/top3/top5 and already wrote a distinct low-level message
// that was simply never rendered.
check('fan concentration renders at every level, including a healthy one',
  !src.includes('dependencyRisk.level !== "low"') &&
  /\{dependencyRisk && \(/.test(src))
check('a healthy creator reads a neutral heading, not an alarm',
  /dependencyRisk\.level === "low" \? "Fan concentration" : "Concentration risk"/.test(src))
check('the alarm border is reserved for the levels that warrant it',
  /dependencyRisk\.level === "high" \? "rgba\(248,113,113,0\.3\)" : dependencyRisk\.level === "medium" \? "rgba\(245,158,11,0\.3\)" : C\.border/.test(src))
check('the copy is the engine\'s own canonical message, not a second one',
  /\{dependencyRisk\.message\}/.test(src))
check('the engine really does write a distinct low-level message',
  /Your revenue is spread across your fan base/.test(engine))
check('no second dependency formula was introduced',
  !/top1Pct\s*=|top3Pct\s*=|lossIfTopFanLeaves\s*=/.test(src))

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

// ══════════════════════════════════════════════════════════════════════
// 9. THE FAN DRAWER INVENTS NOTHING.
// The drawer carried a "🤖 AI Predictions" block whose three headline
// values were arbitrary arithmetic dressed as measurement: avgTipSize *
// 1.1, a hand-rolled score out of 100, and the lifetime monthly average
// * 1.05. Live Mode already had this class of value removed (see
// verify-live-mode.mjs: no "% confidence", no goal-push probability);
// these checks stop it growing back on the fan surface.
// ══════════════════════════════════════════════════════════════════════
check('no "AI" heading claims invention is measurement', !page.includes('AI Predictions'))
check('the fabricated next-tip-size projection is gone', !/avgTipSize\s*\*\s*1\.1/.test(page))
check('the fabricated 30-day revenue forecast is gone',
  !/revenue forecast/i.test(page) && !/\*\s*1\.05/.test(page))
check('the hand-rolled engagement score out of 100 is gone',
  !page.includes('Engagement score') &&
  !/tipCount\s*\/\s*10\s*\)\s*\*\s*20/.test(page))
// Anchored on real code, not on the {/* WHALE PROFILE MODAL */} banner —
// strip() removes JSX comments, so anchoring there silently sliced nothing.
check('no arbitrary growth multiplier survives in the drawer',
  (() => {
    const i = page.indexOf('const w = selectedWhale')
    return i > 0 && !/\*\s*1\.(0[1-9]|[1-9])/.test(page.slice(i))
  })())

check('the one real figure — the return estimate — still renders',
  page.includes('Likely to tip again in') && page.includes('likelyReturnDays'))
check('it is still derived from this fan\'s own observed spacing',
  /const likelyReturnDays = \(avgDaysBetweenTips !== null && daysSinceLastTip !== null\)\s*\?\s*Math\.max\(0, avgDaysBetweenTips - daysSinceLastTip\)/.test(page))
// Scoped to the return-estimate ternary itself. "Not enough data yet" also
// appears in the cadence row above, so a bare substring test passed even
// with this row's own fallback replaced by a fabricated "~7 days".
check('without a measured interval it says "Not enough data yet" rather than predicting',
  /likelyReturnDays !== null \? \(likelyReturnDays === 0 \? "Overdue!" : `~\$\{likelyReturnDays\} days`\) : "Not enough data yet"/.test(page))
check('both cadence rows gate on the same measured evidence — no self-contradiction',
  /"Avg days between tips", value: avgDaysBetweenTips === null \? "Not enough data yet"/.test(page))
check('the removal is documented rather than silent',
  pageRaw.includes('arbitrary literals'))

// ══════════════════════════════════════════════════════════════════════
// 10. TIP CADENCE CANNOT GO NEGATIVE, NaN, OR FABRICATED.
//
// viewFanProfile() builds a synthetic fan with lastTipDate:null whenever a
// username+platform pair is absent from `whales` — reachable for real fans,
// because identifyWhales() keys a fan to the platform of their FIRST tip,
// so opening a multi-platform fan from Private Sessions (which passes the
// paid session's platform) misses. Those fans still have tip rows. The
// cadence read `new Date(w.lastTipDate)`, and new Date(null) is the epoch,
// not an invalid date — so the span was measured from 1970 and the drawer
// rendered "Every ~-10328 days".
//
// These checks EXECUTE the derivation lifted out of page.js rather than
// grepping for it, so they exercise the real failure modes instead of
// asserting that some text is present.
// ══════════════════════════════════════════════════════════════════════
const cadenceSrc = (() => {
  const start = page.indexOf('const validTipTimes = whaleTips')
  const end = page.indexOf('const churnRisk =')
  if (!(start > 0 && end > start)) return null
  // tierColor/tierIcon sit between daysSinceLastTip and avgDaysBetweenTips
  // but are unrelated presentational lookups into module-scope constants.
  // Drop them so the block can run standalone; if either ever starts feeding
  // the cadence, the checks below fail rather than silently skipping it.
  return page.slice(start, end)
    .split('\n')
    .filter(l => !/const tier(Color|Icon) =/.test(l))
    .join('\n')
})()
check('the cadence derivation is present and extractable', !!cadenceSrc)

// The two UI expressions, lifted verbatim so a copy that drifts from the
// source cannot silently keep these checks green.
const cadenceUiSrc = (page.match(/value: (avgDaysBetweenTips === null \?[^\n]*?)\s*\},/) || [])[1]
const returnUiSrc  = (page.match(/value: (likelyReturnDays !== null \?[^\n]*?), color: C\.cyan/) || [])[1]
check('both cadence UI expressions are extractable', !!cadenceUiSrc && !!returnUiSrc)

const derive = cadenceSrc && cadenceUiSrc && returnUiSrc
  ? new Function('whaleTips', 'w', `
      ${cadenceSrc}
      return { avgDaysBetweenTips, likelyReturnDays, daysSinceLastTip,
               cadenceUI: (${cadenceUiSrc}), returnUI: (${returnUiSrc}) }`)
  : null

const dayAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()
const T = (d) => ({ username: 'dave', platform: 'BongaCams', date_time: d })
const fanRow = (lastTipDate) => ({ username: 'dave', platform: 'BongaCams', lastTipDate })
const run = (lastTipDate, tips) => derive(tips, fanRow(lastTipDate))

if (!derive) {
  check('cadence behaviour could be exercised', false)
} else {
  const normal = run(dayAgo(10), [T(dayAgo(30)), T(dayAgo(20)), T(dayAgo(10))])
  check('valid timestamps produce a positive, realistic interval',
    normal.avgDaysBetweenTips === 10 && normal.cadenceUI === 'Every ~10 days')

  // THE BUG: 3 real tips, synthetic fan, lastTipDate null.
  const orphan = run(null, [T(dayAgo(30)), T(dayAgo(20)), T(dayAgo(10))])
  check('lastTipDate:null with real tips no longer yields a negative cadence',
    orphan.avgDaysBetweenTips > 0)
  check('...and that cadence comes from the fan\'s own timestamps',
    orphan.avgDaysBetweenTips === 10 && orphan.cadenceUI === 'Every ~10 days')
  check('...and the epoch is never used as the span anchor',
    !String(orphan.cadenceUI).includes('-') && orphan.avgDaysBetweenTips < 10000)

  check('a single valid tip says "Not enough data yet"',
    run(dayAgo(5), [T(dayAgo(5))]).cadenceUI === 'Not enough data yet')
  check('no valid timestamps says "Not enough data yet"',
    run(null, [T(null), T(undefined), T('')]).cadenceUI === 'Not enough data yet')
  // Discriminating case: several NULL dates alongside one real tip. Without
  // the `raw ? … : NaN` guard, new Date(null) is the epoch and finite, so
  // those rows survive the filter and the span is measured from 1970 —
  // "Every ~9000 days". Three all-invalid rows do NOT catch that, because
  // only one epoch entry survives and one entry yields no interval at all.
  check('null dates are skipped, not silently read as the epoch',
    run(null, [T(null), T(null), T(dayAgo(10))]).cadenceUI === 'Not enough data yet')
  check('zero tips says "Not enough data yet"',
    run(null, []).cadenceUI === 'Not enough data yet')

  const shuffled = run(null, [T(dayAgo(10)), T(dayAgo(30)), T(dayAgo(20))])
  check('out-of-order rows stay chronological and never go negative',
    shuffled.avgDaysBetweenTips === 10)

  const mixed = run(null, [T(dayAgo(30)), T(null), T('garbage'), T(dayAgo(10))])
  check('unparseable rows are ignored rather than contaminating the interval',
    mixed.avgDaysBetweenTips === 20 && !String(mixed.cadenceUI).includes('NaN'))

  check('an unparseable canonical lastTipDate falls back to the fan\'s own rows',
    run('not-a-date', [T(dayAgo(30)), T(dayAgo(10))]).daysSinceLastTip === 10)

  check('a sub-daily interval is stated, not rounded to "Every ~0 days"',
    run(null, [T(dayAgo(2)), T(dayAgo(2)), T(dayAgo(2))]).cadenceUI === 'Less than a day')

  check('"Overdue!" still fires when the fan is past their own interval',
    run(dayAgo(45), [T(dayAgo(101)), T(dayAgo(73)), T(dayAgo(45))]).returnUI === 'Overdue!')
  check('a fan inside their interval gets a real day count, not "Overdue!"',
    run(dayAgo(4), [T(dayAgo(60)), T(dayAgo(32)), T(dayAgo(4))]).returnUI === '~24 days')

  // Across every shape above, nothing may reach the UI that is negative,
  // NaN, an Invalid Date, or the old hardcoded 7-day cadence.
  const allUI = [normal, orphan, shuffled, mixed,
    run(dayAgo(5), [T(dayAgo(5))]), run(null, []), run(null, [T(null)]),
  ].flatMap(r => [String(r.cadenceUI), String(r.returnUI)])
  check('no UI string is ever negative, NaN, or an Invalid Date',
    !allUI.some(s => /-\d|NaN|Invalid Date|undefined/.test(s)))
}

// Scoped to the cadence block, not the whole file. page.js has a second
// `.sort((a, b) => a - b)` at the date-range helper, so a file-wide test
// stayed green with THIS sort deleted; and avgDaysBetweenTips now spans
// several lines, so a single-line `: 7` regex could never have matched it.
check('the hardcoded 7-day cadence fallback is gone from the source',
  !!cadenceSrc && !/:\s*7\b/.test(cadenceSrc))
check('the span is no longer anchored on w.lastTipDate',
  !!cadenceSrc && !/new Date\(w\.lastTipDate\)\s*-/.test(cadenceSrc))
check('timestamps are validated and sorted before use',
  !!cadenceSrc &&
  /\.filter\(ms => Number\.isFinite\(ms\)\)/.test(cadenceSrc) &&
  /\.sort\(\(a, b\) => a - b\)/.test(cadenceSrc))

// ══════════════════════════════════════════════════════════════════════
// 11. THE DRAWER USES THE ENGINE'S FAN IDENTITY, NOT A SECOND ONE.
//
// identifyWhales() keys a fan on `username.toLowerCase()` with NO platform
// in the key: a fan is ONE global identity, and totalUSD / tipCount / tips
// span every platform and every casing. `platform` on the whale object is
// only a label from the fan's FIRST tip row.
//
// The drawer re-derived the rows with an exact-case, platform-scoped
// filter, so for a fan tipping as "DaveTipper" on Chaturbate and
// "davetipper" on BongaCams the header read $110 while the tip list,
// biggest tip, best day and cadence below it covered $35.
//
// These run the REAL engine against a realistic fixture.
// ══════════════════════════════════════════════════════════════════════
// NOTE: lib/analytics.js is deliberately NOT imported here. It uses
// extensionless imports ('./constants'), which plain node ESM cannot resolve
// — the same pre-existing limitation that makes verify-ambiguous-slash-dates
// fail. Importing it would take a green script down with it. So the engine's
// identity CONTRACT is asserted from its source, and the drawer expression —
// the thing this task actually changed — is executed against a fan object
// built to that contract.
const dAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()

const crossPlatformTips = [
  { username: 'DaveTipper', platform: 'Chaturbate', usd: 20, tokens: 400, date_time: dAgo(60) },
  { username: 'davetipper', platform: 'BongaCams',  usd: 35, tokens: 700, date_time: dAgo(30) },
  { username: 'DaveTipper', platform: 'Chaturbate', usd: 15, tokens: 300, date_time: dAgo(20) },
  { username: 'davetipper', platform: 'BongaCams',  usd: 40, tokens: 800, date_time: dAgo(5)  },
]

check('the engine keys a fan globally, with no platform in the key',
  /const key = t\.username\.toLowerCase\(\)/.test(engine) &&
  !/const key = .*platform/.test(engine))
check('the engine returns the rows it aggregated, so the drawer need not re-derive them',
  /tipNotes: f\.tipNotes, tips: f\.tips/.test(engine))

// The drawer's own expression, lifted from page.js and executed.
const whaleTipsSrc = (page.match(/const whaleTips = ([\s\S]*?)\n\s*const validTipTimes/) || [])[1]
check('the whaleTips derivation is extractable', !!whaleTipsSrc)

if (!whaleTipsSrc) {
  check('fan-identity behaviour could be exercised', false)
} else {
  const resolveTips = new Function('tips', 'w', `const whaleTips = ${whaleTipsSrc}; return whaleTips`)

  // The whale object exactly as identifyWhales() builds it for this fixture:
  // one global identity (key = username.toLowerCase(), no platform), totals
  // over ALL rows, `platform` labelled from the FIRST row, and `tips` carrying
  // every row it aggregated. The two checks above pin that contract to the
  // engine's own source.
  const engineWhale = {
    username: 'DaveTipper', platform: 'Chaturbate',
    totalUSD: 110, tipCount: 4, tips: crossPlatformTips,
    lastTipDate: dAgo(5), spendPercentile: 100, tier: 'Whale',
  }

  const drawerTips = resolveTips(crossPlatformTips, engineWhale)
  check('the drawer sees every one of that fan\'s tips, not a platform slice',
    drawerTips.length === 4)
  check('the drawer\'s tip rows sum to the same total the header shows',
    Math.round(drawerTips.reduce((s, t) => s + t.usd, 0) * 100) / 100 === engineWhale.totalUSD)

  // C1 in isolation: one platform, casing drift only.
  const casing = [
    { username: 'Dave', platform: 'Chaturbate', usd: 10, tokens: 200, date_time: dAgo(40) },
    { username: 'dave', platform: 'Chaturbate', usd: 10, tokens: 200, date_time: dAgo(20) },
    { username: 'DAVE', platform: 'Chaturbate', usd: 10, tokens: 200, date_time: dAgo(10) },
  ]
  // Same contract: the engine folds all three casings into one fan whose
  // `username` is whichever casing it saw first.
  const casingWhale = { username: 'Dave', platform: 'Chaturbate', totalUSD: 30, tipCount: 3, tips: casing }
  check('casing drift alone no longer truncates the tip history',
    resolveTips(casing, casingWhale).length === 3)
  // With .tips absent the fallback must still find all three by lowercasing.
  check('...and the fallback path resolves casing drift too',
    resolveTips(casing, { ...casingWhale, tips: undefined }).length === 3)

  // C2: the synthetic fan viewFanProfile() builds when a lookup misses has
  // no .tips, so the fallback must find the rows by the engine's identity.
  const synthetic = { username: 'DaveTipper', platform: 'Chaturbate', tier: 'New / Low Data',
    totalUSD: 0, tipCount: 0, avgTipSize: 0, lastTipDate: null }
  check('a synthetic fan with no .tips still resolves rows by lowercased username',
    resolveTips(crossPlatformTips, synthetic).length === 4)
  check('the fallback does not re-introduce a platform clause',
    !/t\.platform === w\.platform/.test(whaleTipsSrc))
  check('the fallback does not re-introduce exact-case matching',
    !/t\.username === w\.username/.test(whaleTipsSrc))
  check('a fan with genuinely no tips still yields an empty list, not a crash',
    resolveTips([], synthetic).length === 0)
}

// ══════════════════════════════════════════════════════════════════════
// 12. NO UNDOCUMENTED "RELATIONSHIP SCORE".
// A bare number in a coloured circle, no label, no unit, from
// Math.min(100, tipCount*3 + totalUSD/10 + a 20/10/0 recency bonus).
// Nothing in the engine produces or documents it. The two canonical
// classifications it duplicated — w.tier and w.spendPercentile — are both
// already on screen, so nothing replaces it.
// ══════════════════════════════════════════════════════════════════════
check('the relationship score is gone', !/\brelScore\b/.test(page))
check('its colour ramp is gone', !/\brelColor\b/.test(page))
check('the label ladder built on it is gone',
  !/\bvalueLabel\b/.test(page) &&
  !/High value supporter|Growing relationship/.test(page))
check('its formula is gone', !/tipCount \* 3/.test(page) && !/totalUSD \/ 10\b/.test(page))
check('the canonical percentile it sat beside is retained',
  /Top \{topSpenderPct\}%<\/span> of supporters/.test(page) &&
  /w\.spendPercentile/.test(page))
check('the canonical tier badge is still the drawer\'s value classification',
  /color: tierColor, fontSize: 11, fontWeight: 700 \}\}>\{w\.tier\}<\/span>/.test(page))
check('no replacement score was invented',
  !/ \/ 100/.test(page.slice(page.indexOf('const w = selectedWhale'))))
check('the relScore removal is documented rather than silent',
  pageRaw.includes('REMOVED: relScore'))

check('the drawer\'s existing sections and actions were left alone',
  page.includes('Combined Lifetime Value') && page.includes('Close Profile') &&
  page.includes('📝 Add Note'))

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
