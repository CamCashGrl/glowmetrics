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
  const empty = { stateName: 'COLD', ...ROOM_STATES.COLD, score: 0, direction: 'STABLE', directionLabel: MOMENTUM_DIRECTIONS.STABLE.label, directionColor: MOMENTUM_DIRECTIONS.STABLE.color, confidence: 0 }
  if (!state) return empty

  const { timeSinceLastTip, tipsPerMinute, paceStatus, liveOnlyCount, elapsedMins } = state

  // Score components (0–100 total)
  let score = 0

  // Tip recency — biggest signal (0–40 pts)
  if (timeSinceLastTip === null)      score += 15
  else if (timeSinceLastTip < 1)      score += 40
  else if (timeSinceLastTip < 2)      score += 35
  else if (timeSinceLastTip < 3)      score += 28
  else if (timeSinceLastTip < 5)      score += 18
  else if (timeSinceLastTip < 8)      score += 8

  // Tip rate (0–30 pts)
  if (tipsPerMinute >= 2)             score += 30
  else if (tipsPerMinute >= 1)        score += 22
  else if (tipsPerMinute >= 0.5)      score += 14
  else if (tipsPerMinute > 0)         score += 6

  // Pace direction (0–20 pts)
  if (paceStatus === 'above')         score += 20
  else if (paceStatus === 'on_track') score += 12
  else if (paceStatus === 'below')    score += 2
  else                                score += 8 // unknown / starting

  // Event density (0–10 pts)
  if (liveOnlyCount >= 10)            score += 10
  else if (liveOnlyCount >= 5)        score += 7
  else if (liveOnlyCount >= 2)        score += 4
  else if (liveOnlyCount >= 1)        score += 2

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

  return {
    stateName,
    ...ROOM_STATES[stateName],
    score,
    direction,
    directionLabel: MOMENTUM_DIRECTIONS[direction].label,
    directionColor: MOMENTUM_DIRECTIONS[direction].color,
    confidence,
  }
}
