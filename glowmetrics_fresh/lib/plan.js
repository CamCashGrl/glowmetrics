// Single source of truth for "is this profile on a Pro plan" — see profiles.plan
// and profiles.plan_expires_at. plan_expires_at is only ever set by promo-code
// grants (see redeem_promo_code RPC); Stripe-managed subscriptions leave it
// null and flip `plan` straight to 'free' via the webhook on cancellation, so
// a null expiry here always means "not time-limited."
export const PRO_PLANS = ['pro', 'unlimited']

export function isProPlan(profile) {
  if (!profile) return false
  const { plan, plan_expires_at } = profile
  if (!PRO_PLANS.includes(plan)) return false
  if (plan_expires_at && new Date(plan_expires_at) <= new Date()) return false
  return true
}
