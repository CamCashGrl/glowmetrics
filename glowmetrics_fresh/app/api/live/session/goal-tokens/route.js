export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { shapeLiveSession, sanitizedErrorResponse } from '../../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../../lib/liveSession/cors'

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

// Website-only — the extension reads live_sessions.coaching_goal_tokens,
// it never sets it. 0 means "no goal set" (goalProgress stays 0), matching
// the website's existing liveGoalTokens > 0 ? ... : 0 guard.
export async function POST(req) {
  const cors = corsHeaders(req)
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  let goalTokens = null
  try {
    const body = await req.json()
    goalTokens = body?.goalTokens ?? null
  } catch (_) {
    return NextResponse.json({ error: 'Missing goalTokens' }, { status: 400, headers: cors })
  }

  if (!Number.isInteger(goalTokens) || goalTokens < 0) {
    return NextResponse.json({ error: 'goalTokens must be a non-negative integer' }, { status: 400, headers: cors })
  }

  const { data, error } = await supabase.rpc('set_live_session_goal_tokens', { p_goal_tokens: goalTokens })
  if (error) {
    const { status, body } = sanitizedErrorResponse(error)
    return NextResponse.json(body, { status, headers: cors })
  }

  return NextResponse.json({ session: shapeLiveSession(data) }, { headers: cors })
}
