// ============================================================
// CAMCASH — FEATURE USAGE EVENT LOGGING
// Lightweight, fire-and-forget analytics for future feature-adoption
// analysis. Never read this table back as the source of truth for
// earnings, tips, or session duration — those always come from
// stream_sessions / tips / live_tips.
// ============================================================

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ userId: string, sessionId?: string|null, feature: string, action: string, metadata?: Record<string, unknown> }} event
 */
export async function logFeatureUsageEvent(supabase, { userId, sessionId = null, feature, action, metadata = {} }) {
  if (!userId || !feature || !action) return
  try {
    await supabase.from('feature_usage_events').insert({
      user_id: userId,
      session_id: sessionId,
      feature,
      action,
      metadata,
    })
  } catch {
    // Analytics-only — never let a logging failure interrupt streaming.
  }
}

/**
 * Guards against logging the same "once per lifecycle" event twice (e.g.
 * live_mode.session_started firing again on a re-render). Returns a
 * `shouldLog(key)` function that returns true only the first time it sees
 * a given key; reset() clears it (call on a new session start).
 */
export function createOnceGuard() {
  const seen = new Set()
  return {
    shouldLog(key) {
      if (seen.has(key)) return false
      seen.add(key)
      return true
    },
    reset() {
      seen.clear()
    },
  }
}
