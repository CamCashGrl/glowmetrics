// ============================================================
// CAMCASH — PLAN LIMITS & FREEMIUM GATING
// Single source of truth for all Free vs Pro plan constants.
// ============================================================

// Platform connection limits (Free vs Pro)
// DB enforcer: supabase/migrations/20260910_free_tier_three_platform_limit.sql
// Free tier allows 3 platforms (1 Primary + 2 Secondary); Pro allows unlimited.
export const FREE_PLATFORM_LIMIT = 3

// Analysis window for Free tier
// Free users see only the most recent 31 days per connected platform.
// Pro users see full historical data.
export const FREE_ANALYSIS_WINDOW_DAYS = 31

// ── Plan classification ──────────────────────────────────────────────────────
export function isProPlan(plan) {
  return plan === 'pro' || plan === 'unlimited'
}

// ── Platform role resolution ─────────────────────────────────────────────────
// Extracts primary (index 0) and secondary (index 1+) platforms from the
// user's streaming_platforms array. profiles.streaming_platforms is populated
// by onboarding; index 0 is the primary. primaryProPlatform is a fallback.
export function resolvePlatformRoles(streamingPlatforms, primaryProPlatform) {
  const list = Array.isArray(streamingPlatforms) ? streamingPlatforms : []
  const primary = primaryProPlatform || list[0] || null
  const secondary = list.filter(p => p !== primary)
  return { primary, secondary }
}

// ── User-facing error message ────────────────────────────────────────────────
// Single canonical string for all PLATFORM_LIMIT_REACHED surfaces.
// Used by: upload UI, API error responses, tooltip copy.
export function platformLimitMessage() {
  return `Free plan tracks up to ${FREE_PLATFORM_LIMIT} platforms (1 Primary + ${FREE_PLATFORM_LIMIT - 1} Secondary). Upgrade to Pro for unlimited platforms.`
}

// ── Module data thresholds ───────────────────────────────────────────────────
// Minimum data requirements to unlock each dashboard module.
// Never reimplement these thresholds locally in components.
export const MODULE_DATA_THRESHOLDS = {
  bestStreamingTimes: { tips: 25, sessions: 3 },
  avgHourlyRate: { sessions: 3, streamMinutes: 60 },
  topFans: { tips: 10, fans: 5 },
  whales: { fans: 10, earnings: 50 },
  sessionBreakdown: { sessions: 3 },
  moneyMap: { tips: 50, sessions: 5 },
  streamPlanner: { tips: 25, sessions: 3 },
  fanRecovery: { fans: 20, earnings: 50 },
  forecasting: { sessions: 8, earnings: 50 },
  liveScore: { liveModeSessions: 1 },
}
