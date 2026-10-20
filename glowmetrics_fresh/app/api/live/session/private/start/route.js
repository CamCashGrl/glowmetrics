export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../../lib/liveSession/auth'
import { sanitizedErrorResponse } from '../../../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../../../lib/liveSession/cors'

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

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
    return NextResponse.json({ error: 'Fan username is required and must be 80 characters or fewer.' }, { status: 400, headers: cors })
  }

  const platform = typeof body?.platform === 'string' ? body.platform.trim() : null

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
