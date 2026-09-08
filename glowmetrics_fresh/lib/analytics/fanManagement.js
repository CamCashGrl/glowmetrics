/**
 * Fan Management State — Archiving & Dismissal
 *
 * Maintains separate, non-destructive management state for fans:
 * - Archive state (does NOT delete, modify tier, or delete history)
 * - Discovery dismissals (temporarily hides discoveries without modifying fan)
 *
 * These are stored separately from analytics state and do NOT affect:
 * - Tier classification
 * - Relative value
 * - Status
 * - Activity state
 * - Historical revenue/tips/session data
 * - Fan profile visibility
 *
 * Archived fans remain searchable, viewable, and unarchivable.
 */

/**
 * Archive a fan (non-destructive)
 * @param {string} fanKey - platform:username key
 * @param {Object} archiveState - { archivedFans: Set, archivedAt: Map }
 */
export function archiveFan(fanKey, archiveState) {
  if (!fanKey) return
  archiveState.archivedFans.add(fanKey)
  archiveState.archivedAt.set(fanKey, new Date().toISOString())
}

/**
 * Unarchive a fan
 * @param {string} fanKey - platform:username key
 * @param {Object} archiveState - { archivedFans: Set, archivedAt: Map }
 */
export function unarchiveFan(fanKey, archiveState) {
  if (!fanKey) return
  archiveState.archivedFans.delete(fanKey)
  archiveState.archivedAt.delete(fanKey)
}

/**
 * Check if fan is archived
 * @param {string} fanKey - platform:username key
 * @param {Object} archiveState - { archivedFans: Set }
 * @returns {boolean}
 */
export function isArchived(fanKey, archiveState) {
  return archiveState?.archivedFans?.has(fanKey) || false
}

/**
 * Dismiss a discovery alert (hide from feed without modifying fan)
 * @param {string} discoveryId - unique discovery ID (e.g., "churn_risk_username_platform")
 * @param {Object} dismissalState - { dismissedDiscoveries: Set, dismissedAt: Map }
 */
export function dismissDiscovery(discoveryId, dismissalState) {
  if (!discoveryId) return
  dismissalState.dismissedDiscoveries.add(discoveryId)
  dismissalState.dismissedAt.set(discoveryId, new Date().toISOString())
}

/**
 * Check if discovery is dismissed
 * @param {string} discoveryId - unique discovery ID
 * @param {Object} dismissalState - { dismissedDiscoveries: Set }
 * @returns {boolean}
 */
export function isDismissed(discoveryId, dismissalState) {
  return dismissalState?.dismissedDiscoveries?.has(discoveryId) || false
}

/**
 * Restore a dismissed discovery (undismiss)
 * @param {string} discoveryId - unique discovery ID
 * @param {Object} dismissalState - { dismissedDiscoveries: Set, dismissedAt: Map }
 */
export function restoreDiscovery(discoveryId, dismissalState) {
  if (!discoveryId) return
  dismissalState.dismissedDiscoveries.delete(discoveryId)
  dismissalState.dismissedAt.delete(discoveryId)
}

/**
 * Filter alerts/discoveries to exclude dismissed ones
 * @param {Array} alerts - array of alert objects with id property
 * @param {Object} dismissalState - { dismissedDiscoveries: Set }
 * @returns {Array} filtered alerts
 */
export function filterDismissedAlerts(alerts, dismissalState) {
  if (!alerts || !Array.isArray(alerts)) return []
  return alerts.filter(a => !isDismissed(a.id, dismissalState))
}

/**
 * Filter fans to exclude archived ones (for default active view)
 * @param {Array} fans - array of fan objects with platform, username
 * @param {Object} archiveState - { archivedFans: Set }
 * @returns {Array} filtered fans (excluding archived)
 */
export function getActiveFans(fans, archiveState) {
  if (!fans || !Array.isArray(fans)) return []
  return fans.filter(f => {
    const fanKey = `${f.platform}:${f.username}`.toLowerCase()
    return !isArchived(fanKey, archiveState)
  })
}

/**
 * Get archived fans
 * @param {Array} fans - array of fan objects with platform, username
 * @param {Object} archiveState - { archivedFans: Set }
 * @returns {Array} archived fans only
 */
export function getArchivedFans(fans, archiveState) {
  if (!fans || !Array.isArray(fans)) return []
  return fans.filter(f => {
    const fanKey = `${f.platform}:${f.username}`.toLowerCase()
    return isArchived(fanKey, archiveState)
  })
}
