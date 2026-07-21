// ============================================================
// TAX ORGANIZER — TIMEZONE VALIDATION
// Single place that decides what timezone Tax Organizer calculations use.
// No profile-level timezone exists in the DB yet (see repo investigation) —
// the browser-detected IANA zone is passed in from the client and must be
// validated server-side before use. Never trust it blindly.
// ============================================================

export const FALLBACK_TIMEZONE = 'UTC'

// Intl.DateTimeFormat throws RangeError for a string that isn't a real IANA
// zone — that's the only reliable cross-runtime validation available.
export function resolveTimezone(candidate) {
  if (!candidate || typeof candidate !== 'string') return FALLBACK_TIMEZONE
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate })
    return candidate
  } catch {
    return FALLBACK_TIMEZONE
  }
}

export function isValidTimezone(candidate) {
  return resolveTimezone(candidate) === candidate
}
