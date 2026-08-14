// Canonical best-earning-window calculation — the single source of truth for
// "when is my best time to stream," per canonical-analytics-rules.md.
//
// This supersedes (as the source these should eventually read from, per the
// approved migration plan — retiring them is a separate, tracked step, not
// done by this file's existence alone):
//   - app/dashboard/page.js's buildDailyBrief() hour-bucketing
//   - lib/analytics.js's missedRevenueByPlatform's internal platformBestTimes bucketing
//   - lib/analytics.js's generateLossAlerts()'s peak_missed branch
//   - app/dashboard/StreamPlanner.js's bestWindows()
// computeBestTimes() (lib/analytics.js) is kept as a documented reference
// implementation of the median/local-timezone approach — not deleted, but no
// longer the operative "best time" answer once this module's grid is wired
// in (see canonical-analytics-rules.md's Best Times row for that note).
//
// Rules (canonical-analytics-rules.md):
//   - Unit of analysis: SESSIONS (from detectSessions()), not individual tips.
//   - Statistic: MEDIAN session $/hour per day×hour bucket, not mean.
//   - Timezone: local-native (creator's canonical timezone — see
//     resolveCreatorTimezone() in lib/timezone.js), never UTC-then-relabeled.
//   - Confidence tiers (session count in the bucket):
//       < 2            -> insufficient   (never shown as a candidate)
//       2 or 3          -> promising      (shown, never labeled "Best Time")
//       4 or 5          -> supported      (can be labeled "Best Time", medium)
//       6+              -> high           (can be labeled "Best Time", high)
//   - "Best window" = the bucket with the highest median $/hour among buckets
//     at 'supported' or 'high' confidence. Ties resolve to higher session
//     count, then the more recently active bucket.
//   - Session population: meaningfulSessions only (see canonical-analytics-
//     rules.md's Platform $/hr section for the full justification — the same
//     reasoning applies here: near-zero-duration sessions would distort a
//     rate calculation).

import { calcMedian, toLocalHour, toLocalDow } from './localTime'

const LOCAL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const CONFIDENCE_TIER = {
  INSUFFICIENT: 'insufficient',
  PROMISING: 'promising',
  SUPPORTED: 'supported',
  HIGH: 'high',
}

function tierForSessionCount(n) {
  if (n < 2) return CONFIDENCE_TIER.INSUFFICIENT
  if (n <= 3) return CONFIDENCE_TIER.PROMISING
  if (n <= 5) return CONFIDENCE_TIER.SUPPORTED
  return CONFIDENCE_TIER.HIGH
}

const CAN_BE_BEST_TIME = new Set([CONFIDENCE_TIER.SUPPORTED, CONFIDENCE_TIER.HIGH])

/**
 * @param {Array} meaningfulSessions - sessions from detectSessions(), already
 *   filtered to sessionQuality === 'meaningful' by the caller (this function
 *   does not re-filter — see canonical-analytics-rules.md's Platform $/hr
 *   determination for why that filter belongs upstream, applied once).
 * @param {string} tz - IANA timezone string (see lib/timezone.js).
 * @returns {{ grid: Array, bestWindow: Object|null, earlySignal: Object|null }}
 *   grid: one entry per (localDay, localHour) bucket that has >=1 session,
 *     shape: { localDay, localHour, medianUsdPerHour, sessionCount,
 *              totalUsd, tier, topPlatform, lastActiveAt }
 *   bestWindow: the highest-median bucket among 'supported'/'high' tiers, or
 *     null if none qualifies.
 *   earlySignal: if bestWindow is null, the strongest 'promising' bucket (if
 *     any) to show as a labeled, non-authoritative hint — never substituted
 *     for bestWindow silently by any caller.
 */
export function computeCanonicalBestTimes(meaningfulSessions, tz) {
  const buckets = {}

  for (const s of meaningfulSessions) {
    if (!s.startTime || s.usdPerHour == null) continue
    const localDay = LOCAL_DAY_NAMES[toLocalDow(s.startTime, tz)]
    const localHour = toLocalHour(s.startTime, tz)
    const key = `${localDay}-${localHour}`
    if (!buckets[key]) {
      buckets[key] = { localDay, localHour, rates: [], totalUsd: 0, platformUsd: {}, lastActiveAt: s.startTime }
    }
    const b = buckets[key]
    b.rates.push(s.usdPerHour)
    b.totalUsd += s.totalUSD || 0
    b.platformUsd[s.platform] = (b.platformUsd[s.platform] || 0) + (s.totalUSD || 0)
    if (new Date(s.startTime) > new Date(b.lastActiveAt)) b.lastActiveAt = s.startTime
  }

  const grid = Object.values(buckets).map(b => {
    const sessionCount = b.rates.length
    const topPlatform = Object.entries(b.platformUsd).sort((a, b2) => b2[1] - a[1])[0]?.[0] || null
    return {
      localDay: b.localDay,
      localHour: b.localHour,
      medianUsdPerHour: parseFloat(calcMedian(b.rates).toFixed(2)),
      sessionCount,
      totalUsd: parseFloat(b.totalUsd.toFixed(2)),
      tier: tierForSessionCount(sessionCount),
      topPlatform,
      lastActiveAt: b.lastActiveAt,
    }
  })

  const eligible = grid.filter(g => CAN_BE_BEST_TIME.has(g.tier))
  const bestWindow = eligible.length
    ? [...eligible].sort((a, b) =>
        b.medianUsdPerHour - a.medianUsdPerHour ||
        b.sessionCount - a.sessionCount ||
        new Date(b.lastActiveAt) - new Date(a.lastActiveAt)
      )[0]
    : null

  let earlySignal = null
  if (!bestWindow) {
    const promising = grid.filter(g => g.tier === CONFIDENCE_TIER.PROMISING)
    earlySignal = promising.length
      ? [...promising].sort((a, b) => b.medianUsdPerHour - a.medianUsdPerHour)[0]
      : null
  }

  return { grid, bestWindow, earlySignal }
}
