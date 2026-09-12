export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { sanitizedErrorResponse } from '../../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../../lib/liveSession/cors'

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

// Only these two — 'dismissed' is not exposed until there's a real UI
// action and defined behavior for it.
const VALID_STATUSES = ['performed', 'skipped']

// Shared by both surfaces against the same coaching_events.id — whichever
// one the user responds on, the other picks up the change on its next
// GET /api/live/coaching poll and reconciles.
export async function POST(req) {
  const cors = corsHeaders(req)
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  let eventId = null
  let status = null
  try {
    const body = await req.json()
    eventId = body?.eventId ?? null
    status = body?.status ?? null
  } catch (_) {
    return NextResponse.json({ error: 'Missing eventId or status' }, { status: 400, headers: cors })
  }

  if (!eventId || !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400, headers: cors }
    )
  }

  const { data, error } = await supabase.rpc('respond_to_coaching_event', {
    p_event_id: eventId,
    p_status: status,
  })

  if (error) {
    const { status: httpStatus, body } = sanitizedErrorResponse(error)
    return NextResponse.json(body, { status: httpStatus, headers: cors })
  }

  return NextResponse.json(
    {
      event: data
        ? { id: data.id, action_status: data.action_status, action_responded_at: data.action_responded_at }
        : null,
    },
    { headers: cors }
  )
}
