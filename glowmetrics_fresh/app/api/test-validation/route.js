import { parseCSV, aggregateRows as runEngine, applyFreeAnalysisWindow } from '../../../lib/analytics'
import fs from 'fs'
import path from 'path'

export async function GET(req) {
  try {
    const csvDir = '/tmp/test_csvs'
    const files = fs.readdirSync(csvDir).filter(f => f.endsWith('.csv')).sort()

    let totalTips = 0
    let totalUSD = 0
    let totalWindowed = 0
    let platformBreakdown = {}
    let results = []
    let issues = []

    files.forEach((filename) => {
      const filepath = path.join(csvDir, filename)
      const csvContent = fs.readFileSync(filepath, 'utf-8')

      const tips = parseCSV(csvContent)
      if (tips.length === 0) return

      let rawTotal = 0
      tips.forEach(t => { rawTotal += t.usd || 0 })
      totalTips += tips.length
      totalUSD += rawTotal

      // Apply FREE user windowing
      const analysisTips = applyFreeAnalysisWindow(tips, { windowDays: 31 })
      let windowedTotal = 0
      analysisTips.forEach(t => { windowedTotal += t.usd || 0 })
      totalWindowed += windowedTotal

      // Run engine
      const analytics = runEngine(analysisTips, 'America/New_York')
      const analyticsTotal = analytics.totalUSD
      const match = Math.abs(windowedTotal - analyticsTotal) < 0.01

      if (!match) {
        issues.push({
          file: filename,
          windowed: windowedTotal.toFixed(2),
          analytics: analyticsTotal.toFixed(2),
          diff: Math.abs(windowedTotal - analyticsTotal).toFixed(4)
        })
      }

      // Track platforms
      analytics.platforms.forEach(p => {
        if (!platformBreakdown[p.platform]) {
          platformBreakdown[p.platform] = { tips: 0, usd: 0 }
        }
        platformBreakdown[p.platform].usd += p.totalUSD
        platformBreakdown[p.platform].tips += p.tips
      })

      results.push({
        file: filename,
        tips: tips.length,
        raw: rawTotal.toFixed(2),
        windowed: windowedTotal.toFixed(2),
        analytics: analyticsTotal.toFixed(2),
        match
      })
    })

    return Response.json({
      success: true,
      summary: {
        filesProcessed: results.length,
        totalTips,
        totalRaw: totalUSD.toFixed(2),
        totalWindowed: totalWindowed.toFixed(2),
        platformBreakdown: Object.entries(platformBreakdown)
          .sort((a, b) => b[1].usd - a[1].usd)
          .map(([p, d]) => ({
            platform: p,
            usd: d.usd.toFixed(2),
            tips: d.tips,
            pct: ((d.usd / totalWindowed) * 100).toFixed(1)
          })),
        consistencyStatus: issues.length === 0 ? 'ALL PASS' : `${issues.length} ISSUES`
      },
      results,
      issues
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
