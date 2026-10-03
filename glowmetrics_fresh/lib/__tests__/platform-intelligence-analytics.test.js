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
    test('falls back to engine data when no canonical timing passed at all', () => {
      const analytics = {
        totalStreamMinutes: 100,
        meaningfulSessionCount: 10,
        bestHour: { hour: '12', avg: 50 },
        bestDay: { day: 'Tuesday', avg: 50 },
        platformBestTimes: {
          Chaturbate: { hour: 14, day: 'Friday' },
        },
      }

      // No canonical timing passed (completely null)
      const result = buildTimeIntelligence(analytics, null)

      expect(result.bestHour).toBeDefined()
      expect(result.bestHour.hour).toBe(12)
      expect(result.bestHour.label).toBe('12 PM')
      expect(result.bestDay).toBeDefined()
      expect(result.bestDay.day).toBe('Tuesday')
      // Fallback should use meaningfulSessionCount for confidence
      expect(result.confidence).toBeDefined()
    })

    test('falls back when canonical.global.bestWindow is null', () => {
      const analytics = {
        totalStreamMinutes: 100,
        meaningfulSessionCount: 5,
        bestHour: { hour: '9', avg: 40 },
        bestDay: { day: 'Wednesday', avg: 40 },
        platformBestTimes: {},
      }

      const canonicalTiming = {
        global: {
          bestWindow: null,  // ← Explicitly null, should trigger fallback
          earlySignal: { localHour: 10, localDay: 'Monday' },
        },
        byPlatform: {},
      }

      const result = buildTimeIntelligence(analytics, canonicalTiming)

      // Should use fallback because bestWindow is null
      expect(result.bestHour).not.toBeNull()
      expect(result.bestHour.hour).toBe(9)
    })

    test('prefers canonical data over fallback when both available', () => {
      const analytics = {
        totalStreamMinutes: 100,
        meaningfulSessionCount: 10,
        bestHour: { hour: '5', avg: 30 },      // ← Fallback (should NOT be used)
        bestDay: { day: 'Sunday', avg: 30 },   // ← Fallback (should NOT be used)
      }

      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 20,                      // ← Canonical (should be used)
            localDay: 'Saturday',               // ← Canonical (should be used)
            medianUsdPerHour: 200,              // ← Canonical (should be used)
            sessionCount: 10,
            tier: 'high',
            distinctDates: 10,
            qualified: true,
          },
        },
        byPlatform: {},
      }

      const result = buildTimeIntelligence(analytics, canonicalTiming)

      // Should use CANONICAL, NOT fallback
      expect(result.bestHour.hour).toBe(20)  // From canonical, not 5
      expect(result.bestDay.day).toBe('Saturday')  // From canonical, not Sunday
      expect(result.bestHour.avg).toBe(200)  // From canonical, not 30
      // This proves the canonical path runs BEFORE fallback check
    })

    test('FALLBACK TEST: both paths never run simultaneously', () => {
      // This test proves: when canonical path executes, fallback is skipped entirely
      // If both ran, we'd have a bug where old calculation overwrites new one
      const analytics = {
        totalStreamMinutes: 480,
        meaningfulSessionCount: 16,
        bestHour: { hour: '3', avg: 25 },    // Different from canonical
        bestDay: { day: 'Monday', avg: 25 },  // Different from canonical
        platformBestTimes: { Stripchat: { hour: 5, day: 'Tuesday' } },  // Different
      }

      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 18,
            localDay: 'Friday',
            medianUsdPerHour: 180,
            sessionCount: 8,
            tier: 'high',
            distinctDates: 8,
            qualified: true,
          },
        },
        byPlatform: {},
      }

      const result = buildTimeIntelligence(analytics, canonicalTiming)

      // If fallback accidentally ran, result would show engine values (3, Monday, 25)
      // If ONLY canonical runs (correct), result shows canonical values (18, Friday, 180)
      expect(result.bestHour.hour).toBe(18)
      expect(result.bestDay.day).toBe('Friday')
      expect(result.bestHour.avg).toBe(180)
      // platformBestTimes should be empty {} not { Stripchat: ... }
      expect(Object.keys(result.platformBestTimes).length).toBe(0)
    })
  })

  describe('REGRESSION: protection against property-name bugs', () => {
    test('REGRESSION: must read localHour not hour from bestWindow', () => {
      // This test protects against: const bestHour = bw.hour !== null
      // The bug that was caught in PR #634: reading bw.hour instead of bw.localHour
      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 14,      // ← Correct property
            localDay: 'Friday',
            medianUsdPerHour: 150,
            sessionCount: 5,
            tier: 'high',
            distinctDates: 7,
            qualified: true,
            // NOTE: no 'hour' property - this is the regression case
          },
        },
        byPlatform: {},
      }

      const result = buildTimeIntelligence({ totalStreamMinutes: 100 }, canonicalTiming)

      // If code tried to read bw.hour, this would be null/undefined
      expect(result.bestHour).not.toBeNull()
      expect(result.bestHour.hour).toBe(14)
      expect(result.bestHour.label).toBe('2 PM')
    })

    test('REGRESSION: must read localDay not day from bestWindow', () => {
      // This test protects against: const bestDay = bw.day ? ...
      // The bug: reading bw.day instead of bw.localDay
      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 10,
            localDay: 'Wednesday',  // ← Correct property
            medianUsdPerHour: 100,
            sessionCount: 3,
            tier: 'high',
            distinctDates: 5,
            qualified: true,
            // NOTE: no 'day' property - this is the regression case
          },
        },
        byPlatform: {},
      }

      const result = buildTimeIntelligence({ totalStreamMinutes: 100 }, canonicalTiming)

      // If code tried to read bw.day, this would be null/undefined
      expect(result.bestDay).not.toBeNull()
      expect(result.bestDay.day).toBe('Wednesday')
    })

    test('REGRESSION: must read medianUsdPerHour not earnings from bestWindow', () => {
      // This test protects against: avg: bw.earnings
      // The bug: reading bw.earnings instead of bw.medianUsdPerHour
      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 18,
            localDay: 'Thursday',
            medianUsdPerHour: 175.75,  // ← Correct property
            sessionCount: 4,
            tier: 'high',
            distinctDates: 6,
            qualified: true,
            // NOTE: no 'earnings' property - this is the regression case
          },
        },
        byPlatform: {},
      }

      const result = buildTimeIntelligence({ totalStreamMinutes: 100 }, canonicalTiming)

      // If code tried to read bw.earnings, this would be undefined
      expect(result.bestHour.avg).toBe(175.75)
      expect(result.bestDay.avg).toBe(175.75)
    })

    test('REGRESSION: per-platform must read bestHour not bestWindow', () => {
      // This test protects against: if (data.bestWindow)
      // The bug: reading data.bestWindow instead of data.bestHour for per-platform
      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 12,
            localDay: 'Monday',
            medianUsdPerHour: 100,
            sessionCount: 3,
            tier: 'high',
            distinctDates: 5,
            qualified: true,
          },
          earlySignal: null,
        },
        byPlatform: {
          Chaturbate: {
            bestHour: {  // ← Correct property (not bestWindow)
              hour: 20,
              avgPerTip: 50.00,
              qualified: true,
            },
            dayData: [],
            // NOTE: no 'bestWindow' property for platform - regression case
          },
        },
      }

      const result = buildTimeIntelligence({ totalStreamMinutes: 100 }, canonicalTiming)

      // If code tried to read data.bestWindow, platform wouldn't be in result
      expect(result.platformBestTimes.Chaturbate).toBeDefined()
      expect(result.platformBestTimes.Chaturbate.hour.hour).toBe(20)
      expect(result.platformBestTimes.Chaturbate.hour.label).toBe('8 PM')
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
