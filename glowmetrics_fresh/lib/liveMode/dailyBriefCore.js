// Shared, pure "today's peak window / best platform" calculation — the
// single source of truth for the Total Earned / Peak Window / Best Platform
// fields shown in both the dashboard's sticky command bar and the Live Mode
// top stats strip. Extracted from dashboard/page.js's buildDailyBrief() so
// neither surface reimplements this math independently.
//
// tips: raw rows from the `tips` table (date_time/dateRaw, platform, usd)
// analytics: the object returned by lib/analytics's aggregateRows(tips, tz)
export function computeDailyBriefCore(tips, analytics, now = new Date()) {
  if (!tips || tips.length === 0 || !analytics) return null

  const utcHour = now.getHours() // local hour — analytics hours are already local
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const todayName = DAYS[now.getDay()]

  // Best hour: today-specific per platform first, then all-time fallback.
  // bestHour values from analytics are already local hours — format directly.
  const fmtHour = (h) => (h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`)
  const platBestTimes = analytics?.platformBestTimes || {}
  let todayBestPlat = null, todayBestHourNum = null, todayBestAvg = 0
  Object.entries(platBestTimes).forEach(([plat, times]) => {
    const todayEntry = times?.bestHourByDay?.[todayName]
    if (todayEntry && todayEntry.avg > todayBestAvg) {
      todayBestAvg = todayEntry.avg
      todayBestHourNum = todayEntry.hour
      todayBestPlat = plat
    }
  })
  const bestHour = analytics?.bestHour
  const _bhRaw = todayBestHourNum !== null ? todayBestHourNum : (bestHour ? parseInt(bestHour.hour) : null)
  const bh = (_bhRaw !== null && !isNaN(_bhRaw)) ? _bhRaw : null
  const bhLabel = bh === null ? null : fmtHour(bh)
  const hoursUntilPeak = bh !== null ? (bh - utcHour + 24) % 24 : null
  const atPeak = hoursUntilPeak === 0 || hoursUntilPeak === 1

  // Best platform per hour
  const platHourUSD = {}, platHourSessions = {}
  tips.forEach((t) => {
    const p = t.platform || 'Chaturbate'
    const d = new Date(t.date_time || t.dateRaw)
    const h = d.getHours()
    const bucket = Math.floor(d.getTime() / 3600000)
    if (!platHourUSD[p]) { platHourUSD[p] = {}; platHourSessions[p] = {} }
    if (!platHourUSD[p][h]) { platHourUSD[p][h] = 0; platHourSessions[p][h] = new Set() }
    platHourUSD[p][h] += t.usd || 0
    platHourSessions[p][h].add(bucket)
  })
  let bestPlatNow = null, bestPlatNowAvg = 0
  Object.keys(platHourUSD).forEach((plat) => {
    const sessions = platHourSessions[plat][utcHour]?.size || 0
    if (sessions === 0) return
    const avg = platHourUSD[plat][utcHour] / sessions
    if (avg > bestPlatNowAvg) { bestPlatNowAvg = avg; bestPlatNow = plat }
  })
  let bestPlatPeak = null, bestPlatPeakAvg = 0
  if (bh !== null) {
    Object.keys(platHourUSD).forEach((plat) => {
      const sessions = platHourSessions[plat][bh]?.size || 0
      if (sessions === 0) return
      const avg = platHourUSD[plat][bh] / sessions
      if (avg > bestPlatPeakAvg) { bestPlatPeakAvg = avg; bestPlatPeak = plat }
    })
  }
  // Time-bucketed picks need 3+ session buckets at a specific hour/day and
  // are often null for sparse accounts — fall back to the platform with the
  // highest total earnings, which resolves with just 1 tip.
  const platTotalUSD = {}
  tips.forEach((t) => { const p = t.platform || 'Unknown'; platTotalUSD[p] = (platTotalUSD[p] || 0) + (t.usd || 0) })
  const topEarningPlat = Object.entries(platTotalUSD).sort((a, b) => b[1] - a[1])[0]?.[0] || null
  const displayPlat = todayBestPlat || bestPlatPeak || bestPlatNow || topEarningPlat
  const displayAvg = todayBestAvg || bestPlatPeakAvg || bestPlatNowAvg || bestHour?.avg || 0

  return { todayName, bh, bhLabel, atPeak, hoursUntilPeak, displayPlat, displayAvg }
}
