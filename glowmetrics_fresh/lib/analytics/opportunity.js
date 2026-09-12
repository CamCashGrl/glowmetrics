const LEVEL_COLORS = {
  critical: '#10b981',
  high:     '#22d3ee',
  medium:   '#f59e0b',
  low:      '#94a3b8',
  minimal:  '#475569',
}

/**
 * Composite monetization opportunity score (0–100).
 * Higher = stronger conversion window right now.
 *
 * @param {object|null} state      — computeSessionState() result
 * @param {object}      roomHealth — computeRoomHealth() result
 * @returns {{ score, label, level, color, signals }}
 */
export function computeOpportunityScore(state, roomHealth) {
  if (!state) return { score: 0, label: 'Low activity', level: 'minimal', color: LEVEL_COLORS.minimal, signals: [] }

  const { timeSinceLastTip, paceStatus, goalProgress, tipsPerMinute, liveOnlyCount, elapsedMins } = state
  const heatState = roomHealth?.stateName ?? 'COLD'
  const heatScore = roomHealth?.score ?? 0

  let score = 0
  const signals = []

  // Room heat (0–30 pts)
  if (heatState === 'EXPLOSIVE')      { score += 30; signals.push('Room heat at peak — highest conversion window') }
  else if (heatState === 'HOT')       { score += 22; signals.push('Room is hot — high tipping probability') }
  else if (heatState === 'ACTIVE')    { score += 15 }
  else if (heatState === 'WARMING')   { score += 7  }

  // Pace direction (0–25 pts)
  if (paceStatus === 'above')         { score += 25; signals.push('Revenue momentum above baseline') }
  else if (paceStatus === 'on_track')   score += 15
  else if (paceStatus === 'below')      score += 3
  else                                  score += 8

  // Goal proximity creates urgency (0–20 pts)
  if (goalProgress >= 100)            { score += 15; signals.push('Goal hit — set next goal immediately') }
  else if (goalProgress >= 85)        { score += 20; signals.push(`Goal at ${goalProgress}% — urgency window is open`) }
  else if (goalProgress >= 70)        { score += 15; signals.push(`Goal at ${goalProgress}% — building urgency`) }
  else if (goalProgress >= 50)          score += 8

  // Tip recency (0–15 pts)
  if (timeSinceLastTip !== null) {
    if (timeSinceLastTip < 1)         { score += 15; signals.push('Just tipped — capitalize on momentum') }
    else if (timeSinceLastTip < 2)      score += 12
    else if (timeSinceLastTip < 3)      score += 8
    else if (timeSinceLastTip < 5)      score += 4
  }

  // Session momentum (0–10 pts)
  if (tipsPerMinute >= 1)             { score += 10; signals.push('High tip rate — room is responsive') }
  else if (tipsPerMinute >= 0.5)        score += 6

  if (liveOnlyCount >= 10 && elapsedMins < 25) {
    score += 0 // already captured above
    signals.push('High early engagement — strong session')
  }

  score = Math.min(100, score)

  let label, level
  if (score >= 80)      { label = 'Peak conversion window'; level = 'critical' }
  else if (score >= 60) { label = 'Strong opportunity';     level = 'high'     }
  else if (score >= 40) { label = 'Moderate opportunity';   level = 'medium'   }
  else if (score >= 20) { label = 'Building momentum';      level = 'low'      }
  else                  { label = 'Low activity';           level = 'minimal'  }

  return { score, label, level, color: LEVEL_COLORS[level], signals }
}

/**
 * Composite stream health score (0–100) combining momentum, engagement, velocity, and phase.
 *
 * @param {object|null} state      — computeSessionState() result
 * @param {object}      roomHealth — computeRoomHealth() result
 * @param {string}      phase      — detectSessionPhase() result
 * @returns {{ score, grade, trend, components: { momentum, engagement, velocity, recovery } }}
 */
export function computeStreamHealth(state, roomHealth, phase) {
  if (!state) return { score: 0, grade: 'F', trend: 'stable', components: { momentum: 0, engagement: 0, velocity: 0, recovery: 0 } }

  const { paceStatus, timeSinceLastTip } = state
  const heatScore = roomHealth?.score ?? 0

  // Momentum (0–30)
  let momentum = 0
  if (paceStatus === 'above')         momentum = 30
  else if (paceStatus === 'on_track') momentum = 20
  else if (paceStatus === 'below')    momentum = 5
  else                                momentum = 12

  // Engagement = room heat proxy (0–30)
  const engagement = Math.min(30, Math.round(heatScore * 0.3))

  // Velocity = tip recency (0–25)
  let velocity = 0
  if (timeSinceLastTip === null)                        velocity = 12
  else if (timeSinceLastTip < 2)                        velocity = 25
  else if (timeSinceLastTip < 5)                        velocity = 18
  else if (timeSinceLastTip < 8)                        velocity = 10
  else if (timeSinceLastTip < 12)                       velocity = 4

  // Recovery potential by phase (0–15)
  const recoveryMap = { PEAK: 15, GROWTH: 12, RECOVERY: 10, PLATEAU: 8, STARTUP: 6, DECLINE: 0 }
  const recovery = recoveryMap[phase] ?? 6

  const score = Math.min(100, momentum + engagement + velocity + recovery)

  let grade
  if (score >= 85) grade = 'A'
  else if (score >= 70) grade = 'B'
  else if (score >= 55) grade = 'C'
  else if (score >= 40) grade = 'D'
  else grade = 'F'

  const trend = ['PEAK', 'GROWTH'].includes(phase) ? 'improving'
    : phase === 'DECLINE' ? 'declining'
    : 'stable'

  return { score, grade, trend, components: { momentum, engagement, velocity, recovery } }
}
