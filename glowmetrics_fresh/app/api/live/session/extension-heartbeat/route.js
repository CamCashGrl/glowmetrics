export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { shapeLiveSession, sanitizedErrorResponse } from '../../../../../lib/liveSession/shape'
import { enforceActiveLimit } from '../../../../../lib/liveSession/activeLimit'
import { corsHeaders } from '../../../../../lib/liveSession/cors'

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

// Extension heartbeat — proves the extension is active on a supported
// broadcaster page. Merely having Chrome open or the background worker
// alive is not proof; broadcasterPageDetected must reflect an actual,
// periodically re-checked page detection performed by the content script.
export async function POST(req) {
  const cors = corsHeaders(req)
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  let platform = null
  let broadcasterPageDetected = false
  try {
    const body = await req.json()
    platform = body?.platform ?? null
    broadcasterPageDetected = !!body?.broadcasterPageDetected
  } catch (_) {
    // malformed/missing body — treated as "not detected", never as "detected"
  }

  const limitEnded = await enforceActiveLimit(supabase)
  const { data, error } = await supabase.rpc('send_extension_heartbeat', {
    p_platform: platform,
    p_broadcaster_page_detected: broadcasterPageDetected,
  })
  if (error) {
    const { status, body } = sanitizedErrorResponse(error)
    return NextResponse.json(body, { status, headers: cors })
  }

  return NextResponse.json({ session: shapeLiveSession(data), limitEnded }, { headers: cors })
}
