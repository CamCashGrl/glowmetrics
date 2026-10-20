// ============================================================
// CAMCASH — PLAN LIMITS & FREEMIUM GATING
// Single source of truth for Free / Trial / Pro product limits.
// ============================================================

// STORAGE / IMPORT POLICY
// Free and trial users may upload data from every supported platform and may
// upload more than 31 days. CamCash stores that data so it can be unlocked
// after upgrade and used to build truthful, aggregate upgrade teasers.
// Do NOT use this constant to limit uploads.
export const FREE_PLATFORM_LIMIT = Number.POSITIVE_INFINITY

// ANALYTICS POLICY
// Free gets real analytics for ONE selected platform, limited to a rolling
// 31-day window. Other platforms/history stay stored and can contribute only
// to the explicitly-free platform comparison and locked teaser metadata.
export const FREE_ANALYTICS_PLATFORM_LIMIT = 1
export const FREE_ANALYSIS_WINDOW_DAYS = 31

// Free users may see this one full insight surface. Everything else should be
// rendered as a locked teaser built from real stored data, not fake examples.
export const FREE_FULL_INSIGHT_IDS = Object.freeze(['platformComparison'])

// Trial policy: demonstrate the product without giving away full-history value.
// Stripe currently creates a 7-day trial. Trial analytics are still capped to
// one platform + 31 days, with a maximum of two 30-minute Live Mode sessions
// during the trial. Paid Pro is the only tier with unlimited history/Live Mode.
export const TRIAL_DAYS = 7
export const TRIAL_ANALYSIS_WINDOW_DAYS = 31
export const TRIAL_LIVE_STREAMS_TOTAL = 2
export const TRIAL_LIVE_STREAM_MINUTES = 30

// Free Live Mode tasting allowance.
export const FREE_LIVE_STREAMS_PER_WEEK = 2
export const FREE_LIVE_STREAM_MINUTES = 30
export const FREE_LIVE_STREAM_SECONDS = FREE_LIVE_STREAM_MINUTES * 60

export const PRO_MONTHLY_PRICE = 9.99
export const PRO_ANNUAL_PRICE = 99

// ── Plan classification ──────────────────────────────────────────────────────
// NOTE: profile.plan alone cannot distinguish a Stripe trial from paid Pro in
// the legacy schema because the webhook currently writes plan='pro' for both.
// Use hasPaidProAccess() anywhere subscription_status is available.
export function isProPlan(plan) {
  return plan === 'pro' || plan === 'unlimited'
}

export function isTrialStatus(subscriptionStatus, trialEndsAt = null, now = new Date()) {
  if (subscriptionStatus !== 'trialing') return false
  if (!trialEndsAt) return true
  const end = new Date(trialEndsAt)
  return !Number.isNaN(end.getTime()) && end > now
}

export function hasPaidProAccess({ plan, subscriptionStatus } = {}) {
  if (plan === 'unlimited') return true
  return plan === 'pro' && subscriptionStatus === 'active'
}

// ── Platform role resolution ─────────────────────────────────────────────────
// primary_pro_platform is now the ONE platform whose 31-day analytics are
// visible on Free/trial. It no longer receives unlimited history.
// Other uploaded platforms remain stored for platform comparison + teasers.
export function resolvePlatformRoles(streamingPlatforms, primaryProPlatform) {
  const list = Array.isArray(streamingPlatforms) ? streamingPlatforms.filter(Boolean) : []
  const primary = (primaryProPlatform && String(primaryProPlatform).trim()) || null
  const lower = primary ? String(primary).toLowerCase() : null
  const secondary = list.filter((p) => String(p).toLowerCase() !== lower)
  return { primary, secondary }
}

export function platformLimitMessage() {
  return `Free includes real analytics for 1 platform with a rolling ${FREE_ANALYSIS_WINDOW_DAYS}-day window. Upload other platforms too — CamCash stores them for comparison and unlocks their full insights with Pro.`
}

export function freeHistoryMessage() {
  return `Free shows a rolling ${FREE_ANALYSIS_WINDOW_DAYS} days for your 1 analytics platform. Older history and other-platform data stay safely stored and unlock with Pro for $${PRO_MONTHLY_PRICE.toFixed(2)}/mo.`
}

export function trialLimitMessage() {
  return `The ${TRIAL_DAYS}-day trial includes 1 analytics platform, a rolling ${TRIAL_ANALYSIS_WINDOW_DAYS} days of data, and ${TRIAL_LIVE_STREAMS_TOTAL} Live Mode sessions total, up to ${TRIAL_LIVE_STREAM_MINUTES} active minutes each. Paid Pro unlocks full stored history and unlimited Live Mode.`
}

export function canShowFullInsight({ insightId, paidPro = false } = {}) {
  if (paidPro) return true
  return FREE_FULL_INSIGHT_IDS.includes(insightId)
}

// ── Module data thresholds ───────────────────────────────────────────────────
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
