/**
 * PLATFORMS INTELLIGENCE INTEGRATION TESTS
 *
 * Verifies that PlatformsIntelligence component properly:
 * - Consumes canonical timing data from props
 * - Passes canonical data to buildTimeIntelligence()
 * - Displays time intelligence correctly in UI
 * - Handles fallback to engine data when canonical unavailable
 */

import { buildTimeIntelligence, buildBusinessSnapshot, buildPlatformComparison } from '../../../lib/platformIntelligenceAnalytics.js'

describe('PlatformsIntelligence Integration with Canonical Timing', () => {
  // ========== CANONICAL DATA CONSUMPTION ==========

  describe('component receives and uses canonical timing data', () => {
    test('passes canonical timing to buildTimeIntelligence correctly', () => {
      const analytics = {
        totalStreamMinutes: 480,
        meaningfulSessionCount: 8,
        bestHour: { hour: '5', avg: 30 },
        bestDay: { day: 'Sunday', avg: 30 },
        platforms: [
          { platform: 'Chaturbate', totalUSD: 800, hours: 8, sessions: 4 }
        ]
      }

      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 14,
            localDay: 'Friday',
            topPlatform: 'Chaturbate',
            medianUsdPerHour: 120.50,
            sessionCount: 5,
            tier: 'high',
            distinctDates: 7,
            qualified: true
          },
          earlySignal: null
        },
        byPlatform: {}
      }

      // Simulate what UnifiedView does: pass canonical timing to buildTimeIntelligence
      const timeIntel = buildTimeIntelligence(analytics, canonicalTiming)

      // Verify canonical data was used (not fallback)
      expect(timeIntel).not.toBeNull()
      expect(timeIntel.bestHour).not.toBeNull()
      expect(timeIntel.bestHour.hour).toBe(14)
      expect(timeIntel.bestHour.avg).toBe(120.50)
      expect(timeIntel.bestHour.label).toBe('2 PM')
      expect(timeIntel.bestDay.day).toBe('Friday')
    })

    test('displays correct timezone-aware hour in "When you earn best" section', () => {
      const analytics = {
        totalStreamMinutes: 300,
        meaningfulSessionCount: 5,
        platforms: []
      }

      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 10,
            localDay: 'Monday',
            medianUsdPerHour: 150.00,
            sessionCount: 3,
            tier: 'high',
            distinctDates: 5,
            qualified: true
          },
          earlySignal: null
        },
        byPlatform: {}
      }

      const timeIntel = buildTimeIntelligence(analytics, canonicalTiming)

      // Verify the exact display format
      expect(timeIntel.bestHour).toEqual({
        hour: 10,
        avg: 150.00,
        label: '10 AM'
      })
      expect(timeIntel.bestDay).toEqual({
        day: 'Monday',
        avg: 150.00
      })
    })

    test('maps confidence tier to display level correctly', () => {
      const analytics = { totalStreamMinutes: 100, meaningfulSessionCount: 5, platforms: [] }

      const scenarios = [
        {
          tier: 'high',
          expectedLevel: 'High',
          name: 'high tier'
        },
        {
          tier: 'supported',
          expectedLevel: 'Medium',
          name: 'supported tier'
        },
        {
          tier: 'promising',
          expectedLevel: 'Medium',
          name: 'promising tier'
        }
      ]

      scenarios.forEach(({ tier, expectedLevel, name }) => {
        const canonicalTiming = {
          global: {
            bestWindow: {
              localHour: 12,
              localDay: 'Wednesday',
              medianUsdPerHour: 100,
              sessionCount: 3,
              tier,
              distinctDates: 5,
              qualified: true
            },
            earlySignal: null
          },
          byPlatform: {}
        }

        const timeIntel = buildTimeIntelligence(analytics, canonicalTiming)
        expect(timeIntel.confidence.level).toBe(expectedLevel, `Failed for ${name}`)
      })
    })

    test('sets hasPattern flag correctly when canonical data exists', () => {
      const analytics = {
        totalStreamMinutes: 200,
        meaningfulSessionCount: 4,
        platforms: []
      }

      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 18,
            localDay: 'Thursday',
            medianUsdPerHour: 95.75,
            sessionCount: 2,
            tier: 'promising',
            distinctDates: 3,
            qualified: true
          },
          earlySignal: null
        },
        byPlatform: {}
      }

      const timeIntel = buildTimeIntelligence(analytics, canonicalTiming)
      expect(timeIntel.hasPattern).toBe(true)
    })
  })

  // ========== PER-PLATFORM DATA EXTRACTION ==========

  describe('per-platform best times from canonical data', () => {
    test('extracts platform-specific best hours correctly', () => {
      const analytics = {
        totalStreamMinutes: 400,
        meaningfulSessionCount: 8,
        platforms: [
          { platform: 'Chaturbate', totalUSD: 500, hours: 4 },
          { platform: 'Stripchat', totalUSD: 300, hours: 4 }
        ]
      }

      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 14,
            localDay: 'Friday',
            medianUsdPerHour: 100,
            sessionCount: 4,
            tier: 'high',
            distinctDates: 4,
            qualified: true
          },
          earlySignal: null
        },
        byPlatform: {
          Chaturbate: {
            bestHour: {
              hour: 20,
              avgPerTip: 50.00,
              qualified: true
            },
            dayData: []
          },
          Stripchat: {
            bestHour: {
              hour: 16,
              avgPerTip: 60.00,
              qualified: true
            },
            dayData: []
          }
        }
      }

      const timeIntel = buildTimeIntelligence(analytics, canonicalTiming)

      // Verify Chaturbate best hour
      expect(timeIntel.platformBestTimes.Chaturbate).toBeDefined()
      expect(timeIntel.platformBestTimes.Chaturbate.hour.hour).toBe(20)
      expect(timeIntel.platformBestTimes.Chaturbate.hour.avg).toBe(50.00)
      expect(timeIntel.platformBestTimes.Chaturbate.hour.label).toBe('8 PM')

      // Verify Stripchat best hour
      expect(timeIntel.platformBestTimes.Stripchat.hour.hour).toBe(16)
      expect(timeIntel.platformBestTimes.Stripchat.hour.label).toBe('4 PM')
    })

    test('extracts platform-specific best days from dayData array', () => {
      const analytics = {
        totalStreamMinutes: 300,
        meaningfulSessionCount: 6,
        platforms: [
          { platform: 'Chaturbate', totalUSD: 600, hours: 6 }
        ]
      }

      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 14,
            localDay: 'Monday',
            medianUsdPerHour: 100,
            sessionCount: 3,
            tier: 'high',
            distinctDates: 5,
            qualified: true
          },
          earlySignal: null
        },
        byPlatform: {
          Chaturbate: {
            bestHour: {
              hour: 18,
              avgPerTip: 75.00,
              qualified: true
            },
            dayData: [
              {
                day: 'Saturday',
                avgPerTip: 85.50,
                qualified: true
              },
              {
                day: 'Wednesday',
                avgPerTip: 70.00,
                qualified: true
              }
            ]
          }
        }
      }

      const timeIntel = buildTimeIntelligence(analytics, canonicalTiming)

      // Best day should be the first (highest avgPerTip) in dayData
      expect(timeIntel.platformBestTimes.Chaturbate.bestDay).toBeDefined()
      expect(timeIntel.platformBestTimes.Chaturbate.bestDay.day).toBe('Saturday')
      expect(timeIntel.platformBestTimes.Chaturbate.bestDay.avg).toBe(85.50)
    })

    test('handles empty dayData array for platform', () => {
      const analytics = {
        totalStreamMinutes: 200,
        meaningfulSessionCount: 4,
        platforms: [
          { platform: 'MyFreeCams', totalUSD: 400, hours: 4 }
        ]
      }

      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 12,
            localDay: 'Tuesday',
            medianUsdPerHour: 100,
            sessionCount: 2,
            tier: 'supported',
            distinctDates: 3,
            qualified: true
          },
          earlySignal: null
        },
        byPlatform: {
          MyFreeCams: {
            bestHour: {
              hour: 15,
              avgPerTip: 80.00,
              qualified: true
            },
            dayData: []
          }
        }
      }

      const timeIntel = buildTimeIntelligence(analytics, canonicalTiming)

      expect(timeIntel.platformBestTimes.MyFreeCams.hour).toBeDefined()
      expect(timeIntel.platformBestTimes.MyFreeCams.bestDay).toBeNull()
    })
  })

  // ========== FALLBACK BEHAVIOR ==========

  describe('fallback to engine data when canonical unavailable', () => {
    test('uses engine data when no canonical bestWindow', () => {
      const analytics = {
        totalStreamMinutes: 300,
        meaningfulSessionCount: 6,
        bestHour: { hour: '11', avg: 85.50 },
        bestDay: { day: 'Wednesday', avg: 85.50 },
        platformBestTimes: {},
        platforms: []
      }

      // No canonical timing passed
      const timeIntel = buildTimeIntelligence(analytics, null)

      expect(timeIntel.bestHour).not.toBeNull()
      expect(timeIntel.bestHour.hour).toBe(11)
      expect(timeIntel.bestHour.avg).toBe(85.50)
      expect(timeIntel.bestHour.label).toBe('11 AM')
      expect(timeIntel.bestDay.day).toBe('Wednesday')
    })

    test('prefers canonical over fallback engine data', () => {
      const analytics = {
        totalStreamMinutes: 300,
        meaningfulSessionCount: 6,
        bestHour: { hour: '8', avg: 50 },
        bestDay: { day: 'Sunday', avg: 50 },
        platformBestTimes: {},
        platforms: []
      }

      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 20,
            localDay: 'Saturday',
            medianUsdPerHour: 200,
            sessionCount: 6,
            tier: 'high',
            distinctDates: 8,
            qualified: true
          },
          earlySignal: null
        },
        byPlatform: {}
      }

      const timeIntel = buildTimeIntelligence(analytics, canonicalTiming)

      // Should use canonical, not fallback
      expect(timeIntel.bestHour.hour).toBe(20)
      expect(timeIntel.bestDay.day).toBe('Saturday')
      expect(timeIntel.bestHour.avg).toBe(200)
    })
  })

  // ========== EDGE CASES & ERROR HANDLING ==========

  describe('edge cases and error handling', () => {
    test('returns null when no analytics provided', () => {
      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 14,
            localDay: 'Monday',
            medianUsdPerHour: 100,
            sessionCount: 3,
            tier: 'high',
            distinctDates: 5,
            qualified: true
          },
          earlySignal: null
        },
        byPlatform: {}
      }

      const result = buildTimeIntelligence(null, canonicalTiming)
      expect(result).toBeNull()
    })

    test('handles null bestWindow from canonical gracefully', () => {
      const analytics = {
        totalStreamMinutes: 100,
        meaningfulSessionCount: 2,
        bestHour: { hour: '9', avg: 40 },
        bestDay: { day: 'Monday', avg: 40 },
        platforms: []
      }

      const canonicalTiming = {
        global: {
          bestWindow: null,
          earlySignal: {
            localHour: 15,
            localDay: 'Thursday',
            sessionCount: 1,
            distinctDates: 1
          }
        },
        byPlatform: {}
      }

      const timeIntel = buildTimeIntelligence(analytics, canonicalTiming)

      // Should fall back to engine data
      expect(timeIntel.bestHour).not.toBeNull()
      expect(timeIntel.bestHour.hour).toBe(9)
    })

    test('handles missing byPlatform gracefully', () => {
      const analytics = {
        totalStreamMinutes: 200,
        meaningfulSessionCount: 4,
        platforms: []
      }

      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 12,
            localDay: 'Tuesday',
            medianUsdPerHour: 100,
            sessionCount: 2,
            tier: 'supported',
            distinctDates: 3,
            qualified: true
          }
          // byPlatform missing
        }
      }

      const timeIntel = buildTimeIntelligence(analytics, canonicalTiming)

      expect(timeIntel.platformBestTimes).toBeDefined()
      expect(Object.keys(timeIntel.platformBestTimes).length).toBe(0)
    })

    test('displays correct confidence label with low data', () => {
      const analytics = {
        totalStreamMinutes: 50,
        meaningfulSessionCount: 1,
        platforms: []
      }

      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 14,
            localDay: 'Wednesday',
            medianUsdPerHour: 80,
            sessionCount: 1,
            tier: 'promising',
            distinctDates: 3,
            qualified: true
          },
          earlySignal: null
        },
        byPlatform: {}
      }

      const timeIntel = buildTimeIntelligence(analytics, canonicalTiming)

      expect(timeIntel.confidence.level).toBe('Medium')
      expect(timeIntel.confidence.label).toBe('promising')
    })
  })

  // ========== FULL INTEGRATION SCENARIOS ==========

  describe('full platform data flow integration', () => {
    test('complete data flow: canonical timing → buildTimeIntelligence → UI display', () => {
      // Simulate real page.js output after running computeHistoricalTimePerformance()
      const analytics = {
        totalStreamMinutes: 960,
        meaningfulSessionCount: 16,
        platforms: [
          {
            platform: 'Chaturbate',
            totalUSD: 1200,
            hours: 8,
            sessions: 8,
            usdPerHour: 150.00
          },
          {
            platform: 'Stripchat',
            totalUSD: 900,
            hours: 8,
            sessions: 8,
            usdPerHour: 112.50
          }
        ],
        // Old engine output (now being phased out)
        bestHour: { hour: '10', avg: 100 },
        bestDay: { day: 'Monday', avg: 100 },
        platformBestTimes: {}
      }

      // Canonical output from computeHistoricalTimePerformance()
      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 14,
            localDay: 'Friday',
            topPlatform: 'Chaturbate',
            medianUsdPerHour: 180.00,
            sessionCount: 8,
            tier: 'high',
            distinctDates: 10,
            qualified: true
          },
          earlySignal: null,
          hourData: [],
          dayData: []
        },
        byPlatform: {
          Chaturbate: {
            totalRevenue: 1200,
            totalTips: 40,
            bestHour: {
              hour: 18,
              distinctDates: 8,
              revenue: 600,
              tips: 20,
              avgPerTip: 30.00,
              qualified: true,
              confidence: 'high'
            },
            dayData: [
              {
                day: 'Friday',
                distinctDates: 4,
                revenue: 400,
                tips: 12,
                avgPerTip: 33.33,
                qualified: true,
                confidence: 'high'
              }
            ]
          },
          Stripchat: {
            totalRevenue: 900,
            totalTips: 30,
            bestHour: {
              hour: 20,
              distinctDates: 7,
              revenue: 450,
              tips: 15,
              avgPerTip: 30.00,
              qualified: true,
              confidence: 'high'
            },
            dayData: []
          }
        }
      }

      // This is what UnifiedView does in PlatformsIntelligence
      const timeIntel = buildTimeIntelligence(analytics, canonicalTiming)

      // Verify global "When you earn best" section
      expect(timeIntel.bestHour.hour).toBe(14)
      expect(timeIntel.bestHour.label).toBe('2 PM')
      expect(timeIntel.bestDay.day).toBe('Friday')
      expect(timeIntel.confidence.level).toBe('High')
      expect(timeIntel.hasPattern).toBe(true)

      // Verify platform-specific sections
      expect(timeIntel.platformBestTimes.Chaturbate.hour.hour).toBe(18)
      expect(timeIntel.platformBestTimes.Chaturbate.hour.label).toBe('6 PM')
      expect(timeIntel.platformBestTimes.Chaturbate.bestDay.day).toBe('Friday')

      expect(timeIntel.platformBestTimes.Stripchat.hour.hour).toBe(20)
      expect(timeIntel.platformBestTimes.Stripchat.hour.label).toBe('8 PM')
      expect(timeIntel.platformBestTimes.Stripchat.bestDay).toBeNull()
    })

    test('integration with buildBusinessSnapshot does not conflict', () => {
      const analytics = {
        totalStreamMinutes: 480,
        meaningfulSessionCount: 8,
        platforms: [
          {
            platform: 'Chaturbate',
            totalUSD: 800,
            hours: 8,
            sessions: 4,
            tips: 20
          }
        ]
      }

      const canonicalTiming = {
        global: {
          bestWindow: {
            localHour: 14,
            localDay: 'Friday',
            medianUsdPerHour: 100,
            sessionCount: 4,
            tier: 'high',
            distinctDates: 5,
            qualified: true
          },
          earlySignal: null
        },
        byPlatform: {}
      }

      // Both functions work on same analytics object
      const business = buildBusinessSnapshot(analytics)
      const timeIntel = buildTimeIntelligence(analytics, canonicalTiming)

      expect(business.totalEarnings).toBe(800)
      expect(timeIntel.bestHour.hour).toBe(14)
      // No conflicts or overwrites
    })
  })
})
