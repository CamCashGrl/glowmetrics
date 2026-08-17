/**
 * CamCash Free-plan limits.
 *
 * Free:
 *   - Up to 3 tracked platforms.
 *   - Analytics/history window is limited to the most recent 31 days of
 *     available data. This is a presentation/analytics boundary; we do NOT
 *     delete older rows from the database.
 *
 * Pro:
 *   - No platform-count or history-window restriction.
 */

export const FREE_MAX_PLATFORMS = 3
export const FREE_HISTORY_DAYS = 31
export const FREE_HISTORY_MS = FREE_HISTORY_DAYS * 24 * 60 * 60 * 1000

export const normalizePlatform = (value) =>
  String(value || '').trim().toLowerCase()

export function isPaidPlan(plan) {
  return ['pro', 'unlimited'].includes(String(plan || '').toLowerCase())
}

export function uniquePlatforms(rows = []) {
  return [...new Set(
    rows
      .map((r) => normalizePlatform(r.platform))
      .filter(Boolean)
  )]
}

export function getFreePlatformState(existingPlatforms = [], incomingPlatform = null) {
  const existing = new Set(
    existingPlatforms.map(normalizePlatform).filter(Boolean)
  )
  const incoming = normalizePlatform(incomingPlatform)
  const needsNew = Boolean(incoming && !existing.has(incoming))
  const nextCount = existing.size + (needsNew ? 1 : 0)

  return {
    maxPlatforms: FREE_MAX_PLATFORMS,
    currentCount: existing.size,
    nextCount,
    needsNewPlatform: needsNew,
    allowed: nextCount <= FREE_MAX_PLATFORMS,
    atLimit: existing.size >= FREE_MAX_PLATFORMS && needsNew,
    remaining: Math.max(0, FREE_MAX_PLATFORMS - existing.size),
  }
}

export function filterFreeHistory(rows = [], referenceMs = null) {
  const dated = rows
    .map((row) => ({ row, ms: new Date(row.date_time).getTime() }))
    .filter(({ ms }) => Number.isFinite(ms))

  if (!dated.length) {
    return {
      rows: rows.slice(),
      removedCount: 0,
      windowStart: null,
      windowEnd: null,
      truncated: false,
    }
  }

  const endMs = Number.isFinite(referenceMs) ? referenceMs : Math.max(...dated.map(({ ms }) => ms))
  const startMs = endMs - FREE_HISTORY_MS

  const kept = dated
    .filter(({ ms }) => ms >= startMs && ms <= endMs)
    .map(({ row }) => row)

  const removedCount = rows.length - kept.length

  return {
    rows: kept,
    removedCount,
    windowStart: new Date(startMs).toISOString(),
    windowEnd: new Date(endMs).toISOString(),
    truncated: removedCount > 0,
  }
}
