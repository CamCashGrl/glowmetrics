/**
 * Groups a chronological tip history into inferred streaming sessions.
 * Shared by lib/analytics.js (historical CSV analytics engine) and
 * app/live/page.js (real-time Personal Best / Peak Hour / Revenue Velocity
 * baselines) — never duplicate this grouping logic elsewhere.
 *
 * A new session starts when the platform changes or the gap since the last
 * tip exceeds SESSION_GAP_MS. Session start/end are the first/last tip
 * timestamps — CSV/tip data never carries a real stream start/end time, so
 * this is always an inferred boundary, not a verified one.
 *
 * @param {Array} tips - tip rows with { dateRaw|date_time, platform, tokens, usd, username }
 * @returns {Array} sessions — see finalizeSession() below for shape
 */
export function detectSessions(tips) {
  if (!tips || tips.length === 0) return []
  const parsed = tips.map(t => {
    const timestamp = new Date(t.dateRaw || t.date_time)
    if (isNaN(timestamp.getTime())) return null
    return { ...t, timestamp }
  }).filter(Boolean).sort((a, b) => a.timestamp - b.timestamp)
  if (parsed.length === 0) return []

  const SESSION_GAP_MS = 60 * 60 * 1000 // Canonical 60-minute session gap
  const sessions = []
  let cur = null

  parsed.forEach(tip => {
    if (!cur) {
      cur = { tips: [tip], platform: tip.platform, startTime: tip.timestamp, endTime: tip.timestamp, fans: new Set([tip.username.toLowerCase()]) }
    } else if (tip.timestamp - cur.endTime <= SESSION_GAP_MS && tip.platform === cur.platform) {
      cur.tips.push(tip); cur.endTime = tip.timestamp; cur.fans.add(tip.username.toLowerCase())
    } else {
      sessions.push(finalizeSession(cur))
      cur = { tips: [tip], platform: tip.platform, startTime: tip.timestamp, endTime: tip.timestamp, fans: new Set([tip.username.toLowerCase()]) }
    }
  })
  if (cur && cur.tips.length > 0) sessions.push(finalizeSession(cur))
  return sessions
}

function finalizeSession(s) {
  const durationMs = s.endTime - s.startTime
  const rawMinutes = Math.round(durationMs / 60000)
  const durationUnknown = rawMinutes === 0
  const durationMinutes = Math.max(rawMinutes, 1)
  const durationHours = durationMinutes / 60
  let totalTokens = 0, totalUSD = 0
  for (const t of s.tips) { totalTokens += t.tokens || 0; totalUSD += t.usd || 0 }
  const tipCount = s.tips.length
  const uniqueFans = s.fans.size
  const usdPerMinute = !durationUnknown ? parseFloat((totalUSD / durationMinutes).toFixed(3)) : null

  const sorted = [...s.tips].sort((a, b) => a.timestamp - b.timestamp)
  const midMs = s.startTime.getTime() + durationMs / 2
  const firstHalf = sorted.filter(t => t.timestamp.getTime() <= midMs)
  const secondHalf = sorted.filter(t => t.timestamp.getTime() > midMs)
  const halfMins = Math.max(durationMinutes / 2, 1)
  const firstHalfUPM = firstHalf.reduce((a, t) => a + (t.usd || 0), 0) / halfMins
  const secondHalfUPM = secondHalf.reduce((a, t) => a + (t.usd || 0), 0) / halfMins
  let velocityTrend = 'unknown'
  if (!durationUnknown && durationMinutes >= 10) {
    if (secondHalfUPM > firstHalfUPM * 1.15) velocityTrend = 'growing'
    else if (secondHalfUPM < firstHalfUPM * 0.75) velocityTrend = 'dying'
    else velocityTrend = 'steady'
  }

  const tipperMap = {}
  sorted.forEach(t => { const u = t.username || 'unknown'; tipperMap[u] = (tipperMap[u] || 0) + (t.usd || 0) })
  const topEntry = Object.entries(tipperMap).sort((a, b) => b[1] - a[1])[0]
  const topContributor = topEntry ? topEntry[0] : null
  const topContributorPct = topEntry && totalUSD > 0 ? Math.round((topEntry[1] / totalUSD) * 100) : 0

  return {
    id: `session_${s.startTime.getTime()}`, platform: s.platform,
    startTime: s.startTime.toISOString(), endTime: s.endTime.toISOString(),
    durationMinutes, durationHours: parseFloat(durationHours.toFixed(2)), durationUnknown,
    totalTokens, totalUSD: parseFloat(totalUSD.toFixed(2)), tipCount, uniqueFans,
    tokensPerHour: (!durationUnknown && durationHours > 0) ? Math.round(totalTokens / durationHours) : 0,
    usdPerHour: (!durationUnknown && durationHours > 0) ? parseFloat((totalUSD / durationHours).toFixed(2)) : null,
    usdPerMinute, avgTipSize: tipCount > 0 ? parseFloat((totalUSD / tipCount).toFixed(2)) : 0,
    velocityTrend, firstHalfUPM: parseFloat(firstHalfUPM.toFixed(3)), secondHalfUPM: parseFloat(secondHalfUPM.toFixed(3)),
    topContributor, topContributorPct, tips: s.tips
  }
}
