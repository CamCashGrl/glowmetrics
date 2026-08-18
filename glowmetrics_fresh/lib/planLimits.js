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

/**
 * Summarizes a set of rows for a locked-preview/"what you're missing" card.
 *
 * `uniqueDays` is a distinct-calendar-day count, not a formal session-detection
 * model — lib/analytics.js has no exported "derive sessions from raw tip rows"
 * function to reuse safely here, so we deliberately use the more conservative,
 * honestly-labeled proxy rather than inventing a new session algorithm. Any
 * UI that surfaces this should say "days," not "sessions."
 */
export function summarizeRows(rows = []) {
  const dated = rows
    .map((row) => ({ row, ms: new Date(row.date_time).getTime() }))
    .filter(({ ms }) => Number.isFinite(ms))

  const totalUsd = parseFloat(
    rows.reduce((sum, r) => sum + (Number(r.usd) || 0), 0).toFixed(2)
  )
  const totalTokens = rows.reduce((sum, r) => sum + (Number(r.tokens) || 0), 0)
  const uniqueFans = new Set(
    rows.map((r) => String(r.username || '').toLowerCase()).filter(Boolean)
  ).size
  const uniqueDays = new Set(
    dated.map(({ row }) => new Date(row.date_time).toISOString().slice(0, 10))
  ).size
  const dateFrom = dated.length ? new Date(Math.min(...dated.map((d) => d.ms))) : null
  const dateTo = dated.length ? new Date(Math.max(...dated.map((d) => d.ms))) : null

  return {
    count: rows.length,
    totalUsd,
    totalTokens,
    uniqueFans,
    uniqueDays,
    dateFrom: dateFrom ? dateFrom.toISOString() : null,
    dateTo: dateTo ? dateTo.toISOString() : null,
  }
}

/**
 * Splits rows into what the Free 31-day window can show vs. what it can't —
 * WITHOUT discarding the excluded rows. Callers decide what to do with each
 * half (e.g. insert `visible`, summarize `excluded` for a locked preview).
 * Rows with an unparseable date are treated as visible rather than silently
 * dropped from either bucket.
 */
export function splitFreeHistory(rows = [], referenceMs = null) {
  const dated = rows
    .map((row) => ({ row, ms: new Date(row.date_time).getTime() }))
    .filter(({ ms }) => Number.isFinite(ms))
  const undated = rows.filter((row) => !Number.isFinite(new Date(row.date_time).getTime()))

  if (!dated.length) {
    return { visible: rows.slice(), excluded: [], windowStart: null, windowEnd: null }
  }

  const endMs = Number.isFinite(referenceMs) ? referenceMs : Math.max(...dated.map(({ ms }) => ms))
  const startMs = endMs - FREE_HISTORY_MS

  const visible = dated
    .filter(({ ms }) => ms >= startMs && ms <= endMs)
    .map(({ row }) => row)
    .concat(undated)
  const excluded = dated
    .filter(({ ms }) => ms < startMs || ms > endMs)
    .map(({ row }) => row)

  return {
    visible,
    excluded,
    windowStart: new Date(startMs).toISOString(),
    windowEnd: new Date(endMs).toISOString(),
  }
}

/**
 * Splits rows by platform against the Free platform cap — WITHOUT rejecting
 * the whole upload. Rows for platforms already tracked, or that fit within
 * the remaining Free slots, are "visible"; anything beyond the cap is
 * "excluded" (still summarizable for a locked preview, just not inserted
 * into the DB by the caller).
 */
export function splitFreePlatforms(rows = [], existingPlatforms = []) {
  const allowed = new Set(existingPlatforms.map(normalizePlatform).filter(Boolean))
  const visible = []
  const excluded = []

  for (const row of rows) {
    const p = normalizePlatform(row.platform)
    if (!p) { visible.push(row); continue }
    if (allowed.has(p)) { visible.push(row); continue }
    if (allowed.size < FREE_MAX_PLATFORMS) {
      allowed.add(p)
      visible.push(row)
    } else {
      excluded.push(row)
    }
  }

  return { visible, excluded, allowedPlatforms: [...allowed] }
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
