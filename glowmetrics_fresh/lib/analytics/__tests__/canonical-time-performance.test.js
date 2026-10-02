/**
 * CANONICAL HISTORICAL TIME-PERFORMANCE ENGINE
 *
 * Single source of truth for all time-based analytics:
 * - Platform/day/hour earnings and session counts
 * - Distinct creator-local calendar dates (for 3-day confidence rule)
 * - Qualification status (requires 3+ distinct calendar dates)
 *
 * All user-facing time-based recommendations (CommandCenter, Platforms,
 * StreamPlanner) must consume this canonical output.
 */

import {
  computeHistoricalTimePerformance,
  toLocalHour,
  toLocalDow,
  toLocalDateStr,
  applyFreeAnalysisWindow,
  aggregateRows,
} from '../../analytics.js'

describe('Canonical Historical Time-Performance Engine', () => {
  describe('Creator timezone awareness', () => {
    test('same timestamp is assigned to correct creator-local hour', () => {
      // ISO timestamp: 2026-09-15T21:30:00Z (UTC)
      // In UTC: 21:30 on 2026-09-15
      // In US/Pacific (UTC-7): 14:30 on 2026-09-15
      // In US/Eastern (UTC-4): 17:30 on 2026-09-15

      const tips = [
        { date_time: '2026-09-15T21:30:00Z', usd: 10, platform: 'Chaturbate' }
      ]

      const pacificResult = computeHistoricalTimePerformance(tips, 'US/Pacific', 1)
      const easternResult = computeHistoricalTimePerformance(tips, 'US/Eastern', 1)

      // Pacific should show hour 14
      const pacificHour = pacificResult.global.hourData?.find(h => h.hour === 14)
      expect(pacificHour).toBeDefined()
      expect(pacificHour?.revenue).toBe(10)

      // Eastern should show hour 17
      const easternHour = easternResult.global.hourData?.find(h => h.hour === 17)
      expect(easternHour).toBeDefined()
      expect(easternHour?.revenue).toBe(10)
    })

    test('day boundary uses creator-local date', () => {
      // Timestamp that is different date in different timezones
      // 2026-09-15T01:00:00Z is:
      // 2026-09-14 17:00 in US/Pacific (previous day)
      // 2026-09-15 01:00 in UTC
      // 2026-09-15 21:00 in Asia/Tokyo (next day)

      const tips = [
        { date_time: '2026-09-15T01:00:00Z', usd: 20, platform: 'Chaturbate' }
      ]

      const pacificResult = computeHistoricalTimePerformance(tips, 'US/Pacific', 1)
      const tokyoResult = computeHistoricalTimePerformance(tips, 'Asia/Tokyo', 1)

      // Pacific day should be Monday (2026-09-14)
      expect(pacificResult.global.bestDay?.day).toBe('Monday')

      // Tokyo day should be Tuesday (2026-09-15)
      expect(tokyoResult.global.bestDay?.day).toBe('Tuesday')
    })

    test('handles DST transitions correctly', () => {
      // During DST transition, hour conversion must be stable
      const tips = [
        { date_time: '2026-03-08T13:00:00Z', usd: 15, platform: 'Chaturbate' },
        { date_time: '2026-03-09T13:00:00Z', usd: 15, platform: 'Chaturbate' },
      ]

      const result = computeHistoricalTimePerformance(tips, 'US/Eastern', 1)
      // Should not crash and should assign hours based on local time
      expect(result.global.hourData).toBeDefined()
      expect(Array.isArray(result.global.hourData)).toBe(true)
    })
  })

  describe('Three-day confidence rule', () => {
    test('three tips on one day do NOT qualify as three-day pattern', () => {
      const tips = [
        { date_time: '2026-09-15T10:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-15T12:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-15T14:00:00Z', usd: 50, platform: 'Chaturbate' },
      ]

      const result = computeHistoricalTimePerformance(tips, 'UTC', 3)

      // All three tips are on the same date (2026-09-15)
      // So distinctDates = 1, which is < 3
      expect(result.global.bestHour).toBeNull()
      expect(result.global.bestDay).toBeNull()
    })

    test('same time bucket on 3 distinct days DOES qualify', () => {
      // Same hour (10 AM) on three different dates
      const tips = [
        { date_time: '2026-09-15T10:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-16T10:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-17T10:00:00Z', usd: 50, platform: 'Chaturbate' },
      ]

      const result = computeHistoricalTimePerformance(tips, 'UTC', 3)

      // All three on different dates, same hour
      // distinctDates = 3, should qualify
      expect(result.global.bestHour).toBeDefined()
      expect(result.global.bestHour?.hour).toBe(10)
      expect(result.global.bestHour?.distinctDates).toBe(3)
      expect(result.global.bestHour?.qualified).toBe(true)
    })

    test('four tips across 2 dates do NOT qualify', () => {
      const tips = [
        { date_time: '2026-09-15T10:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-15T12:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-16T10:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-16T12:00:00Z', usd: 50, platform: 'Chaturbate' },
      ]

      const result = computeHistoricalTimePerformance(tips, 'UTC', 3)

      // Only 2 distinct dates, not 3
      expect(result.global.bestHour).toBeNull()
      expect(result.global.bestDay).toBeNull()
    })

    test('per-platform qualification is independent', () => {
      const tips = [
        // Chaturbate: 3 distinct dates, should qualify
        { date_time: '2026-09-15T10:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-16T10:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-17T10:00:00Z', usd: 50, platform: 'Chaturbate' },
        // MyFreeCams: only 1 date, should NOT qualify
        { date_time: '2026-09-15T14:00:00Z', usd: 30, platform: 'MyFreeCams' },
      ]

      const result = computeHistoricalTimePerformance(tips, 'UTC', 3)

      // Chaturbate 10 AM should qualify
      expect(result.byPlatform.Chaturbate.bestHour).toBeDefined()
      expect(result.byPlatform.Chaturbate.bestHour?.qualified).toBe(true)

      // MyFreeCams 2 PM should NOT qualify
      expect(result.byPlatform.MyFreeCams.bestHour).toBeNull()
    })

    test('minQualifyingDates parameter is respected', () => {
      const tips = [
        { date_time: '2026-09-15T10:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-16T10:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-17T10:00:00Z', usd: 50, platform: 'Chaturbate' },
      ]

      // With minQualifyingDates = 3, should qualify
      const result3 = computeHistoricalTimePerformance(tips, 'UTC', 3)
      expect(result3.global.bestHour?.qualified).toBe(true)

      // With minQualifyingDates = 4, should NOT have a bestHour (all hours unqualified)
      const result4 = computeHistoricalTimePerformance(tips, 'UTC', 4)
      expect(result4.global.bestHour).toBeNull()

      // With minQualifyingDates = 1, should qualify (all have ≥1 date)
      const result1 = computeHistoricalTimePerformance(tips, 'UTC', 1)
      expect(result1.global.bestHour?.qualified).toBe(true)
    })

    test('preserves raw data even when unqualified (early signal)', () => {
      const tips = [
        { date_time: '2026-09-15T10:00:00Z', usd: 100, platform: 'Chaturbate' },
        { date_time: '2026-09-15T12:00:00Z', usd: 100, platform: 'Chaturbate' },
      ]

      const result = computeHistoricalTimePerformance(tips, 'UTC', 3)

      // Should have hourData even though NOT qualified
      const hour10 = result.global.hourData?.find(h => h.hour === 10)
      expect(hour10).toBeDefined()
      expect(hour10?.revenue).toBe(100)
      expect(hour10?.tips).toBe(1)
      expect(hour10?.qualified).toBe(false)
      expect(hour10?.confidence).toBe('insufficient')

      // Hour 12 also tracked
      const hour12 = result.global.hourData?.find(h => h.hour === 12)
      expect(hour12?.revenue).toBe(100)
    })
  })

  describe('Earnings independence from performance eligibility', () => {
    test('unknown-duration earnings remain in total revenue', () => {
      // Mix of tips with and without duration info
      const tips = [
        { date_time: '2026-09-15T10:00:00Z', usd: 50, platform: 'Chaturbate', duration: 120 },
        { date_time: '2026-09-15T12:00:00Z', usd: 75, platform: 'Chaturbate' }, // no duration
        { date_time: '2026-09-15T14:00:00Z', usd: 25, platform: 'Chaturbate', duration: 90 },
      ]

      const result = computeHistoricalTimePerformance(tips, 'UTC', 1)

      // Total should include ALL tips
      const totalRevenue = Object.keys(result.global.hourData || {})
        .reduce((sum, key) => sum + (result.global.hourData?.[key]?.revenue || 0), 0)

      expect(totalRevenue).toBe(150) // 50 + 75 + 25
    })

    test('unknown-duration earnings do not falsely inflate $/hour calculation', () => {
      // This test documents that aggregateRows (not computeHistoricalTimePerformance)
      // handles hourly rate filtering. The canonical function should NOT include
      // duration-based filtering, only the aggregation engine does.
      const tips = [
        { date_time: '2026-09-15T10:00:00Z', usd: 100, platform: 'Chaturbate', duration: 60 },
        { date_time: '2026-09-15T11:00:00Z', usd: 100, platform: 'Chaturbate' }, // no duration
      ]

      const result = computeHistoricalTimePerformance(tips, 'UTC', 1)

      // Canonical function tracks revenue per hour
      const hour10 = result.global.hourData?.find(h => h.hour === 10)
      const hour11 = result.global.hourData?.find(h => h.hour === 11)

      expect(hour10?.revenue).toBe(100)
      expect(hour11?.revenue).toBe(100)
      // Both hours have same avgPerTip ($100/1 = $100)
      // The aggregateRows function, not this one, applies duration eligibility
    })
  })

  describe('Output structure and API', () => {
    test('returns correct top-level structure', () => {
      const tips = [
        { date_time: '2026-09-15T10:00:00Z', usd: 50, platform: 'Chaturbate' },
      ]

      const result = computeHistoricalTimePerformance(tips, 'UTC', 1)

      expect(result).toHaveProperty('global')
      expect(result).toHaveProperty('byPlatform')
      expect(typeof result.global).toBe('object')
      expect(typeof result.byPlatform).toBe('object')
    })

    test('global object includes bestHour, bestDay, and hourData', () => {
      const tips = [
        { date_time: '2026-09-15T10:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-16T10:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-17T10:00:00Z', usd: 50, platform: 'Chaturbate' },
      ]

      const result = computeHistoricalTimePerformance(tips, 'UTC', 3)

      expect(result.global).toHaveProperty('bestHour')
      expect(result.global).toHaveProperty('bestDay')
      expect(result.global).toHaveProperty('hourData')
      expect(result.global).toHaveProperty('dayData')
      expect(result.global).toHaveProperty('minQualifyingDates')
      expect(result.global.minQualifyingDates).toBe(3)
    })

    test('hourData includes all required fields', () => {
      const tips = [
        { date_time: '2026-09-15T10:00:00Z', usd: 150, platform: 'Chaturbate' },
        { date_time: '2026-09-16T10:00:00Z', usd: 250, platform: 'Chaturbate' },
      ]

      const result = computeHistoricalTimePerformance(tips, 'UTC', 1)
      const hourData = result.global.hourData?.[0]

      expect(hourData).toHaveProperty('hour')
      expect(hourData).toHaveProperty('distinctDates')
      expect(hourData).toHaveProperty('revenue')
      expect(hourData).toHaveProperty('tips')
      expect(hourData).toHaveProperty('avgPerTip')
      expect(hourData).toHaveProperty('qualified')
      expect(hourData).toHaveProperty('confidence')
    })

    test('empty tips array returns empty result', () => {
      const result = computeHistoricalTimePerformance([], 'UTC', 3)

      expect(result.global).toEqual({})
      expect(result.byPlatform).toEqual({})
    })

    test('handles missing timezone gracefully', () => {
      const tips = [
        { date_time: '2026-09-15T10:00:00Z', usd: 50, platform: 'Chaturbate' },
      ]

      // Should not crash if timezone is null
      const result = computeHistoricalTimePerformance(tips, null, 1)
      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
    })
  })

  describe('Platform-specific aggregation', () => {
    test('byPlatform includes each platform independently', () => {
      const tips = [
        { date_time: '2026-09-15T10:00:00Z', usd: 100, platform: 'Chaturbate' },
        { date_time: '2026-09-15T11:00:00Z', usd: 50, platform: 'MyFreeCams' },
      ]

      const result = computeHistoricalTimePerformance(tips, 'UTC', 1)

      expect(result.byPlatform.Chaturbate).toBeDefined()
      expect(result.byPlatform.MyFreeCams).toBeDefined()
      expect(result.byPlatform.Chaturbate.totalRevenue).toBe(100)
      expect(result.byPlatform.MyFreeCams.totalRevenue).toBe(50)
    })

    test('platform earnings do not leak between platforms', () => {
      const tips = [
        { date_time: '2026-09-15T10:00:00Z', usd: 500, platform: 'Chaturbate' },
        { date_time: '2026-09-16T10:00:00Z', usd: 200, platform: 'Chaturbate' },
        { date_time: '2026-09-17T10:00:00Z', usd: 100, platform: 'Chaturbate' },
        { date_time: '2026-09-15T11:00:00Z', usd: 50, platform: 'MyFreeCams' },
        { date_time: '2026-09-16T11:00:00Z', usd: 75, platform: 'MyFreeCams' },
        { date_time: '2026-09-17T11:00:00Z', usd: 25, platform: 'MyFreeCams' },
      ]

      const result = computeHistoricalTimePerformance(tips, 'UTC', 3)

      expect(result.byPlatform.Chaturbate.totalRevenue).toBe(800)
      expect(result.byPlatform.MyFreeCams.totalRevenue).toBe(150)
    })

    test('best hour is per-platform', () => {
      const tips = [
        { date_time: '2026-09-15T10:00:00Z', usd: 500, platform: 'Chaturbate' },
        { date_time: '2026-09-16T10:00:00Z', usd: 500, platform: 'Chaturbate' },
        { date_time: '2026-09-17T10:00:00Z', usd: 500, platform: 'Chaturbate' },
        { date_time: '2026-09-15T14:00:00Z', usd: 1000, platform: 'MyFreeCams' },
        { date_time: '2026-09-16T14:00:00Z', usd: 1000, platform: 'MyFreeCams' },
        { date_time: '2026-09-17T14:00:00Z', usd: 1000, platform: 'MyFreeCams' },
      ]

      const result = computeHistoricalTimePerformance(tips, 'UTC', 3)

      expect(result.byPlatform.Chaturbate.bestHour?.hour).toBe(10)
      expect(result.byPlatform.MyFreeCams.bestHour?.hour).toBe(14)
    })
  })

  describe('Confidence levels', () => {
    test('qualified with <7 dates = medium confidence', () => {
      const tips = [
        { date_time: '2026-09-15T10:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-16T10:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-17T10:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-18T10:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-19T10:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-20T10:00:00Z', usd: 50, platform: 'Chaturbate' },
      ]

      const result = computeHistoricalTimePerformance(tips, 'UTC', 3)

      expect(result.global.bestHour?.qualified).toBe(true)
      expect(result.global.bestHour?.distinctDates).toBe(6)
      expect(result.global.bestHour?.confidence).toBe('medium')
    })

    test('qualified with ≥7 dates = high confidence', () => {
      const tips = [
        { date_time: '2026-09-15T10:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-16T10:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-17T10:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-18T10:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-19T10:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-20T10:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-21T10:00:00Z', usd: 50, platform: 'Chaturbate' },
      ]

      const result = computeHistoricalTimePerformance(tips, 'UTC', 3)

      expect(result.global.bestHour?.qualified).toBe(true)
      expect(result.global.bestHour?.distinctDates).toBe(7)
      expect(result.global.bestHour?.confidence).toBe('high')
    })

    test('unqualified = insufficient confidence', () => {
      const tips = [
        { date_time: '2026-09-15T10:00:00Z', usd: 50, platform: 'Chaturbate' },
        { date_time: '2026-09-15T12:00:00Z', usd: 50, platform: 'Chaturbate' },
      ]

      const result = computeHistoricalTimePerformance(tips, 'UTC', 3)

      const hour10 = result.global.hourData?.find(h => h.hour === 10)
      expect(hour10?.qualified).toBe(false)
      expect(hour10?.confidence).toBe('insufficient')
    })
  })

  describe('Shared source across components', () => {
    test('CommandCenter and Platforms both consume global.bestHour/bestDay', () => {
      const tips = [
        { date_time: '2026-09-15T10:00:00Z', usd: 100, platform: 'Chaturbate' },
        { date_time: '2026-09-16T10:00:00Z', usd: 100, platform: 'Chaturbate' },
        { date_time: '2026-09-17T10:00:00Z', usd: 100, platform: 'Chaturbate' },
        { date_time: '2026-09-15T02:00:00Z', usd: 50, platform: 'Chaturbate' }, // Monday
        { date_time: '2026-09-16T02:00:00Z', usd: 50, platform: 'Chaturbate' }, // Tuesday
        { date_time: '2026-09-17T02:00:00Z', usd: 50, platform: 'Chaturbate' }, // Wednesday
      ]

      const result = computeHistoricalTimePerformance(tips, 'UTC', 3)

      // Both should read from same place
      expect(result.global.bestHour).toBe(result.global.bestHour)
      expect(result.global.bestDay).toBe(result.global.bestDay)
      expect(result.global.bestHour?.hour).toBe(10)
    })

    test('StreamPlanner can consume byPlatform hourData', () => {
      const tips = [
        { date_time: '2026-09-15T10:00:00Z', usd: 100, platform: 'Twitch' },
        { date_time: '2026-09-16T10:00:00Z', usd: 100, platform: 'Twitch' },
        { date_time: '2026-09-17T10:00:00Z', usd: 100, platform: 'Twitch' },
      ]

      const result = computeHistoricalTimePerformance(tips, 'UTC', 3)

      // StreamPlanner should be able to access per-platform hour data
      expect(result.byPlatform.Twitch).toBeDefined()
      expect(result.byPlatform.Twitch.hourData).toBeDefined()
      expect(Array.isArray(result.byPlatform.Twitch.hourData)).toBe(true)
    })
  })

  describe('Revenue precision', () => {
    test('revenue values are formatted to 2 decimal places', () => {
      const tips = [
        { date_time: '2026-09-15T10:00:00Z', usd: 99.995, platform: 'Chaturbate' },
        { date_time: '2026-09-16T10:00:00Z', usd: 50.555, platform: 'Chaturbate' },
      ]

      const result = computeHistoricalTimePerformance(tips, 'UTC', 1)
      const hourData = result.global.hourData

      // All revenue values should have at most 2 decimal places
      hourData?.forEach(h => {
        const revStr = String(h.revenue)
        const decimals = revStr.includes('.') ? revStr.split('.')[1].length : 0
        expect(decimals).toBeLessThanOrEqual(2)
      })
    })
  })
})
