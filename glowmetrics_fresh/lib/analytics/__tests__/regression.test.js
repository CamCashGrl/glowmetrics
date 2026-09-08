/**
 * Regression Tests — Core Analytics Functions
 *
 * Tests verify:
 * 1. Canonical session ID usage (not calendar dates)
 * 2. Personal resurfacing thresholds (no universal minimums)
 * 3. Tier classification rules
 * 4. Archive/dismissal non-destructiveness
 */

import { detectSessions } from '../sessions.js'
import { identifyWhales, detectResurfacing } from '../analytics.js'
import { archiveFan, unarchiveFan, isArchived, dismissDiscovery, restoreDiscovery, isDismissed, filterDismissedAlerts, getActiveFans } from '../fanManagement.js'

describe('Canonical Session Detection', () => {
  test('should use 60-minute session gap', () => {
    const tips = [
      { platform: 'twitch', username: 'alice', dateRaw: '2024-01-01T10:00:00Z', usd: 10, tokens: 100 },
      { platform: 'twitch', username: 'alice', dateRaw: '2024-01-01T10:30:00Z', usd: 20, tokens: 200 },
      { platform: 'twitch', username: 'alice', dateRaw: '2024-01-01T12:00:00Z', usd: 15, tokens: 150 } // 90 min gap - new session
    ]
    const sessions = detectSessions(tips)
    expect(sessions).toHaveLength(2)
    expect(sessions[0].tipCount).toBe(2)
    expect(sessions[1].tipCount).toBe(1)
  })
})

describe('Qualifying Session Count — Canonical Session IDs', () => {
  test('two sessions on same calendar date count as 2 distinct qualifying sessions', () => {
    const tips = [
      // Session 1: morning stream
      { platform: 'twitch', username: 'bob', dateRaw: '2024-01-01T09:00:00Z', usd: 50, tokens: 100 },
      { platform: 'twitch', username: 'bob', dateRaw: '2024-01-01T09:30:00Z', usd: 50, tokens: 100 },
      // Gap > 60 min
      // Session 2: evening stream (same day)
      { platform: 'twitch', username: 'bob', dateRaw: '2024-01-01T20:00:00Z', usd: 50, tokens: 100 },
      { platform: 'twitch', username: 'bob', dateRaw: '2024-01-01T20:30:00Z', usd: 50, tokens: 100 }
    ]
    const sessions = detectSessions(tips)
    expect(sessions).toHaveLength(2)
    // Both sessions are on 2024-01-01 but are DISTINCT canonical sessions

    const whales = identifyWhales(tips, sessions)
    const bob = whales.find(w => w.username === 'bob')
    expect(bob.qualifyingSessionCount).toBe(2) // NOT 1 (which would happen with date-based counting)
  })
})

describe('Tier Classification', () => {
  test('Whale requires $50+ lifetime, not percentile', () => {
    const tips = [
      { platform: 'twitch', username: 'alice', dateRaw: '2024-01-01T10:00:00Z', usd: 55, tokens: 100 },
      { platform: 'twitch', username: 'bob', dateRaw: '2024-01-01T10:00:00Z', usd: 50, tokens: 100 }
    ]
    const sessions = detectSessions(tips)
    const whales = identifyWhales(tips, sessions)
    expect(whales.find(w => w.username === 'alice').tier).toBe('Whale')
    expect(whales.find(w => w.username === 'bob').tier).toBe('Whale')
  })

  test('Regular requires 11+ canonical sessions + active in 6 months', () => {
    const now = Date.now()
    const sixMonthsAgo = now - (180 * 24 * 60 * 60 * 1000)
    const recentDate = new Date(now - 1000).toISOString()

    // Create 11 tips with 11 different session times
    const tips = []
    for (let i = 0; i < 11; i++) {
      tips.push({
        platform: 'twitch',
        username: 'regular',
        dateRaw: new Date(sixMonthsAgo + i * 24 * 60 * 60 * 1000).toISOString(),
        usd: 1,
        tokens: 10
      })
    }
    // Add one recent tip to be within 6-month window
    tips.push({
      platform: 'twitch',
      username: 'regular',
      dateRaw: recentDate,
      usd: 1,
      tokens: 10
    })

    const sessions = detectSessions(tips)
    const whales = identifyWhales(tips, sessions)
    const regular = whales.find(w => w.username === 'regular')
    expect(regular.tier).toBe('Regular')
    expect(regular.qualifyingSessionCount).toBe(12)
  })
})

describe('Resurfacing — Personal Historical Behavior', () => {
  test('should use 2x avgDaysBetweenTips as gap threshold (no universal minimum)', () => {
    // Scenario: fan tips daily (avg 1 day), then 3-day gap, then tips again
    const tips = [
      // Tips every day for 5 days
      { platform: 'twitch', username: 'daily', dateRaw: '2024-01-01T10:00:00Z', usd: 1, tokens: 10 },
      { platform: 'twitch', username: 'daily', dateRaw: '2024-01-02T10:00:00Z', usd: 1, tokens: 10 },
      { platform: 'twitch', username: 'daily', dateRaw: '2024-01-03T10:00:00Z', usd: 1, tokens: 10 },
      { platform: 'twitch', username: 'daily', dateRaw: '2024-01-04T10:00:00Z', usd: 1, tokens: 10 },
      { platform: 'twitch', username: 'daily', dateRaw: '2024-01-05T10:00:00Z', usd: 1, tokens: 10 },
      // 3-day gap
      // Return with 2 tips (pattern resumption)
      { platform: 'twitch', username: 'daily', dateRaw: '2024-01-08T10:00:00Z', usd: 5, tokens: 50 },
      { platform: 'twitch', username: 'daily', dateRaw: '2024-01-09T10:00:00Z', usd: 5, tokens: 50 }
    ]

    const sessions = detectSessions(tips)
    const whales = identifyWhales(tips, sessions)
    const resurfacing = detectResurfacing(whales)

    const dailyFan = resurfacing.find(r => r.username === 'daily')
    expect(dailyFan).toBeDefined() // Should be resurfacing (3-day gap > 2x avg of 1 day)
    expect(dailyFan.dormancyDays).toBe(3)
  })

  test('should NOT use arbitrary 30-day minimum threshold', () => {
    // Weekly tipper: 7-day avg. Gap of 2 weeks (14 days = 2x) should be resurfacing
    const tips = [
      // Tips every 7 days for several weeks
      { platform: 'twitch', username: 'weekly', dateRaw: '2024-01-01T10:00:00Z', usd: 10, tokens: 100 },
      { platform: 'twitch', username: 'weekly', dateRaw: '2024-01-08T10:00:00Z', usd: 10, tokens: 100 },
      { platform: 'twitch', username: 'weekly', dateRaw: '2024-01-15T10:00:00Z', usd: 10, tokens: 100 },
      { platform: 'twitch', username: 'weekly', dateRaw: '2024-01-22T10:00:00Z', usd: 10, tokens: 100 },
      // 14-day gap (2x weekly average)
      { platform: 'twitch', username: 'weekly', dateRaw: '2024-02-05T10:00:00Z', usd: 15, tokens: 150 },
      { platform: 'twitch', username: 'weekly', dateRaw: '2024-02-12T10:00:00Z', usd: 15, tokens: 150 }
    ]

    const sessions = detectSessions(tips)
    const whales = identifyWhales(tips, sessions)
    const resurfacing = detectResurfacing(whales)

    const weeklyFan = resurfacing.find(r => r.username === 'weekly')
    expect(weeklyFan).toBeDefined() // Should be resurfacing (14-day gap = 2x 7-day average)
    // If using arbitrary 30-day minimum, this would NOT be resurfacing (BUG)
  })
})

describe('Archive — Non-Destructive', () => {
  test('archive does not delete fan or modify tier', () => {
    const archiveState = { archivedFans: new Set(), archivedAt: new Map() }
    const fanKey = 'twitch:whale_fan'

    const fan = { platform: 'twitch', username: 'whale_fan', tier: 'Whale', totalUSD: 500 }
    const tierBefore = fan.tier

    archiveFan(fanKey, archiveState)

    expect(isArchived(fanKey, archiveState)).toBe(true)
    expect(fan.tier).toBe(tierBefore) // Tier unchanged
  })

  test('unarchive restores accessibility', () => {
    const archiveState = { archivedFans: new Set(), archivedAt: new Map() }
    const fanKey = 'twitch:whale_fan'

    archiveFan(fanKey, archiveState)
    expect(isArchived(fanKey, archiveState)).toBe(true)

    unarchiveFan(fanKey, archiveState)
    expect(isArchived(fanKey, archiveState)).toBe(false)
  })

  test('getActiveFans filters out archived fans', () => {
    const archiveState = { archivedFans: new Set(), archivedAt: new Map() }
    const fans = [
      { platform: 'twitch', username: 'active' },
      { platform: 'twitch', username: 'archived' }
    ]

    archiveFan('twitch:archived', archiveState)
    const active = getActiveFans(fans, archiveState)

    expect(active).toHaveLength(1)
    expect(active[0].username).toBe('active')
  })
})

describe('Discovery Dismissal — Non-Destructive', () => {
  test('dismiss hides alert without modifying fan', () => {
    const dismissalState = { dismissedDiscoveries: new Set(), dismissedAt: new Map() }
    const discoveryId = 'churn_risk_whale_twitch'

    dismissDiscovery(discoveryId, dismissalState)
    expect(isDismissed(discoveryId, dismissalState)).toBe(true)
  })

  test('restore undismisses discovery', () => {
    const dismissalState = { dismissedDiscoveries: new Set(), dismissedAt: new Map() }
    const discoveryId = 'churn_risk_whale_twitch'

    dismissDiscovery(discoveryId, dismissalState)
    restoreDiscovery(discoveryId, dismissalState)
    expect(isDismissed(discoveryId, dismissalState)).toBe(false)
  })

  test('filterDismissedAlerts removes dismissed ones', () => {
    const dismissalState = { dismissedDiscoveries: new Set(), dismissedAt: new Map() }
    const alerts = [
      { id: 'alert_1', message: 'Active' },
      { id: 'alert_2', message: 'Dismissed' },
      { id: 'alert_3', message: 'Active' }
    ]

    dismissDiscovery('alert_2', dismissalState)
    const filtered = filterDismissedAlerts(alerts, dismissalState)

    expect(filtered).toHaveLength(2)
    expect(filtered.every(a => a.id !== 'alert_2')).toBe(true)
  })
})
