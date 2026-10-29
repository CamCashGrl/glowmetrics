export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../../lib/liveSession/auth'
import { sanitizedErrorResponse } from '../../../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../../../lib/liveSession/cors'

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

// Starts a private interval inside the running live session. The session
// keeps running; a repeated Start returns the interval already open. Timing is
// the database's (started_at is written server-side); earnings are finalized
// only by the existing close path, never from here.
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
  // Platform and username are passed through untouched: start_private_interval
  // refuses a missing/unsupported platform or a blank username. Nothing here
  // (or in the browser) ever fills a default.
  const platform = typeof body?.platform === 'string' ? body.platform : null
  const username = typeof body?.username === 'string' ? body.username : null

  const { data, error } = await supabase.rpc('start_private_interval', {
    p_rate_per_minute: rate,
    p_platform: platform,
    p_username: username,
  })
  if (error) {
    if (error.message?.includes('NO_LIVE_SESSION')) {
      return NextResponse.json({ error: 'Go live before starting a private show.' }, { status: 409, headers: cors })
    }
    const { status, body: errBody } = sanitizedErrorResponse(error)
    return NextResponse.json(errBody, { status, headers: cors })
  }
  return NextResponse.json({ privateInterval: data?.id ? data : null }, { headers: cors })
}
