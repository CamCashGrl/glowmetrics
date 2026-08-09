// ============================================================
// CAMCASH DASHBOARD INTELLIGENCE — ANALYTICS SNAPSHOT
// ============================================================
//
// Pure post-processing of aggregateRows()'s output — computes nothing
// itself, never a second analytics engine. Picks the small, hand-selected
// subset of fields future event types (peak window, whale, pace, platform,
// weekly/monthly — see the event catalog) need to diff "current vs.
// previous", and nothing else. Never store the full aggregateRows() object
// here — that's unbounded, mostly irrelevant to diffing, and re-deriving
// whale/session detail from a stale full snapshot would itself become a
// second source of truth.
//
// This file has no database/network access — it's a pure function over
// whatever getServerAnalytics() (lib/serverAnalytics.js) already returned.

// Only Whale/Shark tier fans are worth remembering for diffing — the whole
// point is detecting "a NEW whale appeared" or "an existing one got more
// active", not tracking every regular/dormant fan snapshot over snapshot.
const WHALE_SNAPSHOT_TIERS = new Set(['Whale', 'Shark'])

export function buildAnalyticsSnapshot(analytics) {
  if (!analytics) return null

  return {
    totalUSD: analytics.totalUSD ?? 0,
    totalTokens: analytics.totalTokens ?? 0,
    totalTips: analytics.totalTips ?? 0,
    bestDay: analytics.bestDay ? { day: analytics.bestDay.day, avg: analytics.bestDay.avg } : null,
    bestHour: analytics.bestHour ? { hour: analytics.bestHour.hour, avg: analytics.bestHour.avg } : null,
    estimatedHourlyRate: analytics.estimatedHourlyRate ?? 0,
    momentum: analytics.momentum ? { pct: analytics.momentum.pct, label: analytics.momentum.label } : null,
    streakDays: analytics.streakDays ?? 0,
    platformTotals: (analytics.platforms || []).map(p => ({
      platform: p.platform, totalUSD: p.totalUSD, usdPerHour: p.usdPerHour,
    })),
    whales: (analytics.whales || [])
      .filter(w => WHALE_SNAPSHOT_TIERS.has(w.tier))
      .map(w => ({ username: w.username, tier: w.tier, totalUSD: w.totalUSD })),
    computedAt: new Date().toISOString(),
  }
}
