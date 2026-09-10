/**
 * Canonical Timezone Utilities
 *
 * Single source of truth for all creator-timezone conversions.
 * All creator-facing analytics must use these functions, never browser Intl or UTC directly.
 *
 * STORAGE: Timestamps stored as ISO strings (UTC in database)
 * CALCULATION: All creator-facing hour/day/month calculations use creator's configured timezone
 * DISPLAY: All creator-facing times show explicit AM/PM
 */

/**
 * Get creator's configured timezone
 * Fallback to UTC if not configured
 * @param {Object} profile - creator's profile object with schedule.timezone
 * @returns {string} IANA timezone string (e.g., "America/Los_Angeles")
 */
export function getCreatorTimezone(profile) {
  // Check for schedule.timezone in profile
  if (profile?.schedule?.timezone) {
    return profile.schedule.timezone
  }
  // Fallback to UTC, never browser timezone
  return 'UTC'
}

/**
 * Convert ISO timestamp to creator's local hour (0-23)
 * CANONICAL replacement for getUTCHours()
 * @param {string|Date} dateStr - ISO timestamp
 * @param {string} creatorTimezone - IANA timezone (e.g., "America/Los_Angeles")
 * @returns {number} hour in creator's timezone (0-23)
 */
export function getCreatorHour(dateStr, creatorTimezone) {
  try {
    const date = new Date(dateStr)
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: creatorTimezone,
      hour: 'numeric',
      hour12: false
    }).format(date)
    const h = parseInt(formatted)
    return isNaN(h) ? 0 : h === 24 ? 0 : h
  } catch {
    // Fallback to UTC, not browser time
    return new Date(dateStr).getUTCHours()
  }
}

/**
 * Convert ISO timestamp to creator's local weekday (0-6, Sunday=0)
 * CANONICAL replacement for getUTCDay()
 * @param {string|Date} dateStr - ISO timestamp
 * @param {string} creatorTimezone - IANA timezone
 * @returns {number} weekday in creator's timezone (0=Sunday, 6=Saturday)
 */
export function getCreatorDay(dateStr, creatorTimezone) {
  try {
    const date = new Date(dateStr)
    const dayName = new Intl.DateTimeFormat('en-US', {
      timeZone: creatorTimezone,
      weekday: 'long'
    }).format(date)
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      .indexOf(dayName)
  } catch {
    return new Date(dateStr).getUTCDay()
  }
}

/**
 * Convert ISO timestamp to creator's local date string
 * Format: YYYY-MM-DD in creator's timezone
 * @param {string|Date} dateStr - ISO timestamp
 * @param {string} creatorTimezone - IANA timezone
 * @returns {string} date in YYYY-MM-DD format (creator's timezone)
 */
export function getCreatorDateString(dateStr, creatorTimezone) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: creatorTimezone
    }).format(new Date(dateStr))
  } catch {
    return new Date(dateStr).toISOString().split('T')[0]
  }
}

/**
 * Format time with explicit AM/PM in creator's timezone
 * Format: "9:00 AM" or "9:00 PM"
 * @param {string|Date} dateStr - ISO timestamp
 * @param {string} creatorTimezone - IANA timezone
 * @returns {string} formatted time with AM/PM
 */
export function getCreatorTimeWithAMPM(dateStr, creatorTimezone) {
  try {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('en-US', {
      timeZone: creatorTimezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date)
  } catch {
    return new Date(dateStr).toLocaleTimeString('en-US')
  }
}

/**
 * Format time range with AM/PM in creator's timezone
 * Format: "9:00 AM – 11:00 AM" or "9:00 PM – 11:00 PM"
 * @param {number} startHour - start hour (0-23)
 * @param {number} endHour - end hour (0-23)
 * @param {string} creatorTimezone - IANA timezone
 * @returns {string} formatted range with AM/PM
 */
export function getCreatorTimeRangeWithAMPM(startHour, endHour, creatorTimezone) {
  try {
    // Create dates for today at the specified hours in creator's timezone
    const now = new Date()
    const startDate = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), startHour, 0, 0)
    const endDate = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), endHour, 0, 0)

    const startFormatted = new Intl.DateTimeFormat('en-US', {
      timeZone: creatorTimezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(startDate)

    const endFormatted = new Intl.DateTimeFormat('en-US', {
      timeZone: creatorTimezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(endDate)

    return `${startFormatted} – ${endFormatted}`
  } catch {
    return `${startHour}:00 – ${endHour}:00`
  }
}

/**
 * Format date with day name in creator's timezone
 * Format: "Monday, December 16, 2025"
 * @param {string|Date} dateStr - ISO timestamp
 * @param {string} creatorTimezone - IANA timezone
 * @returns {string} formatted date with day name
 */
export function getCreatorDateWithDayName(dateStr, creatorTimezone) {
  try {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('en-US', {
      timeZone: creatorTimezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date)
  } catch {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }
}

/**
 * Get creator's current local time as hour
 * @param {string} creatorTimezone - IANA timezone
 * @returns {number} current hour in creator's timezone (0-23)
 */
export function getCurrentCreatorHour(creatorTimezone) {
  return getCreatorHour(new Date().toISOString(), creatorTimezone)
}

/**
 * Get creator's current local day of week
 * @param {string} creatorTimezone - IANA timezone
 * @returns {number} current weekday in creator's timezone
 */
export function getCurrentCreatorDay(creatorTimezone) {
  return getCreatorDay(new Date().toISOString(), creatorTimezone)
}

/**
 * Get creator's current local date string
 * @param {string} creatorTimezone - IANA timezone
 * @returns {string} current date in creator's timezone (YYYY-MM-DD)
 */
export function getCurrentCreatorDateString(creatorTimezone) {
  return getCreatorDateString(new Date().toISOString(), creatorTimezone)
}

/**
 * Calculate days between two timestamps in creator's local date context
 * @param {string|Date} fromDate - ISO timestamp (earlier)
 * @param {string|Date} toDate - ISO timestamp (later, typically now)
 * @param {string} creatorTimezone - IANA timezone
 * @returns {number} days between dates in creator's local time
 */
export function getDaysBetweenInCreatorTimezone(fromDate, toDate, creatorTimezone) {
  const from = new Date(fromDate)
  const to = new Date(toDate)

  const fromLocalDate = new Date(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: creatorTimezone
    }).format(from)
  )

  const toLocalDate = new Date(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: creatorTimezone
    }).format(to)
  )

  const diffMs = toLocalDate - fromLocalDate
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

/**
 * Get month boundaries in creator's timezone
 * Returns [startOfMonth, endOfMonth] as ISO strings
 * @param {number} monthOffset - 0 for current month, -1 for previous, 1 for next
 * @param {string} creatorTimezone - IANA timezone
 * @returns {[string, string]} [startDate, endDate] in YYYY-MM-DD format
 */
export function getMonthBoundariesInCreatorTimezone(monthOffset = 0, creatorTimezone) {
  const now = new Date()

  // Get current date in creator's timezone
  const creatorNowStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: creatorTimezone
  }).format(now)

  const [year, month, day] = creatorNowStr.split('-').map(Number)

  // Calculate target month
  let targetMonth = month + monthOffset
  let targetYear = year
  if (targetMonth > 12) {
    targetYear += Math.floor(targetMonth / 12)
    targetMonth = targetMonth % 12 || 12
  } else if (targetMonth < 1) {
    targetYear -= Math.ceil((1 - targetMonth) / 12)
    targetMonth = ((targetMonth - 1) % 12 + 12) % 12 || 12
  }

  const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`

  // Get last day of month
  const lastDay = new Date(targetYear, targetMonth, 0).getDate()
  const endDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  return [startDate, endDate]
}
