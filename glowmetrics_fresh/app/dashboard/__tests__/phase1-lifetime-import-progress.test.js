/**
 * PHASE 1: LIFETIME DATA IMPORT PROGRESS
 *
 * Tests conversion-focused progress bar showing:
 * - Lifetime earnings imported (all-time revenue)
 * - Estimated available data (projection based on history depth)
 * - Import progress percentage (imported / available)
 * - Missing amount (to motivate upload)
 */

import { computePlatformCardStats } from '../DashboardPreview'

describe('Phase 1: Lifetime Data Import Progress', () => {
  describe('Import progress calculation', () => {
    test('calculates progress when data imported', () => {
      const tips = [
        { platform: 'BongaCams', date_time: '2026-01-01T10:00:00Z', usd: 1000, tokens: 20000, username: 'u1' },
        { platform: 'BongaCams', date_time: '2026-06-01T10:00:00Z', usd: 500, tokens: 10000, username: 'u2' },
      ]

      const stats = computePlatformCardStats(tips, [], 'BongaCams', 31, {}, [])

      // Lifetime: $1,500
      // 6 months of history → estimate ~$2,250 (1.5x multiplier)
      expect(stats.lifetimeUSD).toBe(1500)
      expect(stats.estimatedAvailable).toBeGreaterThan(1500)
      expect(stats.importProgress).toBeGreaterThan(0)
      expect(stats.importProgress).toBeLessThanOrEqual(100)
    })

    test('shows high % when data spans multiple years', () => {
      const tips = [
        { platform: 'BongaCams', date_time: '2024-01-01T10:00:00Z', usd: 100, tokens: 2000, username: 'u1' },
        { platform: 'BongaCams', date_time: '2026-09-01T10:00:00Z', usd: 50, tokens: 1000, username: 'u2' },
      ]

      const stats = computePlatformCardStats(tips, [], 'BongaCams', 31, {}, [])

      // ~1000+ days of history → high % (multiplier 1.3x)
      expect(stats.importProgress).toBeGreaterThanOrEqual(76)
    })

    test('shows missing amount for conversion messaging', () => {
      const tips = [
        { platform: 'BongaCams', date_time: '2026-01-01T10:00:00Z', usd: 500, tokens: 10000, username: 'u1' },
        { platform: 'BongaCams', date_time: '2026-03-01T10:00:00Z', usd: 500, tokens: 10000, username: 'u2' },
      ]

      const stats = computePlatformCardStats(tips, [], 'BongaCams', 31, {}, [])

      expect(stats.lifetimeUSD).toBe(1000)
      expect(stats.importMissing).toBeGreaterThan(0)
      expect(stats.importMissing + stats.lifetimeUSD).toBe(stats.estimatedAvailable)
    })

    test('handles no data gracefully', () => {
      const stats = computePlatformCardStats([], [], 'BongaCams', 31, {}, [])

      expect(stats.hasData).toBe(false)
      expect(stats.lifetimeUSD).toBeUndefined() // No stats when no data
    })
  })

  describe('Lifetime vs rolling window distinction', () => {
    test('lifetime includes old data outside 31-day window', () => {
      const tips = [
        { platform: 'BongaCams', date_time: '2025-01-01T10:00:00Z', usd: 1000, tokens: 20000, username: 'u1' }, // Old
        { platform: 'BongaCams', date_time: '2026-09-01T10:00:00Z', usd: 100, tokens: 2000, username: 'u2' }, // Recent
      ]

      const stats = computePlatformCardStats(tips, [], 'BongaCams', 31, {}, [])

      // 31-day rolling: only $100
      expect(stats.usd).toBe(100)

      // Lifetime: $1,100 (for import progress)
      expect(stats.lifetimeUSD).toBe(1100)
    })

    test('progress bar shows lifetime, not 31-day window', () => {
      const tips = [
        { platform: 'BongaCams', date_time: '2026-01-01T10:00:00Z', usd: 5000, tokens: 100000, username: 'u1' },
        { platform: 'BongaCams', date_time: '2026-09-01T10:00:00Z', usd: 100, tokens: 2000, username: 'u2' },
      ]

      const stats = computePlatformCardStats(tips, [], 'BongaCams', 31, {}, [])

      // 31-day shows: $100 (recent only)
      expect(stats.usd).toBe(100)

      // But progress bar shows: $5,100 lifetime imported
      expect(stats.lifetimeUSD).toBe(5100)

      // And estimated available is based on lifetime history depth
      expect(stats.estimatedAvailable).toBeGreaterThan(5100)
    })
  })

  describe('Paid sessions included in lifetime progress', () => {
    test('lifetime import progress includes paid sessions', () => {
      const tips = [
        { platform: 'BongaCams', date_time: '2026-01-01T10:00:00Z', usd: 1000, tokens: 20000, username: 'u1' },
      ]
      const paidSessions = [
        { platform: 'BongaCams', date_time: '2026-02-01T10:00:00Z', usd: 500, tokens: 10000, session_type: 'Private' },
      ]

      const stats = computePlatformCardStats(tips, [], 'BongaCams', 31, {}, paidSessions)

      // Lifetime: tips + paid = $1,500
      expect(stats.lifetimeUSD).toBe(1500)
    })
  })

  describe('Conversion messaging calculation', () => {
    test('early adopter (< 25%) gets "collect more data" message', () => {
      const tips = [
        { platform: 'BongaCams', date_time: '2026-01-01T10:00:00Z', usd: 500, tokens: 10000, username: 'u1' },
        { platform: 'BongaCams', date_time: '2026-02-01T10:00:00Z', usd: 500, tokens: 10000, username: 'u2' },
      ]

      const stats = computePlatformCardStats(tips, [], 'BongaCams', 31, {}, [])

      if (stats.importProgress < 25) {
        expect(stats.importMissing).toBeGreaterThan(stats.lifetimeUSD)
      }
    })

    test('engaged user with multiple years of data', () => {
      const tips = [
        { platform: 'BongaCams', date_time: '2024-01-01T10:00:00Z', usd: 5000, tokens: 100000, username: 'u1' },
        { platform: 'BongaCams', date_time: '2024-06-01T10:00:00Z', usd: 5000, tokens: 100000, username: 'u2' },
        { platform: 'BongaCams', date_time: '2026-09-01T10:00:00Z', usd: 4500, tokens: 90000, username: 'u3' },
      ]

      const stats = computePlatformCardStats(tips, [], 'BongaCams', 31, {}, [])

      expect(stats.lifetimeUSD).toBeGreaterThan(10000)
      // ~630 days → multiplier ~1.5-1.7x → 60-66% progress
      expect(stats.importProgress).toBeGreaterThanOrEqual(60)
    })

    test('power user (70%+) with multi-year history', () => {
      const tips = [
        { platform: 'BongaCams', date_time: '2023-01-01T10:00:00Z', usd: 1000, tokens: 20000, username: 'u1' },
        { platform: 'BongaCams', date_time: '2026-09-01T10:00:00Z', usd: 1000, tokens: 20000, username: 'u2' },
      ]

      const stats = computePlatformCardStats(tips, [], 'BongaCams', 31, {}, [])

      // ~1000+ days → multiplier 1.3x → ~76% progress
      expect(stats.importProgress).toBeGreaterThanOrEqual(76)
      expect(stats.importMissing).toBeGreaterThan(0)
    })
  })

  describe('Data integrity checks', () => {
    test('lifetime USD precision is 2 decimals', () => {
      const tips = [
        { platform: 'BongaCams', date_time: '2026-01-01T10:00:00Z', usd: 99.995, tokens: 2000, username: 'u1' },
        { platform: 'BongaCams', date_time: '2026-01-02T10:00:00Z', usd: 0.005, tokens: 100, username: 'u2' },
      ]

      const stats = computePlatformCardStats(tips, [], 'BongaCams', 31, {}, [])

      expect(stats.lifetimeUSD).toBe(100.00)
      expect(Number.isInteger(stats.lifetimeUSD * 100)).toBe(true) // 2 decimals
    })

    test('no double-counting tips and paid sessions in lifetime', () => {
      const tips = [{ platform: 'BongaCams', date_time: '2026-01-01T10:00:00Z', usd: 100, tokens: 2000, username: 'u1' }]
      const paidSessions = [{ platform: 'BongaCams', date_time: '2026-01-02T10:00:00Z', usd: 50, tokens: 1000, session_type: 'Private' }]

      const stats = computePlatformCardStats(tips, [], 'BongaCams', 31, {}, paidSessions)

      // Must be exactly 100 + 50 = 150, not more
      expect(stats.lifetimeUSD).toBe(150)
    })

    test('platform filter prevents cross-platform lifetime leakage', () => {
      const tips = [
        { platform: 'BongaCams', date_time: '2026-01-01T10:00:00Z', usd: 1000, tokens: 20000, username: 'u1' },
        { platform: 'Chaturbate', date_time: '2026-01-01T10:00:00Z', usd: 2000, tokens: 40000, username: 'u2' },
      ]

      const stats = computePlatformCardStats(tips, [], 'BongaCams', 31, {}, [])

      // Should only count BongaCams
      expect(stats.lifetimeUSD).toBe(1000)
      expect(stats.lifetimeUSD).not.toBe(3000)
    })
  })
})
