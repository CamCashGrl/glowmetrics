// Single source of truth for "which Stripe price does this plan_type mean".
//
// This exists because of a real, revenue-losing bug: the checkout route
// resolved prices from env names (STRIPE_MONTHLY_PRICE_ID,
// STRIPE_PRICE_STANDARD_ANNUAL, ...) that do not match the names actually
// configured in the environment (STRIPE_PRICE_EARLY_ADOPTER_MONTHLY /
// _ANNUAL), and it only accepted the plan_type strings
// 'standard_monthly'/'standard_annual' while the landing page forwards
// whatever ?plan= is in the URL. A creator arriving on an old
// ?plan=early_adopter_monthly link got a 400 and no way to pay. Exactly one
// user has ever reached checkout, and this is why they failed.
//
// Both halves are fixed here rather than in the route:
//   1. Plan aliases  — every plan_type string ever shipped in a link or a
//      client build maps onto a canonical plan, so old URLs still sell.
//   2. Env candidates — each canonical plan resolves against every env name
//      this project has used, so checkout works whichever generation of
//      naming the deployment actually has set.
//
// Adding a name to either list is always safe. Removing one can silently
// break a live payment link, so don't.

export const CANONICAL_PLANS = ['monthly', 'annual']

// Legacy and current plan_type strings -> canonical plan. Keys are matched
// case-insensitively after trimming. Anything not listed here is rejected by
// the route rather than guessed at — we will not charge someone for a plan we
// cannot name.
const PLAN_ALIASES = {
  monthly: 'monthly',
  standard_monthly: 'monthly',
  early_adopter_monthly: 'monthly',
  creator_pro_monthly: 'monthly',
  pro_monthly: 'monthly',

  annual: 'annual',
  yearly: 'annual',
  standard_annual: 'annual',
  standard_yearly: 'annual',
  early_adopter_annual: 'annual',
  creator_pro_annual: 'annual',
  pro_annual: 'annual',
}

// Env var names to try, in order, per canonical plan. First one holding a
// valid `price_...` wins.
//
// ORDER MATTERS AND IS DELIBERATE. These are ranked by how specific and how
// current the name is, NOT alphabetically or by history. The rule: a name that
// unambiguously describes the plan comes first; a name known to be stale comes
// last.
//
// STRIPE_PRICE_EARLY_ADOPTER_* is last on purpose. There is no early-adopter
// product or price in Stripe — the name is a leftover from an earlier phase
// that survives in a local env file, where it points at a $9.99 "Beta
// Discount" price rather than the $19.99 list price. An earlier version of
// this file ranked it FIRST, which would have quietly halved the monthly
// price for anyone whose environment still defined it. Production never set
// it, so nothing was charged wrong, but the ordering was a live footgun.
//
// The lesson generalizes: the variable NAME tells you nothing about which
// price is inside it. That is why /api/stripe/health now reports the resolved
// price's real amount, interval and nickname straight from Stripe, instead of
// only reporting that some value was found.
const PRICE_ENV_CANDIDATES = {
  monthly: [
    'STRIPE_MONTHLY_PRICE_ID',
    'STRIPE_PRICE_STANDARD_MONTHLY',
    'STRIPE_PRICE_MONTHLY',
    'NEXT_PUBLIC_STRIPE_PRICE_MONTHLY',
    'NEXT_PUBLIC_STRIPE_PRICE_ID',
    'STRIPE_PRICE_EARLY_ADOPTER_MONTHLY',
  ],
  annual: [
    'STRIPE_YEARLY_PRICE_ID',
    'STRIPE_ANNUAL_PRICE_ID',
    'STRIPE_PRICE_STANDARD_ANNUAL',
    'STRIPE_PRICE_ANNUAL',
    'NEXT_PUBLIC_STRIPE_PRICE_ANNUAL',
    'STRIPE_PRICE_EARLY_ADOPTER_ANNUAL',
  ],
}

/**
 * Normalizes any plan_type string this app has ever sent into a canonical
 * plan. Returns null for anything unrecognized.
 */
export function resolvePlanType(input) {
  if (typeof input !== 'string') return null
  return PLAN_ALIASES[input.trim().toLowerCase()] || null
}

/**
 * Resolves the Stripe price ID for a canonical plan.
 *
 * @returns {{priceId: string, envVar: string} | {priceId: null, searched: string[]}}
 *   On failure the searched env names come back so the caller can log exactly
 *   what to set, instead of the previous "not configured correctly" dead end
 *   that named nothing.
 */
export function resolvePriceId(canonicalPlan) {
  const candidates = PRICE_ENV_CANDIDATES[canonicalPlan] || []
  for (const envVar of candidates) {
    const value = process.env[envVar]
    if (typeof value === 'string' && value.trim().startsWith('price_')) {
      return { priceId: value.trim(), envVar }
    }
  }
  return { priceId: null, searched: candidates }
}

/**
 * Startup/health check: which canonical plans are actually sellable right now.
 * Used by the checkout route's diagnostics and by scripts/verify-stripe-plans.mjs.
 */
export function auditPriceConfiguration() {
  return CANONICAL_PLANS.map(plan => {
    const result = resolvePriceId(plan)
    return {
      plan,
      sellable: !!result.priceId,
      resolvedFrom: result.envVar || null,
      searched: result.searched || null,
    }
  })
}
