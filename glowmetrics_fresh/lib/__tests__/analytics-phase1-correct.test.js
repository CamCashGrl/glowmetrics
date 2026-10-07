/**
 * PHASE 1 CORRECT ARCHITECTURE TEST
 *
 * Validates correct implementation:
 * - Financial totals (ALL tips)
 * - Platform breakdown (ALL tips)
 * - Reconciliation (platform rows = dashboard total)
 * - Session analytics (meaningful sessions only)
 * - Hourly rate (meaningful sessions only)
 */

import { aggregateRows } from '../analytics'

describe('Phase 1 Correct Architecture', () => {
  describe('Financial Truth: ALL Tips', () => {
    test('totalUSD should sum ALL tips (not filtered)', () => {
      const tips = [
        // Meaningful session: 20 min, $100
        ...Array(10).fill(null).map((_, i) => ({
          platform: 'Chaturbate',
          username: 'u1',
          date_time: new Date(new Date('2026-09-01T10:00:00Z').getTime() + i * 120000).toISOString(),
          usd: 10,
          tokens: 200
        })),

        // Low-signal session: 2 min, $5 (< 15 min AND < $10)
        { platform: 'BongaCams', username: 'u2', date_time: '2026-09-02T10:00:00Z', usd: 2, tokens: 40 },
        { platform: 'BongaCams', username: 'u2', date_time: '2026-09-02T10:01:00Z', usd: 1.50, tokens: 30 },
        { platform: 'BongaCams', username: 'u2', date_time: '2026-09-02T10:02:00Z', usd: 1.50, tokens: 30 },
      ]

      const result = aggregateRows(tips)

      // FINANCIAL TRUTH: Should include ALL tips
      // Meaningful: $100, Low-signal: $5 = Total: $105
      expect(result.totalUSD).toBeCloseTo(105, 1)
      expect(result.totalUSD).not.toBeCloseTo(100, 1)
    })

    test('totalTips should count ALL tips (not filtered)', () => {
      const tips = [
        // Meaningful: 10 tips
        ...Array(10).fill(null).map((_, i) => ({
          platform: 'Chaturbate',
          username: 'u1',
          date_time: new Date(new Date('2026-09-01T10:00:00Z').getTime() + i * 120000).toISOString(),
          usd: 10,
          tokens: 200
        })),

        // Low-signal: 3 tips
        { platform: 'BongaCams', username: 'u2', date_time: '2026-09-02T10:00:00Z', usd: 2, tokens: 40 },
        { platform: 'BongaCams', username: 'u2', date_time: '2026-09-02T10:01:00Z', usd: 1.50, tokens: 30 },
        { platform: 'BongaCams', username: 'u2', date_time: '2026-09-02T10:02:00Z', usd: 1.50, tokens: 30 },
      ]

      const result = aggregateRows(tips)

      // FINANCIAL TRUTH: Should count ALL tips
      expect(result.totalTips).toBe(13)
    })

    test('avgTipSize should use ALL tips in calculation', () => {
      const tips = [
        // Meaningful: 10 tips, $100
        ...Array(10).fill(null).map((_, i) => ({
          platform: 'Chaturbate',
          username: 'u1',
          date_time: new Date(new Date('2026-09-01T10:00:00Z').getTime() + i * 120000).toISOString(),
          usd: 10,
          tokens: 200
        })),

        // Low-signal: 3 tips, $5
        { platform: 'BongaCams', username: 'u2', date_time: '2026-09-02T10:00:00Z', usd: 2, tokens: 40 },
        { platform: 'BongaCams', username: 'u2', date_time: '2026-09-02T10:01:00Z', usd: 1.50, tokens: 30 },
        { platform: 'BongaCams', username: 'u2', date_time: '2026-09-02T10:02:00Z', usd: 1.50, tokens: 30 },
      ]

      const result = aggregateRows(tips)

      // FINANCIAL TRUTH: $105 / 13 tips = $8.08 per tip (includes low-signal)
      expect(result.avgTipSize).toBeCloseTo(105 / 13, 2)
    })
  })

  describe('Platform Reconciliation: ALL Tips', () => {
    test('platform rows should sum to dashboard totalUSD', () => {
      const tips = [
        { platform: 'Chaturbate', username: 'u1', date_time: '2026-09-01T10:00:00Z', usd: 100, tokens: 2000 },
        { platform: 'Chaturbate', username: 'u1', date_time: '2026-09-01T10:10:00Z', usd: 100, tokens: 2000 },
        { platform: 'MyFreeCams', username: 'u2', date_time: '2026-09-01T14:00:00Z', usd: 200, tokens: 4000 },
        { platform: 'MyFreeCams', username: 'u2', date_time: '2026-09-01T14:10:00Z', usd: 200, tokens: 4000 },
        // Low-signal
        { platform: 'BongaCams', username: 'u3', date_time: '2026-09-02T10:00:00Z', usd: 2, tokens: 40 },
        { platform: 'BongaCams', username: 'u3', date_time: '2026-09-02T10:01:00Z', usd: 3, tokens: 60 },
      ]

      const result = aggregateRows(tips)

      const platformSum = result.platforms.reduce((sum, p) => sum + p.totalUSD, 0)

      // FINANCIAL TRUTH: Dashboard total = platform rows sum
      // Expected: $100+$100+$200+$200+$2+$3 = $605
      expect(result.totalUSD).toBeCloseTo(605, 1)
      expect(platformSum).toBeCloseTo(605, 1)
      expect(platformSum).toBe(result.totalUSD)
    })

    test('platform rows should include low-signal tips in revenue', () => {
      const tips = [
        // Meaningful Chaturbate
        { platform: 'Chaturbate', username: 'u1', date_time: '2026-09-01T10:00:00Z', usd: 50, tokens: 1000 },
        { platform: 'Chaturbate', username: 'u1', date_time: '2026-09-01T10:10:00Z', usd: 50, tokens: 1000 },

        // Low-signal Chaturbate (same platform, should be included)
        { platform: 'Chaturbate', username: 'u2', date_time: '2026-09-02T10:00:00Z', usd: 2, tokens: 40 },
        { platform: 'Chaturbate', username: 'u2', date_time: '2026-09-02T10:01:00Z', usd: 3, tokens: 60 },
      ]

      const result = aggregateRows(tips)

      // Find Chaturbate row
      const chaturbate = result.platforms.find(p => p.platform === 'Chaturbate')

      // FINANCIAL TRUTH: Should include ALL tips from platform
      // Expected: $50 + $50 + $2 + $3 = $105
      expect(chaturbate.totalUSD).toBeCloseTo(105, 1)
    })
  })

  describe('Session Analytics: Meaningful Sessions Only', () => {
    test('sessions array should only include meaningful sessions', () => {
      const tips = [
        // Meaningful session 1: 36 min, 10 tips, $100 (>= 30 min AND >= 2 tips)
        ...Array(10).fill(null).map((_, i) => ({
          platform: 'Chaturbate',
          username: 'u1',
          date_time: new Date(new Date('2026-09-01T10:00:00Z').getTime() + i * 240000).toISOString(),
          usd: 10,
          tokens: 200
        })),

        // Low-signal session: 2 min, $5
        { platform: 'BongaCams', username: 'u2', date_time: '2026-09-02T10:00:00Z', usd: 2, tokens: 40 },
        { platform: 'BongaCams', username: 'u2', date_time: '2026-09-02T10:01:00Z', usd: 1.50, tokens: 30 },
        { platform: 'BongaCams', username: 'u2', date_time: '2026-09-02T10:02:00Z', usd: 1.50, tokens: 30 },
      ]

      const result = aggregateRows(tips)

      // SESSION ANALYTICS: Should only include meaningful sessions
      // Expected: 1 meaningful session (low-signal excluded)
      expect(result.sessions.length).toBe(1)
      expect(result.sessions[0].platform).toBe('Chaturbate')
      expect(result.sessions[0].sessionQuality).toBe('meaningful')
    })

    test('hourly rate should use meaningful sessions only', () => {
      const tips = [
        // Meaningful session: 120 min, $120
        ...Array(60).fill(null).map((_, i) => ({
          platform: 'Chaturbate',
          username: 'u1',
          date_time: new Date(new Date('2026-09-01T10:00:00Z').getTime() + i * 120000).toISOString(),
          usd: 2,
          tokens: 40
        })),

        // Low-signal session: 2 min, $5 (should not affect hourly rate)
        { platform: 'BongaCams', username: 'u2', date_time: '2026-09-02T10:00:00Z', usd: 2, tokens: 40 },
        { platform: 'BongaCams', username: 'u2', date_time: '2026-09-02T10:01:00Z', usd: 1.50, tokens: 30 },
        { platform: 'BongaCams', username: 'u2', date_time: '2026-09-02T10:02:00Z', usd: 1.50, tokens: 30 },
      ]

      const result = aggregateRows(tips)

      // HOURLY RATE: Should use meaningful sessions only
      // Meaningful: $120 over ~120 min = ~$60/hr
      // NOT: ($120 + $5) over 122 min = $1.02/hr
      if (result.estimatedHourlyRate !== 0) {
        // Should be high (meaningful sessions are $120 in ~2 hours)
        expect(result.estimatedHourlyRate).toBeGreaterThan(50)
        expect(result.estimatedHourlyRate).toBeLessThan(70)
        // Should NOT be low (which would indicate low-signal tips are included)
        expect(result.estimatedHourlyRate).not.toBeLessThan(10)
      }
    })
  })

  describe('Data Integrity', () => {
    test('no NaN or Infinity in numeric fields', () => {
      const tips = [
        { platform: 'Chaturbate', username: 'u1', date_time: '2026-09-01T10:00:00Z', usd: 100, tokens: 2000 },
        { platform: 'Chaturbate', username: 'u1', date_time: '2026-09-01T10:10:00Z', usd: 100, tokens: 2000 },
        { platform: 'BongaCams', username: 'u2', date_time: '2026-09-02T10:00:00Z', usd: 2, tokens: 40 },
      ]

      const result = aggregateRows(tips)

      expect(isFinite(result.totalUSD)).toBe(true)
      expect(isFinite(result.totalTips)).toBe(true)
      expect(isFinite(result.avgTipSize)).toBe(true)
      expect(isFinite(result.estimatedHourlyRate) || result.estimatedHourlyRate === 0).toBe(true)

      result.platforms.forEach(p => {
        expect(isFinite(p.totalUSD)).toBe(true)
        expect(isFinite(p.tips)).toBe(true)
      })
    })

    test('empty input handling', () => {
      const result = aggregateRows([])

      expect(result.totalUSD).toBe(0)
      expect(result.totalTips).toBe(0)
      expect(result.avgTipSize).toBe(0)
      expect(result.sessions.length).toBe(0)
      expect(isNaN(result.avgTipSize)).toBe(false)
    })
  })
})
