// ============================================================
// CAMCASH — LIVE COACHING ALERT → STORED COACHING EVENT MAPPING
// Maps the existing live-coaching alert keys (app/live/page.js getAlerts)
// onto the extensible CoachingCategory schema so every shown prompt can be
// persisted. Never duplicate this mapping elsewhere — add new alert keys
// here as the coaching engine grows.
// ============================================================

const TITLES = {
  dead_air_critical: 'Dead air',
  dead_air_high: 'Dead air building',
  goal_push: 'Goal push',
  goal_hit: 'Goal hit',
  pace_below: 'Pace dropping',
  pace_above: 'Momentum building',
  stream_fatigue: 'Stream fatigue',
  whale_prox: 'Returning supporter pattern',
  whale_dep: 'Supporter concentration',
}

/**
 * @param {string} key - the alert's internal cooldown key, e.g. 'whale_prox_Alex'
 * @returns {import('./constants').CoachingCategory}
 */
export function categoryForAlertKey(key) {
  if (!key) return 'supporter_engagement'
  if (key.startsWith('dead_air')) return 'room_recovery'
  if (key.startsWith('goal_')) return 'goal_momentum'
  if (key.startsWith('pace_')) return 'pace_management'
  if (key === 'stream_fatigue') return 'session_timing'
  if (key.startsWith('whale_prox_')) return 'returning_supporter'
  if (key.startsWith('whale_dep_')) return 'supporter_engagement'
  return 'supporter_engagement'
}

/**
 * @param {string} key
 * @returns {string} human title for coaching history / reports
 */
export function titleForAlertKey(key) {
  if (!key) return 'Coaching prompt'
  const prefixMatch = Object.keys(TITLES).find(k => key === k || key.startsWith(`${k}_`))
  return prefixMatch ? TITLES[prefixMatch] : 'Coaching prompt'
}

/**
 * Builds the fields needed to persist a StoredCoachingEvent from a live
 * alert object (see getAlerts() in app/live/page.js).
 *
 * @param {{ key: string, priority: number, text: string, context?: string, action?: string,
 *           relatedTipperName?: string|null, relatedAmountUsd?: number|null }} alert
 */
export function buildCoachingEventFields(alert) {
  return {
    category: categoryForAlertKey(alert.key),
    priority: alert.priority,
    dedupeKey: alert.key,
    title: titleForAlertKey(alert.key),
    message: [alert.context, alert.action].filter(Boolean).join(' — ') || alert.text,
    compactMessage: alert.text,
    relatedTipperName: alert.relatedTipperName ?? null,
    relatedAmountUsd: alert.relatedAmountUsd ?? null,
  }
}
