// ============================================
// PLATFORMS INTELLIGENCE ANALYTICS
// Comprehensive calculations for the Platforms Intelligence page
// Requirement 26: Reuse existing analytics where possible
// ============================================

export const ANALYSIS_WINDOW_DAYS = 31

// =============================================
// BUSINESS SNAPSHOT CALCULATIONS
// Requirement 6: Your Cam Business metrics
// =============================================

export function calculateBusinessSnapshot(tips = [], sessions = [], paidSessions = []) {
  const now = new Date()
  const windowStart = new Date(now.getTime() - (ANALYSIS_WINDOW_DAYS - 1) * 86400000)

  const windowTips = tips.filter(t => new Date(t.date_time || t.dateRaw) >= windowStart)
  const windowSessions = sessions.filter(s => new Date(s.startTime) >= windowStart)
  const windowPaidSessions = paidSessions.filter(p => new Date(p.date_time || p.dateRaw) >= windowStart)

  const totalEarnings = windowTips.reduce((sum, t) => sum + (parseFloat(t.usd) || 0), 0)
  const totalTips = windowTips.length
  // Hours match the dashboard engine's convention (lib/analytics.js): sessions
  // with an unknown duration are excluded, not counted as zero-length. paid_sessions
  // carry no duration column, so they contribute no hours.
  const totalHours = windowSessions.reduce((sum, s) => s.durationUnknown ? sum : sum + (parseFloat(s.durationHours) || 0), 0)
  const usdPerHour = totalHours > 0 ? totalEarnings / totalHours : null
  const sessionCount = windowSessions.length
  const activeDays = new Set(windowTips.map(t => new Date(t.date_time || t.dateRaw).toDateString())).size

  // Secondary metrics
  const avgEarningsPerSession = sessionCount > 0 ? totalEarnings / sessionCount : 0
  const avgSessionLength = sessionCount > 0 ? totalHours / sessionCount : 0
  const avgTipsPerSession = sessionCount > 0 ? totalTips / sessionCount : 0
  const tipsPerHour = totalHours > 0 ? totalTips / totalHours : 0

  return {
    totalEarnings: parseFloat(totalEarnings.toFixed(2)),
    totalTips,
    totalHours: parseFloat(totalHours.toFixed(1)),
    usdPerHour: usdPerHour ? parseFloat(usdPerHour.toFixed(2)) : null,
    sessions: sessionCount,
    activeDays,
    avgEarningsPerSession: parseFloat(avgEarningsPerSession.toFixed(2)),
    avgSessionLength: parseFloat(avgSessionLength.toFixed(2)),
    avgTipsPerSession: parseFloat(avgTipsPerSession.toFixed(2)),
    tipsPerHour: parseFloat(tipsPerHour.toFixed(2)),
  }
}

// =============================================
// PLATFORM COMPARISON (WHERE YOUR MONEY COMES FROM)
// Requirement 7: Platform comparison table
// =============================================

export function calculatePlatformComparison(platforms = [], tips = [], sessions = [], paidSessions = []) {
  const now = new Date()
  const windowStart = new Date(now.getTime() - (ANALYSIS_WINDOW_DAYS - 1) * 86400000)

  const businessSnapshot = calculateBusinessSnapshot(tips, sessions, paidSessions)
  const totalEarnings = businessSnapshot.totalEarnings
  const totalHours = businessSnapshot.totalHours

  return platforms.map(platform => {
    const resolvePlatform = (p) => p?.toLowerCase().trim() || ''
    const plat = resolvePlatform(platform)

    const platTips = tips.filter(t => resolvePlatform(t.platform) === plat && new Date(t.date_time || t.dateRaw) >= windowStart)
    const platSessions = sessions.filter(s => resolvePlatform(s.platform) === plat && new Date(s.startTime) >= windowStart)
    const platPaidSessions = paidSessions.filter(p => resolvePlatform(p.platform) === plat && new Date(p.date_time || p.dateRaw) >= windowStart)

    const earnings = platTips.reduce((sum, t) => sum + (parseFloat(t.usd) || 0), 0)
    const tipCount = platTips.length
    const hours = platSessions.reduce((sum, s) => s.durationUnknown ? sum : sum + (parseFloat(s.durationHours) || 0), 0)
    const sessionsCount = platSessions.length
    const activeDays = new Set(platTips.map(t => new Date(t.date_time || t.dateRaw).toDateString())).size
    const usdPerHour = hours > 0 ? earnings / hours : 0
    const earningsPerSession = sessionsCount > 0 ? earnings / sessionsCount : 0

    const earningsPercent = totalEarnings > 0 ? Math.round((earnings / totalEarnings) * 100) : 0
    const hoursPercent = totalHours > 0 ? Math.round((hours / totalHours) * 100) : 0

    return {
      platform,
      earnings: parseFloat(earnings.toFixed(2)),
      earningsPercent,
      tips: tipCount,
      hours: parseFloat(hours.toFixed(1)),
      hoursPercent,
      sessions: sessionsCount,
      activeDays,
      usdPerHour: parseFloat(usdPerHour.toFixed(2)),
      earningsPerSession: parseFloat(earningsPerSession.toFixed(2)),
      trend: null, // TODO: calculate trend if historical data available
    }
  }).filter(p => p.earnings > 0 || p.tips > 0 || p.sessions > 0)
}

// =============================================
// EFFICIENCY COMPARISON (WHERE YOUR TIME PAYS BEST)
// Requirement 8: Revenue vs Time analysis
// =============================================

export function calculateEfficiencyComparison(platforms = [], tips = [], sessions = [], paidSessions = []) {
  const comparison = calculatePlatformComparison(platforms, tips, sessions, paidSessions)
  const avgUsdPerHour = comparison.length > 0
    ? comparison.reduce((sum, p) => sum + p.usdPerHour, 0) / comparison.length
    : 0

  return comparison.map(p => ({
    ...p,
    efficiencyRank: comparison.filter(x => x.usdPerHour >= p.usdPerHour).length,
    vsAverage: avgUsdPerHour > 0 ? Math.round(((p.usdPerHour - avgUsdPerHour) / avgUsdPerHour) * 100) : 0,
    isTopRevenue: p.earnings === Math.max(...comparison.map(x => x.earnings)),
    isTopEfficiency: p.usdPerHour === Math.max(...comparison.map(x => x.usdPerHour)),
  }))
}

// =============================================
// TIME INTELLIGENCE (WHEN YOU EARN BEST)
// Requirement 10: Cross-platform timing analysis
// =============================================

export function calculateTimeIntelligence(tips = [], sessions = []) {
  const now = new Date()
  const windowStart = new Date(now.getTime() - (ANALYSIS_WINDOW_DAYS - 1) * 86400000)

  const windowTips = tips.filter(t => new Date(t.date_time || t.dateRaw) >= windowStart)

  // Calculate by hour
  const hourlyData = {}
  for (let h = 0; h < 24; h++) hourlyData[h] = { earnings: 0, tips: 0, sessions: 0 }

  windowTips.forEach(t => {
    const hour = new Date(t.date_time || t.dateRaw).getHours()
    hourlyData[hour].earnings += parseFloat(t.usd) || 0
    hourlyData[hour].tips += 1
  })

  const bestHour = Object.entries(hourlyData)
    .map(([hour, data]) => ({ hour: parseInt(hour), ...data }))
    .filter(h => h.tips > 0)
    .sort((a, b) => b.earnings - a.earnings)[0]

  // Calculate by day of week
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dailyData = {}
  dayNames.forEach((day, idx) => {
    dailyData[idx] = { day, earnings: 0, tips: 0 }
  })

  windowTips.forEach(t => {
    const dayIndex = new Date(t.date_time || t.dateRaw).getDay()
    dailyData[dayIndex].earnings += parseFloat(t.usd) || 0
    dailyData[dayIndex].tips += 1
  })

  const bestDay = Object.values(dailyData)
    .filter(d => d.tips > 0)
    .sort((a, b) => b.earnings - a.earnings)[0]

  const totalTips = windowTips.length
  const dataQuality = totalTips < 10 ? 'insufficient' : totalTips < 50 ? 'limited' : 'adequate'

  return {
    bestHour: bestHour ? { ...bestHour, label: formatHour(bestHour.hour) } : null,
    bestDay: bestDay || null,
    dataQuality,
    confidence: totalTips < 10 ? 'Not enough data yet' : 'Based on your available data',
    hourlyData,
    dailyData: Object.values(dailyData),
  }
}

// =============================================
// FAN REVENUE ANALYSIS (WHO DRIVES YOUR REVENUE)
// Requirement 11: Fan contribution analysis
// =============================================

export function calculateFanRevenueSummary(tips = [], isPro = false) {
  const now = new Date()
  const windowStart = new Date(now.getTime() - (ANALYSIS_WINDOW_DAYS - 1) * 86400000)
  const windowTips = tips.filter(t => new Date(t.date_time || t.dateRaw) >= windowStart)

  const fanData = {}
  let totalEarnings = 0

  windowTips.forEach(t => {
    const fan = t.username || 'Guest'
    if (!fanData[fan]) fanData[fan] = { username: fan, earnings: 0, tipCount: 0, lastTip: null }
    fanData[fan].earnings += parseFloat(t.usd) || 0
    fanData[fan].tipCount += 1
    fanData[fan].lastTip = new Date(t.date_time || t.dateRaw)
    totalEarnings += parseFloat(t.usd) || 0
  })

  const sortedFans = Object.values(fanData)
    .map(f => ({ ...f, earningsPercent: totalEarnings > 0 ? Math.round((f.earnings / totalEarnings) * 100) : 0 }))
    .sort((a, b) => b.earnings - a.earnings)

  const uniqueTippers = sortedFans.length
  const returningTippers = sortedFans.filter(f => f.tipCount >= 2).length
  const topSpender = sortedFans[0] || null
  const topThreeSpenders = sortedFans.slice(0, 3)
  const topThreeContribution = topThreeSpenders.reduce((sum, f) => sum + f.earningsPercent, 0)

  return {
    uniqueTippers,
    returningTippers,
    newTippers: uniqueTippers - returningTippers,
    topSpender,
    topThreeSpenders,
    topThreeContribution,
    totalEarnings: parseFloat(totalEarnings.toFixed(2)),
    // Pro-only metrics
    ...(isPro && {
      fullSpenderRanking: sortedFans,
      fanActivity: sortedFans.map(f => ({
        fan: f.username,
        lastTipDaysAgo: f.lastTip ? Math.floor((now - f.lastTip) / 86400000) : null,
      })),
    }),
  }
}

// =============================================
// CAMCASH NOTICED INSIGHTS
// Requirement 12: Real data-driven observations
// =============================================

export function generateCamCashNoticed(tips = [], sessions = [], paidSessions = [], platforms = [], isPro = false) {
  const insights = []
  const snapshot = calculateBusinessSnapshot(tips, sessions, paidSessions)
  const comparison = calculatePlatformComparison(platforms, tips, sessions, paidSessions)
  const efficiency = calculateEfficiencyComparison(platforms, tips, sessions, paidSessions)
  const fanSummary = calculateFanRevenueSummary(tips, isPro)

  // Insight 1: Revenue concentration
  if (comparison.length > 0) {
    const topPlatform = comparison[0]
    if (topPlatform.earningsPercent >= 60) {
      insights.push({
        icon: '📊',
        text: `${topPlatform.platform} generates ${topPlatform.earningsPercent}% of your connected earnings from ${topPlatform.hoursPercent}% of your streaming hours.`,
        type: 'concentration',
        data: { platform: topPlatform.platform, earningsPercent: topPlatform.earningsPercent },
      })
    }
  }

  // Insight 2: Efficiency mismatch
  if (efficiency.length >= 2) {
    const topRevenue = efficiency.sort((a, b) => b.earnings - a.earnings)[0]
    const topEfficiency = efficiency.sort((a, b) => b.usdPerHour - a.usdPerHour)[0]
    if (topRevenue.platform !== topEfficiency.platform) {
      insights.push({
        icon: '⚡',
        text: `${topRevenue.platform} generates the most revenue, but ${topEfficiency.platform} is currently more efficient (${topEfficiency.usdPerHour.toFixed(2)}/hr vs ${topRevenue.usdPerHour.toFixed(2)}/hr).`,
        type: 'efficiency',
        data: { topRevenue: topRevenue.platform, topEfficiency: topEfficiency.platform },
      })
    }
  }

  // Insight 3: Fan concentration
  if (fanSummary.topThreeContribution >= 40) {
    insights.push({
      icon: '👥',
      text: `Your top 3 supporters account for ${fanSummary.topThreeContribution}% of your tracked tips.`,
      type: 'fans',
      data: { concentration: fanSummary.topThreeContribution },
    })
  }

  // Insight 4: Platform underperformance
  if (comparison.length > 1) {
    const underperformer = comparison.find(p => p.hoursPercent > p.earningsPercent && p.hoursPercent - p.earningsPercent >= 15)
    if (underperformer) {
      insights.push({
        icon: '📉',
        text: `${underperformer.platform} consumes ${underperformer.hoursPercent}% of your streaming hours but generates only ${underperformer.earningsPercent}% of earnings.`,
        type: 'performance',
        data: { platform: underperformer.platform },
      })
    }
  }

  return insights.slice(0, 4) // Max 4 insights
}

// =============================================
// PLATFORM-SPECIFIC CALCULATIONS (SPLIT VIEW)
// =============================================

export function calculatePlatformSnapshot(platformName, tips = [], sessions = [], paidSessions = []) {
  const resolvePlatform = (p) => p?.toLowerCase().trim() || ''
  const plat = resolvePlatform(platformName)

  const platTips = tips.filter(t => resolvePlatform(t.platform) === plat)
  const platSessions = sessions.filter(s => resolvePlatform(s.platform) === plat)
  const platPaidSessions = paidSessions.filter(p => resolvePlatform(p.platform) === plat)

  const now = new Date()
  const windowStart = new Date(now.getTime() - (ANALYSIS_WINDOW_DAYS - 1) * 86400000)
  const windowTips = platTips.filter(t => new Date(t.date_time || t.dateRaw) >= windowStart)
  const windowSessions = platSessions.filter(s => new Date(s.startTime) >= windowStart)
  const windowPaidSessions = platPaidSessions.filter(p => new Date(p.date_time || p.dateRaw) >= windowStart)

  const earnings = windowTips.reduce((sum, t) => sum + (parseFloat(t.usd) || 0), 0)
  const tipCount = windowTips.length
  const hours = windowSessions.reduce((sum, s) => s.durationUnknown ? sum : sum + (parseFloat(s.durationHours) || 0), 0)
  const sessionsCount = windowSessions.length
  const activeDays = new Set(windowTips.map(t => new Date(t.date_time || t.dateRaw).toDateString())).size
  const usdPerHour = hours > 0 ? earnings / hours : null
  const earningsPerSession = sessionsCount > 0 ? earnings / sessionsCount : 0
  const tipsPerHour = hours > 0 ? tipCount / hours : 0
  const avgSessionLength = sessionsCount > 0 ? hours / sessionsCount : 0

  // History
  const allDates = platTips.map(t => new Date(t.date_time || t.dateRaw).getTime()).sort((a, b) => a - b)
  const earliestDate = allDates.length > 0 ? new Date(Math.min(...allDates)) : null
  const daysAvailable = earliestDate ? Math.floor((now - earliestDate) / 86400000) + 1 : 0

  return {
    platform: platformName,
    earnings: parseFloat(earnings.toFixed(2)),
    tips: tipCount,
    hours: parseFloat(hours.toFixed(1)),
    usdPerHour: usdPerHour ? parseFloat(usdPerHour.toFixed(2)) : null,
    sessions: sessionsCount,
    activeDays,
    earningsPerSession: parseFloat(earningsPerSession.toFixed(2)),
    tipsPerHour: parseFloat(tipsPerHour.toFixed(2)),
    avgSessionLength: parseFloat(avgSessionLength.toFixed(2)),
    earliestDate,
    daysAvailable,
    hasData: earnings > 0 || tips > 0,
  }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

function formatHour(hour) {
  if (hour === 0) return '12 AM'
  if (hour < 12) return `${hour} AM`
  if (hour === 12) return '12 PM'
  return `${hour - 12} PM`
}

export { formatHour }
