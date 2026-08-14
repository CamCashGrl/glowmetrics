// Canonical missed-revenue calculation — three distinct fields, kept separate
// per canonical-analytics-rules.md's explicit determination (B: "related but
// different calculations, not the same concept" — merging them into one
// number would lose real, distinct information each currently captures).
//
// Supersedes, as the source these should eventually read from:
//   - lib/analytics.js's missedRevenueByPlatform
//   - lib/analytics.js's generateLossAlerts()'s peak_missed branch
//   - get_user_insights's missed_opportunity field
// All three now share the same canonical best-time grid as their input,
// rather than each independently recomputing "best hour."

import { computeCanonicalBestTimes } from './bestTimes'
import { toLocalHour, toLocalDow } from './localTime'

const LOCAL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Local calendar date as YYYY-MM-DD in the given IANA tz — must not use
// Date.toDateString(), which reads the *runtime's* system timezone, not the
// creator's. Same Intl-based approach as lib/analytics.js's (unexported)
// toLocalDateStr(), duplicated here rather than exported+imported since it's
// a 3-line pure function and exporting it would widen lib/analytics.js's
// public surface for a helper this specific to this file.
function localDateStr(dateStr, tz) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(dateStr))
  } catch {
    return new Date(dateStr).toISOString().slice(0, 10)
  }
}

/**
 * @param {Array} meaningfulSessions - see computeCanonicalBestTimes()
 * @param {string} tz
 * @param {Date} [now] - injectable for tests
 * @returns {{ today_missed: Object|null, cumulative_by_platform: Object, recent_streak_missed: Object|null }}
 */
export function computeMissedRevenue(meaningfulSessions, tz, now = new Date()) {
  const { bestWindow } = computeCanonicalBestTimes(meaningfulSessions, tz)

  // ── today_missed ──────────────────────────────────────────────────────
  // If today's best-window hour has already passed locally and no session
  // happened in it today, estimate the loss as that window's own median
  // $/hour — the same "typical value of that hour" figure the grid already
  // trusts, not a separately invented number.
  let today_missed = null
  if (bestWindow) {
    const todayLocalDay = LOCAL_DAY_NAMES[toLocalDow(now.toISOString(), tz)]
    const currentLocalHour = toLocalHour(now.toISOString(), tz)
    const isBestDayToday = bestWindow.localDay === todayLocalDay
    const hourHasPassed = isBestDayToday && currentLocalHour > bestWindow.localHour
    if (hourHasPassed) {
      const hitToday = meaningfulSessions.some(s => {
        const d = LOCAL_DAY_NAMES[toLocalDow(s.startTime, tz)]
        const h = toLocalHour(s.startTime, tz)
        const sameLocalDate = localDateStr(s.startTime, tz) === localDateStr(now.toISOString(), tz)
        return d === bestWindow.localDay && h === bestWindow.localHour && sameLocalDate
      })
      if (!hitToday) {
        today_missed = {
          localDay: bestWindow.localDay,
          localHour: bestWindow.localHour,
          estimatedLoss: Math.min(bestWindow.medianUsdPerHour, 200), // same $200 cap as the prior get_user_insights implementation
        }
      }
    }
  }

  // ── cumulative_by_platform ───────────────────────────────────────────
  // Per platform: (that platform's own best-window median $/hr - that
  // platform's overall median $/hr) * sessions on that platform not in its
  // own best window. Requires a per-platform grid, computed by filtering
  // the session population before calling computeCanonicalBestTimes again.
  const platforms = [...new Set(meaningfulSessions.map(s => s.platform))]
  const cumulative_by_platform = {}
  for (const platform of platforms) {
    const platSessions = meaningfulSessions.filter(s => s.platform === platform)
    if (platSessions.length < 3) continue // same minimum-sample spirit as the grid itself
    const { bestWindow: platBest } = computeCanonicalBestTimes(platSessions, tz)
    if (!platBest) continue
    const overallMedianRates = platSessions.map(s => s.usdPerHour).filter(v => v != null)
    const overallMedian = overallMedianRates.length
      ? [...overallMedianRates].sort((a, b) => a - b)[Math.floor(overallMedianRates.length / 2)]
      : 0
    if (platBest.medianUsdPerHour <= overallMedian * 1.2) continue // not a meaningful gap
    const notAtBestWindow = platSessions.filter(s => {
      const d = LOCAL_DAY_NAMES[toLocalDow(s.startTime, tz)]
      const h = toLocalHour(s.startTime, tz)
      return !(d === platBest.localDay && h === platBest.localHour)
    }).length
    const missedRevenue = parseFloat(((platBest.medianUsdPerHour - overallMedian) * notAtBestWindow).toFixed(2))
    if (missedRevenue > 5) {
      cumulative_by_platform[platform] = {
        bestLocalDay: platBest.localDay,
        bestLocalHour: platBest.localHour,
        bestWindowMedianUsdPerHour: platBest.medianUsdPerHour,
        overallMedianUsdPerHour: parseFloat(overallMedian.toFixed(2)),
        sessionsNotAtBestWindow: notAtBestWindow,
        missedRevenue,
      }
    }
  }

  // ── recent_streak_missed ─────────────────────────────────────────────
  // Rolling 3-day window: has the account's canonical best window been hit
  // at all in the last 3 days?
  let recent_streak_missed = null
  if (bestWindow) {
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    const recentSessions = meaningfulSessions.filter(s => new Date(s.startTime) >= threeDaysAgo)
    const hitRecently = recentSessions.some(s => {
      const d = LOCAL_DAY_NAMES[toLocalDow(s.startTime, tz)]
      const h = toLocalHour(s.startTime, tz)
      return d === bestWindow.localDay && h === bestWindow.localHour
    })
    if (recentSessions.length > 0 && !hitRecently) {
      recent_streak_missed = {
        localDay: bestWindow.localDay,
        localHour: bestWindow.localHour,
        estimatedLoss: parseFloat((bestWindow.medianUsdPerHour * 3).toFixed(2)),
      }
    }
  }

  return { today_missed, cumulative_by_platform, recent_streak_missed }
}
