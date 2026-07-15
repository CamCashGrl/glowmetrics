export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { shapeLiveSession, sanitizedErrorResponse } from '../../../../../lib/liveSession/shape'

export async function POST(req) {
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
    return NextResponse.json(body, { status })
  }

  return NextResponse.json({ session: shapeLiveSession(data) })
}
