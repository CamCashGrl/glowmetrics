// ============================================
// PLATFORM INTELLIGENCE CALCULATIONS
// Extracted from DashboardPreview.js for reuse
// in Platforms Intelligence page and other components
// ============================================

const SNAPSHOT_WINDOW_DAYS = 31
const UTC_DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// =============================================
// PHASE 1: Lifetime Import Progress
// =============================================

export function calculateDataMilestones(maxHistoryDays) {
  return [
    { days: 1, label: 'Started tracking', done: maxHistoryDays >= 1 },
    { days: 7, label: 'Weekly patterns visible', done: maxHistoryDays >= 7 },
    { days: 14, label: 'Two-week trend established', done: maxHistoryDays >= 14 },
    { days: 21, label: 'Monthly cycle emerging', done: maxHistoryDays >= 21 },
    { days: 31, label: 'Full month of data', done: maxHistoryDays >= 31 },
  ]
}

export function computePlatformCardStats(platform, tips = [], paidSessions = [], windowDays = SNAPSHOT_WINDOW_DAYS) {
  const resolvePlatformName = (p) => p?.toLowerCase().trim() || ''
  const platTips = (tips || []).filter(t => resolvePlatformName(t.platform) === resolvePlatformName(platform))
  const platPaid = (paidSessions || []).filter(p => resolvePlatformName(p.platform) === resolvePlatformName(platform))

  const now = new Date()
  const windowStart = new Date(now.getTime() - (windowDays - 1) * 86400000)

  // Window: recent performance (tips only)
  const windowTips = platTips.filter(t => new Date(t.date_time || t.dateRaw) >= windowStart)

  // Lifetime: all data to calculate fullHistoryDays
  const allData = [...platTips, ...platPaid]
  let earliestDate = null
  let fullHistoryDays = 0
  if (allData.length > 0) {
    const dates = allData.map(d => new Date(d.date_time || d.dateRaw).getTime()).filter(t => !isNaN(t))
    if (dates.length > 0) {
      const minDate = new Date(Math.min(...dates))
      earliestDate = minDate
      fullHistoryDays = Math.floor((now - minDate) / 86400000) + 1
    }
  }

  // Lifetime USD (all tips from this platform)
  const lifetimeUSD = platTips.reduce((sum, t) => sum + (parseFloat(t.usd) || 0), 0)

  // Estimation: progressive multiplier based on data depth
  let estimatedAvailable = lifetimeUSD
  if (fullHistoryDays > 0 && fullHistoryDays < 31) {
    const dayRatio = fullHistoryDays / 31
    if (dayRatio < 1/30) estimatedAvailable = lifetimeUSD * 10
    else if (dayRatio < 1/14) estimatedAvailable = lifetimeUSD * 8
    else if (dayRatio < 1/7) estimatedAvailable = lifetimeUSD * 6
    else if (dayRatio < 1/3) estimatedAvailable = lifetimeUSD * 5
    else estimatedAvailable = lifetimeUSD * 3
  }

  const importProgress = estimatedAvailable > 0 ? Math.round((lifetimeUSD / estimatedAvailable) * 100) : 0
  const importMissing = Math.max(0, estimatedAvailable - lifetimeUSD)

  // Window metrics
  const windowUSD = windowTips.reduce((sum, t) => sum + (parseFloat(t.usd) || 0), 0)
  const tipCount = windowTips.length
  const avgTipSize = tipCount > 0 ? windowUSD / tipCount : 0

  // Hours calculation: count sessions, not duplicate tips
  let totalHours = 0
  if (paidSessions.length > 0) {
    const windowPaidSessions = platPaid.filter(p => new Date(p.date_time || p.dateRaw) >= windowStart)
    totalHours = windowPaidSessions.reduce((sum, s) => sum + (parseFloat(s.duration_hours) || 0), 0)
  }

  const usdPerHour = totalHours > 0 ? windowUSD / totalHours : null

  return {
    platform,
    usd: parseFloat(windowUSD.toFixed(2)),
    tipCount,
    hours: parseFloat(totalHours.toFixed(1)),
    usdPerHour: usdPerHour ? parseFloat(usdPerHour.toFixed(2)) : null,
    avgTipSize: parseFloat(avgTipSize.toFixed(2)),
    lifetimeUSD: parseFloat(lifetimeUSD.toFixed(2)),
    estimatedAvailable: parseFloat(estimatedAvailable.toFixed(2)),
    importProgress,
    importMissing: parseFloat(importMissing.toFixed(2)),
    fullHistoryDays,
    earliestDate,
    windowDays,
    hasData: lifetimeUSD > 0,
  }
}

// =============================================
// PHASE 3: Platform Breakdown
// =============================================

export function calculateSessionTypeBreakdown(tips = [], paidSessions = [], platformName = '', windowDays = SNAPSHOT_WINDOW_DAYS) {
  const resolvePlatformName = (p) => p?.toLowerCase().trim() || ''
  const platTips = (tips || []).filter(t => resolvePlatformName(t.platform) === resolvePlatformName(platformName))
  const platPaid = (paidSessions || []).filter(p => resolvePlatformName(p.platform) === resolvePlatformName(platformName))

  const allRevenue = [
    ...platTips.map(t => ({ ...t, _source: 'tip', session_type: t.tip_type || 'Tip' })),
    ...platPaid.map(p => ({ ...p, _source: 'paid', session_type: p.session_type || 'Private' }))
  ]

  const now = new Date()
  const windowStart = new Date(now.getTime() - (windowDays - 1) * 86400000)
  const windowRevenue = allRevenue.filter(r => new Date(r.date_time || r.dateRaw) >= windowStart)

  const breakdown = {}
  let totalUSD = 0

  windowRevenue.forEach(r => {
    const type = r.session_type || 'Other'
    if (!breakdown[type]) breakdown[type] = { usd: 0, count: 0 }
    breakdown[type].usd += parseFloat(r.usd) || 0
    breakdown[type].count += 1
    totalUSD += parseFloat(r.usd) || 0
  })

  return Object.entries(breakdown).map(([type, data]) => ({
    type,
    usd: parseFloat(data.usd.toFixed(2)),
    count: data.count,
    pct: totalUSD > 0 ? Math.round((data.usd / totalUSD) * 100) : 0
  })).sort((a, b) => b.usd - a.usd)
}

export function calculateDayOfWeekBreakdown(tips = [], paidSessions = [], platformName = '', windowDays = SNAPSHOT_WINDOW_DAYS) {
  const resolvePlatformName = (p) => p?.toLowerCase().trim() || ''
  const platTips = (tips || []).filter(t => resolvePlatformName(t.platform) === resolvePlatformName(platformName))
  const platPaid = (paidSessions || []).filter(p => resolvePlatformName(p.platform) === resolvePlatformName(platformName))

  const allRevenue = [
    ...platTips.map(t => ({ ...t, date: new Date(t.date_time) })),
    ...platPaid.map(p => ({ ...p, date: new Date(p.date_time) }))
  ]

  const now = new Date()
  const windowStart = new Date(now.getTime() - (windowDays - 1) * 86400000)
  const windowRevenue = allRevenue.filter(r => r.date >= windowStart)

  const breakdown = {}

  UTC_DAYS_LONG.forEach((day, idx) => {
    breakdown[day] = { usd: 0, count: 0, dayNum: idx }
  })

  windowRevenue.forEach(r => {
    if (isNaN(r.date.getTime())) return
    const dayName = UTC_DAYS_LONG[r.date.getDay()]
    breakdown[dayName].usd += parseFloat(r.usd) || 0
    breakdown[dayName].count += 1
  })

  return UTC_DAYS_LONG.map(day => ({
    day,
    usd: parseFloat(breakdown[day].usd.toFixed(2)),
    count: breakdown[day].count
  }))
}

export function calculatePeakHours(tips = [], paidSessions = [], platformName = '', windowDays = SNAPSHOT_WINDOW_DAYS) {
  const resolvePlatformName = (p) => p?.toLowerCase().trim() || ''
  const platTips = (tips || []).filter(t => resolvePlatformName(t.platform) === resolvePlatformName(platformName))
  const platPaid = (paidSessions || []).filter(p => resolvePlatformName(p.platform) === resolvePlatformName(platformName))

  const allRevenue = [
    ...platTips.map(t => ({ ...t, date: new Date(t.date_time) })),
    ...platPaid.map(p => ({ ...p, date: new Date(p.date_time) }))
  ]

  const now = new Date()
  const windowStart = new Date(now.getTime() - (windowDays - 1) * 86400000)
  const windowRevenue = allRevenue.filter(r => r.date >= windowStart)

  const breakdown = {}
  for (let h = 0; h < 24; h++) {
    breakdown[h] = { usd: 0, count: 0 }
  }

  windowRevenue.forEach(r => {
    if (isNaN(r.date.getTime())) return
    const hour = r.date.getHours()
    breakdown[hour].usd += parseFloat(r.usd) || 0
    breakdown[hour].count += 1
  })

  return Object.entries(breakdown)
    .map(([hour, data]) => ({
      hour: parseInt(hour),
      hourLabel: `${String(hour).padStart(2, '0')}:00`,
      usd: parseFloat(data.usd.toFixed(2)),
      count: data.count
    }))
    .filter(h => h.count > 0)
    .sort((a, b) => b.usd - a.usd)
    .slice(0, 7)
}

export function calculateTopFans(tips = [], paidSessions = [], platformName = '', windowDays = SNAPSHOT_WINDOW_DAYS) {
  const resolvePlatformName = (p) => p?.toLowerCase().trim() || ''
  const platTips = (tips || []).filter(t => resolvePlatformName(t.platform) === resolvePlatformName(platformName))
  const platPaid = (paidSessions || []).filter(p => resolvePlatformName(p.platform) === resolvePlatformName(platformName))

  const allRevenue = [
    ...platTips.map(t => ({ username: t.username || 'Guest', usd: t.usd, date: new Date(t.date_time) })),
    ...platPaid.map(p => ({ username: 'Private', usd: p.usd, date: new Date(p.date_time) }))
  ]

  const now = new Date()
  const windowStart = new Date(now.getTime() - (windowDays - 1) * 86400000)
  const windowRevenue = allRevenue.filter(r => r.date >= windowStart)

  const breakdown = {}
  let totalUSD = 0

  windowRevenue.forEach(r => {
    const name = r.username
    if (!breakdown[name]) breakdown[name] = 0
    breakdown[name] += parseFloat(r.usd) || 0
    totalUSD += parseFloat(r.usd) || 0
  })

  return Object.entries(breakdown)
    .map(([name, usd]) => ({
      name,
      usd: parseFloat(usd.toFixed(2)),
      pct: totalUSD > 0 ? Math.round((usd / totalUSD) * 100) : 0
    }))
    .sort((a, b) => b.usd - a.usd)
    .slice(0, 5)
}

// =============================================
// UNIFIED VIEW: Cross-Platform Aggregation
// =============================================

export function computeCrossPlatformMetrics(platforms = [], tips = [], paidSessions = [], windowDays = SNAPSHOT_WINDOW_DAYS) {
  const platformStats = platforms.map(p =>
    computePlatformCardStats(p, tips, paidSessions, windowDays)
  ).filter(s => s.hasData)

  const totalUSD = platformStats.reduce((sum, s) => sum + s.usd, 0)
  const totalTips = platformStats.reduce((sum, s) => sum + s.tipCount, 0)
  const totalHours = platformStats.reduce((sum, s) => sum + (s.hours || 0), 0)
  const totalUsdPerHour = totalHours > 0 ? totalUSD / totalHours : null

  const topByRevenue = platformStats.sort((a, b) => b.usd - a.usd)[0]
  const topByEfficiency = platformStats.sort((a, b) => (b.usdPerHour || 0) - (a.usdPerHour || 0))[0]

  // Fan contribution: aggregate across all platforms
  const fanBreakdown = {}
  tips.forEach(t => {
    const fan = t.username || 'Guest'
    fanBreakdown[fan] = (fanBreakdown[fan] || 0) + (parseFloat(t.usd) || 0)
  })

  const topFans = Object.entries(fanBreakdown)
    .map(([name, usd]) => ({
      name,
      usd: parseFloat(usd.toFixed(2))
    }))
    .sort((a, b) => b.usd - a.usd)
    .slice(0, 10)

  return {
    platformCount: platformStats.length,
    totalUSD: parseFloat(totalUSD.toFixed(2)),
    totalTips,
    totalHours: parseFloat(totalHours.toFixed(1)),
    totalUsdPerHour: totalUsdPerHour ? parseFloat(totalUsdPerHour.toFixed(2)) : null,
    topByRevenue,
    topByEfficiency,
    topFans,
    platformStats,
    averageUsdPerHour: totalHours > 0
      ? parseFloat((totalUSD / totalHours).toFixed(2))
      : null,
  }
}

// =============================================
// TIMING INTELLIGENCE: Hour-Based Patterns
// =============================================

export function computeHourlyPattern(tips = [], paidSessions = [], windowDays = SNAPSHOT_WINDOW_DAYS) {
  const allRevenue = [
    ...tips.map(t => ({ date: new Date(t.date_time), usd: parseFloat(t.usd) || 0 })),
    ...paidSessions.map(p => ({ date: new Date(p.date_time), usd: parseFloat(p.usd) || 0 }))
  ]

  const now = new Date()
  const windowStart = new Date(now.getTime() - (windowDays - 1) * 86400000)
  const windowRevenue = allRevenue.filter(r => r.date >= windowStart)

  const hourlyBreakdown = {}
  for (let h = 0; h < 24; h++) {
    hourlyBreakdown[h] = { usd: 0, count: 0 }
  }

  windowRevenue.forEach(r => {
    if (isNaN(r.date.getTime())) return
    const hour = r.date.getHours()
    hourlyBreakdown[hour].usd += r.usd
    hourlyBreakdown[hour].count += 1
  })

  return Object.entries(hourlyBreakdown).map(([hour, data]) => ({
    hour: parseInt(hour),
    usd: parseFloat(data.usd.toFixed(2)),
    count: data.count,
    avg: data.count > 0 ? parseFloat((data.usd / data.count).toFixed(2)) : 0
  }))
}

// =============================================
// EFFICIENCY MATRIX: Platform Comparison Grid
// =============================================

export function buildEfficiencyMatrix(platformStats = []) {
  if (platformStats.length === 0) return []

  const maxUsd = Math.max(...platformStats.map(s => s.usd), 1)
  const maxUph = Math.max(...platformStats.map(s => s.usdPerHour || 0), 1)
  const avgUph = platformStats.reduce((sum, s) => sum + (s.usdPerHour || 0), 0) / (platformStats.length || 1)

  return platformStats.map(s => {
    const revenueRank = platformStats.filter(p => p.usd >= s.usd).length
    const efficiencyRank = platformStats.filter(p => (p.usdPerHour || 0) >= (s.usdPerHour || 0)).length
    const efficiencyVsAvg = s.usdPerHour && avgUph ? Math.round(((s.usdPerHour - avgUph) / avgUph) * 100) : 0

    return {
      platform: s.platform,
      usd: s.usd,
      usdPerHour: s.usdPerHour,
      revenueRank,
      efficiencyRank,
      efficiencyVsAvg,
      revenueBarPct: Math.round((s.usd / maxUsd) * 100),
      efficiencyBarPct: s.usdPerHour ? Math.round((s.usdPerHour / maxUph) * 100) : 0
    }
  })
}
