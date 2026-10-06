import {
  buildPlatformPulse,
  buildPlatformPulseInsights,
  filterTipsByLocalDateRange,
  localDateKey,
} from '../platformPulseAnalytics'

const tip = ({ at, platform = 'Chaturbate', username = 'fan', usd = 5, tokens = 100 }) => ({
  date_time: at,
  dateRaw: at,
  platform,
  username,
  usd,
  tokens,
  tip_type: 'Tip',
})

describe('Platform Pulse analytics', () => {
  test('uses creator-local date boundaries rather than UTC calendar dates', () => {
    const tz = 'America/Los_Angeles'
    const rows = [
      tip({ at: '2026-10-06T06:30:00.000Z', username: 'late-night' }), // Oct 5, 11:30 PM PT
      tip({ at: '2026-10-06T07:30:00.000Z', username: 'after-midnight' }), // Oct 6, 12:30 AM PT
    ]

    expect(localDateKey(rows[0].date_time, tz)).toBe('2026-10-05')
    expect(localDateKey(rows[1].date_time, tz)).toBe('2026-10-06')

    const today = filterTipsByLocalDateRange(rows, {
      startDate: '2026-10-06',
      endDate: '2026-10-06',
      tz,
    })
    expect(today).toHaveLength(1)
    expect(today[0].username).toBe('after-midnight')
  })

  test('ranks today by actual tracked earnings and counts platform-scoped supporters', () => {
    const now = new Date('2026-10-06T20:00:00.000Z')
    const rows = [
      tip({ at: '2026-10-06T16:00:00.000Z', platform: 'Chaturbate', username: 'sameName', usd: 20, tokens: 400 }),
      tip({ at: '2026-10-06T17:00:00.000Z', platform: 'Chaturbate', username: 'other', usd: 10, tokens: 200 }),
      tip({ at: '2026-10-06T18:00:00.000Z', platform: 'MyFreeCams', username: 'sameName', usd: 50, tokens: 1000 }),
    ]

    const pulse = buildPlatformPulse(rows, 'UTC', now)
    expect(pulse.winner.platform).toBe('MyFreeCams')
    expect(pulse.winner.earnings).toBe(50)
    expect(pulse.platforms[1].platform).toBe('Chaturbate')
    expect(pulse.platforms[1].supporters).toBe(2)
  })

  test('reuses canonical engine for estimated hourly rate and excludes today from baseline', () => {
    const now = new Date('2026-10-06T20:00:00.000Z')
    const rows = [
      // Today: one valid 40-minute Chaturbate session, $40 total => ~$60/hr.
      tip({ at: '2026-10-06T15:00:00.000Z', platform: 'Chaturbate', username: 'a', usd: 20, tokens: 400 }),
      tip({ at: '2026-10-06T15:40:00.000Z', platform: 'Chaturbate', username: 'b', usd: 20, tokens: 400 }),

      // Baseline day 1: one valid 40-minute session, $20 total => ~$30/hr.
      tip({ at: '2026-10-05T15:00:00.000Z', platform: 'Chaturbate', username: 'a', usd: 10, tokens: 200 }),
      tip({ at: '2026-10-05T15:40:00.000Z', platform: 'Chaturbate', username: 'b', usd: 10, tokens: 200 }),

      // Baseline day 2: low-signal revenue still counts toward active-day earnings,
      // but must not invent an hourly-rate denominator.
      tip({ at: '2026-10-04T15:00:00.000Z', platform: 'Chaturbate', username: 'c', usd: 10, tokens: 200 }),
    ]

    const pulse = buildPlatformPulse(rows, 'UTC', now)
    const cb = pulse.platforms.find(p => p.platform === 'Chaturbate')

    expect(cb.earnings).toBe(40)
    expect(cb.usdPerHour).toBeCloseTo(60, 1)
    expect(cb.baselineActiveDays).toBe(2)
    expect(cb.baselineDailyEarnings).toBe(15)
    expect(cb.vsBaselineDailyEarningsPct).toBe(167)
    expect(cb.baselineUsdPerHour).toBeCloseTo(30, 1)
    expect(cb.vsBaselineUsdPerHourPct).toBe(100)
  })

  test('does not fabricate percentage comparisons when denominator data is missing', () => {
    const now = new Date('2026-10-06T20:00:00.000Z')
    const rows = [
      tip({ at: '2026-10-06T15:00:00.000Z', platform: 'BongaCams', username: 'a', usd: 2.5, tokens: 100 }),
    ]

    const pulse = buildPlatformPulse(rows, 'UTC', now)
    const row = pulse.platforms[0]

    expect(row.vsYesterdayEarningsPct).toBeNull()
    expect(row.vsBaselineDailyEarningsPct).toBeNull()
    expect(row.vsBaselineUsdPerHourPct).toBeNull()
  })

  test('insight copy only uses measured changes and stays empty without activity', () => {
    expect(buildPlatformPulseInsights(buildPlatformPulse([], 'UTC', new Date('2026-10-06T20:00:00Z')))).toEqual([])

    const pulse = {
      platforms: [
        { platform: 'Chaturbate', earnings: 60, vsBaselineUsdPerHourPct: 25, vsBaselineDailyEarningsPct: 10, vsYesterdayEarningsPct: 50 },
        { platform: 'MyFreeCams', earnings: 20, vsBaselineUsdPerHourPct: null, vsBaselineDailyEarningsPct: null, vsYesterdayEarningsPct: null },
      ],
    }
    const insights = buildPlatformPulseInsights(pulse)
    expect(insights[0]).toContain('Chaturbate is #1 today')
    expect(insights.join(' ')).toContain('25% above')
  })
})
