// Single source of truth for "does this profile have access to CamCash" — see
// profiles.plan, profiles.plan_expires_at and profiles.trial_ends_at.
//
// CamCash is gated, not freemium: there is no free tier that sees a partially
// locked dashboard. A profile either has access (paid subscription, active
// card-backed trial, promo grant, or grandfathered legacy account) or it is
// sent to /start-trial. `isProPlan` therefore doubles as the app-access check
// — the two concepts are the same thing now — and is kept under its old name
// so the ~40 existing call sites keep working.
//
// plan values:
//   'free'      -> no access; sees the trial gate
//   'pro'       -> Stripe subscription, status active/trialing/past_due
//   'unlimited' -> legacy paid tier
//   'legacy'    -> grandfathered pre-gate account, full access, never charged
//
// plan_expires_at is only ever set by promo-code grants (see redeem_promo_code
// RPC); Stripe-managed subscriptions leave it null and flip `plan` straight to
// 'free' via the webhook when the subscription (or an unpaid trial) ends, so a
// null expiry here always means "not time-limited."
export const PRO_PLANS = ['pro', 'unlimited', 'legacy']

// Length of the card-backed free trial, in days. Passed to Stripe as
// subscription_data.trial_period_days at checkout — Stripe owns the clock from
// there, and profiles.trial_ends_at mirrors whatever Stripe decided.
export const TRIAL_DAYS = 7

export function isProPlan(profile) {
  if (!profile) return false
  const { plan, plan_expires_at } = profile
  if (!PRO_PLANS.includes(plan)) return false
  if (plan_expires_at && new Date(plan_expires_at) <= new Date()) return false
  return true
}

// Alias that says what the check actually means at the app boundary. Use this
// in new code; isProPlan stays for the existing feature-level call sites.
export const hasAppAccess = isProPlan

/**
 * Display-level state, for banners and the trial countdown. Access itself is
 * decided by hasAppAccess() alone — never branch access off this.
 *
 * @returns {'trialing'|'subscribed'|'legacy'|'locked'}
 */
export function getAccessState(profile) {
  if (!hasAppAccess(profile)) return 'locked'
  if (profile.plan === 'legacy') return 'legacy'
  if (trialDaysRemaining(profile) !== null) return 'trialing'
  return 'subscribed'
}

/**
 * Whole days left in the card-backed trial, or null when the profile is not on
 * one (trial_ends_at unset or already past). Rounds up, so the last partial day
 * still reads as "1 day left" rather than "0".
 */
export function trialDaysRemaining(profile) {
  if (!profile?.trial_ends_at) return null
  const msLeft = new Date(profile.trial_ends_at).getTime() - Date.now()
  if (!(msLeft > 0)) return null
  return Math.ceil(msLeft / 86400000)
}
