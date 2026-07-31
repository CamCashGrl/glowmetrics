import { describe, it, expect } from 'vitest'
import {
  billingStatusFromSubscriptionStatus,
  billingIntervalFromSubscription,
  currentPeriodEndFromSubscription,
  isEarlyAdopterFromMetadata,
  deriveBillingFields,
} from '../lib/stripeBillingStatus'

describe('billingStatusFromSubscriptionStatus', () => {
  it('maps active/trialing to ok', () => {
    expect(billingStatusFromSubscriptionStatus('active')).toBe('ok')
    expect(billingStatusFromSubscriptionStatus('trialing')).toBe('ok')
  })

  it('passes through past_due/unpaid/canceled as-is', () => {
    expect(billingStatusFromSubscriptionStatus('past_due')).toBe('past_due')
    expect(billingStatusFromSubscriptionStatus('unpaid')).toBe('unpaid')
    expect(billingStatusFromSubscriptionStatus('canceled')).toBe('canceled')
  })

  it('maps incomplete_expired to incomplete', () => {
    expect(billingStatusFromSubscriptionStatus('incomplete_expired')).toBe('incomplete')
  })

  it('treats an unrecognized Stripe status as ok rather than inventing an alarming state', () => {
    expect(billingStatusFromSubscriptionStatus('some_future_stripe_status')).toBe('ok')
    expect(billingStatusFromSubscriptionStatus(undefined)).toBe('ok')
  })
})

describe('billingIntervalFromSubscription', () => {
  it('reads the recurring interval off the first price item', () => {
    const sub = { items: { data: [{ price: { recurring: { interval: 'year' } } }] } }
    expect(billingIntervalFromSubscription(sub)).toBe('year')
  })

  it('returns null when absent', () => {
    expect(billingIntervalFromSubscription({})).toBeNull()
    expect(billingIntervalFromSubscription(null)).toBeNull()
  })
})

describe('currentPeriodEndFromSubscription', () => {
  it('converts a unix timestamp to ISO', () => {
    const sub = { current_period_end: 1735689600 }
    expect(currentPeriodEndFromSubscription(sub)).toBe(new Date(1735689600 * 1000).toISOString())
  })

  it('returns null when missing', () => {
    expect(currentPeriodEndFromSubscription({})).toBeNull()
  })
})

describe('isEarlyAdopterFromMetadata', () => {
  it('is true for early_adopter_* plan types', () => {
    expect(isEarlyAdopterFromMetadata({ plan_type: 'early_adopter_monthly' })).toBe(true)
    expect(isEarlyAdopterFromMetadata({ plan_type: 'early_adopter_annual' })).toBe(true)
  })

  it('is false for standard plans or missing metadata', () => {
    expect(isEarlyAdopterFromMetadata({ plan_type: 'standard_monthly' })).toBe(false)
    expect(isEarlyAdopterFromMetadata({})).toBe(false)
    expect(isEarlyAdopterFromMetadata(undefined)).toBe(false)
  })
})

describe('deriveBillingFields', () => {
  it('assembles all four fields from a subscription object', () => {
    const sub = {
      status: 'active',
      current_period_end: 1735689600,
      items: { data: [{ price: { recurring: { interval: 'month' } } }] },
      metadata: { plan_type: 'early_adopter_monthly' },
    }
    expect(deriveBillingFields(sub)).toEqual({
      billing_status: 'ok',
      billing_interval: 'month',
      current_period_end: new Date(1735689600 * 1000).toISOString(),
      is_early_adopter: true,
    })
  })

  it('reflects a past_due subscription accurately', () => {
    const sub = { status: 'past_due', items: { data: [] }, metadata: {} }
    const fields = deriveBillingFields(sub)
    expect(fields.billing_status).toBe('past_due')
    expect(fields.is_early_adopter).toBe(false)
  })
})
