export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { sanitizedErrorResponse } from '../../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../../lib/liveSession/cors'

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

const UNRESOLVED_STATUSES = ['starting', 'live', 'inactive_warning', 'ending']

// The window either side of a prompt used for its before/after comparison.
// Deliberately short: a coaching prompt is a "do this now" instruction, so a
// longer window would sweep in unrelated activity and make the comparison
// mean even less than it already does.
const WINDOW_MINUTES = 15
const WINDOW_MS = WINDOW_MINUTES * 60 * 1000
const MAX_EVENTS = 50

/**
 * Earnings either side of a prompt the creator marked performed.
 *
 * THIS IS A CORRELATION, NOT AN ATTRIBUTION. Tips in the 15 minutes after a
 * prompt were not necessarily caused by acting on it — triggers tend to fire
 * when a room is already heating up, so the after-window is biased upward
 * before the creator does anything. The payload therefore carries the raw
 * observed figures and the session's own baseline, and never a "this prompt
 * earned you $X" number. The UI must present it as an observation.
 *
 * Returns null when the window is not yet complete, so a prompt fired two
 * minutes ago does not report a partial 15-minute total as if it were whole.
 */
function earningsAround(tips, shownAtIso, sessionBaselinePerWindow) {
  const t = new Date(shownAtIso).getTime()
  if (Number.isNaN(t)) return null
  if (Date.now() < t + WINDOW_MS) return null

  let before = 0
  let after = 0
  for (const tip of tips) {
    const ts = new Date(tip.received_at).getTime()
    if (Number.isNaN(ts)) continue
    if (ts >= t - WINDOW_MS && ts < t) before += Number(tip.usd) || 0
    else if (ts >= t && ts < t + WINDOW_MS) after += Number(tip.usd) || 0
  }

  return {
    window_minutes: WINDOW_MINUTES,
    before_usd: parseFloat(before.toFixed(2)),
    after_usd: parseFloat(after.toFixed(2)),
    // Null rather than Infinity when nothing came in beforehand — a jump from
    // zero has no meaningful multiple, and rendering one would overstate it.
    vs_before: before > 0 ? parseFloat((after / before).toFixed(2)) : null,
    vs_session_avg: sessionBaselinePerWindow > 0
      ? parseFloat((after / sessionBaselinePerWindow).toFixed(2))
      : null,
  }
}

// Read-only history of this session's coaching prompts, with an observed
// before/after earnings comparison on the ones the creator performed.
// Separate from GET /api/live/coaching (which resolves the single active
// prompt on a 15s poll) so that poll stays cheap — this is fetched on
// demand and when the feed panel is open.
export async function GET(req) {
  const cors = corsHeaders(req)
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  // Scoped to the caller's own live session. The session id is never taken
  // from the request — it is looked up from the authenticated user, so a
  // caller cannot read another creator's coaching history by supplying an id.
  const { data: session, error: sessionError } = await supabase
    .from('live_sessions')
    .select('id, started_at')
    .eq('user_id', user.id)
    .in('status', UNRESOLVED_STATUSES)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (sessionError) {
    const { status, body } = sanitizedErrorResponse(sessionError)
    return NextResponse.json(body, { status, headers: cors })
  }
  if (!session) {
    return NextResponse.json({ session: null, feed: [], summary: null }, { headers: { 'Cache-Control': 'no-store', ...cors } })
  }

  const { data: events, error: eventsError } = await supabase
    .from('coaching_events')
    .select('id, type, category, priority, title, message, compact_message, recommended_action, shown_at, action_status')
    .eq('session_id', session.id)
    .order('shown_at', { ascending: false })
    .limit(MAX_EVENTS)

  if (eventsError) {
    const { status, body } = sanitizedErrorResponse(eventsError)
    return NextResponse.json(body, { status, headers: cors })
  }

  const { data: tips, error: tipsError } = await supabase
    .from('live_tips')
    .select('usd, received_at')
    .eq('live_session_id', session.id)

  if (tipsError) {
    const { status, body } = sanitizedErrorResponse(tipsError)
    return NextResponse.json(body, { status, headers: cors })
  }

  const tipRows = tips || []
  const sessionUSD = tipRows.reduce((a, t) => a + (Number(t.usd) || 0), 0)
  const elapsedMs = Math.max(Date.now() - new Date(session.started_at).getTime(), 1)
  // The session's own average earnings per 15-minute window — the baseline
  // an after-window is compared against.
  const baselinePerWindow = sessionUSD / (elapsedMs / WINDOW_MS)

  const feed = (events || []).map(e => ({
    id: e.id,
    type: e.type,
    category: e.category,
    priority_rank: e.priority,
    title: e.title,
    message: e.message,
    compact_message: e.compact_message,
    recommended_action: e.recommended_action,
    shown_at: e.shown_at,
    action_status: e.action_status,
    session_timestamp: Math.max(0, Math.round((new Date(e.shown_at) - new Date(session.started_at)) / 1000)),
    // Only computed for prompts actually performed — a skipped or unmarked
    // prompt has no action to observe the effect of.
    earnings: e.action_status === 'performed'
      ? earningsAround(tipRows, e.shown_at, baselinePerWindow)
      : null,
  }))

  const performed = feed.filter(f => f.action_status === 'performed')
  const skipped = feed.filter(f => f.action_status === 'skipped')
  const measured = performed.filter(f => f.earnings)

  const summary = {
    total: feed.length,
    performed: performed.length,
    skipped: skipped.length,
    unmarked: feed.length - performed.length - skipped.length,
    follow_through_pct: performed.length + skipped.length > 0
      ? Math.round((performed.length / (performed.length + skipped.length)) * 100)
      : null,
    window_minutes: WINDOW_MINUTES,
    measured_count: measured.length,
    // Mean of the per-prompt after-window totals. Presented alongside the
    // session baseline so the reader compares two like figures rather than
    // being handed a single number implying causation.
    avg_after_usd: measured.length
      ? parseFloat((measured.reduce((a, f) => a + f.earnings.after_usd, 0) / measured.length).toFixed(2))
      : null,
    avg_before_usd: measured.length
      ? parseFloat((measured.reduce((a, f) => a + f.earnings.before_usd, 0) / measured.length).toFixed(2))
      : null,
    session_avg_per_window_usd: parseFloat(baselinePerWindow.toFixed(2)),
  }

  return NextResponse.json(
    { session: { id: session.id, started_at: session.started_at }, feed, summary },
    { headers: { 'Cache-Control': 'no-store', ...cors } }
  )
}
