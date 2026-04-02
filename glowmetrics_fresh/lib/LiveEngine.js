// ============================================================
// CAMCASH LIVE MODE ENGINE
// Pure functions — no UI, no state, fully testable
// Usage: import into any component or API route
// ============================================================

// ── 1. DATA NORMALIZATION ────────────────────────────────────
// Handles any tip event regardless of source (extension, manual, CSV)
// Never hardcodes token rate — uses platform config or last known rate

export function normalizeTipEvent(event, platformRates = {}) {
  const { username, tokens, usd, timestamp, platform } = event

  const rawTokens = parseInt(tokens) || 0
  const rawUSD    = parseFloat(usd)   || 0

  let normalizedRevenue = 0
  let sourceUsed        = 'unknown'
  let confidenceScore   = 0

  if (rawUSD > 0 && rawTokens > 0) {
    // Both present — use USD as truth, derive implied rate for consistency check
    const impliedRate = rawUSD / rawTokens
    const knownRate   = platformRates[platform] || null
    const rateDeviation = knownRate
      ? Math.abs(impliedRate - knownRate) / knownRate
      : null

    normalizedRevenue = rawUSD
    sourceUsed        = 'usd'
    // High confidence if implied rate matches known rate within 10%
    confidenceScore   = rateDeviation === null ? 0.8
                      : rateDeviation < 0.10   ? 1.0
                      : rateDeviation < 0.25   ? 0.7
                      : 0.4
  } else if (rawUSD > 0) {
    normalizedRevenue = rawUSD
    sourceUsed        = 'usd'
    confidenceScore   = 0.95
  } else if (rawTokens > 0) {
    // Only tokens — use platform rate if known, else null out USD
    const rate = platformRates[platform] || null
    normalizedRevenue = rate ? parseFloat((rawTokens * rate).toFixed(2)) : 0
    sourceUsed        = 'tokens'
    confidenceScore   = rate ? 0.75 : 0.3
  }

  return {
    username:          (username || 'unknown').toLowerCase().trim(),
    tokens:            rawTokens,
    usd:               rawUSD,
    normalizedRevenue: parseFloat(normalizedRevenue.toFixed(2)),
    sourceUsed,
    confidenceScore,
    timestamp:         timestamp ? new Date(timestamp) : new Date(),
    platform:          platform || 'unknown',
  }
}

// ── 2. LIVE SESSION STATE ────────────────────────────────────
// Computes all real-time metrics from the events array
// Call this on every new tip event

export function computeLiveSessionState(events, sessionStartTime, goalTokens = 0, goalUSD = 0) {
  if (!events || events.length === 0) {
    return {
      totalRevenue: 0, totalTokens: 0, totalUSD: 0,
      tipCount: 0, uniqueTippers: 0,
      tipsPerMinute: 0, avgTipValue: 0,
      timeSinceLastTip: null, elapsedMinutes: 0,
      goalProgress: 0, paceStatus: 'unknown',
      topTipper: null, lastTip: null,
    }
  }

  const startMs      = new Date(sessionStartTime).getTime()
  const nowMs        = Date.now()
  const elapsedMins  = Math.max((nowMs - startMs) / 60000, 0.1)

  // Aggregate
  let totalRevenue = 0
  let totalTokens  = 0
  let totalUSD     = 0
  const tipperMap  = {}

  events.forEach(ev => {
    totalRevenue += ev.normalizedRevenue || 0
    totalTokens  += ev.tokens  || 0
    totalUSD     += ev.usd     || 0
    const u = ev.username || 'unknown'
    tipperMap[u] = (tipperMap[u] || 0) + (ev.normalizedRevenue || 0)
  })

  const tipCount     = events.length
  const uniqueTippers = Object.keys(tipperMap).length
  const tipsPerMinute = parseFloat((tipCount / elapsedMins).toFixed(2))
  const avgTipValue   = parseFloat((totalRevenue / tipCount).toFixed(2))

  // Time since last tip
  const sorted       = [...events].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  const lastTip      = sorted[0]
  const timeSinceLastTip = lastTip
    ? parseFloat(((nowMs - new Date(lastTip.timestamp).getTime()) / 60000).toFixed(1))
    : null

  // Goal progress
  let goalProgress = 0
  if (goalUSD > 0)    goalProgress = Math.min(100, Math.round((totalRevenue / goalUSD) * 100))
  else if (goalTokens > 0) goalProgress = Math.min(100, Math.round((totalTokens / goalTokens) * 100))

  // Pace vs historical — split first/second half
  const midMs      = startMs + (nowMs - startMs) / 2
  const firstHalf  = events.filter(e => new Date(e.timestamp).getTime() <= midMs)
  const secondHalf = events.filter(e => new Date(e.timestamp).getTime() > midMs)
  const halfMins   = elapsedMins / 2
  const firstUPM   = halfMins > 0 ? firstHalf.reduce((s, e) => s + (e.normalizedRevenue || 0), 0) / halfMins : 0
  const secondUPM  = halfMins > 0 ? secondHalf.reduce((s, e) => s + (e.normalizedRevenue || 0), 0) / halfMins : 0
  const currentUPM = totalRevenue / elapsedMins

  let paceStatus = 'unknown'
  if (elapsedMins >= 5) {
    if (secondUPM > firstUPM * 1.15) paceStatus = 'above'
    else if (secondUPM < firstUPM * 0.75) paceStatus = 'below'
    else paceStatus = 'on_track'
  }

  // Top tipper this session
  const topTipper = Object.entries(tipperMap).sort((a, b) => b[1] - a[1])[0]

  return {
    totalRevenue:    parseFloat(totalRevenue.toFixed(2)),
    totalTokens,
    totalUSD:        parseFloat(totalUSD.toFixed(2)),
    tipCount,
    uniqueTippers,
    tipsPerMinute,
    avgTipValue,
    timeSinceLastTip,
    elapsedMinutes:  parseFloat(elapsedMins.toFixed(1)),
    goalProgress,
    paceStatus,
    currentUPM:      parseFloat(currentUPM.toFixed(3)),
    firstHalfUPM:    parseFloat(firstUPM.toFixed(3)),
    secondHalfUPM:   parseFloat(secondUPM.toFixed(3)),
    topTipper:       topTipper ? { username: topTipper[0], revenue: parseFloat(topTipper[1].toFixed(2)) } : null,
    lastTip,
  }
}

// ── 3. REAL-TIME ALERTS ──────────────────────────────────────
// Short, urgent, actionable — one alert per condition

export function generateLiveAlerts(state, historicalAvgUPM = 0) {
  const alerts = []
  const {
    timeSinceLastTip, paceStatus, goalProgress,
    topTipper, tipCount, currentUPM, elapsedMinutes,
    totalRevenue, tipsPerMinute,
  } = state

  // Silence — no tips in a while
  if (timeSinceLastTip !== null) {
    if (timeSinceLastTip >= 8) {
      alerts.push({ level: 'critical', icon: '🚨', text: `No tips in ${Math.round(timeSinceLastTip)} min — run a poll or call out names NOW` })
    } else if (timeSinceLastTip >= 5) {
      alerts.push({ level: 'warning', icon: '⚠️', text: `No tips in ${Math.round(timeSinceLastTip)} min — engage chat immediately` })
    } else if (timeSinceLastTip >= 3) {
      alerts.push({ level: 'info', icon: '💬', text: `Quiet for ${Math.round(timeSinceLastTip)} min — set a quick low goal to restart momentum` })
    }
  }

  // Pace alerts
  if (paceStatus === 'below' && elapsedMinutes >= 10) {
    const dropPct = currentUPM > 0 && state.firstHalfUPM > 0
      ? Math.round((1 - state.secondHalfUPM / state.firstHalfUPM) * 100)
      : null
    alerts.push({
      level: 'warning',
      icon: '📉',
      text: dropPct ? `Pace dropped ${dropPct}% — change strategy or activate toy` : 'Earnings pace dropping — switch it up now',
    })
  }

  if (paceStatus === 'above' && elapsedMinutes >= 10) {
    alerts.push({ level: 'success', icon: '🔥', text: 'Momentum building — keep going, don\'t break the energy' })
  }

  // High spender detected this session
  if (topTipper && totalRevenue > 0) {
    const topPct = Math.round((topTipper.revenue / totalRevenue) * 100)
    if (topPct >= 50 && topTipper.revenue >= 5) {
      alerts.push({ level: 'info', icon: '🐳', text: `${topTipper.username} is ${topPct}% of your revenue — give them direct attention NOW` })
    }
  }

  // Goal proximity — conversion window is hot
  if (goalProgress >= 85 && goalProgress < 100) {
    alerts.push({ level: 'success', icon: '🎯', text: `${goalProgress}% to goal — conversion window HOT, push hard for the last ${100 - goalProgress}%` })
  }
  if (goalProgress >= 95) {
    alerts.push({ level: 'critical', icon: '🔥', text: `Goal almost done! Announce the reward NOW to trigger final tips` })
  }
  if (goalProgress >= 100) {
    alerts.push({ level: 'success', icon: '🎉', text: 'Goal hit! Set the next one immediately — momentum carries over' })
  }

  // Historical comparison
  if (historicalAvgUPM > 0 && currentUPM > 0 && elapsedMinutes >= 5) {
    const ratio = currentUPM / historicalAvgUPM
    if (ratio < 0.6) {
      alerts.push({ level: 'warning', icon: '📊', text: `Earning ${Math.round((1 - ratio) * 100)}% below your avg pace — this session needs a reset` })
    } else if (ratio >= 1.5) {
      alerts.push({ level: 'success', icon: '⚡', text: `Crushing your average — you\'re ${Math.round((ratio - 1) * 100)}% above normal pace` })
    }
  }

  // Sort: critical first
  const priority = { critical: 0, warning: 1, success: 2, info: 3 }
  return alerts.sort((a, b) => priority[a.level] - priority[b.level]).slice(0, 4)
}

// ── 4. PROJECTIONS ───────────────────────────────────────────

export function projectSessionOutcome(state, expectedDurationMins = 60, historicalSessions = []) {
  const { currentUPM, elapsedMinutes, totalRevenue, goalProgress } = state

  if (elapsedMinutes < 2) {
    return { projectedRevenue: null, confidenceRange: null, goalHitProbability: null, note: 'Need more data' }
  }

  const remainingMins    = Math.max(expectedDurationMins - elapsedMinutes, 0)
  const projectedRevenue = parseFloat((totalRevenue + currentUPM * remainingMins).toFixed(2))

  // Confidence range — wider early in session
  const uncertainty = Math.max(0.1, 0.5 - (elapsedMinutes / expectedDurationMins) * 0.4)
  const low  = parseFloat((projectedRevenue * (1 - uncertainty)).toFixed(2))
  const high = parseFloat((projectedRevenue * (1 + uncertainty)).toFixed(2))

  // Historical context
  const avgHistorical = historicalSessions.length
    ? historicalSessions.reduce((s, x) => s + x.totalUSD, 0) / historicalSessions.length
    : null

  // Goal hit probability
  let goalHitProbability = null
  if (goalProgress !== null && goalProgress < 100) {
    if (projectedRevenue > 0 && avgHistorical > 0) {
      goalHitProbability = Math.min(99, Math.round((projectedRevenue / avgHistorical) * goalProgress))
    }
  } else if (goalProgress >= 100) {
    goalHitProbability = 100
  }

  return {
    projectedRevenue,
    confidenceRange: { low, high },
    goalHitProbability,
    vsHistorical: avgHistorical
      ? { avg: parseFloat(avgHistorical.toFixed(2)), diff: parseFloat((projectedRevenue - avgHistorical).toFixed(2)) }
      : null,
  }
}

// ── 5. NEXT BEST ACTION ──────────────────────────────────────
// Returns ONE clear, specific, revenue-focused instruction

export function getNextBestAction(state, goalTokens = 0, goalUSD = 0) {
  const {
    timeSinceLastTip, paceStatus, goalProgress,
    topTipper, elapsedMinutes, tipsPerMinute,
    tipCount, uniqueTippers, totalRevenue,
  } = state

  // Priority waterfall — first matching condition wins

  // 1. Goal is close — push for finish
  if (goalProgress >= 90 && goalProgress < 100) {
    return { action: 'CLOSE_GOAL', text: `Announce your reward out loud — goal is ${goalProgress}%. Tell chat exactly what happens when you hit it.` }
  }

  // 2. Dead silence — emergency re-engagement
  if (timeSinceLastTip >= 6) {
    return { action: 'REENGAGE', text: `Say 3 names in chat right now. "I see [name], [name], [name] — tip to control what I do next."` }
  }

  // 3. Pace is dying
  if (paceStatus === 'below' && elapsedMinutes >= 8) {
    return { action: 'SWITCH_STRATEGY', text: `Set a small 50-token goal right now — micro-goals restart tipping momentum when the room slows.` }
  }

  // 4. High-value tipper in room — exploit loyalty
  if (topTipper && totalRevenue > 0 && (topTipper.revenue / totalRevenue) >= 0.4) {
    return { action: 'REWARD_WHALE', text: `Thank ${topTipper.username} by name and give them a small exclusive: "Next tip from you decides what I do for the next 5 min."` }
  }

  // 5. Good pace, no goal — set one
  if (paceStatus === 'above' && goalProgress === 0) {
    return { action: 'SET_GOAL', text: `You\'re on a hot streak — set a token goal NOW while energy is high. Ride the momentum.` }
  }

  // 6. Early stream, low tip count — start engagement
  if (elapsedMinutes < 15 && tipCount < 5) {
    return { action: 'OPEN_STRONG', text: `Set a 200-token opening goal and announce it. Early goals train the room to tip from the start.` }
  }

  // 7. Many tippers, low avg — push for bigger tips
  if (uniqueTippers >= 5 && totalRevenue / tipCount < 1) {
    return { action: 'UPSELL', text: `Lots of small tips — offer a VIP option: "First to tip 50 gets to decide my next move."` }
  }

  // 8. On track — keep going
  return { action: 'MAINTAIN', text: `Pace is good. Keep the energy up and acknowledge tippers by name — recognition drives repeat tipping.` }
}
