export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../lib/liveSession/auth'
import { buildLiveModeAllowance, startOfUtcWeek } from '../../../../lib/liveModeAllowance'
import { corsHeaders } from '../../../../lib/liveSession/cors'

const UNRESOLVED_STATUSES = ['starting', 'live', 'inactive_warning', 'ending']

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

export async function GET(req) {
  const cors = corsHeaders(req)
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  const now = new Date()
  const weekStart = startOfUtcWeek(now).toISOString()

  const [{ data: profile, error: profileError }, { data: sessions, error: sessionsError }, { data: currentSession, error: currentError }] = await Promise.all([
    supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle(),
    supabase
      .from('live_sessions')
      .select('id,started_at,ended_at,total_paused_seconds,paused_at,live_substate,status')
      .eq('user_id', user.id)
      .gte('started_at', weekStart)
      .order('started_at', { ascending: false }),
    supabase
      .from('live_sessions')
      .select('id,started_at,ended_at,total_paused_seconds,paused_at,live_substate,status')
      .eq('user_id', user.id)
      .in('status', UNRESOLVED_STATUSES)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (profileError || sessionsError || currentError) {
    return NextResponse.json({ error: 'Unable to load Live Mode allowance.' }, { status: 500, headers: cors })
  }

  const allowance = buildLiveModeAllowance({
    plan: profile?.plan || 'free',
    sessions: sessions || [],
    currentSession: currentSession || null,
    now,
  })

  return NextResponse.json({ allowance }, { headers: cors })
}
