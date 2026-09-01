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

  const SESSION_GAP_MS = 3 * 60 * 60 * 1000
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

/**
 * Session-quality classification — the canonical "meaningful vs low-signal
 * vs invalid" rule, per canonical-analytics-rules.md's Platform $/hr
 * determination. Previously a closure local to lib/analytics.js's
 * aggregateRows() only; extracted here (same module as detectSessions(), its
 * natural home) so any consumer computing its own session population — e.g.
 * app/dashboard/StreamPlanner.js after migrating off groupIntoSessions() —
 * applies the exact same thresholds instead of redefining them.
 */
export function classifySession(s) {
  const mins = s.durationMinutes || 0
  const usd  = s.totalUSD || 0
  if (mins < 2 && usd === 0) return 'invalid'
  if (mins < 15 && usd < 10) return 'low_signal'
  return 'meaningful'
}

/** detectSessions() + the canonical meaningful-only filter, in one call —
 * the population every rate/best-time calculation should use. */
export function detectMeaningfulSessions(tips) {
  return detectSessions(tips).filter(s => classifySession(s) === 'meaningful')
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
  const firstHalfUSD = firstHalf.reduce((a, t) => a + (t.usd || 0), 0)
  const secondHalfUSD = secondHalf.reduce((a, t) => a + (t.usd || 0), 0)
  const firstHalfUPM = firstHalfUSD / halfMins
  const secondHalfUPM = secondHalfUSD / halfMins
  // The canonical first-half share. Derived from the SAME timestamp-midpoint
  // split as velocityTrend below, so a consumer rendering both a pacing bar
  // and a momentum badge can never show two contradicting halves of the same
  // session. Consumers must read this instead of re-halving the session
  // themselves (the Session Breakdown tab previously split by 5-minute bucket
  // index, which disagreed with velocityTrend on any odd bucket count).
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
    firstHalfUSD: parseFloat(firstHalfUSD.toFixed(2)), secondHalfUSD: parseFloat(secondHalfUSD.toFixed(2)),
    firstHalfPct: totalUSD > 0 ? Math.round((firstHalfUSD / totalUSD) * 100) : 0,
    topContributor, topContributorPct, tips: s.tips
  }
}
