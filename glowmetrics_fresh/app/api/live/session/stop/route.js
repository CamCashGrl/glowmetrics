export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { shapeLiveSession, sanitizedErrorResponse } from '../../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../../lib/liveSession/cors'

// Must match the statuses finalize_live_session() will finalize.
const FINALIZABLE_STATUSES = ['active', 'paused', 'needs_resolution']

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

export async function POST(req) {
  const cors = corsHeaders(req)
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  // finalize_live_session returns the ended row on repeated calls too, so
  // whether this call had anything to stop is decided before calling it.
  const { data: unresolved, error: lookupError } = await supabase
    .from('live_sessions')
    .select('id')
    .eq('user_id', user.id)
    .in('status', FINALIZABLE_STATUSES)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lookupError) {
    const { status, body } = sanitizedErrorResponse(lookupError)
    return NextResponse.json(body, { status, headers: cors })
  }

  const { data, error } = await supabase.rpc(
    'finalize_live_session',
    unresolved ? { p_session_id: unresolved.id } : {}
  )
  if (error) {
    const { status, body } = sanitizedErrorResponse(error)
    return NextResponse.json(body, { status, headers: cors })
  }

  // A plpgsql composite return of NULL arrives as an object of null fields.
  const session = data?.id ? data : null

  return NextResponse.json(
    { session: shapeLiveSession(session), alreadyStopped: !unresolved },
    { headers: cors }
  )
}
