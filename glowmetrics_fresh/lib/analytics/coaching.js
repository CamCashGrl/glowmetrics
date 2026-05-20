/**
 * Centralized coaching engine.
 *
 * ALL coaching logic lives here — never inline in components.
 *
 * RULES:
 *  1. Coaching only fires on live events, never on historical data
 *  2. Every signal has a cooldown to prevent spam
 *  3. Alerts are prioritized: CRITICAL → HIGH → MEDIUM → INFO
 *  4. State is passed in (not fetched) — this is a pure function module
 *
 * Usage in components:
 *   import { getAlerts, getNextAction } from '@/lib/analytics/coaching'
 *   const alerts = getAlerts(state, cooldownsRef, { isHydrating: isHydratingHistory.current, liveActive })
 */

// Priority levels (lower number = higher priority)
export const PRIORITY = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4, INFO: 5 }

// Cooldown windows in milliseconds
const COOLDOWNS = {
  dead_air_critical:  3  * 60 * 1000,  // 3 min
  dead_air_high:      5  * 60 * 1000,  // 5 min
  pace_below:         5  * 60 * 1000,  // 5 min
  pace_above:         8  * 60 * 1000,  // 8 min
  goal_push:          4  * 60 * 1000,  // 4 min
  goal_hit:           10 * 60 * 1000,  // 10 min
  whale_dependency:   10 * 60 * 1000,  // 10 min
}

/**
 * Check and record a cooldown.
 * @param {object} cooldownsRef  — React ref ({ current: {} })
 * @param {string} key
 * @param {number} [overrideMs]  — optional override for the cooldown window
 * @returns {boolean} true if the alert should fire
 */
export function checkCooldown(cooldownsRef, key, overrideMs) {
  const ms   = overrideMs ?? COOLDOWNS[key] ?? 5 * 60 * 1000
  const last = cooldownsRef.current[key]
  if (!last || Date.now() - last > ms) {
    cooldownsRef.current[key] = Date.now()
    return true
  }
  return false
}

/**
 * Generate coaching alerts for the current session state.
 *
 * @param {object}  state         — output of computeSessionState()
 * @param {object}  cooldownsRef  — React ref storing { [alertKey]: lastFiredMs }
 * @param {object}  opts
 * @param {boolean} opts.isHydrating  — suppress all alerts during history load
 * @param {boolean} opts.liveActive   — suppress all alerts when session not started
 * @returns {Array<{priority, level, icon, text}>}
 */
export function getAlerts(state, cooldownsRef, { isHydrating = false, liveActive = false } = {}) {
  if (!state || isHydrating || !liveActive) return []

  const { timeSinceLastTip, paceStatus, goalProgress, topTipper,
          totalRevenue, elapsedMins, liveOnlyCount } = state

  const alerts = []

  // ── CRITICAL ─────────────────────────────────────────────────────────
  if (timeSinceLastTip !== null && timeSinceLastTip >= 8) {
    if (checkCooldown(cooldownsRef, 'dead_air_critical'))
      alerts.push({ priority: PRIORITY.CRITICAL, level: 'critical', icon: '🚨',
        text: `No tips in ${Math.round(timeSinceLastTip)} min — call out names NOW` })
  }
  if (goalProgress >= 90 && goalProgress < 100) {
    if (checkCooldown(cooldownsRef, 'goal_push'))
      alerts.push({ priority: PRIORITY.CRITICAL, level: 'critical', icon: '🎯',
        text: `${goalProgress}% to goal — push NOW, announce the reward` })
  }

  // ── HIGH ─────────────────────────────────────────────────────────────
  if (timeSinceLastTip !== null && timeSinceLastTip >= 5 && timeSinceLastTip < 8) {
    if (checkCooldown(cooldownsRef, 'dead_air_high'))
      alerts.push({ priority: PRIORITY.HIGH, level: 'warning', icon: '⚠️',
        text: `${Math.round(timeSinceLastTip)} min silence — restart with a quick goal` })
  }
  if (paceStatus === 'below' && elapsedMins >= 8 && liveOnlyCount >= 3) {
    if (checkCooldown(cooldownsRef, 'pace_below'))
      alerts.push({ priority: PRIORITY.HIGH, level: 'warning', icon: '📉',
        text: 'Pace dropping — activate toy or set a micro-goal' })
  }

  // ── MEDIUM ────────────────────────────────────────────────────────────
  if (paceStatus === 'above' && elapsedMins >= 8 && liveOnlyCount >= 3) {
    if (checkCooldown(cooldownsRef, 'pace_above'))
      alerts.push({ priority: PRIORITY.MEDIUM, level: 'success', icon: '🔥',
        text: "Momentum building — don't break the energy" })
  }
  if (goalProgress >= 100) {
    if (checkCooldown(cooldownsRef, 'goal_hit'))
      alerts.push({ priority: PRIORITY.MEDIUM, level: 'success', icon: '🎉',
        text: 'Goal hit! Set the next one immediately' })
  }

  // ── INFO ──────────────────────────────────────────────────────────────
  if (topTipper && totalRevenue > 0 && topTipper.revenue / totalRevenue >= 0.45) {
    const key = `whale_dep_${topTipper.username}`
    if (checkCooldown(cooldownsRef, key, COOLDOWNS.whale_dependency))
      alerts.push({ priority: PRIORITY.INFO, level: 'info', icon: '🐳',
        text: `${topTipper.username} is ${Math.round(topTipper.revenue / totalRevenue * 100)}% of revenue — give them attention` })
  }

  return alerts.sort((a, b) => a.priority - b.priority).slice(0, 4)
}

/**
 * Generate the single "Do This Now" coaching recommendation.
 *
 * @param {object}  state
 * @param {object}  opts
 * @param {boolean} opts.isHydrating
 * @param {boolean} opts.liveActive
 * @returns {{ text: string }}
 */
export function getNextAction(state, { isHydrating = false, liveActive = false } = {}) {
  if (!liveActive) return { text: 'Start your stream to get live coaching' }
  if (isHydrating)  return { text: 'Loading session data…' }
  if (!state)       return { text: 'Start your stream to get live coaching' }

  const { timeSinceLastTip, paceStatus, goalProgress, topTipper,
          totalRevenue, elapsedMins, liveOnlyCount } = state

  if (liveOnlyCount === 0)
    return { text: 'Waiting for your first tip this stream — set a goal to get things started.' }
  if (goalProgress >= 90 && goalProgress < 100)
    return { text: `Announce your reward out loud — goal is ${goalProgress}%. Tell chat exactly what happens when you hit it.` }
  if (timeSinceLastTip !== null && timeSinceLastTip >= 6)
    return { text: 'Say 3 names in chat right now. "I see [name] — tip to control what I do next."' }
  if (paceStatus === 'below' && elapsedMins >= 8)
    return { text: 'Set a small 50-token goal right now — micro-goals restart momentum when the room slows.' }
  if (topTipper && totalRevenue > 0 && topTipper.revenue / totalRevenue >= 0.4)
    return { text: `Thank ${topTipper.username} by name and offer them something exclusive for their next tip.` }
  if (elapsedMins < 15 && liveOnlyCount < 3)
    return { text: 'Set a 200-token opening goal and announce it. Early goals train the room to tip.' }
  return { text: 'Keep energy high — acknowledge every tipper by name. Recognition drives repeat tipping.' }
}
