import { parseCSV, aggregateRows as runEngine, applyFreeAnalysisWindow } from '../../../lib/analytics'
import fs from 'fs'
import path from 'path'

export async function GET(req) {
  try {
    const csvDir = '/tmp/test_csvs'
    const files = fs.readdirSync(csvDir).filter(f => f.endsWith('.csv')).sort()

    let allTips = []
    let validationResults = {
      totalEarned: null,
      earningsThisMonth: null,
      avgPerSession: null,
      avgPerTip: null,
      bestPlatform: null,
      platformBreakdown: {},
      fanAnalysis: {},
      peakWindow: null,
      sessions: null,
      contradictions: []
    }

    // Merge all CSVs
    files.forEach((filename) => {
      const filepath = path.join(csvDir, filename)
      const csvContent = fs.readFileSync(filepath, 'utf-8')
      const tips = parseCSV(csvContent)
      allTips = [...allTips, ...tips]
    })

    if (allTips.length === 0) {
      return Response.json({ error: 'No tips parsed' }, { status: 500 })
    }

    // === SIMULATE FREE USER (31-day window) ===
    const analysisTips = applyFreeAnalysisWindow(allTips, { windowDays: 31 })
    const analytics = runEngine(analysisTips, 'America/New_York')

    // ==========================================
    // METRIC 1: TOTAL EARNED
    // ==========================================
    const totalEarned = analytics.totalUSD
    validationResults.totalEarned = {
      displayed: totalEarned,
      source: 'analytics.totalUSD',
      formula: 'Sum of all tips in 31-day window',
      verified: totalEarned > 0
    }

    // ==========================================
    // METRIC 2: EARNINGS THIS MONTH
    // ==========================================
    const now = new Date()
    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const earningsThisMonth = analysisTips
      .filter(t => new Date(t.date_time || t.dateRaw) >= thisMonthStart)
      .reduce((s, t) => s + (t.usd || 0), 0)

    validationResults.earningsThisMonth = {
      displayed: parseFloat(earningsThisMonth.toFixed(2)),
      totalEarned: totalEarned,
      match: Math.abs(earningsThisMonth - totalEarned) < 0.01,
      note: 'Should use same windowed data source as Total Earned'
    }

    if (Math.abs(earningsThisMonth - totalEarned) > 0.01) {
      validationResults.contradictions.push({
        type: 'Earnings Mismatch',
        totalEarned: totalEarned.toFixed(2),
        earningsThisMonth: earningsThisMonth.toFixed(2),
        diff: Math.abs(earningsThisMonth - totalEarned).toFixed(2),
        severity: 'CRITICAL'
      })
    }

    // ==========================================
    // METRIC 3: AVERAGE PER SESSION
    // ==========================================
    const meaningfulSessions = analytics.meaningfulSessions || []
    const avgPerSession = meaningfulSessions.length > 0
      ? totalEarned / meaningfulSessions.length
      : 0

    validationResults.avgPerSession = {
      displayed: parseFloat(avgPerSession.toFixed(2)),
      formula: 'Total Earned / Meaningful Sessions',
      sessionCount: meaningfulSessions.length,
      totalEarned: totalEarned,
      verified: meaningfulSessions.length > 0
    }

    // ==========================================
    // METRIC 4: AVERAGE PER TIP
    // ==========================================
    const avgPerTip = analysisTips.length > 0 ? totalEarned / analysisTips.length : 0
    validationResults.avgPerTip = {
      displayed: parseFloat(avgPerTip.toFixed(2)),
      formula: 'Total Earned / Total Tips',
      tipCount: analysisTips.length,
      totalEarned: totalEarned
    }

    // ==========================================
    // METRIC 5: BEST PLATFORM
    // ==========================================
    const platforms = analytics.platforms || []
    const bestPlatformByRevenue = platforms.length > 0
      ? [...platforms].sort((a, b) => b.totalUSD - a.totalUSD)[0]
      : null

    const bestPlatformByROI = platforms.length > 0
      ? [...platforms]
          .filter(p => p.usdPerHour > 0)
          .sort((a, b) => b.usdPerHour - a.usdPerHour)[0]
      : null

    validationResults.bestPlatform = {
      byRevenue: bestPlatformByRevenue?.platform || 'N/A',
      byRevenuAmount: bestPlatformByRevenue?.totalUSD || 0,
      byROI: bestPlatformByROI?.platform || 'N/A',
      byROIAmount: bestPlatformByROI?.usdPerHour || 0,
      match: bestPlatformByRevenue?.platform === bestPlatformByROI?.platform,
      note: 'Should be consistent across dashboard'
    }

    if (!validationResults.bestPlatform.match) {
      validationResults.contradictions.push({
        type: 'Best Platform Mismatch',
        byRevenue: bestPlatformByRevenue?.platform,
        byROI: bestPlatformByROI?.platform,
        severity: 'HIGH'
      })
    }

    // ==========================================
    // METRIC 6: PLATFORM BREAKDOWN
    // ==========================================
    validationResults.platformBreakdown = platforms.map(p => ({
      platform: p.platform,
      totalUSD: parseFloat(p.totalUSD.toFixed(2)),
      tips: p.tips,
      sessions: p.sessions,
      avgTipSize: parseFloat(p.avgTipSize.toFixed(2)),
      usdPerHour: parseFloat(p.usdPerHour.toFixed(2)),
      formula: 'Sum tips by platform / hours streamed'
    }))

    // ==========================================
    // METRIC 7: TOP FAN ANALYSIS
    // ==========================================
    const topFans = (analytics.whales || []).slice(0, 3)
    validationResults.fanAnalysis = topFans.map((fan, i) => {
      const percentage = totalEarned > 0 ? (fan.totalUSD / totalEarned) * 100 : 0
      return {
        rank: i + 1,
        username: fan.username,
        totalUSD: parseFloat(fan.totalUSD.toFixed(2)),
        tipCount: fan.tipCount,
        percentageOfRevenue: parseFloat(percentage.toFixed(1)),
        formula: '(Fan Total / Total Earned) * 100'
      }
    })

    // ==========================================
    // METRIC 8: PEAK WINDOW (Best hour overall)
    // ==========================================
    const bestHour = analytics.bestHour || null
    validationResults.peakWindow = {
      hour: bestHour?.hour,
      avgEarnings: bestHour?.avg,
      sessionCount: bestHour?.sessionCount,
      totalEarnings: bestHour?.total,
      formula: 'Median earnings per hour bucket (3+ active days)'
    }

    // ==========================================
    // METRIC 9: MOMENTUM & TRENDS
    // ==========================================
    const momentum = analytics.momentum || {}
    const platformMomentum = analytics.platformMomentum || {}

    validationResults.momentum = {
      overall: {
        label: momentum.label,
        pct: momentum.pct,
        last30USD: momentum.last30USD,
        prior30USD: momentum.prior30USD,
        formula: '((Last 30 - Prior 30) / Prior 30) * 100'
      },
      byPlatform: Object.entries(platformMomentum).map(([plat, m]) => ({
        platform: plat,
        label: m.label,
        last30USD: m.last30USD,
        prior30USD: m.prior30USD
      }))
    }

    // ==========================================
    // METRIC 10: SESSION ANALYTICS
    // ==========================================
    validationResults.sessionAnalytics = {
      meaningfulSessionCount: meaningfulSessions.length,
      lowSignalSessionCount: (analytics.lowSignalSessionCount || 0),
      totalSessionsAnalyzed: (analytics.allValidSessions || []).length,
      estimatedHourlyRate: analytics.estimatedHourlyRate || 0,
      hourlyRateSessionCount: analytics.hourlyRateSessionCount || 0,
      earningsVelocity: analytics.earningsVelocity || 0,
      formula: 'Total USD / Total Hours for eligible sessions'
    }

    // ==========================================
    // METRIC 11: INSIGHTS & PREDICTIONS
    // ==========================================
    validationResults.insights = {
      count: (analytics.insights || []).length,
      examples: (analytics.insights || []).slice(0, 3).map(i => i.text)
    }

    validationResults.predictions = {
      generated: (analytics.predictions || []).length > 0,
      examples: (analytics.predictions || []).slice(0, 2)
    }

    validationResults.alerts = {
      whaleAlerts: (analytics.whaleAlerts || []).length,
      lossAlerts: (analytics.lossAlerts || []).length,
      nextMoves: (analytics.nextMoves || []).length
    }

    // ==========================================
    // METRIC 12: TIP TYPE BREAKDOWN
    // ==========================================
    validationResults.tipTypeBreakdown = (analytics.tipTypeBreakdown || []).map(t => ({
      type: t.type,
      usd: parseFloat(t.usd.toFixed(2)),
      count: t.count,
      pct: t.pct,
      avgUsd: parseFloat(t.avgUsd.toFixed(2))
    }))

    // ==========================================
    // METRIC 13: PLATFORM VELOCITY ($/hr by platform)
    // ==========================================
    validationResults.platformVelocity = Object.entries(analytics.platformVelocity || {}).map(([plat, rate]) => ({
      platform: plat,
      usdPerHour: parseFloat(rate.toFixed(2))
    }))

    // ==========================================
    // METRIC 14: BEST TIMES (Day & Hour)
    // ==========================================
    validationResults.bestTimes = {
      bestDay: analytics.bestDay ? {
        day: analytics.bestDay.day,
        avgEarnings: parseFloat(analytics.bestDay.avg.toFixed(2))
      } : null,
      bestHourGlobal: analytics.bestHour ? {
        hour: analytics.bestHour.hour,
        avgEarnings: parseFloat(analytics.bestHour.avg.toFixed(2))
      } : null,
      platformBestTimes: Object.entries(analytics.platformBestTimes || {}).map(([plat, times]) => ({
        platform: plat,
        bestHour: times.hour?.hour,
        bestDay: times.bestDay?.day
      }))
    }

    // ==========================================
    // METRIC 15: RETURNING VS NEW FANS
    // ==========================================
    validationResults.fanMetrics = {
      returningVsNew: analytics.returningVsNew,
      topFanDependency: analytics.topFanDependency,
      formula: 'Track returning % and top fan concentration'
    }

    // ==========================================
    // METRIC 16: MONTHLY DATA
    // ==========================================
    validationResults.monthlyData = (analytics.monthlyData || []).map(m => ({
      month: m.month,
      usd: parseFloat(m.usd.toFixed(2)),
      tips: m.tips,
      fans: m.fans,
      sessions: m.sessions,
      usdPerFan: parseFloat(m.usdPerFan.toFixed(2))
    }))

    // ==========================================
    // CONSISTENCY CHECKS - COMPREHENSIVE
    // ==========================================
    const checks = [
      {
        name: 'Total must be positive',
        passed: totalEarned > 0,
        value: totalEarned
      },
      {
        name: 'Avg per session ≤ Avg per tip',
        passed: avgPerSession <= avgPerTip,
        avgSession: avgPerSession.toFixed(2),
        avgTip: avgPerTip.toFixed(2)
      },
      {
        name: 'Platform totals sum to grand total (±$0.01)',
        passed: Math.abs(platforms.reduce((s, p) => s + p.totalUSD, 0) - totalEarned) < 0.01,
        platformSum: platforms.reduce((s, p) => s + p.totalUSD, 0).toFixed(2),
        grandTotal: totalEarned.toFixed(2)
      },
      {
        name: 'Top fans total ≤ Grand total',
        passed: topFans.reduce((s, f) => s + f.totalUSD, 0) <= totalEarned,
        topFansSum: topFans.reduce((s, f) => s + f.totalUSD, 0).toFixed(2),
        grandTotal: totalEarned.toFixed(2)
      },
      {
        name: 'Tip type breakdown totals to grand total (±$0.01)',
        passed: Math.abs((analytics.tipTypeBreakdown || []).reduce((s, t) => s + t.usd, 0) - totalEarned) < 0.01,
        sum: (analytics.tipTypeBreakdown || []).reduce((s, t) => s + t.usd, 0).toFixed(2),
        total: totalEarned.toFixed(2)
      },
      {
        name: 'Monthly data totals to grand total (±$0.01)',
        passed: Math.abs((analytics.monthlyData || []).reduce((s, m) => s + m.usd, 0) - totalEarned) < 0.01,
        sum: (analytics.monthlyData || []).reduce((s, m) => s + m.usd, 0).toFixed(2),
        total: totalEarned.toFixed(2)
      },
      {
        name: 'Earnings This Month ≤ Total Earned',
        passed: earningsThisMonth <= totalEarned,
        thisMonth: earningsThisMonth.toFixed(2),
        total: totalEarned.toFixed(2)
      },
      {
        name: 'Meaningful sessions + Low signal = Total analyzed',
        passed: meaningfulSessions.length + (analytics.lowSignalSessionCount || 0) === (analytics.allValidSessions || []).length,
        meaningful: meaningfulSessions.length,
        lowSignal: (analytics.lowSignalSessionCount || 0),
        total: (analytics.allValidSessions || []).length
      },
      {
        name: 'Hourly rate sessions ≤ Meaningful sessions',
        passed: (analytics.hourlyRateSessionCount || 0) <= meaningfulSessions.length,
        rateEligible: (analytics.hourlyRateSessionCount || 0),
        meaningful: meaningfulSessions.length
      },
      {
        name: 'Hourly rate USD matches rate calculation',
        passed: Math.abs(analytics.hourlyRateTotalUsd - (analytics.hourlyRateSessionCount > 0 ? analytics.estimatedHourlyRate * (analytics.hourlyRateTotalMinutes / 60) : 0)) < 1,
        hourlyRateUSD: analytics.hourlyRateTotalUsd.toFixed(2),
        calculated: (analytics.estimatedHourlyRate * (analytics.hourlyRateTotalMinutes / 60)).toFixed(2)
      }
    ]

    validationResults.consistencyChecks = checks

    // Add failed checks to contradictions
    checks.forEach(check => {
      if (!check.passed) {
        validationResults.contradictions.push({
          type: 'Consistency Check Failed',
          check: check.name,
          details: check,
          severity: 'CRITICAL'
        })
      }
    })

    return Response.json({
      success: true,
      summary: {
        tipsProcessed: analysisTips.length,
        rawTips: allTips.length,
        windowedPercentage: parseFloat(((analysisTips.length / allTips.length) * 100).toFixed(1)),
        sessionsAnalyzed: meaningfulSessions.length,
        platformsTracked: platforms.length,
        contradictionsFound: validationResults.contradictions.length
      },
      validation: validationResults,
      overallStatus: validationResults.contradictions.length === 0 ? '✅ ALL METRICS VALID' : '⚠️ CONTRADICTIONS FOUND'
    })
  } catch (e) {
    return Response.json({ error: e.message, stack: e.stack }, { status: 500 })
  }
}
