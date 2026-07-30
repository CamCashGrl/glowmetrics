import { describe, it, expect } from 'vitest'
import { resolvePriceMap, isAnnualConfigured, missingAnnualEnvVars } from '../lib/stripePriceConfig'

const FULL_ENV = {
  STRIPE_PRICE_EARLY_ADOPTER_MONTHLY: 'price_early_monthly',
  STRIPE_PRICE_EARLY_ADOPTER_ANNUAL: 'price_early_annual',
  STRIPE_MONTHLY_PRICE_ID: 'price_standard_monthly',
  STRIPE_PRICE_STANDARD_ANNUAL: 'price_standard_annual',
}

describe('resolvePriceMap', () => {
  it('resolves monthly and annual when both are configured', () => {
    const map = resolvePriceMap(FULL_ENV)
    expect(map.standard_monthly.value).toBe('price_standard_monthly')
    expect(map.standard_annual.value).toBe('price_standard_annual')
    expect(map.early_adopter_monthly.value).toBe('price_early_monthly')
  })

  it('prefers the canonical annual env var over legacy fallbacks', () => {
    const map = resolvePriceMap({
      ...FULL_ENV,
      STRIPE_YEARLY_PRICE_ID: 'price_legacy_yearly',
    })
    expect(map.standard_annual.value).toBe('price_standard_annual')
  })

  it('falls back to legacy annual env vars when the canonical one is absent', () => {
    const { STRIPE_PRICE_STANDARD_ANNUAL, ...envWithoutCanonical } = FULL_ENV
    const map = resolvePriceMap({
      ...envWithoutCanonical,
      STRIPE_YEARLY_PRICE_ID: 'price_legacy_yearly',
    })
    expect(map.standard_annual.value).toBe('price_legacy_yearly')
  })

  it('returns null for annual when no env var is set at all (this repo\'s real gap today)', () => {
    const { STRIPE_PRICE_STANDARD_ANNUAL, ...envWithoutAnnual } = FULL_ENV
    const map = resolvePriceMap(envWithoutAnnual)
    expect(map.standard_annual.value).toBeNull()
  })

  it('ignores a non-price-looking value', () => {
    const map = resolvePriceMap({ ...FULL_ENV, STRIPE_PRICE_STANDARD_ANNUAL: 'not-a-price-id' })
    expect(map.standard_annual.value).toBeNull()
  })
})

describe('isAnnualConfigured', () => {
  it('is true when an annual price is set', () => {
    expect(isAnnualConfigured(FULL_ENV)).toBe(true)
  })

  it('is false when no annual price env var is set', () => {
    const { STRIPE_PRICE_STANDARD_ANNUAL, ...envWithoutAnnual } = FULL_ENV
    expect(isAnnualConfigured(envWithoutAnnual)).toBe(false)
  })
})

describe('missingAnnualEnvVars', () => {
  it('lists every unset annual env var name for diagnostics', () => {
    const missing = missingAnnualEnvVars({})
    expect(missing).toContain('STRIPE_PRICE_STANDARD_ANNUAL')
    expect(missing.length).toBeGreaterThan(0)
  })

  it('excludes env vars that are set', () => {
    const missing = missingAnnualEnvVars({ STRIPE_PRICE_STANDARD_ANNUAL: 'price_x' })
    expect(missing).not.toContain('STRIPE_PRICE_STANDARD_ANNUAL')
  })
})
