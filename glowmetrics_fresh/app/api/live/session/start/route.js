export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { shapeLiveSession, sanitizedErrorResponse } from '../../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../../lib/liveSession/cors'
import { buildLiveModeAllowance, startOfUtcWeek } from '../../../../../lib/liveModeAllowance'

const UNRESOLVED_STATUSES = ['starting', 'live', 'inactive_warning', 'ending']

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

export async function POST(req) {
  const cors = corsHeaders(req)
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  const { data: existing, error: lookupError } = await supabase
    .from('live_sessions')
    .select('*')
    .eq('user_id', user.id)
    .in('status', UNRESOLVED_STATUSES)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lookupError) {
    const { status, body } = sanitizedErrorResponse(lookupError)
    return NextResponse.json(body, { status, headers: cors })
  }

  // Reopening an already-running session never consumes another weekly slot.
  if (existing) {
    return NextResponse.json({ session: shapeLiveSession(existing) }, { headers: cors })
  }

  // Enforce the Free weekly allowance before creating a new session.
  const now = new Date()
  const weekStart = startOfUtcWeek(now).toISOString()
  const [{ data: profile, error: profileError }, { data: weeklySessions, error: weeklyError }] = await Promise.all([
    supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle(),
    supabase
      .from('live_sessions')
      .select('id,started_at,ended_at,total_paused_seconds,paused_at,live_substate,status')
      .eq('user_id', user.id)
      .gte('started_at', weekStart),
  ])

  if (profileError || weeklyError) {
    return NextResponse.json({ error: 'Unable to verify Live Mode allowance.' }, { status: 500, headers: cors })
  }

  const allowance = buildLiveModeAllowance({
    plan: profile?.plan || 'free',
    sessions: weeklySessions || [],
    currentSession: null,
    now,
  })

  if (allowance.locked) {
    return NextResponse.json({
      error: 'You’ve used both Free Live Mode streams for this week. Upgrade to Pro for unlimited Live Mode.',
      code: 'FREE_LIVE_WEEKLY_LIMIT',
      allowance,
    }, { status: 403, headers: cors })
  }

  let platform = null
  try {
    const body = await req.json()
    platform = body?.platform ?? null
  } catch (_) {
    // no body / not JSON — platform stays null, RPC defaults it to Chaturbate
  }

  const { data, error } = await supabase.rpc('start_live_session', { p_platform: platform })
  if (error) {
    const { status, body } = sanitizedErrorResponse(error)
    return NextResponse.json(body, { status, headers: cors })
  }

  return NextResponse.json({ session: shapeLiveSession(data) }, { headers: cors })
}
