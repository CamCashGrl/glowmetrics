export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { sanitizedErrorResponse } from '../../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../../lib/liveSession/cors'

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

const UNRESOLVED_STATUSES = ['starting', 'active', 'paused', 'stopping', 'needs_resolution']

function shapeCoachingEvent(row) {
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

// Every coaching_events row for the caller's own current unresolved
// session, newest first — feeds the shared prompt-history feed on both
// the website and the dashboard. Read-only; responding to a prompt still
// goes through POST /api/live/coaching/respond. Never trusts a
// client-supplied session id, same pattern as every other live-mode route.
export async function GET(req) {
  const cors = corsHeaders(req)
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

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

  if (!session) {
    return NextResponse.json({ prompts: [] }, { headers: { 'Cache-Control': 'no-store', ...cors } })
  }

  const { data: events, error: eventsError } = await supabase
    .from('coaching_events')
    .select('*')
    .eq('session_id', session.id)
    .order('shown_at', { ascending: false })
    .limit(50)

  if (eventsError) {
    const { status, body } = sanitizedErrorResponse(eventsError)
    return NextResponse.json(body, { status, headers: cors })
  }

  return NextResponse.json(
    { prompts: (events || []).map(shapeCoachingEvent) },
    { headers: { 'Cache-Control': 'no-store', ...cors } }
  )
}
