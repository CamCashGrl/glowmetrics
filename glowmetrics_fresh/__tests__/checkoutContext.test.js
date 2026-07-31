import { describe, it, expect } from 'vitest'
import {
  sanitizeCheckoutContext,
  contextToMetadata,
  metadataToContext,
  resolveGateConfig,
  GATE_CONFIG,
} from '../lib/checkoutContext'

describe('sanitizeCheckoutContext', () => {
  it('keeps only allowlisted keys', () => {
    const out = sanitizeCheckoutContext({
      gateSource: 'whales_empty',
      returnPath: 'whales',
      notAllowed: 'drop me',
      secretKey: 'sk_live_xxx',
    })
    expect(out).toEqual({ gateSource: 'whales_empty', returnPath: 'whales' })
  })

  it('drops non-string values', () => {
    const out = sanitizeCheckoutContext({ gateSource: 123, importId: { a: 1 } })
    expect(out).toEqual({})
  })

  it('drops values over the length cap', () => {
    const out = sanitizeCheckoutContext({ featureName: 'x'.repeat(500) })
    expect(out).toEqual({})
  })

  it('drops an empty/whitespace-only value', () => {
    const out = sanitizeCheckoutContext({ gateSource: '   ' })
    expect(out).toEqual({})
  })

  it('only allows returnPath to be one of the known dashboard tabs', () => {
    const good = sanitizeCheckoutContext({ returnPath: 'whales' })
    const bad = sanitizeCheckoutContext({ returnPath: 'https://evil.example.com' })
    expect(good).toEqual({ returnPath: 'whales' })
    expect(bad).toEqual({})
  })

  it('returns {} for null/non-object input', () => {
    expect(sanitizeCheckoutContext(null)).toEqual({})
    expect(sanitizeCheckoutContext(undefined)).toEqual({})
    expect(sanitizeCheckoutContext('nope')).toEqual({})
  })

  it('never keeps a raw-CSV-shaped or sensitive-looking free-text field', () => {
    // fanId is allowed, but only as a short identifier — this documents
    // that arbitrary large blobs (e.g. someone passing CSV text as fanId)
    // still get capped by the length check, not treated as safe.
    const out = sanitizeCheckoutContext({ fanId: 'date_time,username,tokens\n'.repeat(50) })
    expect(out.fanId).toBeUndefined()
  })
})

describe('contextToMetadata / metadataToContext round-trip', () => {
  it('round-trips a full valid context through Stripe metadata shape', () => {
    const context = {
      gateSource: 'whales_empty',
      featureName: 'fan_intelligence',
      returnPath: 'whales',
      platform: 'Chaturbate',
      importId: 'imp_123',
      fanId: 'user1::Chaturbate',
      liveSessionId: 'live_1',
    }
    const metadata = contextToMetadata(context)
    expect(metadata).toEqual({
      ctx_gateSource: 'whales_empty',
      ctx_featureName: 'fan_intelligence',
      ctx_returnPath: 'whales',
      ctx_platform: 'Chaturbate',
      ctx_importId: 'imp_123',
      ctx_fanId: 'user1::Chaturbate',
      ctx_liveSessionId: 'live_1',
    })
    expect(metadataToContext(metadata)).toEqual(context)
  })

  it('metadataToContext ignores unrelated metadata keys (userId, plan_type)', () => {
    const context = metadataToContext({ userId: 'user-1', plan_type: 'standard_monthly', ctx_gateSource: 'moneymap' })
    expect(context).toEqual({ gateSource: 'moneymap' })
  })

  it('metadataToContext handles missing/undefined metadata safely', () => {
    expect(metadataToContext(undefined)).toEqual({})
    expect(metadataToContext(null)).toEqual({})
  })
})

describe('resolveGateConfig', () => {
  it('resolves a known gate', () => {
    expect(resolveGateConfig('moneymap')).toEqual(GATE_CONFIG.moneymap)
  })

  it('falls back to pricing_page for an unknown gate', () => {
    expect(resolveGateConfig('made_up_gate')).toEqual(GATE_CONFIG.pricing_page)
    expect(resolveGateConfig(undefined)).toEqual(GATE_CONFIG.pricing_page)
  })
})
