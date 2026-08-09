export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { shapeLiveSession, sanitizedErrorResponse } from '../../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../../lib/liveSession/cors'
import { runStreamCompletionPipeline } from '../../../../../lib/intelligence/streamCompletion'

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

export async function POST(req) {
  const cors = corsHeaders(req)
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  const { data, error } = await supabase.rpc('stop_live_session')
  if (error) {
    const { status, body } = sanitizedErrorResponse(error)
    return NextResponse.json(body, { status, headers: cors })
  }

  // Dashboard intelligence — evaluates the just-finalized session against
  // the account's historical baseline and records a stream_outperformed_baseline
  // event only when the improvement is real and meaningful (see
  // lib/intelligence/streamCompletion.js). Never blocks or fails the stop
  // response — `data` is null when there was nothing to stop (session
  // already ended elsewhere), in which case the pipeline is a no-op.
  if (data) {
    try {
      await runStreamCompletionPipeline({ userId: user.id, supabase, session: data })
    } catch (intelligenceErr) {
      console.warn('[live/session/stop] Stream completion intelligence pipeline failed:', intelligenceErr.message)
    }
  }

  return NextResponse.json({ session: shapeLiveSession(data), alreadyStopped: !data }, { headers: cors })
}
