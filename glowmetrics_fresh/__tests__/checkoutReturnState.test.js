import { describe, it, expect } from 'vitest'
import { parseCheckoutReturnParams, hasCheckoutReturnParams } from '../lib/checkoutReturnState'

describe('parseCheckoutReturnParams', () => {
  it('parses a successful return with session id', () => {
    const result = parseCheckoutReturnParams('?success=true&plan=standard_monthly&session_id=cs_test_123')
    expect(result).toEqual({ success: true, canceled: false, planType: 'standard_monthly', sessionId: 'cs_test_123' })
  })

  it('parses a canceled return', () => {
    const result = parseCheckoutReturnParams('?canceled=true')
    expect(result).toEqual({ success: false, canceled: true, planType: null, sessionId: null })
  })

  it('parses an ordinary dashboard visit with no checkout params', () => {
    const result = parseCheckoutReturnParams('?tab=whales')
    expect(result).toEqual({ success: false, canceled: false, planType: null, sessionId: null })
  })

  it('treats success as false unless the value is exactly "true"', () => {
    expect(parseCheckoutReturnParams('?success=1').success).toBe(false)
    expect(parseCheckoutReturnParams('?success=yes').success).toBe(false)
  })
})

describe('hasCheckoutReturnParams', () => {
  it('is true for success or canceled', () => {
    expect(hasCheckoutReturnParams('?success=true')).toBe(true)
    expect(hasCheckoutReturnParams('?canceled=true')).toBe(true)
  })

  it('is false otherwise', () => {
    expect(hasCheckoutReturnParams('?tab=overview')).toBe(false)
    expect(hasCheckoutReturnParams('')).toBe(false)
  })
})
