export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../../lib/liveSession/auth'
import { sanitizedErrorResponse } from '../../../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../../../lib/liveSession/cors'

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

// Ends the open private interval; a repeated End is a no-op (null).
export async function POST(req) {
  const cors = corsHeaders(req)
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  const { data, error } = await supabase.rpc('end_private_interval')
  if (error) {
    const { status, body } = sanitizedErrorResponse(error)
    return NextResponse.json(body, { status, headers: cors })
  }
  return NextResponse.json({ privateInterval: data?.id ? data : null }, { headers: cors })
}
