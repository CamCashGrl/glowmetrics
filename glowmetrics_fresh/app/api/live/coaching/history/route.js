export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { sanitizedErrorResponse } from '../../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../../lib/liveSession/cors'
import { shapeHistoryEvent, sortByShownAtDesc } from '../../../../../lib/coaching/history'

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

const UNRESOLVED_STATUSES = ['starting', 'active', 'paused', 'stopping', 'needs_resolution']
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

// Coaching History feed for the current Live Mode session only — every
// coaching_events row for the caller's own unresolved session, newest
// first. Never returns another user's rows: the session lookup below is
// scoped to `user_id = auth.uid()` (RLS on coaching_events enforces the
// same thing again at the query layer), so there's no path from a
// tampered request param to someone else's history.
export async function GET(req) {
  const cors = corsHeaders(req)
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit'), 10) || DEFAULT_LIMIT))
  const before = searchParams.get('before') // ISO timestamp cursor for "load earlier"

  const { data: session, error: sessionError } = await supabase
    .from('live_sessions')
    .select('id')
    .eq('user_id', user.id)
    .in('status', UNRESOLVED_STATUSES)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (sessionError) {
    const { status, body } = sanitizedErrorResponse(sessionError)
    return NextResponse.json(body, { status, headers: cors })
  }

  // No active session — empty history, not an error, so the UI can show
  // its "coaching history appears during a session" empty state.
  if (!session) {
    return NextResponse.json(
      { session: null, prompts: [], hasMore: false },
      { headers: { 'Cache-Control': 'no-store', ...cors } }
    )
  }

  let query = supabase
    .from('coaching_events')
    .select('*')
    .eq('session_id', session.id)
    .order('shown_at', { ascending: false })
    .limit(limit + 1)

  if (before) query = query.lt('shown_at', before)

  const { data: rows, error } = await query

  if (error) {
    const { status, body } = sanitizedErrorResponse(error)
    return NextResponse.json(body, { status, headers: cors })
  }

  const hasMore = (rows || []).length > limit
  const page = sortByShownAtDesc((rows || []).slice(0, limit).map(shapeHistoryEvent))

  return NextResponse.json(
    { session: { id: session.id }, prompts: page, hasMore },
    { headers: { 'Cache-Control': 'no-store', ...cors } }
  )
}
