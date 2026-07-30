// Canonical resolution of the Stripe price IDs the checkout route is allowed
// to use. This exists so "which env var wins for annual" is decided in one
// place instead of being re-derived (and possibly re-drifted) in both the
// checkout route and anything that needs to know whether annual is offered.
//
// Standard monthly and both early-adopter prices have always resolved
// correctly in this environment; annual is the one that has historically had
// no value set at all. ANNUAL_PRICE_ENV_VARS lists every fallback still
// supported in production, in priority order, plus the canonical name new
// deployments should use going forward.

const MONTHLY_PRICE_ENV_VARS = [
  'STRIPE_MONTHLY_PRICE_ID',
  'STRIPE_PRICE_STANDARD_MONTHLY',
  'NEXT_PUBLIC_STRIPE_PRICE_ID',
]

// STRIPE_PRICE_STANDARD_ANNUAL is the canonical name — prefer it in any new
// environment config. The rest are supported only so existing production
// config keeps working unchanged.
const ANNUAL_PRICE_ENV_VARS = [
  'STRIPE_PRICE_STANDARD_ANNUAL',
  'STRIPE_YEARLY_PRICE_ID',
  'STRIPE_ANNUAL_PRICE_ID',
  'NEXT_PUBLIC_STRIPE_PRICE_ANNUAL',
]

function firstConfigured(envVarNames, env) {
  for (const name of envVarNames) {
    const value = env[name]
    if (value && value.startsWith('price_')) {
      return { value, source: name }
    }
  }
  return { value: null, source: null }
}

export function resolvePriceMap(env = process.env) {
  const monthly = firstConfigured(MONTHLY_PRICE_ENV_VARS, env)
  const annual = firstConfigured(ANNUAL_PRICE_ENV_VARS, env)

  return {
    early_adopter_monthly: { value: env.STRIPE_PRICE_EARLY_ADOPTER_MONTHLY || null, source: 'STRIPE_PRICE_EARLY_ADOPTER_MONTHLY' },
    early_adopter_annual: { value: env.STRIPE_PRICE_EARLY_ADOPTER_ANNUAL || null, source: 'STRIPE_PRICE_EARLY_ADOPTER_ANNUAL' },
    standard_monthly: monthly,
    standard_annual: annual,
  }
}

export function isAnnualConfigured(env = process.env) {
  return Boolean(resolvePriceMap(env).standard_annual.value)
}

// For a diagnostic log only — never send this list (env var *names*, not
// values) to the client.
export function missingAnnualEnvVars(env = process.env) {
  return ANNUAL_PRICE_ENV_VARS.filter((name) => !env[name])
}

export { MONTHLY_PRICE_ENV_VARS, ANNUAL_PRICE_ENV_VARS }
