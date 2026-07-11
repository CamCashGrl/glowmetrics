// ============================================================
// CAMCASH — SESSION TIME CORRECTION BUILDER
// Produces a SessionTimeCorrection record from a session + proposed
// correction. Pure — never touches the database and never mutates the
// original session object, so original timestamps can never be lost here.
// ============================================================

/**
 * @param {{ id: string, startedAt: string, endedAt: string|null }} original
 * @param {{ startedAt: string, endedAt: string, pauseIntervals: Array, platform?: string|null, completed?: boolean }} corrected
 * @param {Date} [now]
 * @returns {import('./constants')} SessionTimeCorrection-shaped object
 */
export function buildSessionTimeCorrection(original, corrected, now = new Date()) {
  return {
    sessionId: original.id,
    originalStartedAt: original.startedAt,
    originalEndedAt: original.endedAt ?? null,
    correctedStartedAt: corrected.startedAt,
    correctedEndedAt: corrected.endedAt,
    correctedPauseIntervals: corrected.pauseIntervals || [],
    correctedPlatform: corrected.platform ?? null,
    correctedCompleted: corrected.completed ?? true,
    correctedByUser: true,
    correctedAt: now.toISOString(),
  }
}

/**
 * Resolves the "current" values a session should be displayed/computed
 * with — the correction if one exists, otherwise the original recorded
 * values. Never mutates the session; the original fields stay reachable
 * on the same object for anyone who needs them (e.g. the correction form).
 *
 * @param {object} session - mapped stream_sessions row (see mapRows.js)
 */
export function effectiveSessionTiming(session) {
  return {
    startedAt: session.correctedStartedAt || session.startedAt,
    endedAt: session.correctedEndedAt || session.endedAt,
    pauseIntervals: session.correctedPauseIntervals || session.pauseIntervals || [],
    platform: session.correctedPlatform || session.platform,
    completed: session.correctedCompleted ?? session.completed,
  }
}

/**
 * A session's duration confidence: user_confirmed once corrected,
 * verified once cleanly stopped by the user, otherwise estimated (e.g.
 * still active, or ended by inference rather than an explicit Stop).
 *
 * @param {{ hasUserCorrection: boolean, completed: boolean }} params
 * @returns {import('./constants').DurationConfidence}
 */
export function resolveDurationConfidence({ hasUserCorrection, completed }) {
  if (hasUserCorrection) return 'user_confirmed'
  if (completed) return 'verified'
  return 'estimated'
}
