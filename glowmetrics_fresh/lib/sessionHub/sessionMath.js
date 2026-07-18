// ============================================================
// CAMCASH — LIVE MODE SESSION DURATION / RATE MATH
// Single source of truth for active/paused duration and $/hour.
// Used by the live page, session reports, and the time-correction
// preview — never duplicate this math elsewhere.
// ============================================================

/**
 * @typedef {{ start: string, end: string|null }} SessionPause
 */

/**
 * Total minutes covered by pause intervals, clamped to [startedAt, boundary].
 * An open pause (no `end`) is treated as still paused up to `boundary`.
 *
 * @param {SessionPause[]} pauseIntervals
 * @param {Date} boundary - "now" or the session end time
 * @returns {number}
 */
export function computePausedDurationMinutes(pauseIntervals, boundary) {
  if (!pauseIntervals || pauseIntervals.length === 0) return 0
  let totalMs = 0
  for (const p of pauseIntervals) {
    const start = new Date(p.start)
    if (isNaN(start.getTime())) continue
    const end = p.end ? new Date(p.end) : boundary
    const endMs = Math.min(end.getTime(), boundary.getTime())
    if (endMs > start.getTime()) totalMs += endMs - start.getTime()
  }
  return totalMs / 60000
}

/**
 * @param {string|Date} startedAt
 * @param {string|Date|null} endedAt - falls back to `now` for an active session
 * @param {SessionPause[]} pauseIntervals
 * @param {Date} [now]
 * @returns {{ activeDurationMinutes: number, pausedDurationMinutes: number, totalDurationMinutes: number }}
 */
export function computeSessionDuration(startedAt, endedAt, pauseIntervals, now = new Date()) {
  const start = new Date(startedAt)
  const end = endedAt ? new Date(endedAt) : now
  const totalMs = Math.max(end.getTime() - start.getTime(), 0)
  const totalDurationMinutes = totalMs / 60000
  const pausedDurationMinutes = Math.min(
    computePausedDurationMinutes(pauseIntervals, end),
    totalDurationMinutes
  )
  const activeDurationMinutes = Math.max(totalDurationMinutes - pausedDurationMinutes, 0)
  return { activeDurationMinutes, pausedDurationMinutes, totalDurationMinutes }
}

/**
 * @param {number} totalUsd
 * @param {number} activeDurationMinutes
 * @returns {number|null} null when there isn't enough duration to divide by
 */
export function computeActualHourlyRate(totalUsd, activeDurationMinutes) {
  if (!activeDurationMinutes || activeDurationMinutes <= 0) return null
  return parseFloat(((totalUsd || 0) / (activeDurationMinutes / 60)).toFixed(2))
}

/**
 * Recomputes the values a Correct Session Time form should preview before
 * saving — never mutates or reads originals, purely a function of the
 * proposed corrected fields.
 *
 * @param {{ startedAt: string, endedAt: string, pauseIntervals: SessionPause[], totalUsd: number }} corrected
 */
export function previewCorrectedSession({ startedAt, endedAt, pauseIntervals, totalUsd }) {
  const { activeDurationMinutes, pausedDurationMinutes } =
    computeSessionDuration(startedAt, endedAt, pauseIntervals)
  return {
    activeDurationMinutes: parseFloat(activeDurationMinutes.toFixed(2)),
    pausedDurationMinutes: parseFloat(pausedDurationMinutes.toFixed(2)),
    actualHourlyRate: computeActualHourlyRate(totalUsd, activeDurationMinutes),
  }
}

/**
 * Formats minutes as "2h 14m" (or "14m" under an hour) for report display.
 * @param {number} minutes
 */
export function formatDurationMinutes(minutes) {
  const total = Math.max(Math.round(minutes || 0), 0)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}
