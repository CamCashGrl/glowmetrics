export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { sanitizedErrorResponse } from '../../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../../lib/liveSession/cors'
import { isUuid } from '../../../../../lib/liveTips/legacyEventId'

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

// Marks finalized shows as seen by this account (dashboard_seen_at), which
// clears NEW on every device. Idempotent: the first seen time is kept.
export async function POST(req) {
  const cors = corsHeaders(req)
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  let ids = []
  try {
    const body = await req.json()
    ids = Array.isArray(body?.sessionIds) ? body.sessionIds : body?.sessionId ? [body.sessionId] : []
  } catch (_) {}
  if (!ids.length || ids.length > 50 || !ids.every(isUuid)) {
    return NextResponse.json({ error: 'sessionIds must be 1-50 UUIDs' }, { status: 400, headers: cors })
  }

  const acknowledged = []
  for (const id of ids) {
    const { data, error } = await supabase.rpc('acknowledge_live_session', { p_session_id: id })
    if (error) {
      const { status, body } = sanitizedErrorResponse(error)
      return NextResponse.json(body, { status, headers: cors })
    }
    if (data?.id) acknowledged.push({ id: data.id, seenAt: data.dashboard_seen_at })
  }
  return NextResponse.json({ acknowledged }, { headers: cors })
}
