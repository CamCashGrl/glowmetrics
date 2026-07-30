import { describe, it, expect } from 'vitest'
import { isProPlan } from '../lib/plan'

describe('isProPlan', () => {
  it('treats "pro" as pro', () => {
    expect(isProPlan('pro')).toBe(true)
  })

  it('treats "unlimited" as pro', () => {
    expect(isProPlan('unlimited')).toBe(true)
  })

  it('treats "free" as not pro', () => {
    expect(isProPlan('free')).toBe(false)
  })

  it('treats null/undefined plan as not pro', () => {
    expect(isProPlan(null)).toBe(false)
    expect(isProPlan(undefined)).toBe(false)
  })

  it('treats an unrecognized plan value as not pro', () => {
    expect(isProPlan('past_due')).toBe(false)
    expect(isProPlan('canceled')).toBe(false)
  })
})
