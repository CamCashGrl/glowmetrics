export const PHASES = {
  STARTUP:  { label: 'Startup',  icon: '🚀', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  border: 'rgba(148,163,184,0.25)', desc: 'Building momentum' },
  GROWTH:   { label: 'Growth',   icon: '📈', color: '#22d3ee', bg: 'rgba(34,211,238,0.1)',   border: 'rgba(34,211,238,0.25)',  desc: 'Engagement accelerating' },
  PEAK:     { label: 'Peak',     icon: '⚡', color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)',   desc: 'Maximum momentum' },
  PLATEAU:  { label: 'Plateau',  icon: '→',  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.28)', desc: 'Holding steady' },
  DECLINE:  { label: 'Decline',  icon: '📉', color: '#f87171', bg: 'rgba(248,113,113,0.1)',  border: 'rgba(248,113,113,0.3)', desc: 'Momentum dropping' },
  RECOVERY: { label: 'Recovery', icon: '🔄', color: '#a855f7', bg: 'rgba(168,85,247,0.1)',   border: 'rgba(168,85,247,0.28)', desc: 'Rebuilding energy' },
}

/**
 * Detect which phase a stream is currently in based on session state signals.
 * Uses only liveOnly metrics — never fires from historical hydration.
 *
 * @param {object|null} state     — computeSessionState() result
 * @param {string|null} prevPhase — previous phase key for transition detection
 * @returns {string} phase key
 */
export function detectSessionPhase(state, prevPhase = null) {
  if (!state) return 'STARTUP'

  const { elapsedMins, liveOnlyCount, paceStatus, timeSinceLastTip, tipsPerMinute } = state

  if (elapsedMins < 5 || liveOnlyCount < 2)
    return 'STARTUP'

  if (paceStatus === 'above' && elapsedMins >= 25 && liveOnlyCount >= 8)
    return 'PEAK'

  if (paceStatus === 'above' && elapsedMins >= 5)
    return 'GROWTH'

  if (timeSinceLastTip !== null && timeSinceLastTip > 10) {
    if (prevPhase === 'DECLINE' && tipsPerMinute > 0) return 'RECOVERY'
    return 'DECLINE'
  }

  if (paceStatus === 'below' && elapsedMins >= 20)
    return 'DECLINE'

  if (paceStatus === 'on_track' && elapsedMins >= 10)
    return 'PLATEAU'

  return 'GROWTH'
}

/**
 * Actionable recovery suggestions for the current stream phase.
 *
 * @param {string} phase — phase key
 * @returns {string[]}
 */
export function getRecoveryActions(phase) {
  const map = {
    DECLINE:  [
      'Say 3 names in chat NOW — force interaction',
      'Start a 100-token countdown goal immediately',
      'Switch your pacing — change content angle',
      'Offer a limited-time exclusive to next tipper',
    ],
    PLATEAU:  [
      'Raise the goal amount to create fresh urgency',
      'Introduce a new menu item or offer',
      'Personal shoutout for next 3 tippers',
      'Announce a surprise at next milestone',
    ],
    STARTUP:  [
      'Set a 200-token opening goal right now',
      'Announce: 3 tips = reward reveal',
      'Greet every viewer by name in chat',
    ],
    RECOVERY: [
      'Small win: set a 50-token micro-goal',
      'Acknowledge the energy shift — it happens',
      'New goal, new energy — announce it clearly',
    ],
    PEAK:     [
      "Keep going — don't change what's working",
      'Raise the ceiling — set a bigger goal now',
      "Ride the momentum, don't interrupt it",
    ],
    GROWTH:   [
      "Don't slow down — momentum is building",
      'Set a visible goal to channel the energy',
      'Name your top tipper to encourage more',
    ],
  }
  return map[phase] || map.GROWTH
}

/**
 * Intelligent goal strategy based on current state.
 *
 * @param {object|null} state      — computeSessionState() result
 * @param {object}      roomHealth — computeRoomHealth() result
 * @returns {{ probability, timing, suggestion, urgency }}
 */
export function getGoalStrategy(state, roomHealth) {
  if (!state) return { probability: 0, timing: 'wait', suggestion: 'Start streaming to get goal coaching', urgency: 'low' }

  const { goalProgress, paceStatus } = state
  const heatScore = roomHealth?.score ?? 0

  if (goalProgress >= 100)
    return { probability: 100, timing: 'reset',  urgency: 'high',   suggestion: 'Goal hit! Set the next one IMMEDIATELY before energy drops' }

  if (goalProgress >= 85 && heatScore >= 50)
    return { probability: 85,  timing: 'now',   urgency: 'high',   suggestion: `Announce goal reward NOW — you're ${goalProgress}% there` }

  if (goalProgress >= 60 && paceStatus === 'above')
    return { probability: 72,  timing: 'soon',  urgency: 'medium', suggestion: 'Momentum is up — mention the goal to keep it going' }

  if (paceStatus === 'below' && goalProgress < 40)
    return { probability: 25,  timing: 'wait',  urgency: 'low',    suggestion: 'Reset the goal — lower it to rebuild tip momentum' }

  return { probability: 50, timing: 'soon', urgency: 'low', suggestion: 'Keep mentioning the goal — repetition drives tipping' }
}
