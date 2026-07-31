export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { sanitizedErrorResponse } from '../../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../../lib/liveSession/cors'

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

const UNRESOLVED_STATUSES = ['starting', 'active', 'paused', 'stopping', 'needs_resolution']
const PAGE_SIZE_DEFAULT = 20
const PAGE_SIZE_MAX = 50

function shapeCoachingEvent(row) {
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

// Previous Prompts panel — paginated, newest-first list of coaching_events
// for the caller's current (or most recent) session, including already-
// answered and still-unmarked-but-expired rows so an older prompt stays
// resolvable from the UI. GET /api/live/coaching only ever returns the
// single currently-active prompt; this is the read path for everything
// that isn't that one row.
export async function GET(req) {
  const cors = corsHeaders(req)
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  const url = new URL(req.url)
  const requestedLimit = parseInt(url.searchParams.get('limit'), 10)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), PAGE_SIZE_MAX) : PAGE_SIZE_DEFAULT
  const cursor = url.searchParams.get('before') // ISO shown_at cursor, exclusive
  const statusFilter = url.searchParams.get('status') // 'performed' | 'skipped' | 'needs_response' | null (all)
  let sessionId = url.searchParams.get('sessionId')

  if (!sessionId) {
    const { data: session, error: sessionError } = await supabase
      .from('live_sessions')
      .select('id')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (sessionError) {
      const { status, body } = sanitizedErrorResponse(sessionError)
      return NextResponse.json(body, { status, headers: cors })
    }
    sessionId = session?.id || null
  }

  if (!sessionId) {
    return NextResponse.json(
      { sessionId: null, prompts: [], needsResponseCount: 0, totalCount: 0, nextCursor: null },
      { headers: { 'Cache-Control': 'no-store', ...cors } }
    )
  }

  // Ownership check — a caller-supplied sessionId must belong to them.
  const { data: ownedSession, error: ownedError } = await supabase
    .from('live_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (ownedError) {
    const { status, body } = sanitizedErrorResponse(ownedError)
    return NextResponse.json(body, { status, headers: cors })
  }
  if (!ownedSession) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: cors })
  }

  let query = supabase
    .from('coaching_events')
    .select('*', { count: 'exact' })
    .eq('session_id', sessionId)
    .order('shown_at', { ascending: false })
    .limit(limit)

  if (cursor) query = query.lt('shown_at', cursor)
  if (statusFilter === 'performed' || statusFilter === 'skipped') {
    query = query.eq('action_status', statusFilter)
  } else if (statusFilter === 'needs_response') {
    query = query.eq('action_status', 'unmarked')
  }

  const { data, error, count } = await query
  if (error) {
    const { status, body } = sanitizedErrorResponse(error)
    return NextResponse.json(body, { status, headers: cors })
  }

  const { count: needsResponseCount, error: countError } = await supabase
    .from('coaching_events')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('action_status', 'unmarked')
  if (countError) {
    const { status, body } = sanitizedErrorResponse(countError)
    return NextResponse.json(body, { status, headers: cors })
  }

  const rows = data || []
  const nextCursor = rows.length === limit ? rows[rows.length - 1].shown_at : null

  return NextResponse.json(
    {
      sessionId,
      prompts: rows.map(shapeCoachingEvent),
      needsResponseCount: needsResponseCount || 0,
      totalCount: count ?? rows.length,
      nextCursor,
    },
    { headers: { 'Cache-Control': 'no-store', ...cors } }
  )
}
