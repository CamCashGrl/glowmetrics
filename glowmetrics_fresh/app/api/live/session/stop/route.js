export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { shapeLiveSession, sanitizedErrorResponse } from '../../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../../lib/liveSession/cors'

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

export async function POST(req) {
  const cors = corsHeaders(req)
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  // Phase 2: Call atomic finalize_live_session() RPC
  // This single RPC handles status transition, metric aggregation, and persistence
  // in one transaction with advisory lock protection against concurrent tips.
  const { data, error } = await supabase.rpc('finalize_live_session')
  if (error) {
    const { status, body } = sanitizedErrorResponse(error)
    return NextResponse.json(body, { status, headers: cors })
  }

  // Return finalized session (with all final_* metrics) on both first and repeated calls
  return NextResponse.json({
    session: shapeLiveSession(data),
    alreadyStopped: !data,
    finalized: data?.status === 'ended'
  }, { headers: cors })
}
