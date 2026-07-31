export const ROOM_STATES = {
  EXPLOSIVE: { label: 'Explosive', emoji: '🔥🔥', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.35)' },
  HOT:       { label: 'Hot',       emoji: '🔥',   color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)'  },
  ACTIVE:    { label: 'Active',    emoji: '⚡',   color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)'  },
  WARMING:   { label: 'Warming',   emoji: '🌡️',  color: '#22d3ee', bg: 'rgba(34,211,238,0.10)', border: 'rgba(34,211,238,0.25)' },
  COLD:      { label: 'Cold',      emoji: '❄️',  color: '#475569', bg: 'rgba(71,85,105,0.10)',  border: 'rgba(71,85,105,0.25)'  },
}

export const MOMENTUM_DIRECTIONS = {
  SPIKING: { label: '⚡ Spike',   color: '#f59e0b' },
  RISING:  { label: '↑ Rising',  color: '#10b981' },
  STABLE:  { label: '→ Stable',  color: '#22d3ee' },
  FALLING: { label: '↓ Falling', color: '#f87171' },
}

/**
 * Compute room temperature state from available live session signals.
 * Only uses liveOnly data — historical events never affect room health.
 *
 * @param {object|null} state — output of computeSessionState()
 * @returns {{ stateName, label, emoji, color, bg, border, score, direction, directionLabel, directionColor, confidence }}
 */
export function computeRoomHealth(state) {
  const empty = { stateName: 'COLD', ...ROOM_STATES.COLD, score: 0, direction: 'STABLE', directionLabel: MOMENTUM_DIRECTIONS.STABLE.label, directionColor: MOMENTUM_DIRECTIONS.STABLE.color, confidence: 0, reasons: [], bars: { velocity: 0, whale: 0, momentum: 0 } }
  if (!state) return empty

  const { timeSinceLastTip, tipsPerMinute, paceStatus, liveOnlyCount, elapsedMins, topTipper, totalRevenue } = state

  // Score components (0–100 total) — each bucket's points are kept below
  // so reasons[]/bars{} can explain the total instead of restating it.
  let score = 0
  const reasons = []

  // Tip recency — biggest signal (0–40 pts)
  let recencyPts = 0
  if (timeSinceLastTip === null)      recencyPts = 15
  else if (timeSinceLastTip < 1)      recencyPts = 40
  else if (timeSinceLastTip < 2)      recencyPts = 35
  else if (timeSinceLastTip < 3)      recencyPts = 28
  else if (timeSinceLastTip < 5)      recencyPts = 18
  else if (timeSinceLastTip < 8)      recencyPts = 8
  score += recencyPts
  if (timeSinceLastTip !== null && timeSinceLastTip < 2) reasons.push(`Tip ${timeSinceLastTip < 1 ? 'just landed' : `${timeSinceLastTip.toFixed(1)} min ago`}`)
  else if (timeSinceLastTip !== null && timeSinceLastTip >= 8) reasons.push(`No tips for ${Math.round(timeSinceLastTip)} min`)

  // Tip rate (0–30 pts)
  let ratePts = 0
  if (tipsPerMinute >= 2)             ratePts = 30
  else if (tipsPerMinute >= 1)        ratePts = 22
  else if (tipsPerMinute >= 0.5)      ratePts = 14
  else if (tipsPerMinute > 0)         ratePts = 6
  score += ratePts
  if (tipsPerMinute >= 1) reasons.push(`${tipsPerMinute.toFixed(1)} tips/min`)
  else if (elapsedMins >= 5 && tipsPerMinute === 0) reasons.push('Viewer activity slowing')

  // Pace direction (0–20 pts)
  let pacePts = 0
  if (paceStatus === 'above')         pacePts = 20
  else if (paceStatus === 'on_track') pacePts = 12
  else if (paceStatus === 'below')    pacePts = 2
  else                                pacePts = 8 // unknown / starting
  score += pacePts
  if (paceStatus === 'above') reasons.push('Average tip pace increasing')
  else if (paceStatus === 'below') reasons.push('Pace below normal')

  // Event density (0–10 pts)
  let densityPts = 0
  if (liveOnlyCount >= 10)            densityPts = 10
  else if (liveOnlyCount >= 5)        densityPts = 7
  else if (liveOnlyCount >= 2)        densityPts = 4
  else if (liveOnlyCount >= 1)        densityPts = 2
  score += densityPts

  // Whale share — real signal (top tipper's share of session revenue),
  // used for the "Whale Activity" bar only, never added into score so it
  // doesn't double-count topTipper/pace signals already scored above.
  const whalePts = totalRevenue > 0 && topTipper ? Math.min(100, Math.round((topTipper.revenue / totalRevenue) * 100)) : 0
  if (whalePts >= 40) reasons.push('Whale activity detected')

  // State thresholds
  let stateName
  if (score >= 80)      stateName = 'EXPLOSIVE'
  else if (score >= 62) stateName = 'HOT'
  else if (score >= 44) stateName = 'ACTIVE'
  else if (score >= 22) stateName = 'WARMING'
  else                  stateName = 'COLD'

  // Momentum direction
  let direction
  if (timeSinceLastTip !== null && timeSinceLastTip < 0.5) direction = 'SPIKING'
  else if (paceStatus === 'above')                          direction = 'RISING'
  else if (paceStatus === 'below')                         direction = 'FALLING'
  else                                                      direction = 'STABLE'

  // Confidence increases with more data
  const confidence = Math.min(100, Math.floor((liveOnlyCount / 5) * 60 + (elapsedMins / 20) * 40))

  if (reasons.length === 0) reasons.push(elapsedMins < 3 ? 'Just started — still gathering signal' : 'Steady, no major shifts')

  return {
    stateName,
    ...ROOM_STATES[stateName],
    score,
    direction,
    directionLabel: MOMENTUM_DIRECTIONS[direction].label,
    directionColor: MOMENTUM_DIRECTIONS[direction].color,
    confidence,
    reasons: reasons.slice(0, 3),
    // 0–100 bars for the Room Pulse panel — each maps to a real score
    // component above (rescaled to 100) or, for whale, the real top-tipper
    // revenue share. Never an invented "viewer count" — this product has
    // no viewer-count signal to show.
    bars: {
      velocity: Math.round((ratePts / 30) * 100),
      whale: whalePts,
      momentum: Math.round((pacePts / 20) * 100),
    },
    confidenceBreakdown: [
      { label: 'Tip velocity', met: ratePts > 0 },
      { label: 'Tip recency', met: recencyPts >= 18 },
      { label: 'Pace vs. your history', met: paceStatus === 'above' || paceStatus === 'on_track' },
      { label: 'Event density', met: densityPts >= 4 },
    ],
  }
}
