// ============================================================
// CAMCASH — SESSION DATA QUALITY FLAGS
// Computes SessionDataQuality. Never used to delete or hide a session —
// only to exclude it from future (separate) impact-analysis features.
// ============================================================

// A session shorter than this is too short to be a meaningful comparison
// point later, regardless of how clean its data is.
export const MIN_ELIGIBLE_ACTIVE_MINUTES = 5

/**
 * @param {object} params
 * @param {{ activeDurationMinutes: number|null, completed: boolean, hasEstimatedEnd: boolean }} params.duration
 * @param {boolean} params.hasUserCorrection
 * @param {boolean} params.containsPauseIntervals
 * @param {number|null} params.extensionConnectedPercent
 * @param {number} params.duplicateTipCount
 * @param {number} params.invalidTipCount
 * @param {boolean} params.coachingDataComplete
 * @param {boolean} params.outcomeWindowsComplete
 * @returns {import('./constants')} SessionDataQuality-shaped object (minus sessionId)
 */
export function computeSessionDataQuality({
  duration,
  hasUserCorrection,
  containsPauseIntervals,
  extensionConnectedPercent = null,
  duplicateTipCount = 0,
  invalidTipCount = 0,
  coachingDataComplete = true,
  outcomeWindowsComplete = true,
}) {
  const reasons = []

  const durationMissing = duration.activeDurationMinutes === null || duration.activeDurationMinutes === undefined
  const durationInvalid = !durationMissing && duration.activeDurationMinutes <= 0
  if (durationMissing) reasons.push('duration_missing')
  else if (durationInvalid) reasons.push('duration_invalid')
  else if (duration.activeDurationMinutes < MIN_ELIGIBLE_ACTIVE_MINUTES) reasons.push('session_too_short')

  if (duplicateTipCount > 0) reasons.push('unresolved_duplicate_tips')
  if (invalidTipCount > 0) reasons.push('tips_failed_to_reconcile')
  if (!coachingDataComplete) reasons.push('coaching_timestamps_incomplete')
  if (!outcomeWindowsComplete) reasons.push('outcome_windows_incomplete')
  if (!duration.completed) reasons.push('session_not_completed')

  return {
    hasVerifiedStart: true,
    hasVerifiedEnd: !!duration.completed && !duration.hasEstimatedEnd,
    hasEstimatedEnd: !!duration.hasEstimatedEnd,
    hasUserCorrection: !!hasUserCorrection,
    containsPauseIntervals: !!containsPauseIntervals,
    extensionConnectedPercent,
    duplicateTipCount,
    invalidTipCount,
    coachingDataComplete,
    outcomeWindowsComplete,
    eligibleForFutureImpactAnalysis: reasons.length === 0,
    ineligibilityReasons: reasons,
  }
}
