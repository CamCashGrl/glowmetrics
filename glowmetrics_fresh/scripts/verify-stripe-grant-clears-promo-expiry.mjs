// Regression tests for: a Pro grant originating from Stripe must clear
// profiles.plan_expires_at.
//
// The bug this pins, from production: the only paying subscriber this product
// has (active $19.99/mo since 2026-07-26) had also redeemed a promo code,
// which set plan_expires_at = 2026-08-27. isProPlan() treats a past
// plan_expires_at as "not Pro" regardless of `plan`, so their paid access was
// due to lapse on the promo date while Stripe carried on charging them. The
// webhook set plan:'pro' on every subscription event and never touched the
// expiry, so nothing would have corrected it.
//
// Mirrors the webhook's update-shaping decisions and lib/plan.js's isProPlan
// (both pure, safe to mirror 1:1 — same convention as the repo's other
// verify-*.mjs scripts).

import { readFileSync } from 'node:fs'

let failures = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) { failures++; console.error(`FAIL  ${name}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`) }
  else console.log(`  ok  ${name}`)
}

// ── mirrors lib/plan.js ────────────────────────────────────────────────────
const PRO_PLANS = ['pro', 'unlimited', 'legacy']
function isProPlan(profile) {
  if (!profile) return false
  const { plan, plan_expires_at } = profile
  if (!PRO_PLANS.includes(plan)) return false
  if (plan_expires_at && new Date(plan_expires_at) <= new Date()) return false
  return true
}

// ── mirrors app/api/stripe/webhook/route.js ───────────────────────────────
const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due'])
function trialFields(sub) {
  if (sub.status === 'trialing' && sub.trial_end) {
    return { trial_ends_at: new Date(sub.trial_end * 1000).toISOString() }
  }
  return { trial_ends_at: null }
}
function proGrantFields(sub) {
  return { plan: 'pro', plan_expires_at: null, ...(sub ? trialFields(sub) : {}) }
}
function subscriptionUpdate(sub) {
  const plan = ACTIVE_STATUSES.has(sub.status) ? 'pro' : 'free'
  return plan === 'pro' ? proGrantFields(sub) : { plan: 'free', ...trialFields(sub) }
}

// Relative, so this cannot rot into a false pass the way a hardcoded date
// does. The real production value was 2026-08-27T16:45:27Z, which was still a
// week in the future when the bug was found — the damage was scheduled, not
// yet done, which is exactly why nothing had surfaced it.
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
const FUTURE = '2099-01-01T00:00:00Z'

console.log('\nevery Stripe-originated Pro grant clears the promo expiry:')
for (const status of ['active', 'trialing', 'past_due']) {
  const update = subscriptionUpdate({ status, customer: 'cus_x', trial_end: null })
  check(`status=${status} -> plan pro`, update.plan, 'pro')
  check(`status=${status} -> plan_expires_at null`, update.plan_expires_at, null)
}

console.log('\nthe resulting profile is actually Pro (the point of the fix):')
{
  const before = { plan: 'pro', plan_expires_at: PAST }
  check('promo expiry in the past defeats plan=pro', isProPlan(before), false)
  const after = { ...before, ...subscriptionUpdate({ status: 'active', trial_end: null }) }
  check('after a Stripe grant the same profile is Pro', isProPlan(after), true)
}

console.log('\ndowngrades leave plan_expires_at alone (a promo on a non-subscriber survives):')
for (const status of ['canceled', 'unpaid', 'incomplete_expired']) {
  const update = subscriptionUpdate({ status, trial_end: null })
  check(`status=${status} -> plan free`, update.plan, 'free')
  check(`status=${status} does not write plan_expires_at`,
    Object.prototype.hasOwnProperty.call(update, 'plan_expires_at'), false)
}
{
  // An unexpired promo holder who never subscribed keeps their access.
  const promoOnly = { plan: 'pro', plan_expires_at: FUTURE }
  const after = { ...promoOnly, ...subscriptionUpdate({ status: 'canceled', trial_end: null }) }
  check('cancel does not clear an unexpired promo date', after.plan_expires_at, FUTURE)
}

console.log('\na trialing grant still records the trial end:')
{
  const trialEnd = Math.floor(Date.parse('2026-09-01T00:00:00Z') / 1000)
  const update = subscriptionUpdate({ status: 'trialing', trial_end: trialEnd })
  check('trial_ends_at is set', update.trial_ends_at, '2026-09-01T00:00:00.000Z')
  check('and the promo expiry is still cleared', update.plan_expires_at, null)
}

console.log('\nthe deployed webhook actually contains the fix:')
{
  const src = readFileSync(new URL('../app/api/stripe/webhook/route.js', import.meta.url), 'utf8')
  check('proGrantFields exists', src.includes('function proGrantFields'), true)
  check('it nulls plan_expires_at', src.includes("plan_expires_at: null"), true)
  check('checkout.session.completed clears it too',
    src.includes("const update = { plan: 'pro', plan_expires_at: null }"), true)
  check('no Pro grant path sets plan without the expiry beside it',
    /plan: 'pro'(?!, plan_expires_at)/.test(src.replace("return { plan: 'pro', plan_expires_at: null,", '')), false)
}

console.log(failures === 0 ? '\nAll promo-expiry checks passed.\n' : `\n${failures} check(s) FAILED.\n`)
process.exit(failures === 0 ? 0 : 1)
