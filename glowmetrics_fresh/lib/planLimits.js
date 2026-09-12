// ============================================================
// CAMCASH — PLAN LIMITS & FREEMIUM GATING
// Single source of truth for all Free vs Pro plan constants.
// ============================================================

// Platform connection limits (Free vs Pro)
// DB enforcer: supabase/migrations/20260910b_document_primary_and_streaming_platform_columns.sql
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
// user's streaming_platforms array and primary_pro_platform marker.
// Falls back to inferring from tip totals if these columns are missing
// (for accounts that onboarded before multi-platform selection existed).
export function resolvePlatformRoles(streamingPlatforms, primaryProPlatform) {
  if (!streamingPlatforms || !Array.isArray(streamingPlatforms) || streamingPlatforms.length === 0) {
    return { primary: null, secondary: [] }
  }

  const primary = streamingPlatforms[0] || primaryProPlatform || null
  const secondary = streamingPlatforms.slice(1) || []

  return { primary, secondary }
}

// ── User-facing error message ────────────────────────────────────────────────
// Single canonical string for all PLATFORM_LIMIT_REACHED surfaces.
// Used by: upload UI, API error responses, tooltip copy.
export function platformLimitMessage() {
  return `Free plan tracks ${FREE_PLATFORM_LIMIT} platforms (1 Primary + 2 Secondary). Upgrade to Pro to add more.`
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
