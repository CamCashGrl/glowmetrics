export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../lib/liveSession/auth'
import { shapeLiveSession, sanitizedErrorResponse } from '../../../../lib/liveSession/shape'
import { isEngineV2AllowedForUser } from '../../../../lib/liveSession/flag'
import { corsHeaders } from '../../../../lib/liveSession/cors'

const UNRESOLVED_STATUSES = ['starting', 'active', 'paused', 'stopping', 'needs_resolution']

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

// Restore. Read-only — never creates a session, never mutates anything.
// Does not use the "last 12 hours of live_tips" heuristic this replaces.
export async function GET(req) {
  const cors = corsHeaders(req)
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store', ...cors } })
  }

  // Always looked up, independent of the flag — an existing session must be
  // found and returned even when the flag is currently disabled or Edge
  // Config is unavailable.
  const { data, error } = await supabase
    .from('live_sessions')
    .select('*')
    .eq('user_id', user.id)
    .in('status', UNRESOLVED_STATUSES)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    const { status, body } = sanitizedErrorResponse(error)
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...cors } })
  }

  // Evaluated separately and always, but this value only ever governs
  // whether a NEW session may be started — never whether `session` above
  // (if not null) should be shown or abandoned. Named explicitly to avoid
  // any ambiguity that an existing V2 session could be at risk from it.
  const engineEnabledForNewSession = await isEngineV2AllowedForUser(user.id)

  return NextResponse.json(
    { session: shapeLiveSession(data), engineEnabledForNewSession },
    { headers: { 'Cache-Control': 'no-store', ...cors } }
  )
}
