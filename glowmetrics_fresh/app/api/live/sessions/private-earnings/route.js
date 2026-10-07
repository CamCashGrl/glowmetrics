export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { sanitizedErrorResponse } from '../../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../../lib/liveSession/cors'
import { loadFinalizedPrivateIntervals } from '../../../../../lib/liveSession/loadShows'

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

// Closed private intervals of the caller's finalized Live shows (RLS-scoped).
export async function GET(req) {
  const cors = { 'Cache-Control': 'no-store', ...corsHeaders(req) }
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  const { intervals, error } = await loadFinalizedPrivateIntervals(supabase, user.id)
  if (error) {
    const { status, body } = sanitizedErrorResponse(error)
    return NextResponse.json(body, { status, headers: cors })
  }
  return NextResponse.json({ intervals }, { headers: cors })
}
