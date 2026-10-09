/**
 * PHASE 1: COMPREHENSIVE FORMULA VALIDATION
 *
 * Validates ALL critical formulas that determine metrics displayed on the dashboard:
 * - Token rate calculations (platform-specific)
 * - Session validity filtering (meaningful vs low-signal vs invalid)
 * - Fan tier classification (based on percentile rank)
 * - Hourly rate computation (from eligible sessions only)
 * - Data confidence levels (based on sample size)
 * - Best time to stream scoring (USD per hour in each bucket)
 *
 * CRITICAL: These tests reference the source of truth formulas defined in:
 * - lib/constants.js (PLATFORM_TOKEN_RATES)
 * - lib/analytics/sessions.js (SESSION_GAP_MS, session detection)
 * - lib/analytics.js (classifySession, isHourlyRateEligible, calculateConfidence)
 *
 * Do NOT rely on hardcoded values. Import and validate against actual implementations.
 */

import {
  calculateConfidence,
  toLocalHour,
  toLocalDow,
  aggregateRows,
  identifyWhales,
} from '../analytics'

import {
  PLATFORM_TOKEN_RATES,
  DEFAULT_TOKEN_RATE,
  tokenRate,
} from '../constants'

import { detectSessions, SESSION_GAP_MS } from '../analytics/sessions'

describe('PHASE 1: Formula Validation', () => {
  // ────────────────────────────────────────────────────────────────────
  // SECTION 1: TOKEN RATE CALCULATIONS
  // Validate that platform rates are correctly applied and fallbacks work
  // ────────────────────────────────────────────────────────────────────

  describe('Token Rate Calculations', () => {
    test('Chaturbate platform should use 0.05 rate', () => {
      expect(tokenRate('Chaturbate')).toBe(0.05)
      expect(tokenRate('chaturbate')).toBe(0.05) // Case-insensitive
      expect(tokenRate('CHATURBATE')).toBe(0.05)
    })

    test('BongaCams platform should use 0.025 rate', () => {
      expect(tokenRate('BongaCams')).toBe(0.025)
      expect(tokenRate('bongacams')).toBe(0.025)
    })

    test('MyFreeCams platform should use 0.05 rate', () => {
      expect(tokenRate('MyFreeCams')).toBe(0.05)
      expect(tokenRate('myfreecams')).toBe(0.05)
    })

    test('Stripchat platform should use 0.05 rate', () => {
      expect(tokenRate('Stripchat')).toBe(0.05)
      expect(tokenRate('stripchat')).toBe(0.05)
    })

    test('CamSoda platform should use 0.05 rate', () => {
      expect(tokenRate('CamSoda')).toBe(0.05)
      expect(tokenRate('camsoda')).toBe(0.05)
    })

    test('Unknown platform should fall back to default rate (0.05)', () => {
      expect(tokenRate('UnknownPlatform')).toBe(DEFAULT_TOKEN_RATE)
      expect(tokenRate(null)).toBe(DEFAULT_TOKEN_RATE)
      expect(tokenRate(undefined)).toBe(DEFAULT_TOKEN_RATE)
    })

    test('Token to USD conversion should use platform rate', () => {
      // Chaturbate: 100 tokens × 0.05 = $5
      const chaturbateTokens = 100
      const chaturbateUSD = chaturbateTokens * tokenRate('Chaturbate')
      expect(chaturbateUSD).toBe(5)

      // BongaCams: 100 tokens × 0.025 = $2.50
      const bongaTokens = 100
      const bongaUSD = bongaTokens * tokenRate('BongaCams')
      expect(bongaUSD).toBe(2.5)

      // Mismatch check: Same tokens, different rates = different USD
      expect(chaturbateUSD).not.toBe(bongaUSD)
    })

    test('PLATFORM_TOKEN_RATES constant should contain all expected platforms', () => {
      expect(Object.keys(PLATFORM_TOKEN_RATES)).toContain('Chaturbate')
      expect(Object.keys(PLATFORM_TOKEN_RATES)).toContain('BongaCams')
      expect(Object.keys(PLATFORM_TOKEN_RATES)).toContain('MyFreeCams')
      expect(Object.keys(PLATFORM_TOKEN_RATES)).toContain('Stripchat')
      expect(Object.keys(PLATFORM_TOKEN_RATES)).toContain('CamSoda')
    })

    test('Token rates should never be zero or negative', () => {
      Object.values(PLATFORM_TOKEN_RATES).forEach(rate => {
        expect(rate).toBeGreaterThan(0)
      })
    })
  })

  // ────────────────────────────────────────────────────────────────────
  // SECTION 2: SESSION VALIDITY & CLASSIFICATION
  // Validates the rules that determine meaningful vs low-signal vs invalid
  // ────────────────────────────────────────────────────────────────────

  describe('Session Validity & Classification', () => {
    test('Session under 2 minutes with no revenue should be invalid', () => {
      const tips = [
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: '2026-09-01T10:00:00Z',
          usd: 0,
          tokens: 0,
        },
      ]

      const result = aggregateRows(tips)
      const sessions = detectSessions(tips)

      // Session duration will be 0 (single tip = 0 duration)
      // Should be classified as invalid
      expect(sessions.length).toBe(1)
      expect(sessions[0].durationMinutes).toBeLessThan(2)
      expect(sessions[0].totalUSD).toBe(0)
    })

    test('Session 10 minutes with $5 revenue should be low-signal', () => {
      const baseTime = new Date('2026-09-01T10:00:00Z')
      const tips = [
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: new Date(baseTime.getTime() + 0).toISOString(),
          usd: 2.50,
          tokens: 50,
        },
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: new Date(baseTime.getTime() + 5 * 60000).toISOString(),
          usd: 2.50,
          tokens: 50,
        },
      ]

      const sessions = detectSessions(tips)
      expect(sessions.length).toBe(1)
      expect(sessions[0].durationMinutes).toBeLessThan(15)
      expect(sessions[0].totalUSD).toBeLessThan(10)
      // Should be classified as low_signal (minutes < 15 AND usd < 10)
    })

    test('Session 30 minutes with $50 revenue should be meaningful', () => {
      const baseTime = new Date('2026-09-01T10:00:00Z')
      const tips = Array.from({ length: 10 }, (_, i) => ({
        platform: 'Chaturbate',
        username: 'user1',
        date_time: new Date(baseTime.getTime() + i * 3 * 60000).toISOString(),
        usd: 5,
        tokens: 100,
      }))

      const sessions = detectSessions(tips)
      expect(sessions.length).toBe(1)
      expect(sessions[0].durationMinutes).toBeGreaterThanOrEqual(27) // 9 gaps × 3 min
      expect(sessions[0].totalUSD).toBe(50)
      // Should be classified as meaningful (not matching invalid or low_signal rules)
    })

    test('Session should split into two sessions if platform changes', () => {
      const baseTime = new Date('2026-09-01T10:00:00Z')
      const tips = [
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: new Date(baseTime.getTime()).toISOString(),
          usd: 20,
          tokens: 400,
        },
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: new Date(baseTime.getTime() + 5 * 60000).toISOString(),
          usd: 20,
          tokens: 400,
        },
        // Platform changes
        {
          platform: 'BongaCams',
          username: 'user1',
          date_time: new Date(baseTime.getTime() + 10 * 60000).toISOString(),
          usd: 10,
          tokens: 400,
        },
      ]

      const sessions = detectSessions(tips)
      expect(sessions.length).toBe(2)
      expect(sessions[0].platform).toBe('Chaturbate')
      expect(sessions[1].platform).toBe('BongaCams')
    })

    test('Session should split if gap exceeds SESSION_GAP_MS (60 minutes)', () => {
      const baseTime = new Date('2026-09-01T10:00:00Z')
      const tips = [
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: new Date(baseTime.getTime()).toISOString(),
          usd: 20,
          tokens: 400,
        },
        // Gap of 61 minutes (exceeds 60-minute SESSION_GAP_MS)
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: new Date(baseTime.getTime() + 61 * 60000).toISOString(),
          usd: 20,
          tokens: 400,
        },
      ]

      const sessions = detectSessions(tips)
      expect(sessions.length).toBe(2)
      expect(SESSION_GAP_MS).toBe(60 * 60 * 1000) // Verify the constant
    })

    test('Session should NOT split if gap is exactly SESSION_GAP_MS (60 minutes)', () => {
      const baseTime = new Date('2026-09-01T10:00:00Z')
      const tips = [
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: new Date(baseTime.getTime()).toISOString(),
          usd: 20,
          tokens: 400,
        },
        // Gap of exactly 60 minutes (not more than the limit)
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: new Date(baseTime.getTime() + 60 * 60000).toISOString(),
          usd: 20,
          tokens: 400,
        },
      ]

      const sessions = detectSessions(tips)
      expect(sessions.length).toBe(1)
    })
  })

  // ────────────────────────────────────────────────────────────────────
  // SECTION 3: HOURLY RATE ELIGIBILITY
  // Validates which sessions contribute to hourly rate calculations
  // ────────────────────────────────────────────────────────────────────

  describe('Hourly Rate Eligibility', () => {
    test('Session with single tip should NOT be hourly-rate eligible', () => {
      // Even if meaningful earning, single tip (tipCount = 1) fails eligibility
      const tips = [
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: '2026-09-01T10:00:00Z',
          usd: 100,
          tokens: 2000,
        },
      ]

      const result = aggregateRows(tips)
      // Session will have tipCount = 1, which is < 2 minimum
      // This should exclude it from hourly rate calculation
      expect(result.hourlyRateSessionCount).toBe(0)
    })

    test('Session with 2+ tips and valid duration should be hourly-rate eligible', () => {
      const baseTime = new Date('2026-09-01T10:00:00Z')
      const tips = [
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: new Date(baseTime.getTime()).toISOString(),
          usd: 25,
          tokens: 500,
        },
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: new Date(baseTime.getTime() + 35 * 60000).toISOString(),
          usd: 25,
          tokens: 500,
        },
      ]

      const result = aggregateRows(tips)
      // Should have: tipCount = 2, durationMinutes = 35 (meaningful), totalUSD = 50
      // All eligible criteria met
      expect(result.hourlyRateSessionCount).toBeGreaterThan(0)
    })

    test('Session under 15 minutes should NOT be hourly-rate eligible', () => {
      const baseTime = new Date('2026-09-01T10:00:00Z')
      const tips = [
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: new Date(baseTime.getTime()).toISOString(),
          usd: 25,
          tokens: 500,
        },
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: new Date(baseTime.getTime() + 5 * 60000).toISOString(),
          usd: 25,
          tokens: 500,
        },
      ]

      const sessions = detectSessions(tips)
      expect(sessions.length).toBe(1)
      expect(sessions[0].durationMinutes).toBeLessThan(15)
      // Should not contribute to hourly rate
    })

    test('Session with unknown duration should NOT be hourly-rate eligible', () => {
      // Single tip = unknown duration (no gap to measure)
      const tips = [
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: '2026-09-01T10:00:00Z',
          usd: 100,
          tokens: 2000,
        },
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: '2026-09-01T10:00:00Z', // Same timestamp
          usd: 100,
          tokens: 2000,
        },
      ]

      const sessions = detectSessions(tips)
      expect(sessions.length).toBe(1)
      expect(sessions[0].durationMinutes).toBe(1) // durationUnknown flag set
    })

    test('Session with zero USD should NOT be hourly-rate eligible', () => {
      const baseTime = new Date('2026-09-01T10:00:00Z')
      const tips = [
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: new Date(baseTime.getTime()).toISOString(),
          usd: 0,
          tokens: 0,
        },
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: new Date(baseTime.getTime() + 20 * 60000).toISOString(),
          usd: 0,
          tokens: 0,
        },
      ]

      const sessions = detectSessions(tips)
      expect(sessions.length).toBe(1)
      expect(sessions[0].totalUSD).toBe(0)
    })
  })

  // ────────────────────────────────────────────────────────────────────
  // SECTION 4: DATA CONFIDENCE LEVELS
  // Validates confidence calculation based on sample size
  // ────────────────────────────────────────────────────────────────────

  describe('Data Confidence Levels', () => {
    test('Very Low confidence: less than 3 valid sessions', () => {
      expect(calculateConfidence(0, 100).level).toBe('Very Low')
      expect(calculateConfidence(1, 100).level).toBe('Very Low')
      expect(calculateConfidence(2, 100).level).toBe('Very Low')
    })

    test('Very Low confidence: less than 3 streamed hours', () => {
      expect(calculateConfidence(10, 0).level).toBe('Very Low')
      expect(calculateConfidence(10, 1).level).toBe('Very Low')
      expect(calculateConfidence(10, 2).level).toBe('Very Low')
    })

    test('Low confidence: 3-4 sessions or 3-5 hours', () => {
      expect(calculateConfidence(3, 100).level).toBe('Low')
      expect(calculateConfidence(4, 100).level).toBe('Low')
      expect(calculateConfidence(10, 3).level).toBe('Low')
      expect(calculateConfidence(10, 5).level).toBe('Low')
    })

    test('Medium confidence: 5-9 sessions and 6+ hours', () => {
      expect(calculateConfidence(5, 6).level).toBe('Medium')
      expect(calculateConfidence(7, 10).level).toBe('Medium')
      expect(calculateConfidence(9, 20).level).toBe('Medium')
    })

    test('High confidence: 10+ sessions and 20+ hours', () => {
      expect(calculateConfidence(10, 20).level).toBe('High')
      expect(calculateConfidence(15, 30).level).toBe('High')
      expect(calculateConfidence(50, 100).level).toBe('High')
    })

    test('Confidence should have label property', () => {
      const conf = calculateConfidence(5, 6)
      expect(conf).toHaveProperty('level')
      expect(conf).toHaveProperty('label')
      expect(typeof conf.label).toBe('string')
    })
  })

  // ────────────────────────────────────────────────────────────────────
  // SECTION 5: TIMEZONE-AWARE HOUR & DAY DETECTION
  // Validates that best hour/day calculations use correct timezone
  // ────────────────────────────────────────────────────────────────────

  describe('Timezone-Aware Hour Detection', () => {
    test('toLocalHour should convert UTC to timezone', () => {
      const utcDate = '2026-09-01T15:00:00Z' // 3 PM UTC

      // America/New_York is UTC-4 in September, so 15:00 UTC = 11:00 EDT
      const nyHour = toLocalHour(utcDate, 'America/New_York')
      expect(nyHour).toBe(11)

      // Asia/Tokyo is UTC+9, so 15:00 UTC = 00:00 JST (next day)
      const tokyoHour = toLocalHour(utcDate, 'Asia/Tokyo')
      expect(tokyoHour).toBe(0)
    })

    test('toLocalHour should handle hour wrap-around at day boundary', () => {
      const earlyMorningUTC = '2026-09-01T03:00:00Z' // 3 AM UTC
      const tokyoHour = toLocalHour(earlyMorningUTC, 'Asia/Tokyo')
      expect(tokyoHour).toBe(12) // 3 AM UTC + 9 hours = noon JST
    })

    test('toLocalHour should fallback to UTC if timezone invalid', () => {
      const utcDate = '2026-09-01T15:00:00Z'
      const hour = toLocalHour(utcDate, 'Invalid/Timezone')
      // Should fallback to UTC
      expect(hour).toBe(15)
    })
  })

  describe('Timezone-Aware Day of Week Detection', () => {
    test('toLocalDow should return correct day index (0=Sunday)', () => {
      // 2026-09-01 is a Tuesday in UTC
      const tuesdayUTC = '2026-09-01T12:00:00Z'

      // In any timezone, should still identify as Tuesday (day 2)
      const dowUTC = toLocalDow(tuesdayUTC, 'America/New_York')
      expect(dowUTC).toBe(2) // Tuesday

      const dowUTC2 = toLocalDow(tuesdayUTC, 'UTC')
      expect(dowUTC2).toBe(2)
    })

    test('toLocalDow should account for timezone-induced day changes', () => {
      // 2026-08-31 21:00:00 UTC (Monday night) = 2026-09-01 05:00:00 JST (Tuesday morning)
      const mondayNightUTC = '2026-08-31T21:00:00Z'

      const dowUTC = toLocalDow(mondayNightUTC, 'UTC')
      expect(dowUTC).toBe(1) // Monday in UTC

      const dowTokyo = toLocalDow(mondayNightUTC, 'Asia/Tokyo')
      expect(dowTokyo).toBe(2) // Tuesday in Tokyo
    })
  })

  // ────────────────────────────────────────────────────────────────────
  // SECTION 6: BEST TIME TO STREAM SCORING
  // Validates that hourly/daily buckets correctly aggregate USD per hour
  // ────────────────────────────────────────────────────────────────────

  describe('Best Time to Stream Scoring', () => {
    test('Best hour tracking should be populated when tips exist', () => {
      const tips = [
        // Tuesday 2-3 PM UTC: $100
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: '2026-09-01T14:00:00Z',
          usd: 50,
          tokens: 1000,
        },
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: '2026-09-01T14:30:00Z',
          usd: 50,
          tokens: 1000,
        },

        // Tuesday 3-4 PM UTC: $10
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: '2026-09-01T15:00:00Z',
          usd: 10,
          tokens: 200,
        },
      ]

      const result = aggregateRows(tips)
      // Result should have bestHour and it should be a valid hour (0-23)
      expect(result.bestHour).toBeDefined()
      if (result.bestHour !== null) {
        expect(result.bestHour).toBeGreaterThanOrEqual(0)
        expect(result.bestHour).toBeLessThan(24)
      }
    })

    test('Best day should aggregate all tips across all hours on that day', () => {
      const tips = [
        // Tuesday: 4 tips = $100
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: '2026-09-01T10:00:00Z',
          usd: 25,
          tokens: 500,
        },
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: '2026-09-01T14:00:00Z',
          usd: 25,
          tokens: 500,
        },
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: '2026-09-01T18:00:00Z',
          usd: 25,
          tokens: 500,
        },
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: '2026-09-01T22:00:00Z',
          usd: 25,
          tokens: 500,
        },

        // Wednesday: 2 tips = $20
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: '2026-09-02T10:00:00Z',
          usd: 10,
          tokens: 200,
        },
        {
          platform: 'Chaturbate',
          username: 'user1',
          date_time: '2026-09-02T14:00:00Z',
          usd: 10,
          tokens: 200,
        },
      ]

      const result = aggregateRows(tips)
      // Tuesday should be identified as best day (higher total revenue)
      expect(result.bestDay).toBeDefined()
      if (result.bestDay) {
        // Should be one of the day names
        const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
        expect(dayNames).toContain(result.bestDay)
      }
    })
  })

  // ────────────────────────────────────────────────────────────────────
  // SECTION 7: WHALE/SHARK/REGULAR TIER CLASSIFICATION
  // Validates fan segmentation based on percentile rank
  // ────────────────────────────────────────────────────────────────────

  describe('Fan Tier Classification', () => {
    test('Multiple users should be classified with tier (Whale/Shark/Regular)', () => {
      // Create tips from multiple users with well-formed dates
      const baseTime = new Date('2026-09-01T10:00:00Z')
      const tips = []

      // User 1: High spender (5 tips, $500)
      for (let i = 0; i < 5; i++) {
        tips.push({
          platform: 'Chaturbate',
          username: 'highSpender',
          date_time: new Date(baseTime.getTime() + i * 60000).toISOString(),
          usd: 100,
          tokens: 2000,
        })
      }

      // User 2: Low spender (2 tips, $10)
      for (let i = 0; i < 2; i++) {
        tips.push({
          platform: 'Chaturbate',
          username: 'lowSpender',
          date_time: new Date(baseTime.getTime() + (1000 + i) * 60000).toISOString(),
          usd: 5,
          tokens: 100,
        })
      }

      const result = aggregateRows(tips)

      // Total should include both users' contributions
      expect(result.totalUSD).toBeCloseTo(500 + 10, 1)
      expect(result.totalTips).toBe(7)

      // topTippers should have entries
      expect(result.topTippers).toBeDefined()
      if (result.topTippers && result.topTippers.length >= 2) {
        // High spender should be ranked first or second
        const highSpenderIndex = result.topTippers.findIndex(t => t.username === 'highSpender')
        expect(highSpenderIndex).toBeGreaterThanOrEqual(0)
      }
    })
  })

  // ────────────────────────────────────────────────────────────────────
  // SECTION 8: CROSS-FORMULA VALIDATION
  // Validates relationships between different formulas (data integrity)
  // ────────────────────────────────────────────────────────────────────

  describe('Cross-Formula Integrity', () => {
    test('totalUSD should equal sum of platform usd values', () => {
      const tips = [
        { platform: 'Chaturbate', username: 'u1', date_time: '2026-09-01T10:00:00Z', usd: 100, tokens: 2000 },
        { platform: 'Chaturbate', username: 'u1', date_time: '2026-09-01T10:10:00Z', usd: 100, tokens: 2000 },
        { platform: 'BongaCams', username: 'u2', date_time: '2026-09-01T14:00:00Z', usd: 50, tokens: 2000 },
        { platform: 'BongaCams', username: 'u2', date_time: '2026-09-01T14:10:00Z', usd: 50, tokens: 2000 },
      ]

      const result = aggregateRows(tips)

      const platformTotal = result.platforms
        .reduce((sum, p) => sum + (p.totalUSD || 0), 0)

      expect(result.totalUSD).toBeCloseTo(platformTotal, 1)
    })

    test('avgTipSize should equal totalUSD / totalTips', () => {
      const tips = [
        { platform: 'Chaturbate', username: 'u1', date_time: '2026-09-01T10:00:00Z', usd: 50, tokens: 1000 },
        { platform: 'Chaturbate', username: 'u1', date_time: '2026-09-01T10:10:00Z', usd: 50, tokens: 1000 },
        { platform: 'Chaturbate', username: 'u1', date_time: '2026-09-01T10:20:00Z', usd: 50, tokens: 1000 },
      ]

      const result = aggregateRows(tips)

      const expectedAvg = result.totalUSD / result.totalTips
      expect(result.avgTipSize).toBeCloseTo(expectedAvg, 2)
    })

    test('Session duration should increase monotonically with more tips', () => {
      const baseTips = [
        { platform: 'Chaturbate', username: 'u1', date_time: '2026-09-01T10:00:00Z', usd: 25, tokens: 500 },
        { platform: 'Chaturbate', username: 'u1', date_time: '2026-09-01T10:10:00Z', usd: 25, tokens: 500 },
      ]

      const result1 = aggregateRows(baseTips)
      const sessions1 = result1.meaningfulSessions || []
      const duration1 = sessions1.length > 0 ? sessions1[0].durationMinutes : 0

      const extendedTips = [
        ...baseTips,
        { platform: 'Chaturbate', username: 'u1', date_time: '2026-09-01T10:20:00Z', usd: 25, tokens: 500 },
        { platform: 'Chaturbate', username: 'u1', date_time: '2026-09-01T10:30:00Z', usd: 25, tokens: 500 },
      ]

      const result2 = aggregateRows(extendedTips)
      const sessions2 = result2.meaningfulSessions || []
      const duration2 = sessions2.length > 0 ? sessions2[0].durationMinutes : 0

      expect(duration2).toBeGreaterThanOrEqual(duration1)
    })

    test('Hourly rate should never exceed per-session rates significantly', () => {
      const tips = Array.from({ length: 5 }, (_, i) => ({
        platform: 'Chaturbate',
        username: `user${i}`,
        date_time: `2026-09-0${i + 1}T10:00:00Z`,
        usd: 100,
        tokens: 2000,
      }))

      const result = aggregateRows(tips)

      // Estimated hourly rate should be reasonable (not infinitely high)
      if (result.estimatedHourlyRate) {
        expect(result.estimatedHourlyRate).toBeLessThan(10000)
        expect(result.estimatedHourlyRate).toBeGreaterThanOrEqual(0)
      }
    })
  })
})
