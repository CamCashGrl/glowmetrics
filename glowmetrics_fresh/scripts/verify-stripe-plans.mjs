// Standalone verification for the checkout plan/price resolution contract
// (lib/stripe-plans.js). Same mirror-free convention as the repo's other
// verify-*.mjs scripts, except this one imports the real module — it is pure
// and env-driven, so there is nothing to mirror and mirroring would defeat
// the purpose.
//
// What this protects: exactly one user has ever reached Stripe Checkout in
// this product's history, and they failed, because the plan_type in their
// marketing link ('early_adopter_monthly') was not accepted by the route and
// the price env vars were named differently than the route expected. These
// assertions exist so that specific class of silent revenue loss cannot
// return.

import { resolvePlanType, resolvePriceId, auditPriceConfiguration } from '../lib/stripe-plans.js'

let failures = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) { failures++; console.error(`FAIL ${name}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`) }
  else console.log(`  ok  ${name}`)
}

console.log('\nplan_type aliases (every string ever shipped in a link must still sell):')
// The one that actually broke.
check('early_adopter_monthly -> monthly', resolvePlanType('early_adopter_monthly'), 'monthly')
check('early_adopter_annual -> annual', resolvePlanType('early_adopter_annual'), 'annual')
check('standard_monthly -> monthly', resolvePlanType('standard_monthly'), 'monthly')
check('standard_annual -> annual', resolvePlanType('standard_annual'), 'annual')
check('monthly -> monthly', resolvePlanType('monthly'), 'monthly')
check('annual -> annual', resolvePlanType('annual'), 'annual')
check('yearly -> annual', resolvePlanType('yearly'), 'annual')
check('case/whitespace tolerated', resolvePlanType('  Standard_Monthly '), 'monthly')

console.log('\nunknown plans are rejected, never guessed (we do not charge for a plan we cannot name):')
check('garbage -> null', resolvePlanType('garbage'), null)
check('empty -> null', resolvePlanType(''), null)
check('undefined -> null', resolvePlanType(undefined), null)
check('object -> null', resolvePlanType({}), null)

console.log('\nprice resolution accepts every env naming generation:')
for (const envVar of ['STRIPE_PRICE_EARLY_ADOPTER_MONTHLY', 'STRIPE_MONTHLY_PRICE_ID', 'STRIPE_PRICE_STANDARD_MONTHLY', 'NEXT_PUBLIC_STRIPE_PRICE_ID']) {
  for (const k of Object.keys(process.env)) if (k.startsWith('STRIPE_') || k.startsWith('NEXT_PUBLIC_STRIPE')) delete process.env[k]
  process.env[envVar] = 'price_test123'
  check(`monthly resolves from ${envVar}`, resolvePriceId('monthly').priceId, 'price_test123')
}
for (const envVar of ['STRIPE_PRICE_EARLY_ADOPTER_ANNUAL', 'STRIPE_YEARLY_PRICE_ID', 'STRIPE_ANNUAL_PRICE_ID', 'STRIPE_PRICE_STANDARD_ANNUAL', 'NEXT_PUBLIC_STRIPE_PRICE_ANNUAL']) {
  for (const k of Object.keys(process.env)) if (k.startsWith('STRIPE_') || k.startsWith('NEXT_PUBLIC_STRIPE')) delete process.env[k]
  process.env[envVar] = 'price_test456'
  check(`annual resolves from ${envVar}`, resolvePriceId('annual').priceId, 'price_test456')
}

console.log('\nmalformed price values are refused rather than sent to Stripe:')
for (const k of Object.keys(process.env)) if (k.startsWith('STRIPE_') || k.startsWith('NEXT_PUBLIC_STRIPE')) delete process.env[k]
process.env.STRIPE_PRICE_EARLY_ADOPTER_MONTHLY = 'prod_notaprice'
check('product id is not accepted as a price', resolvePriceId('monthly').priceId, null)
process.env.STRIPE_PRICE_EARLY_ADOPTER_MONTHLY = ''
check('empty string is not accepted', resolvePriceId('monthly').priceId, null)

console.log('\nfailure reporting names the env vars to set:')
for (const k of Object.keys(process.env)) if (k.startsWith('STRIPE_') || k.startsWith('NEXT_PUBLIC_STRIPE')) delete process.env[k]
const missing = resolvePriceId('annual')
check('unconfigured annual reports null price', missing.priceId, null)
check('unconfigured annual lists candidates', missing.searched.length > 0, true)
check('audit marks both plans unsellable', auditPriceConfiguration().every(p => !p.sellable), true)

console.log(failures === 0 ? '\nAll checkout plan/price checks passed.\n' : `\n${failures} check(s) FAILED.\n`)
process.exit(failures === 0 ? 1 - 1 : 1)
