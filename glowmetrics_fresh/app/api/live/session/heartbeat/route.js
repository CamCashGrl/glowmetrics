export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { shapeLiveSession, sanitizedErrorResponse } from '../../../../../lib/liveSession/shape'

// Website heartbeat — proves only that the CamCash Live Mode page is
// connected. Never touches extension fields, never creates a session,
// never revives needs_resolution (enforced in the RPC's WHERE clause).
export async function POST(req) {
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase.rpc('send_website_heartbeat')
  if (error) {
    const { status, body } = sanitizedErrorResponse(error)
    return NextResponse.json(body, { status })
  }

  return NextResponse.json({ session: shapeLiveSession(data) })
}
