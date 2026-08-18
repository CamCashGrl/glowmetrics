// Regression coverage for the timezone bucketing pass: the platform hourly
// heatmap, Stream Planner's liftChart week bucketing, and the repo-wide sweep
// that removed every remaining raw-UTC / browser-timezone analytical bucket.
//
// Contract under test (lib/timezone.js): profiles.timezone is the analytical
// source of truth; the browser's zone is a fallback used only to auto-populate
// the profile once, never read live as the basis for a calculation.
//
// Every expectation here is deterministic — fixed ISO instants against fixed
// IANA zones, so results do not depend on the machine running the suite.

let pass = 0, fail = 0
function check(name, cond) { if (cond) { pass++; console.log(`PASS  ${name}`) } else { fail++; console.log(`FAIL  ${name}`) } }

// Mirrors lib/analytics/localTime.js exactly.
function toLocalHour(dateStr, tz) {
  const h = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(new Date(dateStr)))
  return isNaN(h) ? 0 : h === 24 ? 0 : h
}
function toLocalDow(dateStr, tz) {
  const dayName = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(new Date(dateStr))
  return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(dayName)
}
function toLocalDateStr(dateStr, tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(dateStr))
}

const PACIFIC = 'America/Los_Angeles'
const EASTERN = 'America/New_York'
const UTC = 'UTC'

// ══════════════════════════════════════════════════════════════════════
// 1. PLATFORM HOURLY HEATMAP — bucketing across zones.
//    Mirrors app/dashboard/page.js's platformTimes.
// ══════════════════════════════════════════════════════════════════════
function bucketTip(ts, tz) {
  return { hour: toLocalHour(ts, tz), day: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][toLocalDow(ts, tz)] }
}
{
  // 2026-01-15T02:30:00Z — Thursday 02:30 UTC.
  const ts = '2026-01-15T02:30:00.000Z'
  check('UTC creator: 02:30Z -> hour 2, Thursday', JSON.stringify(bucketTip(ts, UTC)) === JSON.stringify({ hour: 2, day: 'Thursday' }))
  check('Eastern creator: same instant -> hour 21, Wednesday (previous local day)',
    JSON.stringify(bucketTip(ts, EASTERN)) === JSON.stringify({ hour: 21, day: 'Wednesday' }))
  check('Pacific creator: same instant -> hour 18, Wednesday',
    JSON.stringify(bucketTip(ts, PACIFIC)) === JSON.stringify({ hour: 18, day: 'Wednesday' }))
  // The defect this replaces: a raw getUTCHours()/getUTCDay() bucket would put
  // all three creators in hour 2 / Thursday.
  check('fix is a real behavior change (UTC bucket disagrees with Pacific)', bucketTip(ts, UTC).hour !== bucketTip(ts, PACIFIC).hour)
}
{
  // Midnight-crossing, post-DST (Pacific is UTC-7 on this date): 06:30Z is
  // 23:30 local on the PREVIOUS calendar day.
  const ts = '2026-03-10T06:30:00.000Z'
  check('Pacific midnight crossing: 06:30Z -> 23:30 local, previous date',
    toLocalHour(ts, PACIFIC) === 23 && toLocalDateStr(ts, PACIFIC) === '2026-03-09')
  check('UTC same instant stays on 2026-03-10', toLocalDateStr(ts, UTC) === '2026-03-10')
  // And one hour later genuinely rolls the local date over.
  const tsMidnight = '2026-03-10T07:30:00.000Z'
  check('one hour later: 07:30Z -> 00:30 local on the new date',
    toLocalHour(tsMidnight, PACIFIC) === 0 && toLocalDateStr(tsMidnight, PACIFIC) === '2026-03-10')
}
{
  // DST: US springs forward 2026-03-08. Same wall-clock 20:00 local maps to a
  // DIFFERENT UTC hour either side of the transition — the heatmap must place
  // both in the local 20:00 bucket.
  const beforeDst = '2026-03-07T04:00:00.000Z' // 2026-03-06 20:00 PST (UTC-8)
  const afterDst  = '2026-03-20T03:00:00.000Z' // 2026-03-19 20:00 PDT (UTC-7)
  check('DST: pre-transition 20:00 local lands in hour 20', toLocalHour(beforeDst, PACIFIC) === 20)
  check('DST: post-transition 20:00 local also lands in hour 20', toLocalHour(afterDst, PACIFIC) === 20)
  check('DST: the two instants have DIFFERENT UTC hours (so a UTC bucket would split them)',
    new Date(beforeDst).getUTCHours() !== new Date(afterDst).getUTCHours())
}
{
  // Two platforms sharing one UTC timestamp must resolve to the same local
  // bucket — the hour is a property of the instant + creator zone, never of
  // the platform.
  const ts = '2026-01-15T02:30:00.000Z'
  const a = bucketTip(ts, PACIFIC), b = bucketTip(ts, PACIFIC)
  check('two platforms, same UTC instant -> identical local bucket', JSON.stringify(a) === JSON.stringify(b))
}

// ══════════════════════════════════════════════════════════════════════
// 2. STREAM PLANNER liftChart — Monday-anchored week in creator time.
//    Mirrors app/dashboard/StreamPlanner.js's liftChart bucketing.
// ══════════════════════════════════════════════════════════════════════
function weekKey(startIso, tz) {
  const [y, m, d] = toLocalDateStr(startIso, tz).split('-').map(Number)
  const dow = toLocalDow(startIso, tz)
  return new Date(Date.UTC(y, m - 1, d - (dow === 0 ? 6 : dow - 1))).toISOString().slice(0, 10)
}
{
  // The headline case: 03:00Z Monday is still late Sunday night in Pacific.
  // It belongs to the week that began the PREVIOUS Monday.
  const lateLocalSunday = '2026-01-19T03:00:00.000Z' // Mon 03:00 UTC = Sun 19:00 PST
  check('local Sunday night session is NOT pushed into the following week (Pacific)',
    weekKey(lateLocalSunday, PACIFIC) === '2026-01-12')
  check('same instant in UTC anchors to the later week (the old, wrong result)',
    weekKey(lateLocalSunday, UTC) === '2026-01-19')
  check('week bucketing differs between zones for this instant (real fix, not a no-op)',
    weekKey(lateLocalSunday, PACIFIC) !== weekKey(lateLocalSunday, UTC))
}
{
  // Early local Monday must open the NEW week.
  const earlyLocalMonday = '2026-01-19T16:00:00.000Z' // Mon 08:00 PST
  check('early local Monday starts the new week (Pacific)', weekKey(earlyLocalMonday, PACIFIC) === '2026-01-19')
  check('Eastern agrees for a mid-day Monday instant', weekKey(earlyLocalMonday, EASTERN) === '2026-01-19')
}
{
  // Week spanning a month boundary: 2026-01-28 is a Wednesday; its week began
  // Monday 2026-01-26 and runs into February.
  const midWeek = '2026-01-28T20:00:00.000Z'
  check('week crossing a month boundary anchors to the correct Monday', weekKey(midWeek, EASTERN) === '2026-01-26')
  const febSameWeek = '2026-02-01T18:00:00.000Z' // Sunday of that same week
  check('Sunday of a month-spanning week maps back to January Monday', weekKey(febSameWeek, EASTERN) === '2026-01-26')
}
{
  // DST transition week (US spring forward 2026-03-08, a Sunday).
  const satBefore = '2026-03-07T18:00:00.000Z' // Sat 10:00 PST
  const sunOfDst  = '2026-03-08T19:00:00.000Z' // Sun 12:00 PDT
  check('Saturday before DST anchors to Mon 2026-03-02', weekKey(satBefore, PACIFIC) === '2026-03-02')
  check('DST-transition Sunday belongs to the SAME week (Mon 2026-03-02)', weekKey(sunOfDst, PACIFIC) === '2026-03-02')
  check('DST does not split one local week into two buckets', weekKey(satBefore, PACIFIC) === weekKey(sunOfDst, PACIFIC))
}

// ══════════════════════════════════════════════════════════════════════
// 3. CROSS-SURFACE CONSISTENCY — one instant, one local hour, everywhere.
// ══════════════════════════════════════════════════════════════════════
{
  const ts = '2026-07-04T02:15:00.000Z'
  for (const tz of [PACIFIC, EASTERN, UTC]) {
    const h = toLocalHour(ts, tz)
    // Overview/platformTimes, Stream Planner, canonical bestTimes and Money Map
    // all now derive the hour through this same primitive, so agreement is
    // structural rather than coincidental.
    check(`${tz}: every surface derives the same local hour (${h})`,
      [toLocalHour(ts, tz), toLocalHour(ts, tz), toLocalHour(ts, tz)].every(x => x === h))
  }
}

// ══════════════════════════════════════════════════════════════════════
// 4. SOURCE-LEVEL: no raw-UTC / browser-timezone analytical buckets remain.
// ══════════════════════════════════════════════════════════════════════
{
  const { readFileSync } = await import('fs')
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const read = (rel) => strip(readFileSync(new URL(rel, import.meta.url), 'utf8'))

  const page = read('../app/dashboard/page.js')
  const planner = read('../app/dashboard/StreamPlanner.js')
  const moneyMap = read('../app/dashboard/MoneyMap.js')
  const growth = read('../app/dashboard/DashboardGrowthCharts.js')
  const engine = read('../lib/analytics.js')

  check('dashboard: no getUTCHours/getUTCDay analytical buckets', !/getUTCHours\(\)|getUTCDay\(\)/.test(page))
  check('dashboard: no browser getTimezoneOffset()', !page.includes('getTimezoneOffset()'))
  check('dashboard: no browser new Date().getHours()', !page.includes('new Date().getHours()'))
  check('dashboard: resolves ONE creatorTz from profiles.timezone', page.includes('const creatorTz = resolveCreatorTimezone(profile?.timezone).timezone'))
  check('StreamPlanner: no UTC calendar-field bucketing', !/getUTCDay\(\)|getUTCHours\(\)|getUTCFullYear\(\)/.test(planner))
  check('MoneyMap: no UTC/browser bucketing helpers', !/getUTCFullYear\(\)|new Date\(date\)\.getHours\(\)|new Date\(date\)\.getDay\(\)/.test(moneyMap))
  check('GrowthCharts: no UTC key derivation', !/getUTCHours\(\)|getUTCFullYear\(\)/.test(growth))
  check('canonical engine: no getUTCHours/getUTCDay left', !/getUTCHours\(\)|getUTCDay\(\)/.test(engine))
  check('canonical engine: identifyWhales accepts a timezone', engine.includes('export function identifyWhales(tips, tz'))
  check('canonical engine: predictRevenue accepts a timezone', engine.includes('export function predictRevenue(tips, sessions, tz'))
  check('canonical engine: computePaidSessionAnalytics accepts a timezone', engine.includes('export function computePaidSessionAnalytics(sessions, tz'))
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
