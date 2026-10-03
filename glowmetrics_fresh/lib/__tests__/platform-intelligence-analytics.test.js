/**
 * Tests for buildTimeIntelligence() function with canonical data input
 */

import { buildTimeIntelligence } from '../platformIntelligenceAnalytics.js'

describe('buildTimeIntelligence with canonical data', () => {
  describe('canonical bestWindow consumption', () => {
    test('extracts localHour and localDay correctly', () => {
      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 10,
            localDay: 'Monday',
            topPlatform: 'Chaturbate',
            medianUsdPerHour: 120.50,
            sessionCount: 5,
            tier: 'high',
            distinctDates: 7,
            qualified: true,
          },
        },
        byPlatform: {},
      }

      const result = buildTimeIntelligence({ totalStreamMinutes: 100 }, canonicalTiming)

      expect(result.bestHour).toBeDefined()
      expect(result.bestHour.hour).toBe(10)
      expect(result.bestHour.avg).toBe(120.50)
      expect(result.bestHour.label).toBe('10 AM')

      expect(result.bestDay).toBeDefined()
      expect(result.bestDay.day).toBe('Monday')
      expect(result.bestDay.avg).toBe(120.50)
    })

    test('maps confidence tier correctly', () => {
      const scenarios = [
        { tier: 'high', expectedLevel: 'High' },
        { tier: 'supported', expectedLevel: 'Medium' },
        { tier: 'promising', expectedLevel: 'Medium' },
      ]

      scenarios.forEach(({ tier, expectedLevel }) => {
        const canonicalTiming = {
          global: {
            bestWindow: {
              localHour: 10,
              localDay: 'Monday',
              medianUsdPerHour: 100,
              sessionCount: 5,
              tier,
              distinctDates: 5,
              qualified: true,
            },
          },
          byPlatform: {},
        }

        const result = buildTimeIntelligence({ totalStreamMinutes: 100 }, canonicalTiming)
        expect(result.confidence.level).toBe(expectedLevel)
      })
    })

    test('returns null bestWindow and earlySignal when no canonical data', () => {
      const result = buildTimeIntelligence({ totalStreamMinutes: 100 }, null)

      expect(result.bestHour).toBeNull()
      expect(result.bestDay).toBeNull()
    })

    test('sets hasPattern true when bestWindow exists', () => {
      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 10,
            localDay: 'Monday',
            medianUsdPerHour: 100,
            sessionCount: 5,
            tier: 'high',
            distinctDates: 5,
            qualified: true,
          },
        },
        byPlatform: {},
      }

      const result = buildTimeIntelligence({ totalStreamMinutes: 100 }, canonicalTiming)
      expect(result.hasPattern).toBe(true)
    })
  })

  describe('per-platform extraction', () => {
    test('extracts platform best hours correctly', () => {
      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 10,
            localDay: 'Monday',
            medianUsdPerHour: 100,
            sessionCount: 5,
            tier: 'high',
            distinctDates: 5,
            qualified: true,
          },
        },
        byPlatform: {
          Chaturbate: {
            bestHour: {
              hour: 14,
              distinctDates: 4,
              revenue: 500,
              tips: 5,
              avgPerTip: 100,
              qualified: true,
              confidence: 'medium',
            },
            dayData: [
              {
                day: 'Friday',
                distinctDates: 3,
                revenue: 300,
                tips: 3,
                avgPerTip: 100,
                qualified: true,
                confidence: 'medium',
              },
            ],
          },
          Stripchat: {
            bestHour: {
              hour: 22,
              distinctDates: 3,
              revenue: 400,
              tips: 4,
              avgPerTip: 100,
              qualified: true,
              confidence: 'medium',
            },
            dayData: [],
          },
        },
      }

      const result = buildTimeIntelligence({ totalStreamMinutes: 100 }, canonicalTiming)

      expect(result.platformBestTimes.Chaturbate).toBeDefined()
      expect(result.platformBestTimes.Chaturbate.hour).toBeDefined()
      expect(result.platformBestTimes.Chaturbate.hour.hour).toBe(14)
      expect(result.platformBestTimes.Chaturbate.hour.avg).toBe(100)
      expect(result.platformBestTimes.Chaturbate.hour.label).toBe('2 PM')

      expect(result.platformBestTimes.Stripchat).toBeDefined()
      expect(result.platformBestTimes.Stripchat.hour.hour).toBe(22)
      expect(result.platformBestTimes.Stripchat.hour.label).toBe('10 PM')
    })

    test('extracts platform best days when available', () => {
      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 10,
            localDay: 'Monday',
            medianUsdPerHour: 100,
            sessionCount: 5,
            tier: 'high',
            distinctDates: 5,
            qualified: true,
          },
        },
        byPlatform: {
          Chaturbate: {
            bestHour: {
              hour: 14,
              avgPerTip: 100,
              qualified: true,
            },
            dayData: [
              {
                day: 'Wednesday',
                avgPerTip: 110,
                qualified: true,
              },
              {
                day: 'Friday',
                avgPerTip: 95,
                qualified: true,
              },
            ],
          },
        },
      }

      const result = buildTimeIntelligence({ totalStreamMinutes: 100 }, canonicalTiming)

      expect(result.platformBestTimes.Chaturbate.bestDay).toBeDefined()
      expect(result.platformBestTimes.Chaturbate.bestDay.day).toBe('Wednesday')
      expect(result.platformBestTimes.Chaturbate.bestDay.avg).toBe(110)
    })

    test('handles empty dayData array', () => {
      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 10,
            localDay: 'Monday',
            medianUsdPerHour: 100,
            sessionCount: 5,
            tier: 'high',
            distinctDates: 5,
            qualified: true,
          },
        },
        byPlatform: {
          Chaturbate: {
            bestHour: {
              hour: 14,
              avgPerTip: 100,
              qualified: true,
            },
            dayData: [],
          },
        },
      }

      const result = buildTimeIntelligence({ totalStreamMinutes: 100 }, canonicalTiming)

      expect(result.platformBestTimes.Chaturbate.hour).toBeDefined()
      expect(result.platformBestTimes.Chaturbate.bestDay).toBeNull()
    })
  })

  describe('fallback to engine data', () => {
    test('falls back to engine data when no canonical bestWindow', () => {
      const analytics = {
        totalStreamMinutes: 100,
        meaningfulSessionCount: 10,
        bestHour: { hour: '12', avg: 50 },
        bestDay: { day: 'Tuesday', avg: 50 },
        platformBestTimes: {
          Chaturbate: { hour: 14, day: 'Friday' },
        },
      }

      // No canonical timing passed
      const result = buildTimeIntelligence(analytics, null)

      expect(result.bestHour).toBeDefined()
      expect(result.bestHour.hour).toBe(12)
      expect(result.bestDay).toBeDefined()
      expect(result.bestDay.day).toBe('Tuesday')
    })

    test('prefers canonical data over fallback', () => {
      const analytics = {
        totalStreamMinutes: 100,
        meaningfulSessionCount: 10,
        bestHour: { hour: '5', avg: 30 },
        bestDay: { day: 'Sunday', avg: 30 },
      }

      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 20,
            localDay: 'Saturday',
            medianUsdPerHour: 200,
            sessionCount: 10,
            tier: 'high',
            distinctDates: 10,
            qualified: true,
          },
        },
        byPlatform: {},
      }

      const result = buildTimeIntelligence(analytics, canonicalTiming)

      // Should use canonical, not fallback
      expect(result.bestHour.hour).toBe(20)
      expect(result.bestDay.day).toBe('Saturday')
      expect(result.bestHour.avg).toBe(200)
    })
  })

  describe('edge cases', () => {
    test('handles null bestWindow gracefully', () => {
      const canonicalTiming = {
        global: {
          bestWindow: null,
          earlySignal: {
            localHour: 15,
            localDay: 'Thursday',
            sessionCount: 2,
            distinctDates: 1,
          },
        },
        byPlatform: {},
      }

      const result = buildTimeIntelligence({ totalStreamMinutes: 50 }, canonicalTiming)

      // Should fall back to engine data since bestWindow is null
      expect(result.bestHour).toBeNull()
      expect(result.hasPattern).toBe(false)
    })

    test('handles missing byPlatform gracefully', () => {
      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 10,
            localDay: 'Monday',
            medianUsdPerHour: 100,
            sessionCount: 5,
            tier: 'high',
            distinctDates: 5,
            qualified: true,
          },
        },
        // byPlatform missing or undefined
      }

      const result = buildTimeIntelligence({ totalStreamMinutes: 100 }, canonicalTiming)

      expect(result.platformBestTimes).toBeDefined()
      expect(Object.keys(result.platformBestTimes).length).toBe(0)
    })

    test('handles null analytics gracefully', () => {
      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 10,
            localDay: 'Monday',
            medianUsdPerHour: 100,
            sessionCount: 5,
            tier: 'high',
            distinctDates: 5,
            qualified: true,
          },
        },
        byPlatform: {},
      }

      const result = buildTimeIntelligence(null, canonicalTiming)

      expect(result).toBeNull()
    })
  })
})
