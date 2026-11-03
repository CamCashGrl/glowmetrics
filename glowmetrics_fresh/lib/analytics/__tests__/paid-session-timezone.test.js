/**
 * computePaidSessionAnalytics(sessions, tz): peak hours and the monthly trend
 * are bucketed on the creator's selected IANA clock, not UTC. Without a
 * timezone the previous (UTC) behaviour is unchanged.
 */
import { computePaidSessionAnalytics } from '../../analytics'

// Creator-local wall time -> UTC ISO instant, independent of the engine.
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
const session = (iso, usd = 12, username = 'client', type = 'Private Chat') => ({
  date_time: iso, usd, tokens: usd * 40, username, session_type: type, platform: 'BongaCams',
})

describe.each(['America/Los_Angeles', 'Asia/Kolkata', 'Asia/Kathmandu', 'America/St_Johns', 'Australia/Lord_Howe', 'Pacific/Kiritimati'])(
  'creator timezone %s (explicit)', (tz) => {
    test('peak hour is the creator-local hour (incl. :30 / :45 offset zones)', () => {
      const r = computePaidSessionAnalytics([session(localToUtc('2026-10-07', '14:40', tz), 30), session(localToUtc('2026-10-14', '14:10', tz), 20), session(localToUtc('2026-10-21', '09:00', tz), 5)], tz)
      expect(r.peakHours[0]).toMatchObject({ hour: 14, usd: 50, count: 2 })
      expect(r.peakHours.map(p => p.hour).sort((a, b) => a - b)).toEqual([9, 14])
    })

    test('the monthly trend uses the creator-local month across the month boundary', () => {
      // Local Oct 31 23:30 stays in October; local Nov 1 00:30 is November.
      const r = computePaidSessionAnalytics([session(localToUtc('2026-10-31', '23:30', tz), 10), session(localToUtc('2026-11-01', '00:30', tz), 7)], tz)
      const byMonth = Object.fromEntries(r.monthlyTrend.map(m => [m.month, m.usd]))
      expect(byMonth).toEqual({ '2026-10': 10, '2026-11': 7 })
    })
  }
)

test('without a timezone the buckets stay on UTC (previous behaviour)', () => {
  const iso = '2026-10-01T03:00:00Z' // 8 PM on Sept 30 in Los Angeles
  const utc = computePaidSessionAnalytics([session(iso, 12)])
  expect(utc.peakHours[0].hour).toBe(3)
  expect(utc.monthlyTrend[0].month).toBe('2026-10')
  const la = computePaidSessionAnalytics([session(iso, 12)], 'America/Los_Angeles')
  expect(la.peakHours[0].hour).toBe(20)
  expect(la.monthlyTrend[0].month).toBe('2026-09')
})

test('totals are identical whatever the timezone; only the hour and month a session lands in move', () => {
  const rows = [session('2026-10-01T03:00:00Z', 12), session('2026-10-15T20:00:00Z', 8, 'b'), session('2026-09-30T20:00:00Z', 5, 'c')]
  const a = computePaidSessionAnalytics(rows, 'America/Los_Angeles'), b = computePaidSessionAnalytics(rows, 'UTC')
  expect(a.totalUSD).toBe(b.totalUSD)
  expect(a.totalCount).toBe(b.totalCount)
  expect(a.monthlyTrend.reduce((n, m) => n + m.usd, 0)).toBe(b.monthlyTrend.reduce((n, m) => n + m.usd, 0))
})

test('the Private Sessions page labels its timing by the clock it actually uses', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', '..', 'app', 'dashboard', 'PrivateSessions.js'), 'utf8')
  expect(src).toMatch(/computePaidSessionAnalytics\(filtered, tz \|\| 'UTC'\)/)
  expect(src).toMatch(/\{tz \? 'your time' : 'UTC'\}/)
  expect(src).not.toMatch(/by hour, UTC\)/)
})

test("the dashboard's Monthly Goal block reads the creator's calendar, not UTC", () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', '..', 'app', 'dashboard', 'page.js'), 'utf8')
  const block = src.slice(src.indexOf('{activeTab === "monthly"'), src.indexOf('const maxBarUSD'))
  expect(block).toMatch(/zonedParts\(new Date\(\), creatorTz\)/)
  expect(block).toMatch(/zonedMonthKey\(new Date\(\), creatorTz\)/)
  expect(block).toMatch(/Date\.UTC\(nowParts\.year, nowParts\.month, 0\)/)
  // The days-in-month line is calendar arithmetic on already-localised numbers (Date.UTC(year, month, 0)).
  // What must not remain is reading the current time in UTC.
  expect(block).not.toMatch(/now\.getUTC|new Date\(\)\.getUTC/)
})
