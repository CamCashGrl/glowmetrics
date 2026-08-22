export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { shapeLiveSession, sanitizedErrorResponse } from '../../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../../lib/liveSession/cors'
import { resolveLiveModeAccess, LIVE_MODE_PRO_REQUIRED } from '../../../../../lib/liveSession/entitlement'

const UNRESOLVED_STATUSES = ['starting', 'live', 'inactive_warning', 'ending']

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

export async function POST(req) {
  const cors = corsHeaders(req)
  // 1. Authenticate.
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  // 1b. ENTITLEMENT. Live Mode is Pro, and this is where that is decided —
  // not by hiding the dashboard tab, which /live bypassed entirely. Checked
  // before the lookup so a Free caller cannot even learn whether a session
  // exists. A promo-trial plan passes here and stops passing when it expires.
  const { allowed } = await resolveLiveModeAccess(supabase, user)
  if (!allowed) {
    return NextResponse.json(LIVE_MODE_PRO_REQUIRED.body,
      { status: LIVE_MODE_PRO_REQUIRED.status, headers: cors })
  }

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

  // 3. An unresolved session already exists — return it. Never create
  // another one: an already-running session is never stranded or duplicated.
  if (existing) {
    return NextResponse.json({ session: shapeLiveSession(existing) }, { headers: cors })
  }

  // 4. No existing session — create one. There is exactly one Live Engine,
  // and by this point the caller has been confirmed Pro at step 1b.
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
