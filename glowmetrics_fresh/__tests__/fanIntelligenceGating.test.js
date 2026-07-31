import { describe, it, expect } from 'vitest'
import {
  shouldShowFanUpgradeGate,
  shouldShowFanDataNotice,
  pickAtRiskWhale,
  additionalFanCount,
} from '../lib/fanIntelligenceGating'

describe('shouldShowFanUpgradeGate', () => {
  it('shows the upgrade gate for a free user with 3 or fewer visible fans', () => {
    expect(shouldShowFanUpgradeGate(3, false)).toBe(true)
    expect(shouldShowFanUpgradeGate(0, false)).toBe(true)
  })

  it('hides the upgrade gate for a free user with more than 3 fans (shouldn\'t happen, but never a payment prompt above the free cap)', () => {
    expect(shouldShowFanUpgradeGate(5, false)).toBe(false)
  })

  it('never shows the upgrade gate for a Pro user, regardless of fan count', () => {
    expect(shouldShowFanUpgradeGate(0, true)).toBe(false)
    expect(shouldShowFanUpgradeGate(3, true)).toBe(false)
    expect(shouldShowFanUpgradeGate(5, true)).toBe(false)
  })
})

describe('shouldShowFanDataNotice', () => {
  it('shows a neutral data notice for a Pro user with zero fans', () => {
    expect(shouldShowFanDataNotice(0, true)).toBe(true)
  })

  it('does not show the data notice once a Pro user has any fans', () => {
    expect(shouldShowFanDataNotice(1, true)).toBe(false)
  })

  it('never shows the data notice for a free user (they get the upgrade gate instead)', () => {
    expect(shouldShowFanDataNotice(0, false)).toBe(false)
  })
})

describe('pickAtRiskWhale', () => {
  const whales = [
    { username: 'a', totalUSD: 120, daysSinceLastTip: 19, churnRisk: { level: 'High' } },
    { username: 'b', totalUSD: 428, daysSinceLastTip: 19, churnRisk: { level: 'Critical' } },
    { username: 'c', totalUSD: 50, daysSinceLastTip: 2, churnRisk: { level: 'Low' } },
  ]

  it('picks the highest-spend at-risk fan for a free user', () => {
    const result = pickAtRiskWhale(whales, false)
    expect(result.username).toBe('b')
  })

  it('returns null for a Pro user — they already see everything, no tease needed', () => {
    expect(pickAtRiskWhale(whales, true)).toBeNull()
  })

  it('returns null when no fan meets the churn-risk + real-spend bar (never fabricates one)', () => {
    const noRisk = [{ username: 'c', totalUSD: 50, daysSinceLastTip: 2, churnRisk: { level: 'Low' } }]
    expect(pickAtRiskWhale(noRisk, false)).toBeNull()
  })

  it('excludes an at-risk fan with no real spend or unknown days-since-tip', () => {
    const bad = [
      { username: 'd', totalUSD: 0, daysSinceLastTip: 19, churnRisk: { level: 'Critical' } },
      { username: 'e', totalUSD: 200, daysSinceLastTip: NaN, churnRisk: { level: 'Critical' } },
    ]
    expect(pickAtRiskWhale(bad, false)).toBeNull()
  })

  it('handles an empty fan list', () => {
    expect(pickAtRiskWhale([], false)).toBeNull()
  })
})

describe('additionalFanCount', () => {
  it('computes how many fans are beyond the free-visible count', () => {
    expect(additionalFanCount(10)).toBe(7)
  })

  it('never returns a negative count', () => {
    expect(additionalFanCount(1)).toBe(0)
    expect(additionalFanCount(0)).toBe(0)
  })

  it('respects a custom free-visible count', () => {
    expect(additionalFanCount(10, 5)).toBe(5)
  })
})
