// ============================================
// PLATFORMS INTELLIGENCE — DERIVATION LAYER
//
// This file computes NO primary metrics. Every earnings, hours, rate, fan and
// timing figure comes from the shared engine output (`aggregateRows` in
// lib/analytics.js), so the Platforms page cannot disagree with the rest of the
// dashboard. What lives here is presentation-level derivation only: shares of a
// total, ranking, and differences between values the engine already produced.
//
// Consequences worth knowing:
//   - The analysis window is whatever the caller ran the engine on. page.js
//     applies the free-tier 31-day window before aggregating, so this layer
//     inherits it rather than re-implementing it.
//   - Hours exclude sessions with an unknown duration, and platform totals come
//     from meaningful sessions, because analytics.platforms is built that way.
//   - Fans are identified by platform + username (fanKey), so the same name on
//     two platforms stays two people.
// ============================================

import { calculateConfidence } from './analytics'

const round2 = (n) => parseFloat((n || 0).toFixed(2))
const pct = (part, whole) => whole > 0 ? Math.round((part / whole) * 100) : 0

// =============================================
// YOUR CAM BUSINESS
// =============================================

export function buildBusinessSnapshot(analytics) {
  if (!analytics) return null

  const platforms = analytics.platforms || []
  const totalHours = (analytics.totalStreamMinutes || 0) / 60
  const sessions = analytics.meaningfulSessionCount || 0

  // Every headline total is the sum of the platform rows this page actually
  // shows — never analytics.totalUSD / totalTips, which also count tips from
  // sessions too thin to analyse. Mixing the two bases leaves the headline
  // unreconcilable against the table beneath it (639 tips above, 590 in the
  // rows) and makes every share-of-total quietly wrong.
  const totalEarnings = platforms.reduce((s, p) => s + (p.totalUSD || 0), 0)
  const totalTips = platforms.reduce((s, p) => s + (p.tips || 0), 0)

  return {
    totalEarnings: round2(totalEarnings),
    totalTips,
    totalHours: parseFloat(totalHours.toFixed(1)),
    // The engine's own estimate, derived from tip timestamps. Always an
    // estimate — imported CSVs never carry real stream start/end times.
    usdPerHour: analytics.estimatedHourlyRate ?? null,
    rateHours: parseFloat(((analytics.hourlyRateTotalMinutes || 0) / 60).toFixed(1)),
    rateUSD: analytics.hourlyRateTotalUsd ?? 0,
    sessions,
    platformCount: platforms.length,
    avgEarningsPerSession: sessions > 0 ? round2(totalEarnings / sessions) : 0,
    avgTipSize: totalTips > 0 ? round2(totalEarnings / totalTips) : 0,
    tipsPerHour: totalHours > 0 ? parseFloat((totalTips / totalHours).toFixed(1)) : 0,
    momentum: analytics.momentum || null,
  }
}

// =============================================
// WHERE YOUR MONEY COMES FROM
// Adds share-of-total to the engine's per-platform rows. Nothing is recomputed.
// =============================================

export function buildPlatformComparison(analytics) {
  const platforms = analytics?.platforms || []
  const totalEarnings = platforms.reduce((s, p) => s + (p.totalUSD || 0), 0)
  const totalHours = platforms.reduce((s, p) => s + (p.hours || 0), 0)

  return platforms
    .map(p => ({
      platform: p.platform,
      earnings: round2(p.totalUSD),
      earningsPercent: pct(p.totalUSD, totalEarnings),
      hours: parseFloat((p.hours || 0).toFixed(1)),
      hoursPercent: pct(p.hours, totalHours),
      usdPerHour: p.usdPerHour ?? 0,
      // Hours behind the rate, which is a subset of `hours` — only sessions
      // with a duration reliable enough to divide by.
      rateHours: p.rateHours ?? 0,
      rateUSD: p.rateUSD ?? 0,
      rateSessionCount: p.rateSessionCount ?? 0,
      tips: p.tips || 0,
      sessions: p.sessions || 0,
      avgTipSize: p.avgTipSize ?? 0,
      earningsPerSession: p.sessions > 0 ? round2(p.totalUSD / p.sessions) : 0,
      // null pct means the prior period holds no data to compare against, so
      // the table shows no trend rather than implying one.
      trend: analytics?.platformMomentum?.[p.platform] || null,
    }))
    .sort((a, b) => b.earnings - a.earnings)
}

// =============================================
// WHERE YOUR TIME PAYS BEST
// =============================================

export function buildEfficiencyComparison(analytics) {
  const rated = buildPlatformComparison(analytics).filter(p => p.rateHours > 0 && p.usdPerHour > 0)
  if (rated.length === 0) return []

  // Weighted average, not an average of per-platform rates: a short stint must
  // not carry the same weight as a long one.
  const totalUsd = rated.reduce((s, p) => s + p.rateUSD, 0)
  const totalHours = rated.reduce((s, p) => s + p.rateHours, 0)
  const avgUsdPerHour = totalHours > 0 ? totalUsd / totalHours : 0

  return [...rated]
    .sort((a, b) => b.usdPerHour - a.usdPerHour)
    .map((p, i) => ({
      ...p,
      efficiencyRank: i + 1,
      vsAverage: avgUsdPerHour > 0 ? Math.round(((p.usdPerHour - avgUsdPerHour) / avgUsdPerHour) * 100) : 0,
    }))
}

// =============================================
// WHEN YOU EARN BEST
// Reuses the engine's bestHour/bestDay, which rank by median earnings per
// active bucket and require at least 3 active buckets — never by raw total.
// =============================================

export function buildTimeIntelligence(analytics) {
  if (!analytics) return null

  const totalHours = (analytics.totalStreamMinutes || 0) / 60
  const confidence = calculateConfidence(analytics.meaningfulSessionCount || 0, totalHours)

  return {
    bestHour: analytics.bestHour
      ? { ...analytics.bestHour, hour: parseInt(analytics.bestHour.hour), label: formatHour(analytics.bestHour.hour) }
      : null,
    bestDay: analytics.bestDay || null,
    platformBestTimes: analytics.platformBestTimes || {},
    confidence,
    // The engine withholds bestHour/bestDay until a pattern is supportable, so
    // their absence is the signal that there is nothing trustworthy to show.
    hasPattern: Boolean(analytics.bestHour || analytics.bestDay),
  }
}

// =============================================
// WHO IS DRIVING YOUR REVENUE
// Fans come from the engine's whales list, keyed by platform + username.
// =============================================

// Fan figures are the engine's whales list, which is built from every tip —
// a wider base than the platform rows above. Percentages here are therefore
// shares of all tracked tips, and the section says so rather than implying
// they divide the platform subtotal.
export function buildFanRevenue(analytics, isPro = false) {
  const whales = analytics?.whales || []
  const totalEarnings = analytics?.totalUSD || 0

  const ranked = [...whales]
    .sort((a, b) => b.totalUSD - a.totalUSD)
    .map(f => ({
      username: f.username,
      platform: f.platform,
      earnings: round2(f.totalUSD),
      tipCount: f.tipCount || 0,
      earningsPercent: pct(f.totalUSD, totalEarnings),
    }))

  const returning = analytics?.returningVsNew || null
  const dependency = analytics?.topFanDependency || null

  return {
    uniqueTippers: ranked.length,
    // Counts only — returningPct is deliberately not surfaced: the engine
    // computes it against a different fan set than `whales`, so showing it
    // beside these counts produces a figure that contradicts them.
    returningTippers: returning?.returningCount ?? null,
    newTippers: returning?.newCount ?? null,
    topThreeContribution: dependency?.top3Pct ?? null,
    topSpender: ranked[0] || null,
    visibleSpenders: isPro ? ranked.slice(0, 8) : ranked.slice(0, 3),
    totalEarnings: round2(totalEarnings),
  }
}

// =============================================
// CAMCASH NOTICED
// Observations only where the engine's own numbers support them.
// =============================================

export function buildCamCashNoticed(analytics) {
  const insights = []
  const comparison = buildPlatformComparison(analytics)
  const efficiency = buildEfficiencyComparison(analytics)
  const fans = buildFanRevenue(analytics)

  if (comparison.length > 1 && comparison[0].earningsPercent >= 60) {
    const top = comparison[0]
    insights.push({
      icon: '📊',
      text: `${top.platform} brings in ${top.earningsPercent}% of your earnings from ${top.hoursPercent}% of your streaming hours.`,
    })
  }

  if (efficiency.length >= 2 && comparison.length > 0) {
    const topEfficiency = efficiency[0]
    const topRevenue = comparison[0]
    if (topEfficiency.platform !== topRevenue.platform && topRevenue.usdPerHour > 0) {
      insights.push({
        icon: '⚡',
        text: `${topRevenue.platform} earns the most overall, but ${topEfficiency.platform} pays better per hour ($${topEfficiency.usdPerHour.toFixed(2)} vs $${topRevenue.usdPerHour.toFixed(2)}).`,
      })
    }
  }

  if (fans.topThreeContribution !== null && fans.topThreeContribution >= 40) {
    insights.push({
      icon: '👥',
      text: `Your top 3 supporters account for ${fans.topThreeContribution}% of tracked earnings.`,
    })
  }

  const underperformer = comparison.find(p => p.hours > 0 && p.hoursPercent - p.earningsPercent >= 15)
  if (underperformer) {
    insights.push({
      icon: '📉',
      text: `${underperformer.platform} takes ${underperformer.hoursPercent}% of your hours but returns ${underperformer.earningsPercent}% of earnings.`,
    })
  }

  return insights.slice(0, 4)
}

// =============================================
// SPLIT VIEW — one platform
// =============================================

export function buildPlatformSnapshot(analytics, platformName) {
  const row = buildPlatformComparison(analytics).find(p => p.platform === platformName)
  if (!row) return null

  const times = analytics?.platformBestTimes?.[platformName] || null
  const topFans = [...(analytics?.whales || [])]
    .filter(f => f.platform === platformName)
    .sort((a, b) => b.totalUSD - a.totalUSD)
    .map(f => ({
      username: f.username,
      earnings: round2(f.totalUSD),
      tipCount: f.tipCount || 0,
      earningsPercent: pct(f.totalUSD, row.earnings),
    }))

  return {
    ...row,
    // The engine names this `bestDay`, not `day` — reading the wrong key here
    // silently blanked the best-day row on every platform.
    bestHour: times?.hour ? { ...times.hour, label: formatHour(times.hour.hour) } : null,
    bestDay: times?.bestDay || null,
    // Full per-platform breakdowns the engine already publishes.
    // Named `hourly`, not `hours`: the spread row above already carries a
    // numeric `hours`, and clobbering it with an array would blank the snapshot.
    weekdays: times?.allDays || [],
    hourly: times?.allHours || [],
    revenueMix: analytics?.platformTipTypes?.[platformName] || [],
    topFans,
    missedRevenue: analytics?.missedRevenueByPlatform?.[platformName] || null,
  }
}

// =============================================
// YOUR DATA (Phase 1 + 2 — coverage and milestones)
//
// Reports only what is on file. The earlier version of this paired the real
// history span with an "estimated available earnings" figure derived by
// multiplying lifetime revenue by a hand-picked multiplier, then showed the
// ratio as an import-progress bar. That denominator was invented, so both the
// "of ~$X lifetime" line and the percentage were fiction. Coverage is reported
// here in days actually imported, which is checkable.
// =============================================

export const FULL_WINDOW_DAYS = 31

export function buildDataCoverage(vaultStats) {
  const historyDays = vaultStats?.fullHistoryDays || 0

  return {
    historyDays,
    visibleDays: vaultStats?.visibleDays || 0,
    hasMoreThanWindow: Boolean(vaultStats?.hasMoreThanWindow),
    windowDays: FULL_WINDOW_DAYS,
    // Share of the analysis window actually covered by imported history.
    windowCoveragePct: Math.min(100, Math.round((historyDays / FULL_WINDOW_DAYS) * 100)),
    milestones: [
      { days: 1,  label: 'Started tracking',          done: historyDays >= 1 },
      { days: 7,  label: 'Weekly patterns visible',   done: historyDays >= 7 },
      { days: 14, label: 'Two-week trend',            done: historyDays >= 14 },
      { days: 21, label: 'Monthly cycle emerging',    done: historyDays >= 21 },
      { days: 31, label: 'Full month of data',        done: historyDays >= 31 },
    ],
  }
}

// =============================================
// HELPERS
// =============================================

export function formatHour(hour) {
  const h = parseInt(hour)
  if (isNaN(h)) return '—'
  if (h === 0) return '12 AM'
  if (h < 12) return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}
