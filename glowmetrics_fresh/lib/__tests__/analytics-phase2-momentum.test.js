/**
 * PHASE 2 PLATFORM MOMENTUM TEST
 *
 * Validates correct implementation:
 * - Platform momentum uses ALL tips (not meaningfulSessions)
 * - Platform momentum revenue matches overall momentum calculation
 * - Reconciliation: platform momentum by-platform sum = overall momentum
 * - Date ranges: last 30 days vs prior 30 days correct
 */

import { aggregateRows } from '../analytics'

describe('Phase 2 Platform Momentum', () => {
  describe('Platform Momentum: ALL Tips', () => {
    test('platform momentum should use ALL tips in revenue calculation', () => {
      const now = new Date()
      const tips = [
        // Meaningful Chaturbate (last 30 days)
        { platform: 'Chaturbate', username: 'u1', date_time: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), usd: 100, tokens: 2000 },
        // Low-signal Chaturbate (last 30 days) - should be included
        { platform: 'Chaturbate', username: 'u2', date_time: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(), usd: 5, tokens: 100 },

        // Meaningful MyFreeCams (prior 30 days)
        { platform: 'MyFreeCams', username: 'u3', date_time: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString(), usd: 80, tokens: 1600 },
        // Low-signal MyFreeCams (prior 30 days) - should be included
        { platform: 'MyFreeCams', username: 'u4', date_time: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString(), usd: 5, tokens: 100 },
      ]

      const result = aggregateRows(tips)

      // Chaturbate: last 30 days should include both meaningful ($100) and low-signal ($5)
      const chaturbate = result.platformMomentum.Chaturbate
      expect(chaturbate).toBeDefined()
      expect(chaturbate.last30USD).toBeCloseTo(105, 1)

      // MyFreeCams: prior 30 days should include both meaningful ($80) and low-signal ($5)
      const myfreecams = result.platformMomentum.MyFreeCams
      expect(myfreecams).toBeDefined()
      expect(myfreecams.prior30USD).toBeCloseTo(85, 1)
    })

    test('platform momentum should match overall momentum period totals', () => {
      const now = new Date()
      const tips = [
        // Last 30 days: Chaturbate $100, MyFreeCams $80, total $180
        { platform: 'Chaturbate', username: 'u1', date_time: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), usd: 100, tokens: 2000 },
        { platform: 'MyFreeCams', username: 'u2', date_time: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(), usd: 80, tokens: 1600 },

        // Prior 30 days: Chaturbate $50, MyFreeCams $40, total $90
        { platform: 'Chaturbate', username: 'u3', date_time: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString(), usd: 50, tokens: 1000 },
        { platform: 'MyFreeCams', username: 'u4', date_time: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString(), usd: 40, tokens: 800 },
      ]

      const result = aggregateRows(tips)

      // Sum platform momentum last30USD
      const platformLast30Sum = Object.values(result.platformMomentum).reduce(
        (sum, p) => sum + (p.last30USD || 0),
        0
      )

      // This should match overall momentum calculation
      // Note: Overall momentum is calculated on overallMomentum object
      expect(platformLast30Sum).toBeCloseTo(180, 1)

      // Prior 30 days sum
      const platformPrior30Sum = Object.values(result.platformMomentum).reduce(
        (sum, p) => sum + (p.prior30USD || 0),
        0
      )
      expect(platformPrior30Sum).toBeCloseTo(90, 1)
    })

    test('platform momentum low-signal tips should be included in revenue', () => {
      const now = new Date()
      const tips = [
        // Meaningful Chaturbate
        { platform: 'Chaturbate', username: 'u1', date_time: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), usd: 50, tokens: 1000 },
        // Low-signal Chaturbate (both < 15 min AND < $10)
        { platform: 'Chaturbate', username: 'u2', date_time: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(), usd: 2, tokens: 40 },
        { platform: 'Chaturbate', username: 'u2', date_time: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(), usd: 3, tokens: 60 },
      ]

      const result = aggregateRows(tips)
      const chaturbate = result.platformMomentum.Chaturbate

      // Should include all three tips in last 30 days
      expect(chaturbate.last30USD).toBeCloseTo(55, 1)
    })
  })

  describe('Platform Momentum Reconciliation', () => {
    test('sum of platform momentum should reconcile across multiple platforms', () => {
      const now = new Date()
      const tips = [
        // Chaturbate last 30: $100
        { platform: 'Chaturbate', username: 'u1', date_time: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), usd: 100, tokens: 2000 },
        // MyFreeCams last 30: $80
        { platform: 'MyFreeCams', username: 'u2', date_time: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(), usd: 80, tokens: 1600 },
        // BongaCams last 30: $20 (mix of meaningful and low-signal)
        { platform: 'BongaCams', username: 'u3', date_time: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(), usd: 15, tokens: 300 },
        { platform: 'BongaCams', username: 'u4', date_time: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(), usd: 5, tokens: 100 },
      ]

      const result = aggregateRows(tips)

      const platformSum = Object.values(result.platformMomentum).reduce(
        (sum, p) => sum + (p.last30USD || 0),
        0
      )

      expect(platformSum).toBeCloseTo(200, 1)
    })

    test('platform momentum dates should correctly categorize into 30-day periods', () => {
      const now = new Date()

      const tips = [
        // Clearly in last 30 days
        { platform: 'Chaturbate', username: 'u1', date_time: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(), usd: 50, tokens: 1000 },
        // Clearly in prior 30 days
        { platform: 'Chaturbate', username: 'u2', date_time: new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000).toISOString(), usd: 50, tokens: 1000 },
      ]

      const result = aggregateRows(tips)
      const chaturbate = result.platformMomentum.Chaturbate

      expect(chaturbate.last30USD).toBeCloseTo(50, 1)
      expect(chaturbate.prior30USD).toBeCloseTo(50, 1)
    })
  })

  describe('Platform Momentum Calculations', () => {
    test('platform momentum percentage should reflect period-over-period growth', () => {
      const now = new Date()
      const tips = [
        // Last 30 days: $100
        { platform: 'Chaturbate', username: 'u1', date_time: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), usd: 100, tokens: 2000 },
        // Prior 30 days: $50 (so growth is 100%)
        { platform: 'Chaturbate', username: 'u2', date_time: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString(), usd: 50, tokens: 1000 },
      ]

      const result = aggregateRows(tips)
      const chaturbate = result.platformMomentum.Chaturbate

      // (100 - 50) / 50 * 100 = 100%
      expect(chaturbate.pct).toBeCloseTo(100, 1)
      expect(chaturbate.label).toBe('Surging')
      expect(chaturbate.emoji).toBe('🚀')
    })

    test('platform momentum labels should be assigned correctly', () => {
      const now = new Date()

      // Test Surging (>50%)
      let tips = [
        { platform: 'Chaturbate', username: 'u1', date_time: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), usd: 160, tokens: 3200 },
        { platform: 'Chaturbate', username: 'u2', date_time: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString(), usd: 100, tokens: 2000 },
      ]
      let result = aggregateRows(tips)
      expect(result.platformMomentum.Chaturbate.label).toBe('Surging')

      // Test Growing (>10% and <=50%)
      tips = [
        { platform: 'MyFreeCams', username: 'u1', date_time: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), usd: 115, tokens: 2300 },
        { platform: 'MyFreeCams', username: 'u2', date_time: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString(), usd: 100, tokens: 2000 },
      ]
      result = aggregateRows(tips)
      expect(result.platformMomentum.MyFreeCams.label).toBe('Growing')

      // Test Steady (>-10% and <=10%)
      tips = [
        { platform: 'BongaCams', username: 'u1', date_time: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), usd: 105, tokens: 2100 },
        { platform: 'BongaCams', username: 'u2', date_time: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString(), usd: 100, tokens: 2000 },
      ]
      result = aggregateRows(tips)
      expect(result.platformMomentum.BongaCams.label).toBe('Steady')

      // Test Declining (<-10%)
      tips = [
        { platform: 'StripChat', username: 'u1', date_time: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), usd: 80, tokens: 1600 },
        { platform: 'StripChat', username: 'u2', date_time: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString(), usd: 100, tokens: 2000 },
      ]
      result = aggregateRows(tips)
      expect(result.platformMomentum.StripChat.label).toBe('Declining')
    })

    test('platform momentum should handle no prior period data', () => {
      const today = new Date('2026-09-13')
      const tips = [
        // Only last 30 days, no prior period
        { platform: 'Chaturbate', username: 'u1', date_time: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), usd: 100, tokens: 2000 },
      ]

      const result = aggregateRows(tips)
      const chaturbate = result.platformMomentum.Chaturbate

      expect(chaturbate.pct).toBeNull()
      expect(chaturbate.label).toBe('Not enough history')
    })
  })

  describe('Data Integrity', () => {
    test('platform momentum should have valid numeric values', () => {
      const today = new Date('2026-09-13')
      const tips = [
        { platform: 'Chaturbate', username: 'u1', date_time: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), usd: 100, tokens: 2000 },
        { platform: 'Chaturbate', username: 'u2', date_time: new Date(today.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString(), usd: 50, tokens: 1000 },
      ]

      const result = aggregateRows(tips)
      const chaturbate = result.platformMomentum.Chaturbate

      expect(isFinite(chaturbate.last30USD)).toBe(true)
      expect(isFinite(chaturbate.prior30USD)).toBe(true)
      expect(isFinite(chaturbate.pct) || chaturbate.pct === null).toBe(true)
    })

    test('platform momentum should handle empty tips', () => {
      const result = aggregateRows([])

      expect(result.platformMomentum).toBeDefined()
      expect(typeof result.platformMomentum).toBe('object')
      expect(Object.keys(result.platformMomentum).length).toBe(0)
    })
  })
})
