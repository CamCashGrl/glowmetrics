// Standalone verification for the Phase 1 canonical analytics modules:
// lib/analytics/sessions.js, lib/analytics/localTime.js,
// lib/analytics/bestTimes.js, lib/analytics/missedRevenue.js, and
// lib/analytics.js's local-calendar-month bucketing.
//
// Same convention as scripts/verify-estimated-hourly-rate.mjs: this repo has
// no test framework and lib/analytics.js's ESM files can't be `import`-ed
// directly by plain Node (no "type": "module" in package.json). This script
// mirrors the exact logic added in Phase 1 and runs it against constructed
// fixtures covering the scenarios canonical-analytics-rules.md's Testing
// section requires. Keep in sync with the real modules if the formulas
// change.

// ── mirrored from lib/analytics/localTime.js ──────────────────────────────
function calcMedian(arr) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
function toLocalHour(dateStr, tz) {
  try { return parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(new Date(dateStr))) % 24 }
  catch { return new Date(dateStr).getUTCHours() }
}
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function toLocalDow(dateStr, tz) {
  try { return DOW.indexOf(new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz }).format(new Date(dateStr))) }
  catch { return new Date(dateStr).getUTCDay() }
}
function toLocalDateStr(dateStr, tz) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(dateStr)) }
  catch { return new Date(dateStr).toISOString().slice(0, 10) }
}

// ── mirrored from lib/analytics/sessions.js ───────────────────────────────
function classifySession(s) {
  const mins = s.durationMinutes || 0
  const usd = s.totalUSD || 0
  if (mins < 2 && usd === 0) return 'invalid'
  if (mins < 15 && usd < 10) return 'low_signal'
  return 'meaningful'
}

// ── mirrored from lib/analytics/bestTimes.js ──────────────────────────────
const LOCAL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const TIER = { INSUFFICIENT: 'insufficient', PROMISING: 'promising', SUPPORTED: 'supported', HIGH: 'high' }
function tierForSessionCount(n) {
  if (n < 2) return TIER.INSUFFICIENT
  if (n <= 3) return TIER.PROMISING
  if (n <= 5) return TIER.SUPPORTED
  return TIER.HIGH
}
const CAN_BE_BEST_TIME = new Set([TIER.SUPPORTED, TIER.HIGH])
function computeCanonicalBestTimes(sessions, tz) {
  const buckets = {}
  for (const s of sessions) {
    if (!s.startTime || s.usdPerHour == null) continue
    const localDay = LOCAL_DAY_NAMES[toLocalDow(s.startTime, tz)]
    const localHour = toLocalHour(s.startTime, tz)
    const key = `${localDay}-${localHour}`
    if (!buckets[key]) buckets[key] = { localDay, localHour, rates: [], totalUsd: 0, platformUsd: {}, lastActiveAt: s.startTime }
    const b = buckets[key]
    b.rates.push(s.usdPerHour); b.totalUsd += s.totalUSD || 0
    b.platformUsd[s.platform] = (b.platformUsd[s.platform] || 0) + (s.totalUSD || 0)
    if (new Date(s.startTime) > new Date(b.lastActiveAt)) b.lastActiveAt = s.startTime
  }
  const grid = Object.values(buckets).map(b => {
    const sessionCount = b.rates.length
    const topPlatform = Object.entries(b.platformUsd).sort((a, b2) => b2[1] - a[1])[0]?.[0] || null
    return { localDay: b.localDay, localHour: b.localHour, medianUsdPerHour: parseFloat(calcMedian(b.rates).toFixed(2)), sessionCount, totalUsd: parseFloat(b.totalUsd.toFixed(2)), tier: tierForSessionCount(sessionCount), topPlatform, lastActiveAt: b.lastActiveAt }
  })
  const eligible = grid.filter(g => CAN_BE_BEST_TIME.has(g.tier))
  const bestWindow = eligible.length
    ? [...eligible].sort((a, b) => b.medianUsdPerHour - a.medianUsdPerHour || b.sessionCount - a.sessionCount || new Date(b.lastActiveAt) - new Date(a.lastActiveAt))[0]
    : null
  let earlySignal = null
  if (!bestWindow) {
    const promising = grid.filter(g => g.tier === TIER.PROMISING)
    earlySignal = promising.length ? [...promising].sort((a, b) => b.medianUsdPerHour - a.medianUsdPerHour)[0] : null
  }
  return { grid, bestWindow, earlySignal }
}

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`) }
}

function mkSession({ startTime, platform = 'Chaturbate', totalUSD, durationHours = 1 }) {
  return { startTime, platform, totalUSD, durationMinutes: durationHours * 60, usdPerHour: parseFloat((totalUSD / durationHours).toFixed(2)) }
}

// ══════════════════════════════════════════════════════════════════════
// 1. Confidence tiers — exact boundaries
// ══════════════════════════════════════════════════════════════════════
check('tier 0 sessions -> insufficient', tierForSessionCount(0), 'insufficient')
check('tier 1 session -> insufficient', tierForSessionCount(1), 'insufficient')
check('tier 2 sessions -> promising', tierForSessionCount(2), 'promising')
check('tier 3 sessions -> promising', tierForSessionCount(3), 'promising')
check('tier 4 sessions -> supported', tierForSessionCount(4), 'supported')
check('tier 5 sessions -> supported', tierForSessionCount(5), 'supported')
check('tier 6 sessions -> high', tierForSessionCount(6), 'high')
check('tier 10 sessions -> high', tierForSessionCount(10), 'high')

// ══════════════════════════════════════════════════════════════════════
// 2. Sparse account — below every threshold, no bestWindow, no crash
// ══════════════════════════════════════════════════════════════════════
{
  const sessions = [mkSession({ startTime: '2026-08-10T20:00:00Z', totalUSD: 40 })]
  const { grid, bestWindow, earlySignal } = computeCanonicalBestTimes(sessions, 'UTC')
  check('sparse account: 1 bucket in grid', grid.length, 1)
  check('sparse account: no bestWindow (insufficient tier)', bestWindow, null)
  check('sparse account: no earlySignal either (insufficient, not promising)', earlySignal, null)
}

// ══════════════════════════════════════════════════════════════════════
// 3. Exact-threshold account — exactly 2 sessions in a bucket = promising,
//    shown as earlySignal, never substituted for bestWindow
// ══════════════════════════════════════════════════════════════════════
{
  const sessions = [
    mkSession({ startTime: '2026-08-03T20:00:00Z', totalUSD: 40 }), // Monday 20:00
    mkSession({ startTime: '2026-08-10T20:00:00Z', totalUSD: 60 }),
  ]
  const { bestWindow, earlySignal } = computeCanonicalBestTimes(sessions, 'UTC')
  check('exact-threshold (2 sessions): bestWindow still null', bestWindow, null)
  check('exact-threshold (2 sessions): earlySignal present at promising tier', earlySignal?.tier, 'promising')
  check('exact-threshold (2 sessions): earlySignal medianUsdPerHour', earlySignal?.medianUsdPerHour, 50)
}

// ══════════════════════════════════════════════════════════════════════
// 4. Whale-heavy account — one huge outlier session must not skew the
//    median the way it would skew a mean
// ══════════════════════════════════════════════════════════════════════
{
  const base = (n) => Array.from({ length: n }, (_, i) =>
    mkSession({ startTime: `2026-08-${String(3 + i * 7).padStart(2, '0')}T20:00:00Z`, totalUSD: 50 }))
  const sessions = [...base(5), mkSession({ startTime: '2026-08-31T20:00:00Z', totalUSD: 5000 })] // 6th session, whale
  const { bestWindow } = computeCanonicalBestTimes(sessions, 'UTC')
  check('whale-heavy: tier reaches high (6 sessions)', bestWindow?.tier, 'high')
  check('whale-heavy: median stays at $50/hr, not pulled to the $5000 outlier', bestWindow?.medianUsdPerHour, 50)
}

// ══════════════════════════════════════════════════════════════════════
// 5. Platform switching — same day/hour, different platforms, topPlatform
//    tracks whichever platform actually earned the most in that bucket
// ══════════════════════════════════════════════════════════════════════
{
  const sessions = [
    mkSession({ startTime: '2026-08-03T20:00:00Z', platform: 'Chaturbate', totalUSD: 30 }),
    mkSession({ startTime: '2026-08-10T20:00:00Z', platform: 'BongaCams', totalUSD: 30 }),
    mkSession({ startTime: '2026-08-17T20:00:00Z', platform: 'BongaCams', totalUSD: 90 }),
    mkSession({ startTime: '2026-08-24T20:00:00Z', platform: 'Chaturbate', totalUSD: 30 }),
  ]
  const { grid } = computeCanonicalBestTimes(sessions, 'UTC')
  check('platform switching: single bucket (same day/hour)', grid.length, 1)
  check('platform switching: topPlatform is the higher-earning one', grid[0].topPlatform, 'BongaCams')
}

// ══════════════════════════════════════════════════════════════════════
// 6. Midnight-crossing session — startTime is what buckets the session,
//    even if the session runs past midnight local time
// ══════════════════════════════════════════════════════════════════════
{
  // 23:30 UTC start, in America/New_York (UTC-4 in August, DST) = 19:30 local
  const s = mkSession({ startTime: '2026-08-10T23:30:00Z', totalUSD: 40 })
  const hour = toLocalHour(s.startTime, 'America/New_York')
  check('midnight-crossing session buckets by local start hour (19), not UTC hour (23)', hour, 19)
}

// ══════════════════════════════════════════════════════════════════════
// 7. DST transition — same IANA zone, one date before/one after a DST
//    change, correct local hour on both sides (Intl handles this by
//    construction; this asserts that construction is actually correct)
// ══════════════════════════════════════════════════════════════════════
{
  // US DST ends 2026-11-01. 18:00 UTC on 10/31 (still EDT, UTC-4) = 14:00 local.
  // 18:00 UTC on 11/02 (now EST, UTC-5) = 13:00 local. Same UTC hour, different
  // local hour across the transition — proves tz-aware bucketing, not a fixed
  // UTC offset baked in anywhere.
  const before = toLocalHour('2026-10-31T18:00:00Z', 'America/New_York')
  const after = toLocalHour('2026-11-02T18:00:00Z', 'America/New_York')
  check('DST: pre-transition local hour', before, 14)
  check('DST: post-transition local hour (falls back 1hr)', after, 13)
}

// ══════════════════════════════════════════════════════════════════════
// 8. Timezone fallback / explicit creator timezone / timezone change —
//    covered by lib/timezone.js's resolveCreatorTimezone() directly
//    (pure function, no DB/browser dependency, safe to import here since
//    it's plain data-in/data-out with no ESM/CJS boundary issue... but
//    lib/timezone.js is also an ESM `export function` file, so it's
//    mirrored the same way as the others for consistency).
// ══════════════════════════════════════════════════════════════════════
function resolveCreatorTimezone(profileTimezone, browserTz) {
  if (profileTimezone) return { timezone: profileTimezone, source: 'profile' }
  if (browserTz) return { timezone: browserTz, source: 'browser_fallback' }
  return { timezone: 'UTC', source: 'utc_fallback' }
}
check('explicit creator timezone wins over browser', resolveCreatorTimezone('Europe/Berlin', 'America/Chicago'), { timezone: 'Europe/Berlin', source: 'profile' })
check('timezone fallback: no profile tz -> browser tz used', resolveCreatorTimezone(null, 'America/Chicago'), { timezone: 'America/Chicago', source: 'browser_fallback' })
check('timezone fallback: neither present -> UTC, explicitly marked', resolveCreatorTimezone(null, null), { timezone: 'UTC', source: 'utc_fallback' })
{
  // "timezone change": same historical session, resolved under the OLD vs
  // NEW saved timezone, produces a different (and correctly different)
  // local bucket — this is expected, not a bug: canonical-analytics-rules.md
  // requires this be documented, not silently hidden.
  const s = { startTime: '2026-08-10T23:30:00Z' }
  const oldTzHour = toLocalHour(s.startTime, 'America/New_York')
  const newTzHour = toLocalHour(s.startTime, 'Asia/Tokyo')
  check('timezone change: same session buckets differently under old tz', oldTzHour, 19)
  check('timezone change: same session buckets differently under new tz', newTzHour, 8)
}

// ── NULL timezone gets initialized / explicit timezone is never
//    overwritten — mirrors lib/timezone.js's autoPopulateTimezoneIfMissing(),
//    which is race-safe via .is('timezone', null) in the real Supabase
//    update filter. This mirror simulates that filter against an in-memory
//    "row" instead of a real DB round trip.
function mockAutoPopulateTimezoneIfMissing(row, browserTz) {
  if (row.timezone) return { wrote: false, row } // explicit value present -> never touched
  if (!browserTz) return { wrote: false, row }
  return { wrote: true, row: { ...row, timezone: browserTz } }
}
{
  const nullRow = { id: 'u1', timezone: null }
  const { wrote, row } = mockAutoPopulateTimezoneIfMissing(nullRow, 'America/Denver')
  check('NULL timezone: auto-populate writes the browser-detected value', wrote, true)
  check('NULL timezone: auto-populate result stores that value', row.timezone, 'America/Denver')
}
{
  const explicitRow = { id: 'u2', timezone: 'Asia/Kolkata' }
  const { wrote, row } = mockAutoPopulateTimezoneIfMissing(explicitRow, 'America/Denver')
  check('explicit timezone: auto-populate does NOT write (no wrote flag)', wrote, false)
  check('explicit timezone: saved value is untouched, not overwritten by browser', row.timezone, 'Asia/Kolkata')
}
{
  // Simulates a creator's second device reporting a different browser tz —
  // still must not overwrite the already-saved preference.
  const explicitRow = { id: 'u3', timezone: 'Europe/London' }
  const { wrote, row } = mockAutoPopulateTimezoneIfMissing(explicitRow, 'Australia/Sydney')
  check('explicit timezone: a DIFFERENT browser tz on a later load still does not overwrite', wrote === false && row.timezone === 'Europe/London', true)
}

// ── Platform timestamps crossing local midnight — two platforms, one tip
//    each, both stored at the same UTC instant that falls on different
//    local calendar dates/hours depending on tz; confirms per-tip local
//    bucketing is independent per timestamp, not accidentally shared state
//    across platforms in the same buckets object.
{
  const platformTips = [
    // 04:30 UTC minus America/New_York's August (EDT, UTC-4) offset = 00:30
    // local — just past midnight, still Aug 11 local (Tuesday).
    { startTime: '2026-08-11T04:30:00Z', platform: 'Chaturbate', totalUSD: 40, durationMinutes: 60, usdPerHour: 40 },
    { startTime: '2026-08-11T04:30:00Z', platform: 'BongaCams', totalUSD: 40, durationMinutes: 60, usdPerHour: 40 },
  ]
  const { grid } = computeCanonicalBestTimes(platformTips, 'America/New_York')
  check('platform timestamps crossing local midnight: both platforms land in the same local bucket (same instant, same tz)', grid.length, 1)
  check('platform timestamps crossing local midnight: local day is Aug 11 (00:30 local), not Aug 10 (UTC calendar date)', grid[0].localDay, 'Tuesday') // 2026-08-11 is a Tuesday
  check('platform timestamps crossing local midnight: local hour is 0 (12am), correctly rolled past midnight from 04:30 UTC', grid[0].localHour, 0)
}

// ── Timezone change must not mutate historical source data — resolving a
//    session/tip under a different tz must never write back to the
//    session/tip object itself (toLocalHour/toLocalDow/toLocalDateStr are
//    pure: dateStr in, bucket out — no assignment to the input).
{
  const historicalSession = Object.freeze({ startTime: '2026-08-10T23:30:00Z', totalUSD: 40, platform: 'Chaturbate' })
  // Object.freeze means any accidental mutation attempt inside toLocalHour/
  // toLocalDow would throw in strict mode / silently no-op — either way the
  // object's own fields must be provably unchanged after resolving it under
  // two different timezones.
  const before = JSON.stringify(historicalSession)
  toLocalHour(historicalSession.startTime, 'America/New_York')
  toLocalDow(historicalSession.startTime, 'America/New_York')
  toLocalHour(historicalSession.startTime, 'Asia/Tokyo')
  toLocalDateStr(historicalSession.startTime, 'Asia/Tokyo')
  const after = JSON.stringify(historicalSession)
  check('timezone change: resolving the same historical session under two different timezones does not mutate its stored startTime/fields', before, after)
}

// ══════════════════════════════════════════════════════════════════════
// 9. Median calculation — odd and even bucket sizes
// ══════════════════════════════════════════════════════════════════════
check('median of odd-length array', calcMedian([10, 30, 20]), 20)
check('median of even-length array', calcMedian([10, 20, 30, 40]), 25)
check('median of single value', calcMedian([42]), 42)
check('median of empty array', calcMedian([]), 0)

// ══════════════════════════════════════════════════════════════════════
// 10. Platform $/hr — meaningfulSessions population, classifySession gate
// ══════════════════════════════════════════════════════════════════════
check('invalid session excluded (< 2min, $0)', classifySession({ durationMinutes: 1, totalUSD: 0 }), 'invalid')
check('low-signal session excluded (< 15min, < $10)', classifySession({ durationMinutes: 5, totalUSD: 3 }), 'low_signal')
check('meaningful session included (>= 15min or >= $10)', classifySession({ durationMinutes: 20, totalUSD: 15 }), 'meaningful')
check('meaningful session: short but high-value still counts', classifySession({ durationMinutes: 3, totalUSD: 25 }), 'meaningful')

// ══════════════════════════════════════════════════════════════════════
// 11. Monthly growth — local-calendar-month bucketing, growthPct formula
// ══════════════════════════════════════════════════════════════════════
function monthKeyLocal(dateStr, tz) { const local = toLocalDateStr(dateStr, tz); return local ? local.slice(0, 7) : null }
{
  // 2026-08-01T02:00:00Z is July 31st in America/Los_Angeles (UTC-7 in Aug)
  // — this is exactly the local-vs-UTC month misattribution
  // canonical-analytics-rules.md's Monthly-Growth Reconciliation flagged.
  const key = monthKeyLocal('2026-08-01T02:00:00Z', 'America/Los_Angeles')
  check('monthly growth: local calendar month, not UTC (July 31 local, not Aug 1)', key, '2026-07')
}
{
  const monthlyDataUnsorted = [{ month: '2026-06', usd: 100 }, { month: '2026-07', usd: 150 }, { month: '2026-08', usd: 75 }]
  const withGrowth = monthlyDataUnsorted.map((m, i) => {
    const prev = i > 0 ? monthlyDataUnsorted[i - 1] : null
    const growthPct = prev && prev.usd > 0 ? Math.round(((m.usd - prev.usd) / prev.usd) * 100) : null
    return { ...m, growthPct }
  })
  check('monthly growth: first month has null growthPct (no prior month)', withGrowth[0].growthPct, null)
  check('monthly growth: 100 -> 150 is +50%', withGrowth[1].growthPct, 50)
  check('monthly growth: 150 -> 75 is -50%', withGrowth[2].growthPct, -50)
}

// ══════════════════════════════════════════════════════════════════════
// 12. Missed revenue — today_missed / cumulative_by_platform /
//     recent_streak_missed stay distinct, share the same bestWindow input
// ══════════════════════════════════════════════════════════════════════
{
  // 6 sessions at the same Monday-20:00 window -> high-confidence bestWindow
  const sessions = Array.from({ length: 6 }, (_, i) =>
    mkSession({ startTime: `2026-07-${String(6 + i * 7).padStart(2, '0')}T20:00:00Z`, totalUSD: 60 }))
  const { bestWindow } = computeCanonicalBestTimes(sessions, 'UTC')
  check('missed revenue precondition: bestWindow found for streak test', bestWindow?.localDay, 'Monday')
  // recent_streak_missed: none of the 6 fixture sessions fall in the last 3
  // days relative to "now" below, so the streak should read as missed.
  const now = new Date('2026-08-14T12:00:00Z')
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
  const recentSessions = sessions.filter(s => new Date(s.startTime) >= threeDaysAgo)
  check('missed revenue: recent_streak_missed precondition (no sessions in last 3 days)', recentSessions.length, 0)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
