export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { shapeLiveSession, sanitizedErrorResponse, ALLOWANCE_LOCK_CODES } from '../../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../../lib/liveSession/cors'

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

// Start is a thin relay. start_live_session() is the single authority: it
// validates the platform (Chaturbate / BongaCams / MyFreeCams, never guessed),
// returns an already-unresolved session unchanged (refresh, reconnect and a
// second tab never create a row or consume a weekly start), and enforces the
// Free allowance under a per-user lock. This route decides nothing.
export async function POST(req) {
  const cors = corsHeaders(req)
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  let platform = null
  try {
    const body = await req.json()
    platform = typeof body?.platform === 'string' ? body.platform : null
  } catch (_) {
    // no body / not JSON — platform stays null and the database refuses it
  }

  const { data, error } = await supabase.rpc('start_live_session', { p_platform: platform })
  if (error) {
    const { status, body } = sanitizedErrorResponse(error)
    // A locked Start carries the database's allowance state so the UI can say
    // why (and prompt for a timezone). Display only: nothing is recomputed here.
    if (ALLOWANCE_LOCK_CODES.includes(body.code)) {
      const { data: allowance } = await supabase.rpc('get_live_mode_allowance')
      return NextResponse.json({ ...body, allowance: allowance ?? null }, { status, headers: cors })
    }
    return NextResponse.json(body, { status, headers: cors })
  }

  return NextResponse.json({ session: shapeLiveSession(data) }, { headers: cors })
}
