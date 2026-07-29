// Shared shaping/ordering logic for the Coaching History feed
// (GET /api/live/coaching/history) — pulled out of the route handler so it
// can be unit-tested without a Next.js/Supabase request context.

// Same public shape as shapeCoachingEvent() in
// app/api/live/coaching/route.js, plus the response-timestamp field the
// history feed needs to show "responded 2 min ago" — never re-derive this
// shape independently, keep the two in sync if either changes.
export function shapeHistoryEvent(row) {
  if (!row) return null
  return {
    id: row.id,
    type: row.type,
    category: row.category,
    priority: row.priority,
    title: row.title,
    message: row.message,
    compact_message: row.compact_message,
    shown_at: row.shown_at,
    expires_at: row.expires_at,
    action_status: row.action_status,
    action_responded_at: row.action_responded_at,
    related_tipper_id: row.related_tipper_id,
    related_tipper_name: row.related_tipper_name,
    related_amount_usd: row.related_amount_usd,
  }
}

// Newest first, ties broken by id for a stable sort — matches the
// "newest historical prompt first" product requirement.
export function sortByShownAtDesc(events) {
  return [...events].sort((a, b) => {
    const diff = new Date(b.shown_at).getTime() - new Date(a.shown_at).getTime()
    if (diff !== 0) return diff
    return String(a.id).localeCompare(String(b.id))
  })
}

// Dedupes by id, keeping the first occurrence — guards against the same
// coaching_events row ever appearing twice if a caller merges two fetches.
export function dedupeById(events) {
  const seen = new Set()
  const out = []
  for (const event of events) {
    if (seen.has(event.id)) continue
    seen.add(event.id)
    out.push(event)
  }
  return out
}
