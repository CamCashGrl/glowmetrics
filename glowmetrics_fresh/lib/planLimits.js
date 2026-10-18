// ============================================================
// CAMCASH — PLAN LIMITS & FREEMIUM GATING
// Single source of truth for all Free vs Pro plan constants.
// ============================================================

// Free users may import/track every supported platform. The restriction is
// historical depth, not platform count: every platform is limited to a
// rolling 31-day analysis window on Free; Pro gets full history.
// Infinity is retained for backward compatibility with older components that
// still compare a tracked-platform count against this constant.
export const FREE_PLATFORM_LIMIT = Number.POSITIVE_INFINITY

// Analysis window for Free tier. Applies to every supported platform.
export const FREE_ANALYSIS_WINDOW_DAYS = 31

// Live Mode tasting allowance for Free accounts.
export const FREE_LIVE_STREAMS_PER_WEEK = 2
export const FREE_LIVE_STREAM_MINUTES = 30
export const FREE_LIVE_STREAM_SECONDS = FREE_LIVE_STREAM_MINUTES * 60

// Current conversion price shown on contextual upgrade surfaces.
export const PRO_MONTHLY_PRICE = 9.99

// ── Plan classification ──────────────────────────────────────────────────────
export function isProPlan(plan) {
  return plan === 'pro' || plan === 'unlimited'
}

// ── Platform role resolution ─────────────────────────────────────────────────
// Kept for display-order compatibility only. Free history gating must never
// grant a primary platform deeper history than another platform.
export function resolvePlatformRoles(streamingPlatforms, primaryProPlatform) {
  const list = Array.isArray(streamingPlatforms) ? streamingPlatforms.filter(Boolean) : []
  const primary = (primaryProPlatform && String(primaryProPlatform).trim()) || null
  const lower = primary ? String(primary).toLowerCase() : null
  const secondary = list.filter((p) => String(p).toLowerCase() !== lower)
  return { primary, secondary }
}

// Old callers still surface this message for a platform lock. There is no
// platform-count lock anymore, so point users at the real Free limitation.
export function platformLimitMessage() {
  return `Free includes all supported platforms with a rolling ${FREE_ANALYSIS_WINDOW_DAYS}-day history. Upgrade to Pro for full history.`
}

export function freeHistoryMessage() {
  return `Free shows the most recent ${FREE_ANALYSIS_WINDOW_DAYS} days on every platform. Unlock full history with Pro for $${PRO_MONTHLY_PRICE.toFixed(2)}/mo.`
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
