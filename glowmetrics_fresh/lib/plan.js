// Single source of truth for "does this profile.plan value count as Pro".
// Every place that gates a feature on plan should import this instead of
// re-deriving the check inline, so the definition of "pro" never drifts
// between the dashboard, the webhook, and any future server route.

export const PRO_PLAN_VALUES = ['pro', 'unlimited']

export function isProPlan(plan) {
  return PRO_PLAN_VALUES.includes(plan)
}
