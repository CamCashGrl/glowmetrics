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
// Renders at EVERY level now, low included — an explicit product decision:
// a healthy concentration is itself worth stating, and hiding the card until
// risk appears means the creator only ever sees it as bad news. The card
// changes its label ("Fan concentration" vs "Concentration risk") and border
// instead of disappearing. Pinning the label switch is what stops the card
// from silently becoming an always-red alarm.
check('fan concentration renders at every level, including low',
  src.includes('dependencyRisk.level === "low" ? "Fan concentration" : "Concentration risk"') &&
  !src.includes('dependencyRisk.level !== "low"'))

// ══════════════════════════════════════════════════════════════════════
// 7. FREE vs PRO.
// ══════════════════════════════════════════════════════════════════════
check('exactly one upgrade CTA in the component', (src.match(/onUpgrade\?\./g) || []).length === 1)
check('the free limit is supplied by the dashboard, not redefined here', src.includes('freeFanLimit = 3'))
check('the dashboard passes its own FREE_FAN_LIMIT', page.includes('freeFanLimit={FREE_FAN_LIMIT}'))
// The locked preview used to render two real fan rows under filter: blur(4px).
// That was removed deliberately: a blur communicates only "something is hidden"
// and asks the creator to squint at their own data, while the summary card
// directly below already states what is withheld using this account's real
// counts and dollar figures. These assertions now pin the ABSENCE of the blur,
// so it cannot come back by accident, and pin the summary as the thing that
// carries the value.
check('no blurred fan rows — the value is stated, never obscured',
  !src.includes('blur(4px)') && !src.includes('dimmed'))
check('nothing renders a partial locked fan row', !src.includes('hidden.slice(0, 2).map'))
check('the hidden set is still computed, to power the real-numbers summary',
  src.includes('const hidden = isPro ? [] : prioritised.slice(freeFanLimit)'))
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
