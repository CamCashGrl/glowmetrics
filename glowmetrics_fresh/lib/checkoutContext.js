// Safe, allowlisted "why did this user start checkout" context, carried
// through Stripe as metadata (a trustworthy, server-backed channel — not
// just client state that could be lost on redirect) so the dashboard can
// return the user to the feature that triggered the upgrade once their
// plan actually activates.
//
// Deliberately excludes anything that could be sensitive or unbounded:
// no raw CSV, no tip messages, no arbitrary strings. Every value is a
// short identifier, capped in length, and only known keys are kept.

export const ALLOWED_CONTEXT_KEYS = [
  'gateSource',
  'featureName',
  'returnPath',
  'platform',
  'importId',
  'fanId',
  'liveSessionId',
]

const MAX_VALUE_LENGTH = 200

// Dashboard tab a given gate should return the user to once Pro is active,
// plus the analytics identifiers for that gate. One shared source so the
// modal, the pricing page, and the dashboard's return-state handler can't
// drift on what a given gate means.
export const GATE_CONFIG = {
  whales_empty: { returnTab: 'whales', gateSource: 'whales_empty', featureName: 'fan_intelligence' },
  post_upload_at_risk_fan: { returnTab: 'whales', gateSource: 'post_upload_at_risk_fan', featureName: 'fan_intelligence' },
  moneymap: { returnTab: 'moneymap', gateSource: 'moneymap', featureName: 'money_map' },
  streamplanner: { returnTab: 'planner', gateSource: 'streamplanner', featureName: 'stream_planner' },
  second_platform: { returnTab: 'upload', gateSource: 'second_platform', featureName: 'platform_import' },
  early_adopter_offer: { returnTab: 'overview', gateSource: 'early_adopter_offer', featureName: 'early_adopter_offer' },
  pricing_page: { returnTab: 'overview', gateSource: 'pricing_page', featureName: null },
}

export function resolveGateConfig(gateKey) {
  return GATE_CONFIG[gateKey] || GATE_CONFIG.pricing_page
}

// Only /dashboard tabs are ever restored to — reject anything else so
// stored context can never be used to navigate somewhere unexpected.
const SAFE_RETURN_TABS = new Set([
  'overview', 'whales', 'sessions', 'live', 'private', 'platforms',
  'monthly', 'titles', 'calc', 'data', 'analytics', 'planner', 'moneymap',
  'upload', 'help',
])

export function sanitizeCheckoutContext(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const out = {}
  for (const key of ALLOWED_CONTEXT_KEYS) {
    const value = raw[key]
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (!trimmed || trimmed.length > MAX_VALUE_LENGTH) continue
    if (key === 'returnPath' && !SAFE_RETURN_TABS.has(trimmed)) continue
    out[key] = trimmed
  }
  return out
}

export function contextToMetadata(context) {
  const metadata = {}
  for (const [key, value] of Object.entries(sanitizeCheckoutContext(context))) {
    metadata[`ctx_${key}`] = value
  }
  return metadata
}

export function metadataToContext(metadata) {
  if (!metadata) return {}
  const out = {}
  for (const key of ALLOWED_CONTEXT_KEYS) {
    const value = metadata[`ctx_${key}`]
    if (typeof value === 'string' && value) out[key] = value
  }
  return sanitizeCheckoutContext(out)
}
