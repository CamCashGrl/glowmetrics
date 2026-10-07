export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { shapeLiveSession, sanitizedErrorResponse } from '../../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../../lib/liveSession/cors'

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

export async function POST(req) {
  const cors = corsHeaders(req)
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  const { data, error } = await supabase.rpc('stop_live_session')
  if (error) {
    const { status, body } = sanitizedErrorResponse(error)
    return NextResponse.json(body, { status, headers: cors })
  }

  // A plpgsql composite return of NULL ("nothing to stop") arrives as an
  // object of null fields, not null.
  if (data?.id) {
    return NextResponse.json({ session: shapeLiveSession(data), alreadyStopped: false }, { headers: cors })
  }

  // Repeated Stop: return the same ended session, unchanged.
  const { data: lastEnded, error: lookupError } = await supabase
    .from('live_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'ended')
    .order('ended_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lookupError) {
    const { status, body } = sanitizedErrorResponse(lookupError)
    return NextResponse.json(body, { status, headers: cors })
  }

  return NextResponse.json({ session: shapeLiveSession(lastEnded), alreadyStopped: true }, { headers: cors })
}
