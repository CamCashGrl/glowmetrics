// ============================================================
// CAMCASH — SESSION HUB / LIVE MODE SHARED CONSTANTS
// Single source of truth for the Session Hub + Live Mode data model.
// Never redefine these enums/values elsewhere.
// ============================================================

/** @typedef {'unmarked'|'performed'|'skipped'} CoachingActionStatus */
export const COACHING_ACTION_STATUSES = ['unmarked', 'performed', 'skipped']

/** @typedef {'supporter_engagement'|'new_supporter'|'returning_supporter'|'goal_momentum'|'room_recovery'|'pace_management'|'retention'|'session_timing'|'stream_ending'} CoachingCategory */
export const COACHING_CATEGORIES = [
  'supporter_engagement',
  'new_supporter',
  'returning_supporter',
  'goal_momentum',
  'room_recovery',
  'pace_management',
  'retention',
  'session_timing',
  'stream_ending',
]

/** @typedef {'verified'|'user_confirmed'|'estimated'} DurationConfidence */
export const DURATION_CONFIDENCE = {
  VERIFIED: 'verified',
  USER_CONFIRMED: 'user_confirmed',
  ESTIMATED: 'estimated',
}

export const FEATURE_USAGE_FEATURES = [
  'live_mode',
  'coaching',
  'coaching_action',
  'session_correction',
  'pause_resume',
  'goal_tracker',
  'streaming_plan',
  'peak_window',
]

// Windows around a shown coaching prompt used to capture (not interpret)
// activity for later effectiveness analysis. "after" windows are always
// measured cumulatively from promptShownAt, "before" is strictly prior to
// it, so before/after never overlap.
export const COACHING_OUTCOME_WINDOWS_MS = {
  before5m: 5 * 60_000,
  after5m: 5 * 60_000,
  after10m: 10 * 60_000,
  after20m: 20 * 60_000,
}
