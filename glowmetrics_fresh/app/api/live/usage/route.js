export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../lib/liveSession/auth'
import { sanitizedErrorResponse } from '../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../lib/liveSession/cors'

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

// Live Mode allowance for the progress bar. Read-only; the numbers come from
// get_live_mode_allowance(), the same rules start_live_session enforces.
// ?timezone= is the browser's zone, used only when no zone is saved.
export async function GET(req) {
  const cors = { 'Cache-Control': 'no-store', ...corsHeaders(req) }
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  const tz = new URL(req.url).searchParams.get('timezone')
  const { data, error } = await supabase.rpc('get_live_mode_allowance', {
    p_timezone: tz ? tz.slice(0, 64) : null,
  })
  if (error) {
    const { status, body } = sanitizedErrorResponse(error)
    return NextResponse.json(body, { status, headers: cors })
  }
  return NextResponse.json({ allowance: data }, { headers: cors })
}
