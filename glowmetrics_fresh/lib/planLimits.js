// Single source of truth for UX-facing Free/Pro plan constants. The real
// enforcement for platform count lives in the DB trigger
// (supabase/migrations/20260910_free_tier_three_platform_limit.sql) — these
// values are advisory/display-only and must be kept in sync with it by hand
// if that trigger's constant ever changes.

export const FREE_PLATFORM_LIMIT = 3
export const FREE_ANALYSIS_WINDOW_DAYS = 31

export function isProPlan(plan) {
  return plan === 'pro' || plan === 'unlimited'
}

// profiles.primary_pro_platform / profiles.streaming_platforms already exist
// and are written by onboarding (index 0 of streaming_platforms is primary).
// This just names the split for display purposes.
export function resolvePlatformRoles(streamingPlatforms, primaryProPlatform) {
  const list = Array.isArray(streamingPlatforms) ? streamingPlatforms : []
  const primary = primaryProPlatform || list[0] || null
  const secondary = list.filter(p => p !== primary)
  return { primary, secondary }
}

export function platformLimitMessage() {
  return `Free tracks up to ${FREE_PLATFORM_LIMIT} platforms (1 Primary + ${FREE_PLATFORM_LIMIT - 1} Secondary). Upgrade to Pro for unlimited platforms.`
}
