/**
 * Batch 1 dashboard correction — regression tests.
 *
 *  1. Creator timezone: every engine output that names a day, hour, month or
 *     date is on the creator's selected IANA clock (passed explicitly), never
 *     UTC or the device/process zone.
 *  2. ">= 3 separate days" for best times is counted in distinct creator-local
 *     dates (UTC hour buckets over-count in half-hour offset zones).
 *  3. One entitlement scope: the heatmap's weekday activity comes from the
 *     engine's plan-gated input (Free: primary full history, other platforms
 *     31 days; Pro: everything).
 *  4. A tip with no platform is 'Unknown' — never Chaturbate.
 *  5. Hourly-rate eligibility is the canonical valid session (>= 30 min AND
 *     >= 2 tips) with a known duration and revenue; removing the inert
 *     ">= 15 min" clause changes no figure.
 */
const fs = require('fs')
const path = require('path')
import {
  aggregateRows, applyFreeAnalysisWindow, predictRevenue, generateNextMoves, generateInsights, MISSING_PLATFORM,
} from '../../analytics'
import { detectSessions, isValidSession } from '../sessions'

// Creator-local wall time -> UTC ISO instant (independent of the engine).
function localToUtc(ymd, hm, tz) {
  const [y, mo, d] = ymd.split('-').map(Number)
  const [h, mi] = hm.split(':').map(Number)
  const target = Date.UTC(y, mo - 1, d, h, mi)
  let guess = target
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(guess)).map(x => [x.type, x.value]))
    guess += target - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute)
  }
  return new Date(guess).toISOString()
}
const tip = (iso, username = 'fan', usd = 2, platform = 'BongaCams') => ({ date_time: iso, platform, username, tokens: Math.round(usd * 40), usd })
const at = (tz, ymd, hm, ...rest) => tip(localToUtc(ymd, hm, tz), ...rest)
const freeze = (iso) => jest.useFakeTimers({ now: new Date(iso), doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick'] })
afterEach(() => jest.useRealTimers())

// Whole-hour, half-hour, 45-minute and +14 offsets, incl. a half-hour DST zone.
const ZONES = ['America/Los_Angeles', 'Asia/Kolkata', 'Asia/Kathmandu', 'America/St_Johns', 'Australia/Lord_Howe', 'Pacific/Kiritimati']
const FRIDAYS = ['2026-10-09', '2026-10-16', '2026-10-23']

describe.each(ZONES)('creator timezone %s (explicit)', (tz) => {
  test('best day is the creator-local weekday across local midnight', () => {
    freeze('2026-11-20T12:00:00Z')
    const rows = FRIDAYS.flatMap(d => [at(tz, d, '23:10', 'a'), at(tz, d, '23:50', 'b')])
    const r = aggregateRows(rows, tz)
    expect(r.bestDay.day).toBe('Friday')
  })

  test('best-day insight names the creator-local weekday', () => {
    freeze('2026-11-20T12:00:00Z')
    const fri = FRIDAYS.flatMap(d => [at(tz, d, '23:10', 'a', 20), at(tz, d, '23:50', 'b', 20)])
    const mon = ['2026-10-05', '2026-10-12', '2026-10-19'].flatMap(d => [at(tz, d, '23:10', 'c', 1), at(tz, d, '23:50', 'd', 1)])
    const rows = [...fri, ...mon]
    const sessions = detectSessions(rows).filter(isValidSession)
    const ins = generateInsights(rows, sessions, { day: 'Friday' }, { day: 'Monday' }, null, null, tz)
    expect(ins.find(i => i.type === 'day')?.text).toMatch(/^Fridays are your highest-earning day — you avg \$40 on Fridays vs \$2 on other days/)
  })

  test('monthly buckets use the creator-local month (local Oct 31 23:30 stays in October)', () => {
    freeze('2026-11-20T12:00:00Z')
    const r = aggregateRows([at(tz, '2026-10-31', '23:30', 'a'), at(tz, '2026-10-31', '23:45', 'a')], tz)
    expect(r.monthlyData.map(m => m.month)).toEqual(['2026-10'])
  })

  test('a best hour needs 3 distinct local dates — 2 dates never qualify, even when they span 4 UTC hour buckets', () => {
    freeze('2026-11-20T12:00:00Z')
    const two = ['2026-10-05', '2026-10-06'].flatMap(d => [at(tz, d, '14:10', 'x' + d), at(tz, d, '14:50', 'y' + d)])
    const r2 = aggregateRows(two, tz)
    expect(r2.bestHour).toBeNull()
    expect(r2.platformBestTimes.BongaCams.hour).toBeNull()
    const three = ['2026-10-05', '2026-10-06', '2026-10-07'].map(d => at(tz, d, '14:20', 'z' + d))
    const r3 = aggregateRows(three, tz)
    expect(String(r3.bestHour.hour)).toBe('14')
    expect(r3.bestHour.localDates).toBe(3)
  })

  test('tonight forecast uses sessions on the creator-local weekday', () => {
    const rows = FRIDAYS.flatMap(d => [at(tz, d, '10:10', 'a', 5), at(tz, d, '10:50', 'b', 5)])
    const sessions = detectSessions(rows).filter(isValidSession)
    freeze(localToUtc('2026-10-30', '20:00', tz)) // local Friday 8 PM
    const p = predictRevenue(rows, sessions, tz)
    expect(p.tonightStream).toBeTruthy()
    expect(p.tonightStream.expected).toBe(10)
  })

  test('"hours until peak" is measured on the creator clock (1h before a 9 PM local peak → Go live NOW)', () => {
    freeze(localToUtc('2026-10-30', '20:00', tz))
    const moves = generateNextMoves([], [], [], null, { hour: '21', avg: 5 }, [], tz)
    expect(moves[0].text).toMatch(/^Go live NOW — 9 PM is your peak earning time/)
  })

  test("fan typical online hours and first/last dates are creator-local", () => {
    freeze('2026-11-20T12:00:00Z')
    const rows = ['2026-10-05', '2026-10-06', '2026-10-07'].map(d => at(tz, d, '09:20', 'fanq'))
    const r = aggregateRows(rows, tz)
    const w = r.whales.find(x => x.username === 'fanq')
    expect(w.typicalOnlineHours).toBe('9:00 - 11:00')
    const t = r.topTippers.find(x => x.username === 'fanq')
    expect(t.first).toBe('10/5/2026')
    expect(t.last).toBe('10/7/2026')
  })
})

test('results do not depend on the process timezone (only on the creator timezone passed)', () => {
  freeze('2026-11-20T12:00:00Z')
  const tz = 'Asia/Kolkata'
  const rows = FRIDAYS.flatMap(d => [at(tz, d, '23:10', 'a'), at(tz, d, '23:50', 'b')])
  const r = aggregateRows(rows, tz)
  // Every date/hour field is derived from tz, so these hold under any TZ env.
  expect(r.bestDay.day).toBe('Friday')
  expect(r.monthlyData.map(m => m.month)).toEqual(['2026-10'])
  expect(r.topTippers.map(t => t.first)).toEqual(['10/9/2026', '10/9/2026'])
})

describe('entitlement scope for weekday activity (heatmap source)', () => {
  const TZ = 'America/Los_Angeles'
  // Primary BongaCams: 400 days of weekly Sunday tips. Secondary Chaturbate:
  // one old Monday (outside its 31-day window) + recent Tuesdays.
  const rows = [
    ...Array.from({ length: 40 }, (_, i) => tip(new Date(Date.parse('2026-10-04T19:00:00Z') - i * 7 * 864e5).toISOString(), 'b' + i, 3, 'BongaCams')),
    tip('2026-06-01T19:00:00Z', 'old', 50, 'Chaturbate'),
    tip('2026-09-22T19:00:00Z', 'c1', 4, 'Chaturbate'),
    tip('2026-09-29T19:00:00Z', 'c2', 4, 'Chaturbate'),
  ]
  beforeEach(() => freeze('2026-11-20T12:00:00Z'))

  test('Free: primary keeps full history, secondary keeps its 31-day preview', () => {
    const r = aggregateRows(applyFreeAnalysisWindow(rows, { windowDays: 31, unlimitedPlatform: 'BongaCams' }), TZ)
    expect(r.platformDayActivity.BongaCams.Sunday).toEqual({ totalUSD: 120, activeDays: 40, avgPerActiveDay: 3 })
    expect(r.platformDayActivity.Chaturbate.Monday).toBeUndefined() // the old row is outside the preview
    expect(r.platformDayActivity.Chaturbate.Tuesday).toEqual({ totalUSD: 8, activeDays: 2, avgPerActiveDay: 4 })
    // Same dataset as the platform totals shown beside the heatmap.
    expect(r.platforms.find(p => p.platform === 'Chaturbate').totalUSD).toBe(8)
  })

  test('Pro: full history on every platform', () => {
    const r = aggregateRows(rows, TZ)
    expect(r.platformDayActivity.Chaturbate.Monday).toEqual({ totalUSD: 50, activeDays: 1, avgPerActiveDay: 50 })
    expect(r.platforms.find(p => p.platform === 'Chaturbate').totalUSD).toBe(58)
  })

  test('the dashboard renders the heatmap, platform totals and Likely Online from engine output, not raw tips', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'app', 'dashboard', 'page.js'), 'utf8')
    const heat = src.slice(src.indexOf('{/* Platform day heatmap */}'), src.indexOf('Platform by Day of Week'))
    expect(heat).toMatch(/analytics\?\.platformDayActivity/)
    expect(heat).not.toMatch(/tips\.forEach/)
    expect(src).not.toMatch(/platTotalUSD/)
    expect(src).not.toMatch(/: tips\.filter\(t => t\.username\.toLowerCase\(\) === w\.username\.toLowerCase\(\)\)\n\s*const hourCounts/)
    expect(src).toMatch(/const fanTips = w\.tips \|\| \[\]/)
    expect(src).toMatch(/analytics\?\.monthlyData/)
  })
})

describe('missing platform', () => {
  beforeEach(() => freeze('2026-11-20T12:00:00Z'))
  test("a tip with no platform is grouped as 'Unknown', never Chaturbate", () => {
    const t = (iso, u, usd) => ({ date_time: iso, username: u, tokens: usd * 20, usd })
    const r = aggregateRows([
      t('2026-10-05T19:00:00Z', 'a', 3), t('2026-10-05T19:40:00Z', 'b', 3), // one 40-min valid session
      tip('2026-10-06T19:00:00Z', 'c', 5, 'Chaturbate'),
    ], 'UTC')
    expect(MISSING_PLATFORM).toBe('Unknown')
    const unk = r.platforms.find(p => p.platform === 'Unknown')
    expect(unk).toMatchObject({ totalUSD: 6, tips: 2, sessions: 1, rateSessionCount: 1 })
    expect(r.platforms.find(p => p.platform === 'Chaturbate').totalUSD).toBe(5)
    expect(r.platformVelocity.Unknown).toBe(9) // $6 over 40 minutes
    expect(Object.keys(r.platformDayActivity)).toEqual(expect.arrayContaining(['Unknown', 'Chaturbate']))
    expect(Object.keys(r.platformTipTypes)).toEqual(expect.arrayContaining(['Unknown', 'Chaturbate']))
    expect(r.platformMomentum.Unknown).toBeDefined()
  })
})

describe('hourly-rate eligibility = valid session (>= 30 min AND >= 2 tips) + known duration + revenue', () => {
  beforeEach(() => freeze('2026-11-20T12:00:00Z'))
  const T = (hm, u, usd, day = '2026-10-05') => ({ date_time: `${day}T${hm}:00Z`, platform: 'BongaCams', username: u, tokens: Math.max(1, Math.round(usd * 40)), usd })
  const rows = [
    T('10:00', 'a', 6), T('10:45', 'b', 6),                       // 45 min, 2 tips, $12  → eligible
    T('12:00', 'c', 4), T('12:20', 'd', 4),                       // 20 min, 2 tips       → not valid (< 30)
    T('14:00', 'e', 0), T('14:40', 'f', 0),                       // 40 min, 2 tips, $0   → valid, no revenue → excluded from rate
    T('16:00', 'g', 30),                                          // single tip: missing duration → excluded
    T('18:00', 'h', 9, '2026-10-06'), T('18:00', 'i', 9, '2026-10-06'), // same minute: duration unknown → excluded
  ]
  test('only the 45-minute, 2-tip, $12 session feeds the rate; totals still include every tip', () => {
    const r = aggregateRows(rows, 'UTC')
    expect(r.hourlyRateSessionCount).toBe(1)
    expect(r.hourlyRateTotalUsd).toBe(12)
    expect(r.hourlyRateTotalMinutes).toBe(45)
    expect(r.estimatedHourlyRate).toBe(16)
    expect(r.totalUSD).toBe(68)
    expect(r.meaningfulSessionCount).toBe(2) // 45-min $12 and 40-min $0 sessions are both valid sessions
  })
  test('the removed ">= 15 min" clause could never exclude a valid session', () => {
    const r = aggregateRows(rows, 'UTC')
    expect(r.meaningfulSessions.every(s => s.durationMinutes >= 30)).toBe(true)
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'analytics.js'), 'utf8')
    const rule = src.slice(src.indexOf('const isHourlyRateEligible'), src.indexOf('const hourlyRateSessions'))
    expect(rule).not.toMatch(/>= 15/)
    expect(src).toMatch(/const hourlyRateSessions = meaningfulSessions\.filter\(isHourlyRateEligible\)/)
  })
})
