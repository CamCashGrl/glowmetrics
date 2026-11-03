export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../../lib/liveSession/auth'
import { sanitizedErrorResponse } from '../../../../../../lib/liveSession/shape'
import { enforceActiveLimit } from '../../../../../../lib/liveSession/activeLimit'
import { corsHeaders } from '../../../../../../lib/liveSession/cors'

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

// Starts a private interval inside the running live session. The session
// keeps running; a repeated Start returns the interval already open. The
// platform is the running session's own (checked in start_private_interval);
// a platform sent here is only a cross-check, never a fallback.
export async function POST(req) {
  const cors = corsHeaders(req)
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  let body = {}
  try { body = await req.json() } catch (_) {}
  const rate = Number(body?.ratePerMinute)
  if (!Number.isFinite(rate) || rate < 0 || rate > 1000) {
    return NextResponse.json({ error: 'ratePerMinute must be a number between 0 and 1000' }, { status: 400, headers: cors })
  }
  const username = typeof body?.username === 'string' ? body.username.trim() : ''
  if (!username || username.length > 80) {
    return NextResponse.json({ error: 'Enter the fan’s username to start a private show.', code: 'USERNAME_REQUIRED' }, { status: 400, headers: cors })
  }
  const platform = typeof body?.platform === 'string' && body.platform.trim() ? body.platform.trim() : null

  // A Free stream already past its 35 active minutes ends here, not inside a private.
  const limitEnded = await enforceActiveLimit(supabase)
  if (limitEnded) {
    return NextResponse.json({ error: 'Your Free stream reached its 35 active minutes and has ended.', code: 'FREE_LIVE_ACTIVE_LIMIT', limitEnded }, { status: 409, headers: cors })
  }

  const { data, error } = await supabase.rpc('start_private_interval', { p_rate_per_minute: rate, p_platform: platform, p_username: username })
  if (error) {
    const { status, body: errBody } = sanitizedErrorResponse(error)
    return NextResponse.json(errBody, { status, headers: cors })
  }
  return NextResponse.json({ privateInterval: data?.id ? data : null }, { headers: cors })
}
