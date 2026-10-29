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

import { calculateConfidence, fanKey, toLocalDateStr } from './analytics'

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

// Comprehensive platform metrics — includes all platforms regardless of data sufficiency
// Shows peak hours + $/hr for each platform, with data confidence labels
export function buildAllPlatformMetrics(analytics) {
  const platforms = analytics?.platforms || []
  if (platforms.length === 0) return []

  return platforms
    .map(p => {
      const peakHourData = analytics?.platformBestTimes?.[p.platform]
      const hasRateData = p.rateHours > 0 && p.usdPerHour > 0
      const hasPeakHour = peakHourData?.hour !== null && peakHourData?.hour !== undefined

      return {
        platform: p.platform,
        earnings: round2(p.totalUSD || 0),
        sessions: p.sessions || 0,
        hours: parseFloat((p.hours || 0).toFixed(1)),
        usdPerHour: hasRateData ? p.usdPerHour : 0,
        rateHours: p.rateHours ?? 0,
        peakHour: hasPeakHour ? parseInt(peakHourData.hour) : null,
        tips: p.tips || 0,
        // Data confidence indicators
        hasRateData,
        hasPeakHourData: hasPeakHour,
        isEarlySignal: !hasRateData || p.rateHours < 2 // Less than 2 hours of rated data
      }
    })
    .sort((a, b) => b.earnings - a.earnings)
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

  // Needs recorded hours: with none, hoursPercent is 0 and the sentence would
  // claim the platform earns its share from "0% of your streaming hours".
  if (comparison.length > 1 && comparison[0].earningsPercent >= 60 && comparison[0].hours > 0) {
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
// PLATFORM PULSE — the Platforms page's return loop
//
// Everything below re-reads engine output (platform rows, meaningful/valid
// sessions, whales, platformMomentum). Nothing here re-runs session
// detection, rate math or windowing; the engine already applied the plan's
// window, so Free accounts only ever see what they are entitled to.
// =============================================

// Per-platform figures the engine publishes in pieces: fans come from the
// whales list (platform + username identity) and the biggest tip from the
// engine's own session partition, which covers every tip it was given.
export function buildPlatformExtras(analytics) {
  const extras = {}
  const ensure = (p) => (extras[p] ||= { uniqueFans: 0, biggestTip: 0 })
  for (const w of analytics?.whales || []) ensure(w.platform).uniqueFans += 1
  for (const s of analytics?.allValidSessions || []) {
    for (const t of s.tips || []) {
      const e = ensure(s.platform)
      if ((t.usd || 0) > e.biggestTip) e.biggestTip = round2(t.usd)
    }
  }
  return extras
}

// The most recent meaningful session (the engine's definition of a stream:
// 30+ minutes and 2+ tips) and what it changed. Returning / new are judged
// against every earlier valid session on the same platform; with no earlier
// session there is nothing to compare, so those counts are null, not zero.
export function buildLatestStreamRecap(analytics) {
  const meaningful = analytics?.meaningfulSessions || analytics?.sessions || []
  if (meaningful.length === 0) return null
  const latest = meaningful.reduce((a, b) => (new Date(b.endTime) > new Date(a.endTime) ? b : a))
  const latestStart = new Date(latest.startTime)

  const earlier = (analytics?.allValidSessions || []).filter(s => new Date(s.endTime) < latestStart)
  const seenBefore = new Set()
  for (const s of earlier) for (const t of s.tips || []) seenBefore.add(fanKey(s.platform, t.username))

  const sessionFans = new Set((latest.tips || []).map(t => fanKey(latest.platform, t.username)))
  const hasHistory = earlier.some(s => s.platform === latest.platform)
  const returningFans = hasHistory ? [...sessionFans].filter(k => seenBefore.has(k)).length : null
  const newSpenders = hasHistory ? [...sessionFans].filter(k => !seenBefore.has(k)).length : null

  // Revenue-share movement: the platform rows with and without this session's
  // own tips. Shares are of the same platform-row total the page shows.
  const rows = analytics?.platforms || []
  const totalNow = rows.reduce((s, p) => s + (p.totalUSD || 0), 0)
  const before = rows.map(p => ({ platform: p.platform, usd: (p.totalUSD || 0) - (p.platform === latest.platform ? latest.totalUSD : 0) }))
  const totalBefore = before.reduce((s, p) => s + p.usd, 0)
  const leaderOf = (list, key) => [...list].sort((a, b) => b[key] - a[key])[0]?.platform || null
  const leaderNow = leaderOf(rows, 'totalUSD')
  const leaderBefore = totalBefore > 0 ? leaderOf(before, 'usd') : null
  const row = rows.find(p => p.platform === latest.platform)
  const shareNow = row && totalNow > 0 ? (row.totalUSD / totalNow) * 100 : 0
  const shareBefore = totalBefore > 0 ? (before.find(p => p.platform === latest.platform).usd / totalBefore) * 100 : null

  return {
    platform: latest.platform,
    startTime: latest.startTime,
    endTime: latest.endTime,
    earned: round2(latest.totalUSD),
    tips: latest.tipCount,
    fans: sessionFans.size,
    durationMinutes: latest.durationUnknown ? null : latest.durationMinutes,
    returningFans,
    newSpenders,
    // Only multi-platform accounts have a share to move or a lead to take.
    shareShiftPts: rows.length > 1 && shareBefore !== null ? Math.round(shareNow - shareBefore) : null,
    tookLead: rows.length > 1 && leaderBefore !== null && leaderNow === latest.platform && leaderBefore !== latest.platform,
    priorSessionCount: earlier.length,
  }
}

// Deterministic card badges. Each maps to one engine field:
//   Leading      — top earnings row, only when there is something to lead
//   Latest stream — platform of the most recent meaningful session
//   Gaining / Cooling — engine platformMomentum label (last 30 vs prior 30 days)
//   Still learning — calculateConfidence 'Very Low' on this platform's sample
export function buildPlatformStatuses(analytics, recap = buildLatestStreamRecap(analytics)) {
  const comparison = buildPlatformComparison(analytics)
  const out = {}
  comparison.forEach((p, i) => {
    const badges = []
    if (comparison.length > 1 && i === 0 && p.earnings > 0) badges.push('leading')
    if (recap && recap.platform === p.platform) badges.push('latest')
    const label = p.trend?.label
    if (label === 'Growing' || label === 'Surging') badges.push('gaining')
    else if (label === 'Declining' || label === 'Inactive') badges.push('cooling')
    if (calculateConfidence(p.sessions, p.hours).level === 'Very Low') badges.push('learning')
    out[p.platform] = badges
  })
  return out
}

// Where the account stands against the engine's own confidence bands —
// counts only, never a made-up progress percentage.
export function buildLearningState(analytics) {
  const rows = analytics?.platforms || []
  const sessions = analytics?.meaningfulSessionCount || 0
  const hours = (analytics?.totalStreamMinutes || 0) / 60
  const confidence = calculateConfidence(sessions, hours)
  return {
    platforms: rows.length,
    sessions,
    tips: rows.reduce((s, p) => s + (p.tips || 0), 0),
    hours: parseFloat(hours.toFixed(1)),
    confidence,
    isLearning: confidence.level === 'Very Low',
    // The 'Very Low' band ends at 3 meaningful sessions and 3 streamed hours.
    sessionsNeeded: Math.max(0, 3 - sessions),
    hoursNeeded: Math.max(0, parseFloat((3 - hours).toFixed(1))),
  }
}

// Cross-platform findings that need two or more platforms. Each carries a
// `teaser` with the platform names withheld, so Free accounts are told a
// finding exists (it really does) without being shown it.
export function buildCrossPlatformInsights(analytics) {
  const comparison = buildPlatformComparison(analytics)
  if (comparison.length < 2) return []
  const leader = comparison[0]
  const out = []
  // Platform-vs-platform claims need a usable sample on both sides — the
  // engine's 'Very Low' band (under 3 meaningful sessions or 3 hours) is out.
  const sampled = (p) => calculateConfidence(p.sessions, p.hours).level !== 'Very Low'

  // Average tip: a smaller platform whose tips are clearly bigger. Both sides
  // need 10+ tips so one large tip can't manufacture the finding.
  const biggerTips = comparison.slice(1)
    .filter(p => sampled(p) && sampled(leader) && p.tips >= 10 && leader.tips >= 10 && leader.avgTipSize > 0 && p.avgTipSize >= leader.avgTipSize * 1.2)
    .sort((a, b) => b.avgTipSize - a.avgTipSize)[0]
  if (biggerTips) {
    const diff = Math.round(((biggerTips.avgTipSize - leader.avgTipSize) / leader.avgTipSize) * 100)
    out.push({
      id: 'avg_tip',
      text: `Your average tip on ${biggerTips.platform} is ${diff}% higher than on ${leader.platform} ($${biggerTips.avgTipSize.toFixed(2)} vs $${leader.avgTipSize.toFixed(2)}), even though ${leader.platform} earns more overall.`,
      teaser: 'One of your platforms beats your top earner on average tip size.',
      cta: 'See the insight',
    })
  }

  // Growth: only when both platforms have a measured trend (prior period present).
  if (sampled(leader) && leader.trend?.pct !== null && leader.trend?.pct !== undefined) {
    const faster = comparison.slice(1)
      .filter(p => sampled(p) && p.trend?.pct !== null && p.trend?.pct !== undefined && (p.trend.label === 'Growing' || p.trend.label === 'Surging') && p.trend.pct > leader.trend.pct)
      .sort((a, b) => b.trend.pct - a.trend.pct)[0]
    if (faster) {
      out.push({
        id: 'growth',
        text: `${leader.platform} generates most of your earnings, but ${faster.platform} is growing faster: ${faster.trend.pct > 0 ? '+' : ''}${faster.trend.pct}% vs ${leader.trend.pct > 0 ? '+' : ''}${leader.trend.pct}% over the last 30 days.`,
        teaser: 'A platform other than your top earner is growing faster right now.',
        cta: 'Reveal the platform',
      })
    }
  }

  // Top spenders: where the five biggest supporters actually tip.
  const top = [...(analytics?.whales || [])].sort((a, b) => b.totalUSD - a.totalUSD).slice(0, 5)
  if (top.length === 5) {
    const counts = {}
    top.forEach(w => { counts[w.platform] = (counts[w.platform] || 0) + 1 })
    const [mainPlat, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    if (mainPlat !== leader.platform && n >= 3) {
      out.push({
        id: 'top_spenders',
        text: `${n} of your 5 highest-spending fans tip on ${mainPlat}, not ${leader.platform}, your highest-earning platform.`,
        teaser: 'Your highest-spending fans are not concentrated on your highest-earning platform.',
        cta: "See where they're spending",
      })
    }
  }

  // Hourly-rate gaps are deliberately absent: buildCamCashNoticed already
  // states them on every plan, so a Pro teaser for one would sell what Free
  // users can already read.

  return out
}

// Last 30 days vs the 30 before, per platform, from the engine's
// platformMomentum sums. Only returned when the prior period holds revenue.
export function buildShareShift(analytics) {
  const m = analytics?.platformMomentum || {}
  const rows = Object.entries(m).map(([platform, v]) => ({ platform, last: v.last30USD || 0, prior: v.prior30USD || 0 }))
  const lastTotal = rows.reduce((s, r) => s + r.last, 0)
  const priorTotal = rows.reduce((s, r) => s + r.prior, 0)
  if (rows.length < 2 || lastTotal <= 0 || priorTotal <= 0) return null
  return rows
    .map(r => ({ ...r, lastPct: pct(r.last, lastTotal), priorPct: pct(r.prior, priorTotal) }))
    .map(r => ({ ...r, shiftPts: r.lastPct - r.priorPct }))
    .sort((a, b) => b.lastPct - a.lastPct)
}

// Platform revenue by calendar month in the creator's timezone, from the
// engine's own session partition (which holds every tip it was given, so the
// months sum to the platform rows). Months are bucketed with the engine's
// toLocalDateStr — never UTC. Returned only when there are 2+ months.
export function buildPlatformMonthlyHistory(analytics, tz) {
  const months = {}
  for (const s of analytics?.allValidSessions || []) {
    for (const t of s.tips || []) {
      const key = toLocalDateStr(t.dateRaw || t.date_time, tz).slice(0, 7)
      ;(months[key] ||= {})[s.platform] = (months[key][s.platform] || 0) + (t.usd || 0)
    }
  }
  const keys = Object.keys(months).sort()
  if (keys.length < 2) return null
  return keys.map(month => {
    const byPlatform = months[month]
    const total = Object.values(byPlatform).reduce((a, b) => a + b, 0)
    return {
      month,
      total: round2(total),
      platforms: Object.entries(byPlatform)
        .map(([platform, usd]) => ({ platform, usd: round2(usd), pct: pct(usd, total) }))
        .sort((a, b) => b.usd - a.usd),
    }
  })
}

// Fans whose first recorded tip falls in the last `days` days, per platform.
// Read from the engine's whales list (firstTipDate, platform + username).
export function buildNewFans(analytics, { now = Date.now(), days = 7 } = {}) {
  const since = now - days * 86400000
  const byPlatform = {}
  let total = 0
  for (const w of analytics?.whales || []) {
    const first = new Date(w.firstTipDate).getTime()
    if (!isNaN(first) && first >= since && first <= now) {
      byPlatform[w.platform] = (byPlatform[w.platform] || 0) + 1
      total += 1
    }
  }
  return { total, byPlatform, days }
}

// Platform activity feed: only real, dated events.
//   - earnings per platform in the last 24 hours (tip timestamps)
//   - new fans per platform in the last 7 days (first tip)
//   - the latest stream's top returning fan, by name
//   - the latest stream's revenue-share movement
export function buildPlatformActivity(analytics, { now = Date.now(), recap = buildLatestStreamRecap(analytics) } = {}) {
  const items = []
  const dayAgo = now - 86400000
  const last24 = {}
  for (const s of analytics?.allValidSessions || []) {
    for (const t of s.tips || []) {
      const ts = new Date(t.dateRaw || t.date_time).getTime()
      if (ts >= dayAgo && ts <= now) last24[s.platform] = (last24[s.platform] || 0) + (t.usd || 0)
    }
  }
  Object.entries(last24).sort((a, b) => b[1] - a[1]).forEach(([platform, usd]) => {
    if (usd > 0) items.push({ kind: 'earned24h', platform, text: `${platform} +$${usd.toFixed(2)}`, sub: 'last 24 hours' })
  })

  const fresh = buildNewFans(analytics, { now })
  Object.entries(fresh.byPlatform).sort((a, b) => b[1] - a[1]).forEach(([platform, n]) => {
    items.push({ kind: 'newFans', platform, text: `${n} new ${platform} ${n === 1 ? 'spender' : 'spenders'}`, sub: 'first tip this week' })
  })

  if (recap && recap.returningFans) {
    const meaningful = analytics?.meaningfulSessions || []
    const latest = meaningful.find(s => s.endTime === recap.endTime && s.platform === recap.platform)
    const earlier = new Set()
    for (const s of analytics?.allValidSessions || []) {
      if (new Date(s.endTime) < new Date(recap.startTime)) for (const t of s.tips || []) earlier.add(fanKey(s.platform, t.username))
    }
    const spend = {}
    for (const t of latest?.tips || []) {
      const k = fanKey(recap.platform, t.username)
      if (earlier.has(k)) spend[t.username] = (spend[t.username] || 0) + (t.usd || 0)
    }
    const top = Object.entries(spend).sort((a, b) => b[1] - a[1])[0]
    if (top) items.push({ kind: 'returning', platform: recap.platform, text: `${top[0]} tipped again`, sub: `$${top[1].toFixed(2)} on ${recap.platform}` })
  }

  if (recap && recap.shareShiftPts) {
    items.push({ kind: 'share', platform: recap.platform, text: `${recap.platform} ${recap.shareShiftPts > 0 ? '+' : ''}${recap.shareShiftPts}% revenue share`, sub: 'after your latest stream' })
  }
  return items
}

// What arrived after the viewer's previous visit to this page. `sinceMs` is
// that visit's timestamp (kept in the viewer's own browser); every figure is
// read from the engine's session tips and whales, by tip timestamp.
export function buildSinceLastVisit(analytics, sinceMs, now = Date.now()) {
  if (!Number.isFinite(sinceMs) || sinceMs <= 0 || sinceMs >= now) return null
  const byPlatform = {}
  let totalUSD = 0, tips = 0
  for (const s of analytics?.allValidSessions || []) {
    for (const t of s.tips || []) {
      const ts = new Date(t.dateRaw || t.date_time).getTime()
      if (!(ts > sinceMs && ts <= now)) continue
      const p = (byPlatform[s.platform] ||= { usd: 0, tips: 0 })
      p.usd += t.usd || 0
      p.tips += 1
      totalUSD += t.usd || 0
      tips += 1
    }
  }
  let newFans = 0
  for (const w of analytics?.whales || []) {
    const first = new Date(w.firstTipDate).getTime()
    if (first > sinceMs && first <= now) newFans += 1
  }
  return {
    since: sinceMs,
    totalUSD: round2(totalUSD),
    tips,
    newFans,
    platforms: Object.entries(byPlatform)
      .map(([platform, v]) => ({ platform, usd: round2(v.usd), tips: v.tips }))
      .sort((a, b) => b.usd - a.usd),
  }
}

// Daily earnings for the last `days` creator-local days, total and per
// platform, from the engine's session tips. Days are keyed with the engine's
// toLocalDateStr in the creator's timezone; days with no tips are real zeros.
// Returns null when the window holds no earnings at all.
export function buildDailySeries(analytics, tz, { days = 30, now = Date.now() } = {}) {
  const keys = []
  for (let i = days - 1; i >= 0; i--) keys.push(toLocalDateStr(new Date(now - i * 86400000).toISOString(), tz))
  const uniq = [...new Set(keys)]
  const index = new Map(uniq.map((k, i) => [k, i]))
  const total = uniq.map(() => 0)
  const byPlatform = {}
  let any = false
  for (const s of analytics?.allValidSessions || []) {
    for (const t of s.tips || []) {
      const i = index.get(toLocalDateStr(t.dateRaw || t.date_time, tz))
      if (i === undefined) continue
      const usd = t.usd || 0
      total[i] += usd
      ;(byPlatform[s.platform] ||= uniq.map(() => 0))[i] += usd
      if (usd > 0) any = true
    }
  }
  if (!any) return null
  const r = (arr) => arr.map(round2)
  return {
    days: uniq,
    total: r(total),
    byPlatform: Object.fromEntries(Object.entries(byPlatform).map(([p, a]) => [p, r(a)])),
    activeDays: total.filter(v => v > 0).length,
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
