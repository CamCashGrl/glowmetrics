export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { shapeLiveSession, sanitizedErrorResponse } from '../../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../../lib/liveSession/cors'

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

// Explicit, user-initiated recovery from needs_resolution. Never invoked
// automatically by any heartbeat.
export async function POST(req) {
  const cors = corsHeaders(req)
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  let choice = null
  let endTime = null
  try {
    const body = await req.json()
    choice = body?.choice ?? null
    endTime = body?.endTime ?? null
  } catch (_) {
    return NextResponse.json({ error: 'Missing choice' }, { status: 400, headers: cors })
  }

  if (choice !== 'still_live' && choice !== 'ended') {
    return NextResponse.json({ error: 'choice must be "still_live" or "ended"' }, { status: 400, headers: cors })
  }

  const { data, error } = await supabase.rpc('resolve_live_session', {
    p_choice: choice,
    p_end_time: endTime,
  })
  if (error) {
    const { status, body } = sanitizedErrorResponse(error)
    return NextResponse.json(body, { status, headers: cors })
  }

  return NextResponse.json({ session: shapeLiveSession(data), resolved: !!data }, { headers: cors })
}
