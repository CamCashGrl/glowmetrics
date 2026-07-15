export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../lib/liveSession/auth'
import { shapeLiveSession, sanitizedErrorResponse } from '../../../../lib/liveSession/shape'

// Restore. Read-only — never creates a session, never mutates anything.
// Does not use the "last 12 hours of live_tips" heuristic this replaces.
export async function GET(req) {
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  const { data, error } = await supabase
    .from('live_sessions')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['starting', 'active', 'paused', 'stopping', 'needs_resolution'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    const { status, body } = sanitizedErrorResponse(error)
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
  }

  return NextResponse.json(
    { session: shapeLiveSession(data) },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
