export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { shapeLiveSession, sanitizedErrorResponse } from '../../../../../lib/liveSession/shape'
import { isEngineV2AllowedForUser } from '../../../../../lib/liveSession/flag'
import { corsHeaders } from '../../../../../lib/liveSession/cors'

import { UNRESOLVED_DB_STATUSES as UNRESOLVED_STATUSES } from '../../../../../lib/liveSession/status'

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

export async function POST(req) {
  const cors = corsHeaders(req)
  // 1. Authenticate.
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  // 2. Look for an existing unresolved live_sessions row owned by this user.
  const { data: existing, error: lookupError } = await supabase
    .from('live_sessions')
    .select('*')
    .eq('user_id', user.id)
    .in('status', UNRESOLVED_STATUSES)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lookupError) {
    const { status, body } = sanitizedErrorResponse(lookupError)
    return NextResponse.json(body, { status, headers: cors })
  }

  // 3. An unresolved session already exists — return it regardless of the
  // current flag value. Never create another one, never consult the flag
  // for this branch: an already-running session is never stranded by a
  // later flag change.
  if (existing) {
    return NextResponse.json({ session: shapeLiveSession(existing) }, { headers: cors })
  }

  // 4. No existing session — only now does the flag matter.
  const allowed = await isEngineV2AllowedForUser(user.id)

  // 5. Flag disabled, Edge Config unavailable, or this user not on the
  // allow-list — do not call start_live_session, do not create a session.
  if (!allowed) {
    return NextResponse.json(
      { error: 'Live Mode V2 is not enabled for this account.', engineDisabled: true },
      { status: 403, headers: cors }
    )
  }

  // 6. Only reachable when no session existed AND the flag allows this user.
  let platform = null
  try {
    const body = await req.json()
    platform = body?.platform ?? null
  } catch (_) {
    // no body / not JSON — platform stays null, RPC defaults it to Chaturbate
  }

  const { data, error } = await supabase.rpc('start_live_session', { p_platform: platform })
  if (error) {
    const { status, body } = sanitizedErrorResponse(error)
    return NextResponse.json(body, { status, headers: cors })
  }

  return NextResponse.json({ session: shapeLiveSession(data) }, { headers: cors })
}
