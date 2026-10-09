export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { sanitizedErrorResponse } from '../../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../../lib/liveSession/cors'
import { loadFinalizedShows } from '../../../../../lib/liveSession/loadShows'

const MAX_LIMIT = 50

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

// Finalized shows, newest first, rebuilt from persisted data on every call.
export async function GET(req) {
  const cors = { 'Cache-Control': 'no-store', ...corsHeaders(req) }
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  const requested = Number(new URL(req.url).searchParams.get('limit'))
  const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, MAX_LIMIT) : 10

  const { shows, error } = await loadFinalizedShows(supabase, user.id, { limit })
  if (error) {
    const { status, body } = sanitizedErrorResponse(error)
    return NextResponse.json(body, { status, headers: cors })
  }
  return NextResponse.json({ shows }, { headers: cors })
}
