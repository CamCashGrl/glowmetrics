/**
 * @jest-environment node
 */
// Display helpers only. The database decides entitlement; these format and tick
// its numbers, taking every threshold from the database response.
import { clock, levelFor, tickCurrent, describeAllowance, formatReset, minutesLeftLabel } from '../allowanceView'

const limits = { starts_per_week: 2, stream_seconds: 2100, warn_seconds: 1500, strong_warn_seconds: 1800 }
const live = (over = {}) => ({
  unlimited: false, limits, timezone: { value: 'America/New_York', required: false, source: 'profile' },
  week: { start: '2026-03-09T04:00:00Z', end: '2026-03-16T04:00:00Z', starts_used: 1, starts_remaining: 1 },
  can_start: true, lock_reason: null, latest_cap_ended: null,
  current: { session_id: 's', status: 'live', counted: true, paused: false, active_seconds: 600, remaining_seconds: 1500, warning_level: 'none', cap_at: null },
  ...over,
})

describe('clock / labels', () => {
  test('formats m:ss and never goes negative', () => {
    expect(clock(0)).toBe('0:00'); expect(clock(65)).toBe('1:05'); expect(clock(2100)).toBe('35:00'); expect(clock(-5)).toBe('0:00'); expect(clock(null)).toBe('0:00')
  })
  test('minutes left rounds up', () => {
    expect(minutesLeftLabel(1)).toBe('1 minute'); expect(minutesLeftLabel(61)).toBe('2 minutes'); expect(minutesLeftLabel(300)).toBe('5 minutes')
  })
})

describe('levelFor uses the thresholds the DATABASE sent (25 / 30 / 35 minutes)', () => {
  test.each([[0, 'none'], [1499, 'none'], [1500, 'warn25'], [1799, 'warn25'], [1800, 'warn30'], [2099, 'warn30'], [2100, 'limit'], [9999, 'limit']])('%i s -> %s', (s, lvl) => {
    expect(levelFor(s, limits)).toBe(lvl)
  })
  test('with no limits from the server there is no level (nothing hardcoded)', () => {
    expect(levelFor(5000, null)).toBe('none')
    expect(levelFor(1500, { ...limits, warn_seconds: 99999 })).toBe('none')
  })
})

describe('tickCurrent', () => {
  test('ticks forward from the moment the database produced the numbers', () => {
    const t = tickCurrent(live(), 1_000_000, 1_000_000 + 90_000)
    expect(t.activeSeconds).toBe(690); expect(t.remainingSeconds).toBe(1410); expect(t.running).toBe(true); expect(t.level).toBe('none')
  })
  test('crosses the warnings and the limit without any client constants', () => {
    const base = live({ current: { ...live().current, active_seconds: 1490 } })
    expect(tickCurrent(base, 0, 9_000).level).toBe('none')
    expect(tickCurrent(base, 0, 10_000).level).toBe('warn25')
    expect(tickCurrent(base, 0, 310_000).level).toBe('warn30')
    expect(tickCurrent(base, 0, 610_000).level).toBe('limit')
    expect(tickCurrent(base, 0, 610_000).remainingSeconds).toBe(0)
  })
  test('34 minutes used leaves 60 seconds', () => {
    const t = tickCurrent(live({ current: { ...live().current, active_seconds: 2040 } }), 0, 0)
    expect(t.remainingSeconds).toBe(60); expect(t.level).toBe('warn30')
  })
  test('a paused stream does not tick (pauses do not use allowance)', () => {
    const t = tickCurrent(live({ current: { ...live().current, paused: true, active_seconds: 1800 } }), 0, 600_000)
    expect(t.activeSeconds).toBe(1800); expect(t.running).toBe(false)
  })
  test('an uncounted (still connecting) session has nothing to show', () => {
    expect(tickCurrent(live({ current: { ...live().current, counted: false } }), 0, 5000)).toBeNull()
  })
  test('no limits or no current -> null', () => {
    expect(tickCurrent(live({ limits: null }), 0, 0)).toBeNull(); expect(tickCurrent(live({ current: null }), 0, 0)).toBeNull(); expect(tickCurrent(null, 0, 0)).toBeNull()
  })
})

describe('describeAllowance', () => {
  test('loading / unlimited / timezone', () => {
    expect(describeAllowance(null).kind).toBe('loading')
    expect(describeAllowance({ unlimited: true }).kind).toBe('unlimited')
    expect(describeAllowance({ unlimited: false, timezone: { required: true, source: 'missing' } })).toEqual({ kind: 'timezone_required', source: 'missing' })
  })
  test('live / connecting / ready / weekly_locked', () => {
    expect(describeAllowance(live()).kind).toBe('live')
    expect(describeAllowance(live({ current: { ...live().current, counted: false } })).kind).toBe('connecting')
    expect(describeAllowance(live({ current: null })).kind).toBe('ready')
    expect(describeAllowance(live({ current: null, can_start: false, lock_reason: 'FREE_LIVE_WEEKLY_LIMIT', week: { ...live().week, starts_used: 2, starts_remaining: 0 } })).kind).toBe('weekly_locked')
  })
  test('shows the cap-ended notice the database reports', () => {
    const d = describeAllowance(live({ current: null, latest_cap_ended: { session_id: 'x', ended_at: '2026-03-10T00:00:00Z' } }))
    expect(d.capEnded).toEqual({ session_id: 'x', ended_at: '2026-03-10T00:00:00Z' })
  })
})

describe('formatReset', () => {
  test('formats in the allowance timezone, not the device or UTC', () => {
    expect(formatReset('2026-03-16T04:00:00Z', 'America/New_York')).toMatch(/Mon.*12:00 AM/)
    expect(formatReset('2026-03-16T04:00:00Z', 'Pacific/Auckland')).toMatch(/Mon.*5:00 PM/)
  })
  test('missing or invalid input degrades to null', () => {
    expect(formatReset(null, 'UTC')).toBeNull(); expect(formatReset('2026-03-16T04:00:00Z', 'Nope/Zone')).toBeNull()
  })
})
