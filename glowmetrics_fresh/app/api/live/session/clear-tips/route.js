export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { shapeLiveSession, sanitizedErrorResponse } from '../../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../../lib/liveSession/cors'

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

// Never deletes or modifies a single live_tips row. Sets tips_cleared_at on
// the caller's current unresolved session only — every reader of live_tips
// (the GET below, and each client's own tip feed) hides rows for that exact
// session id received at or before this timestamp. Historical/completed
// sessions and imported tips are untouched, since the filter only ever
// applies to rows tagged with this specific session's id.
export async function POST(req) {
  const cors = corsHeaders(req)
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  const { data, error } = await supabase.rpc('clear_live_session_tips')
  if (error) {
    const { status, body } = sanitizedErrorResponse(error)
    return NextResponse.json(body, { status, headers: cors })
  }
  if (!data) {
    return NextResponse.json({ error: 'No active session to clear tips for.' }, { status: 404, headers: cors })
  }

  return NextResponse.json({ session: shapeLiveSession(data) }, { headers: cors })
}
