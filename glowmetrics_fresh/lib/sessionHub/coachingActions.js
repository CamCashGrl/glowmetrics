// ============================================================
// CAMCASH — COACHING ACTION STATUS UPDATES
// The user may mark Performed/Skipped, or leave a prompt unmarked forever,
// and may change their mind later. Pure state-transition helper — the
// caller persists the returned shape to coaching_events.
// ============================================================

/**
 * @param {'unmarked'|'performed'|'skipped'} status
 * @param {Date} [now]
 * @returns {{ actionStatus: string, actionRespondedAt: string|null, updatedAt: string }}
 */
export function setCoachingActionStatus(status, now = new Date()) {
  return {
    actionStatus: status,
    actionRespondedAt: status === 'unmarked' ? null : now.toISOString(),
    updatedAt: now.toISOString(),
  }
}

/**
 * Clears optional coaching-response data (privacy control) without
 * touching earnings, tips, duration, or the underlying prompt/report data.
 * @param {Date} [now]
 */
export function clearCoachingActionResponse(now = new Date()) {
  return setCoachingActionStatus('unmarked', now)
}
