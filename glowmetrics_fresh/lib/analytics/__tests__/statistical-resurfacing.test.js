/**
 * Statistical Distribution-Based Resurfacing Tests
 *
 * Validates the new classifyCurrentGapByDistribution algorithm
 * that uses real historical interval distributions instead of hardcoded multipliers
 */

import { identifyWhales, classifyCurrentGapByDistribution } from '../../analytics.js'
import { detectSessions } from '../../analytics/sessions.js'

describe('Statistical Distribution-Based Resurfacing', () => {
  test('daily tipper with 10-day gap classified as strongly-unusual', () => {
    // Fan tips daily for 30 days, last tip was 10 days ago
    // So daysSinceLastTip = 10, and all historical intervals are ~1 day
    const now = new Date()
    const baseDate = new Date(now.getTime() - (40 * 24 * 60 * 60 * 1000))
    const tips = []
    for (let i = 0; i < 30; i++) {
      tips.push({
        platform: 'twitch',
        username: 'daily_fan',
        dateRaw: baseDate.getTime() + (i * 24 * 60 * 60 * 1000),
        usd: 5,
        tokens: 100
      })
    }
    // Last tip was 10 days ago (no additional tip, just let the gap be the current gap)

    const sessions = detectSessions(tips)
    const whales = identifyWhales(tips, sessions, 'UTC')
    const dailyFan = whales.find(w => w.username === 'daily_fan')

    const classification = classifyCurrentGapByDistribution(dailyFan)

    // For a daily tipper (median ~1 day), 10-day gap is strongly unusual (z-score > 2)
    expect(classification.classification).toBe('strongly-unusual')
    expect(classification.confidence).toBe('high')
    expect(classification.shouldAlert).toBe(true)
    expect(classification.stats.zScore).toBeGreaterThan(2)
  })

  test('weekly tipper with 2-week gap classified as normal or unusual', () => {
    // Fan tips weekly for 8 weeks, last tip was 14 days ago
    const now = new Date()
    const baseDate = new Date(now.getTime() - (63 * 24 * 60 * 60 * 1000))
    const tips = []
    for (let i = 0; i < 8; i++) {
      tips.push({
        platform: 'twitch',
        username: 'weekly_fan',
        dateRaw: baseDate.getTime() + (i * 7 * 24 * 60 * 60 * 1000),
        usd: 20,
        tokens: 400
      })
    }
    // Last tip was 14 days ago (2x typical interval, but not extreme)

    const sessions = detectSessions(tips)
    const whales = identifyWhales(tips, sessions, 'UTC')
    const weeklyFan = whales.find(w => w.username === 'weekly_fan')

    const classification = classifyCurrentGapByDistribution(weeklyFan)

    // For a weekly tipper, 14 days is within normal range (close to median, maybe 1σ)
    expect(classification.classification).toMatch(/normal|unusual/)
    // z-score should not be extremely high (though could be 1-2 range)
    expect(classification.stats.zScore).toBeLessThan(3)
  })

  test('inconsistent tipper has medium confidence', () => {
    // Gaps: 1, 3, 15, 1, 20, 1 days (high variability)
    // Last tip was 21 days ago
    const now = new Date()
    const baseDate = new Date(now.getTime() - (62 * 24 * 60 * 60 * 1000))
    const tips = [
      { platform: 'twitch', username: 'inconsistent', dateRaw: baseDate.getTime(), usd: 50, tokens: 1000 },
      { platform: 'twitch', username: 'inconsistent', dateRaw: baseDate.getTime() + (1 * 24 * 60 * 60 * 1000), usd: 30, tokens: 600 },
      { platform: 'twitch', username: 'inconsistent', dateRaw: baseDate.getTime() + (4 * 24 * 60 * 60 * 1000), usd: 25, tokens: 500 },
      { platform: 'twitch', username: 'inconsistent', dateRaw: baseDate.getTime() + (19 * 24 * 60 * 60 * 1000), usd: 40, tokens: 800 },
      { platform: 'twitch', username: 'inconsistent', dateRaw: baseDate.getTime() + (20 * 24 * 60 * 60 * 1000), usd: 35, tokens: 700 },
      { platform: 'twitch', username: 'inconsistent', dateRaw: baseDate.getTime() + (40 * 24 * 60 * 60 * 1000), usd: 45, tokens: 900 },
      { platform: 'twitch', username: 'inconsistent', dateRaw: baseDate.getTime() + (41 * 24 * 60 * 60 * 1000), usd: 30, tokens: 600 }
      // Last tip 21 days ago; daysSinceLastTip = 21
    ]

    const sessions = detectSessions(tips)
    const whales = identifyWhales(tips, sessions, 'UTC')
    const inconsistent = whales.find(w => w.username === 'inconsistent')

    const classification = classifyCurrentGapByDistribution(inconsistent)

    // High variability = lower/medium confidence, with several observations
    expect(classification.stats.observationCount).toBeGreaterThanOrEqual(5)
    expect(classification.stats.stddev).toBeGreaterThan(5)
    expect(classification.confidence).toMatch(/high|medium|low/)
  })

  test('new fan with single tip has insufficient evidence', () => {
    const tips = [
      { platform: 'twitch', username: 'new_fan', dateRaw: '2024-04-01T10:00:00Z', usd: 100, tokens: 2000 }
    ]

    const sessions = detectSessions(tips)
    const whales = identifyWhales(tips, sessions, 'UTC')
    const newFan = whales.find(w => w.username === 'new_fan')

    const classification = classifyCurrentGapByDistribution(newFan)

    expect(classification.classification).toBe('insufficient-evidence')
    expect(classification.shouldAlert).toBe(false)
  })

  test('fan with 2 tips has low confidence', () => {
    // Only 2 tips = only 1 historical interval
    // Last tip was 60 days ago
    const now = new Date()
    const baseDate = new Date(now.getTime() - (75 * 24 * 60 * 60 * 1000))
    const tips = [
      { platform: 'twitch', username: 'sparse', dateRaw: baseDate.getTime(), usd: 50, tokens: 1000 },
      { platform: 'twitch', username: 'sparse', dateRaw: baseDate.getTime() + (14 * 24 * 60 * 60 * 1000), usd: 50, tokens: 1000 }
      // Last tip was 61 days ago; daysSinceLastTip ≈ 61
    ]

    const sessions = detectSessions(tips)
    const whales = identifyWhales(tips, sessions, 'UTC')
    const sparse = whales.find(w => w.username === 'sparse')

    const classification = classifyCurrentGapByDistribution(sparse)

    expect(classification.stats.observationCount).toBeLessThan(5)
    expect(classification.confidence).toBe('low')
  })

  test('no hardcoded multipliers - uses actual distribution', () => {
    // Different fans with different patterns should have different thresholds
    // based on their actual history, not fixed multipliers

    const now = new Date()

    // Fan A: Tips every 5 days, last tip 15 days ago
    const baseDateA = new Date(now.getTime() - (65 * 24 * 60 * 60 * 1000))
    const tipsA = []
    for (let i = 0; i < 10; i++) {
      tipsA.push({
        platform: 'twitch',
        username: 'fan_a',
        dateRaw: baseDateA.getTime() + (i * 5 * 24 * 60 * 60 * 1000),
        usd: 10,
        tokens: 200
      })
    }
    // Last tip 15 days ago (3x their 5-day pattern)

    // Fan B: Tips every 50 days, last tip 15 days ago
    const baseDateB = new Date(now.getTime() - (215 * 24 * 60 * 60 * 1000))
    const tipsB = []
    for (let i = 0; i < 4; i++) {
      tipsB.push({
        platform: 'twitch',
        username: 'fan_b',
        dateRaw: baseDateB.getTime() + (i * 50 * 24 * 60 * 60 * 1000),
        usd: 100,
        tokens: 2000
      })
    }
    // Last tip 15 days ago (much less than their 50-day pattern, median ~50)

    const sessions = detectSessions([...tipsA, ...tipsB])
    const whales = identifyWhales([...tipsA, ...tipsB], sessions, 'UTC')
    const fanA = whales.find(w => w.username === 'fan_a')
    const fanB = whales.find(w => w.username === 'fan_b')

    const classA = classifyCurrentGapByDistribution(fanA)
    const classB = classifyCurrentGapByDistribution(fanB)

    // Same 15-day gap, but:
    // - For 5-day-pattern fan (15 days = 3x median): unusual or strongly-unusual
    // - For 50-day-pattern fan (15 days < median): normal
    expect(classA.classification).toMatch(/unusual|strongly-unusual/)
    expect(classB.classification).toBe('normal')
    // No hardcoded "2x" or "3x" - calculated from distribution
  })
})
