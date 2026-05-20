/**
 * Centralized live-session metrics engine.
 *
 * ALL live metric formulas live here — never inline in components.
 * Inputs: liveEvents array (with _isHistory flag), liveStartTime, goalTokens
 * Output: a single state snapshot used for coaching, alerts, and UI display.
 *
 * HISTORY vs LIVE separation:
 *  - Historical events (_isHistory: true) count toward totals (revenue, tokens)
 *    but are EXCLUDED from time-sensitive calculations (pace, timeSinceLastTip)
 *  - Only liveOnly events drive coaching signals
 */

/**
 * @param {Array}  liveEvents    — all events including history
 * @param {Date}   liveStartTime — when the current session started
 * @param {number} goalTokens    — token goal for goal-progress display
 * @returns {object|null}
 */
export function computeSessionState(liveEvents, liveStartTime, goalTokens = 0) {
  if (!liveEvents?.length || !liveStartTime) return null

  const nowMs   = Date.now()
  const startMs = new Date(liveStartTime).getTime()
  const elapsedMins = Math.max((nowMs - startMs) / 60000, 0.1)

  // ── TOTALS (all events including history) ──────────────────────────────
  let totalRevenue = 0
  let totalTokens  = 0
  const tipperMap  = {}
  for (const ev of liveEvents) {
    totalRevenue += ev.normalizedRevenue || 0
    totalTokens  += ev.tokens || 0
    tipperMap[ev.username] = (tipperMap[ev.username] || 0) + (ev.normalizedRevenue || 0)
  }

  // ── LIVE-ONLY (excludes history) — used for coaching ──────────────────
  const liveOnly   = liveEvents.filter(e => !e._isHistory)
  const sortedLive = [...liveOnly].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  const lastLiveTip = sortedLive[0] ?? null

  const timeSinceLastTip = lastLiveTip
    ? parseFloat(((nowMs - new Date(lastLiveTip.timestamp).getTime()) / 60000).toFixed(1))
    : null

  // ── PACE (first-half vs second-half of elapsed time, live events only) ─
  const midMs = startMs + (nowMs - startMs) / 2
  const fh    = liveOnly.filter(e => new Date(e.timestamp).getTime() <= midMs)
  const sh    = liveOnly.filter(e => new Date(e.timestamp).getTime() > midMs)
  const hm    = elapsedMins / 2

  const fUPM = hm > 0 ? fh.reduce((s, e) => s + (e.normalizedRevenue || 0), 0) / hm : 0
  const sUPM = hm > 0 ? sh.reduce((s, e) => s + (e.normalizedRevenue || 0), 0) / hm : 0

  let paceStatus = 'unknown'
  if (liveOnly.length >= 3 && elapsedMins >= 5) {
    if (sUPM > fUPM * 1.15)      paceStatus = 'above'
    else if (sUPM < fUPM * 0.75) paceStatus = 'below'
    else                          paceStatus = 'on_track'
  }

  // ── DERIVED ─────────────────────────────────────────────────────────────
  const tpm        = liveOnly.length > 0 ? parseFloat((liveOnly.length / elapsedMins).toFixed(2)) : 0
  const livRevenue = liveOnly.reduce((s, e) => s + (e.normalizedRevenue || 0), 0)
  const avgTip     = liveOnly.length > 0 ? parseFloat((livRevenue / liveOnly.length).toFixed(2)) : 0
  const goalProgress = goalTokens > 0
    ? Math.min(100, Math.round((totalTokens / goalTokens) * 100))
    : 0

  const topEntry = Object.entries(tipperMap).sort((a, b) => b[1] - a[1])[0]

  return {
    totalRevenue:     parseFloat(totalRevenue.toFixed(2)),
    totalTokens,
    elapsedMins:      parseFloat(elapsedMins.toFixed(1)),
    tipsPerMinute:    tpm,
    avgTipValue:      avgTip,
    timeSinceLastTip,
    goalProgress,
    paceStatus,
    liveOnlyCount:    liveOnly.length,
    firstHalfUPM:     parseFloat(fUPM.toFixed(3)),
    secondHalfUPM:    parseFloat(sUPM.toFixed(3)),
    currentUPM:       parseFloat((totalRevenue / elapsedMins).toFixed(3)),
    topTipper:        topEntry
      ? { username: topEntry[0], revenue: parseFloat(topEntry[1].toFixed(2)) }
      : null,
  }
}

/**
 * Token → USD conversion using per-platform rates.
 * Always call this instead of hardcoding 0.05 in components.
 */
export function tokensToUsd(tokens, platform = 'Chaturbate', rates = {}) {
  const defaultRates = { Chaturbate: 0.05, BongaCams: 0.05, MyFreeCams: 0.05, Stripchat: 0.05, CamSoda: 0.05 }
  const rate = rates[platform] ?? defaultRates[platform] ?? 0.05
  return parseFloat((tokens * rate).toFixed(2))
}

/**
 * Sort events by timestamp ascending, handling both Date objects and ISO strings.
 * Always sort before feeding into any momentum or graph calculation.
 */
export function sortByTime(events) {
  return [...events].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
}
