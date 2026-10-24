/**
 * Creator timezone contract: the saved profiles.timezone wins, then the
 * browser zone, then UTC — and every dashboard time bucket (hour, weekday,
 * calendar date) lands on that same clock.
 */
import {
  isValidTimeZone, detectBrowserTimeZone, resolveCreatorTimeZone, timeZoneLabel,
  zonedParts, zonedHour, zonedDay, zonedYMD, zonedMonthKey, zonedHourDecimal, zonedWallTimeToDate,
} from '../creatorTimezone'

const realResolved = Intl.DateTimeFormat.prototype.resolvedOptions
let browserTz
beforeEach(() => {
  browserTz = 'America/New_York'
  jest.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function () {
    return { ...realResolved.call(this), timeZone: browserTz }
  })
})
afterEach(() => jest.restoreAllMocks())

describe('resolveCreatorTimeZone — source of truth and fallback', () => {
  test('a valid saved timezone wins over the browser zone', () => {
    expect(resolveCreatorTimeZone('Europe/Berlin')).toBe('Europe/Berlin')
  })
  test.each([[null], [undefined], [''], ['GMT-8 PST'], ['Not/AZone'], [42]])('invalid saved value %p falls back to the browser zone', (saved) => {
    expect(resolveCreatorTimeZone(saved)).toBe('America/New_York')
  })
  test.each([[''], [undefined], ['Mars/Olympus']])('invalid browser zone %p falls back to UTC', (bad) => {
    browserTz = bad
    expect(detectBrowserTimeZone()).toBe('UTC')
    expect(resolveCreatorTimeZone(null)).toBe('UTC')
  })
  test('IANA validation', () => {
    expect(isValidTimeZone('Asia/Tokyo')).toBe(true)
    expect(isValidTimeZone('PST8PDT-ish')).toBe(false)
  })
  test('readable label', () => {
    expect(timeZoneLabel('America/Los_Angeles')).toBe('Pacific Time')
  })
})

describe('zoned buckets move together on the creator clock', () => {
  // 03:30 UTC Thu 15 Jan 2026 = 19:30 Wed 14 Jan in Los Angeles (UTC-8)
  const instant = '2026-01-15T03:30:00Z'
  test('Los Angeles: hour, weekday and date all roll back to the creator day', () => {
    const tz = 'America/Los_Angeles'
    expect(zonedHour(instant, tz)).toBe(19)
    expect(zonedDay(instant, tz)).toBe(3) // Wednesday
    expect(zonedYMD(instant, tz)).toBe('2026-01-14')
    expect(zonedMonthKey(instant, tz)).toBe('2026-01')
    expect(zonedHourDecimal(instant, tz)).toBe(19.5)
  })
  test('the same instant in UTC and Tokyo', () => {
    expect(zonedParts(instant, 'UTC')).toMatchObject({ year: 2026, month: 1, day: 15, hour: 3, minute: 30, weekday: 4 })
    expect(zonedParts(instant, 'Asia/Tokyo')).toMatchObject({ day: 15, hour: 12, weekday: 4 })
  })
  test('midnight is hour 0, not 24', () => {
    expect(zonedHour('2026-01-15T08:00:00Z', 'America/Los_Angeles')).toBe(0)
  })
  test('month boundary follows the creator calendar', () => {
    expect(zonedMonthKey('2026-02-01T02:00:00Z', 'America/Los_Angeles')).toBe('2026-01')
  })
})

describe('zonedWallTimeToDate — creator wall clock → instant', () => {
  test('standard time', () => {
    expect(zonedWallTimeToDate('2026-01-14', '20:00', 'America/Los_Angeles').toISOString()).toBe('2026-01-15T04:00:00.000Z')
  })
  test('daylight time', () => {
    expect(zonedWallTimeToDate('2026-07-14', '20:00', 'America/Los_Angeles').toISOString()).toBe('2026-07-15T03:00:00.000Z')
  })
  test('half-hour zone', () => {
    expect(zonedWallTimeToDate('2026-01-14', '20:00', 'Asia/Kolkata').toISOString()).toBe('2026-01-14T14:30:00.000Z')
  })
  test('bad input is an invalid date', () => {
    expect(isNaN(zonedWallTimeToDate('', '20:00', 'UTC').getTime())).toBe(true)
  })
})
