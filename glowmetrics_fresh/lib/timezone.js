// Canonical creator-timezone resolution, per canonical-analytics-rules.md's
// timezone contract:
//   1. profiles.timezone (creator's saved preference) = source of truth
//   2. browser-detected timezone = fallback only when (1) is null
//   3. 'UTC' = final fallback, with the source explicitly marked so no caller
//      silently presents a guess as a confirmed preference.
//
// profiles.timezone already exists in the schema (text, nullable) but was
// unpopulated by any code path before this file — see the Phase 1 PR
// description for the trace confirming that.

export function detectBrowserTimezone() {
  try {
    return typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : null
  } catch {
    return null
  }
}

/**
 * @param {string|null} profileTimezone - profiles.timezone for this user
 * @returns {{ timezone: string, source: 'profile' | 'browser_fallback' | 'utc_fallback' }}
 */
export function resolveCreatorTimezone(profileTimezone) {
  if (profileTimezone) return { timezone: profileTimezone, source: 'profile' }
  const browserTz = detectBrowserTimezone()
  if (browserTz) return { timezone: browserTz, source: 'browser_fallback' }
  return { timezone: 'UTC', source: 'utc_fallback' }
}

// Auto-populates profiles.timezone from the browser exactly once — never
// overwrites an existing value (explicit or previously auto-populated).
// Call this from the dashboard's load path; safe to call on every load since
// it's a no-op once profiles.timezone is already set.
export async function autoPopulateTimezoneIfMissing(supabase, userId, currentProfileTimezone) {
  if (currentProfileTimezone) return null
  const browserTz = detectBrowserTimezone()
  if (!browserTz) return null
  const { error } = await supabase
    .from('profiles')
    .update({ timezone: browserTz })
    .eq('id', userId)
    .is('timezone', null) // race-safe: only writes if still null server-side
  if (error) {
    console.error('[timezone] auto-populate failed:', error.message)
    return null
  }
  return browserTz
}
