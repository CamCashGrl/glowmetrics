// ============================================================
// CAMCASH — LIVE SESSION ANALYSIS CONTEXT BUILDER
// Captures the session context needed for future matched comparisons.
// Streaming-plan / goal fields stay false/null until those separate beta
// features exist — this only avoids a later migration losing history.
// ============================================================

import { computeActualHourlyRate } from './sessionMath'

/**
 * @param {object} params
 * @param {string} params.sessionId
 * @param {string} params.platform
 * @param {string} params.startedAt
 * @param {string|null} params.endedAt
 * @param {string} params.timezone - e.g. from Intl.DateTimeFormat().resolvedOptions().timeZone
 * @param {number} params.activeDurationMinutes
 * @param {number} params.pausedDurationMinutes
 * @param {number} params.totalEarningsUsd
 * @param {number} params.totalTokens
 * @param {number} params.tipCount
 * @param {number} params.uniqueTipperCount
 * @param {boolean} params.coachingEnabled
 * @param {{ performed: number, skipped: number, unmarked: number }} params.promptCounts
 * @param {import('./constants').DurationConfidence} params.durationConfidence
 * @param {{ goalUsed?: boolean, streamingPlanWindowId?: string|null, startedFromStreamingPlan?: boolean, startedInsideRecommendedWindow?: boolean }} [params.futureFeatureFlags]
 */
export function buildLiveSessionAnalysisContext({
  sessionId,
  platform,
  startedAt,
  endedAt,
  timezone,
  activeDurationMinutes,
  pausedDurationMinutes,
  totalEarningsUsd,
  totalTokens,
  tipCount,
  uniqueTipperCount,
  coachingEnabled,
  promptCounts,
  durationConfidence,
  futureFeatureFlags = {},
}) {
  const start = new Date(startedAt)
  return {
    sessionId,
    platform,
    startedAt: start.toISOString(),
    endedAt: endedAt ? new Date(endedAt).toISOString() : null,
    dayOfWeek: start.getDay(),
    startHourLocal: start.getHours(),
    timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    activeDurationMinutes: parseFloat((activeDurationMinutes || 0).toFixed(2)),
    pausedDurationMinutes: parseFloat((pausedDurationMinutes || 0).toFixed(2)),
    totalEarningsUsd: parseFloat((totalEarningsUsd || 0).toFixed(2)),
    totalTokens: totalTokens || 0,
    tipCount: tipCount || 0,
    uniqueTipperCount: uniqueTipperCount || 0,
    actualHourlyRate: computeActualHourlyRate(totalEarningsUsd, activeDurationMinutes),
    coachingEnabled: !!coachingEnabled,
    coachingPromptCount: (promptCounts?.performed || 0) + (promptCounts?.skipped || 0) + (promptCounts?.unmarked || 0),
    performedPromptCount: promptCounts?.performed || 0,
    skippedPromptCount: promptCounts?.skipped || 0,
    unmarkedPromptCount: promptCounts?.unmarked || 0,
    goalUsed: !!futureFeatureFlags.goalUsed,
    streamingPlanWindowId: futureFeatureFlags.streamingPlanWindowId ?? null,
    startedFromStreamingPlan: !!futureFeatureFlags.startedFromStreamingPlan,
    startedInsideRecommendedWindow: !!futureFeatureFlags.startedInsideRecommendedWindow,
    durationConfidence,
  }
}
