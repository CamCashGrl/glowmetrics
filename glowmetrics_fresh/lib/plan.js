// Single source of truth for "does this profile have Pro access" — see
// profiles.plan, profiles.plan_expires_at and profiles.trial_ends_at.
//
// CamCash is freemium: Free is a genuinely useful product (import, earnings,
// sessions, fans, platform stats, Creator Report, Command Center) and Pro is
// the layer that tells the creator what to DO with that data. This module
// decides Pro access only — it is never a gate on the app itself, and nothing
// should redirect a signed-in creator away from their own dashboard.
//
// plan values:
//   'free'      -> Free tier; full core product, Pro layer locked
//   'pro'       -> Stripe subscription, status active/trialing/past_due
//   'unlimited' -> legacy paid tier
//   'legacy'    -> grandfathered pre-trial account, Pro access, never charged
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

// Retained for /start-trial, which redirects creators who already have Pro.
// NOT an app-access gate — see the module comment.
export const hasAppAccess = isProPlan

/**
 * Display-level state, for banners and the trial countdown. Pro access itself
 * is decided by isProPlan() alone — never branch access off this.
 *
 * @returns {'trialing'|'subscribed'|'legacy'|'free'}
 */
export function getAccessState(profile) {
  if (!isProPlan(profile)) return 'free'
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
