// Server-side analytics event logging — writes directly to the same
// `analytics_events` table app/api/track/route.js persists to, so
// server-confirmed events (checkout_completed, plan_activated) land in the
// same store as client events without an extra HTTP round-trip from
// server code calling itself.
//
// Never pass raw CSV contents, fan usernames, tip messages, or Stripe
// secrets in `properties` — callers are responsible for that; this helper
// does no redaction of its own since it has no way to know what's safe.
export async function logServerEvent(supabase, { userId, eventName, properties = {} }) {
  try {
    const { error } = await supabase.from('analytics_events').insert({
      user_id: userId ?? null,
      session_id: null,
      event_name: eventName,
      properties,
      url: null,
    })
    if (error) {
      console.error(`serverAnalytics: failed to log ${eventName}`, error.message)
    }
  } catch (e) {
    console.error(`serverAnalytics: failed to log ${eventName}`, e.message)
  }
}
