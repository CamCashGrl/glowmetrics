import { describe, it, expect } from 'vitest'
import { categoryForAlertKey, buildCoachingEventFields } from '../coachingCategory'
import { COACHING_CATEGORIES } from '../constants'

describe('categoryForAlertKey', () => {
  it('maps every known live-alert key to a valid, extensible category', () => {
    const keys = ['dead_air_critical', 'dead_air_high', 'goal_push', 'goal_hit', 'pace_below', 'pace_above', 'stream_fatigue', 'whale_prox_Alex', 'whale_dep_Alex']
    keys.forEach(key => {
      expect(COACHING_CATEGORIES).toContain(categoryForAlertKey(key))
    })
  })

  it('maps returning-tipper-pattern alerts to returning_supporter', () => {
    expect(categoryForAlertKey('whale_prox_Alex')).toBe('returning_supporter')
  })
})

describe('buildCoachingEventFields', () => {
  it('carries related supporter/amount data through for storage', () => {
    const fields = buildCoachingEventFields({
      key: 'whale_dep_Alex',
      priority: 4,
      text: 'Alex is 45% of revenue',
      context: 'Alex is 45% of your session revenue',
      action: 'Give them personal attention',
      relatedTipperName: 'Alex',
      relatedAmountUsd: 30,
    })
    expect(fields.category).toBe('supporter_engagement')
    expect(fields.dedupeKey).toBe('whale_dep_Alex')
    expect(fields.relatedTipperName).toBe('Alex')
    expect(fields.relatedAmountUsd).toBe(30)
    expect(fields.compactMessage).toBe('Alex is 45% of revenue')
  })
})
