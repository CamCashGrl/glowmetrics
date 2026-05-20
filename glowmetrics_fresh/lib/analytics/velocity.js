const TREND_CONFIG = {
  excellent: { color: '#10b981' },
  good:      { color: '#22d3ee' },
  neutral:   { color: '#94a3b8' },
  slow:      { color: '#f59e0b' },
  poor:      { color: '#f87171' },
  unknown:   { color: '#475569' },
}

/**
 * Compare current stream revenue pace against historical averages.
 *
 * @param {number} currentUPM — current USD/minute (from computeSessionState().currentUPM)
 * @param {Array}  sessions   — analytics.sessions array (each has totalUSD, durationMinutes, durationUnknown)
 * @returns {{ currentUPM, currentUPH, avgUPM, avgUPH, bestUPM, bestUPH, pctVsAvg, pctVsBest, label, trend, color }}
 */
export function computeRevenueVelocity(currentUPM, sessions) {
  const valid = (sessions || []).filter(s =>
    !s.durationUnknown && (s.totalUSD || 0) > 0 && (s.durationMinutes || 0) >= 15
  )

  if (!valid.length || !currentUPM) {
    return {
      currentUPM: currentUPM || 0,
      currentUPH: (currentUPM || 0) * 60,
      avgUPM: 0, avgUPH: 0, bestUPM: 0, bestUPH: 0,
      pctVsAvg: null, pctVsBest: null,
      label: 'No baseline yet',
      trend: 'unknown',
      color: TREND_CONFIG.unknown.color,
    }
  }

  const upms   = valid.map(s => (s.totalUSD || 0) / Math.max(s.durationMinutes || 1, 1))
  const avgUPM = upms.reduce((a, v) => a + v, 0) / upms.length
  const bestUPM = Math.max(...upms)

  const pctVsAvg  = avgUPM  > 0 ? Math.round(((currentUPM - avgUPM)  / avgUPM)  * 100) : null
  const pctVsBest = bestUPM > 0 ? Math.round(((currentUPM - bestUPM) / bestUPM) * 100) : null

  let trend, label
  if (pctVsAvg === null)      { trend = 'unknown';   label = 'No baseline yet' }
  else if (pctVsAvg >= 30)    { trend = 'excellent'; label = `+${pctVsAvg}% above normal pace` }
  else if (pctVsAvg >= 10)    { trend = 'good';      label = `+${pctVsAvg}% above normal pace` }
  else if (pctVsAvg >= -10)   { trend = 'neutral';   label = 'At normal pace' }
  else if (pctVsAvg >= -30)   { trend = 'slow';      label = `${pctVsAvg}% below normal pace` }
  else                         { trend = 'poor';      label = `${pctVsAvg}% below normal pace` }

  return {
    currentUPM,
    currentUPH: parseFloat((currentUPM * 60).toFixed(2)),
    avgUPM:  parseFloat(avgUPM.toFixed(4)),
    avgUPH:  parseFloat((avgUPM * 60).toFixed(2)),
    bestUPM: parseFloat(bestUPM.toFixed(4)),
    bestUPH: parseFloat((bestUPM * 60).toFixed(2)),
    pctVsAvg,
    pctVsBest,
    label,
    trend,
    color: TREND_CONFIG[trend].color,
  }
}

/**
 * Compare current session pace against last session and best session.
 *
 * @param {object|null} state    — computeSessionState() result
 * @param {Array}       sessions — analytics.sessions
 * @returns {{ vsAvgPct, vsBestPct, vsLastPct, avgUPH, bestUPH, lastSessionUPH, label, currentUPH }}
 */
export function computeLiveComparison(state, sessions) {
  const currentUPH = state ? state.currentUPM * 60 : 0

  const valid = (sessions || []).filter(s =>
    !s.durationUnknown && (s.totalUSD || 0) > 0 && (s.durationMinutes || 0) >= 15
  )

  if (!valid.length) return { vsAvgPct: null, vsBestPct: null, vsLastPct: null, avgUPH: 0, bestUPH: 0, lastSessionUPH: 0, currentUPH, label: 'No comparison data yet' }

  const uphs     = valid.map(s => (s.totalUSD || 0) / Math.max((s.durationMinutes || 1) / 60, 0.1))
  const avgUPH   = uphs.reduce((a, v) => a + v, 0) / uphs.length
  const bestUPH  = Math.max(...uphs)
  const lastUPH  = uphs[uphs.length - 1] || 0

  const vsAvgPct  = avgUPH  > 0 ? Math.round(((currentUPH - avgUPH)  / avgUPH)  * 100) : null
  const vsBestPct = bestUPH > 0 ? Math.round(((currentUPH - bestUPH) / bestUPH) * 100) : null
  const vsLastPct = lastUPH > 0 ? Math.round(((currentUPH - lastUPH) / lastUPH) * 100) : null

  let label = 'At normal pace'
  if (vsAvgPct !== null) {
    if (vsAvgPct >= 20)       label = `+${vsAvgPct}% above your average`
    else if (vsAvgPct >= 5)   label = `+${vsAvgPct}% above your average`
    else if (vsAvgPct <= -20) label = `${vsAvgPct}% below your average`
    else if (vsAvgPct <= -5)  label = `${vsAvgPct}% below your average`
  }

  return {
    currentUPH: parseFloat(currentUPH.toFixed(2)),
    avgUPH:  parseFloat(avgUPH.toFixed(2)),
    bestUPH: parseFloat(bestUPH.toFixed(2)),
    lastSessionUPH: parseFloat(lastUPH.toFixed(2)),
    vsAvgPct,
    vsBestPct,
    vsLastPct,
    label,
  }
}
