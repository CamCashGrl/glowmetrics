export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../lib/liveSession/auth'
import { buildLiveModeAllowance, startOfUtcWeek, trialWindowStart } from '../../../../lib/liveModeAllowance'
import { isTrialStatus } from '../../../../lib/planLimits'
import { verifyLiveModeProfile } from '../../../../lib/liveSession/paidEntitlement'
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
  const { data: storedProfile, error: profileError } = await supabase
    .from('profiles')
    .select('plan,subscription_status,trial_ends_at,stripe_subscription_id,stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ error: 'Unable to load Live Mode allowance.' }, { status: 500, headers: cors })
  }

  let profile
  try { profile = await verifyLiveModeProfile(storedProfile) } catch (_) {
    return NextResponse.json({ error: 'Unable to verify Live Mode entitlement.' }, { status: 503, headers: cors })
  }

  const trialing = isTrialStatus(profile?.subscription_status, profile?.trial_ends_at, now)
  const trialStart = trialing ? trialWindowStart(profile?.trial_ends_at) : null
  const allowanceStart = trialStart || startOfUtcWeek(now)

  const [{ data: sessions, error: sessionsError }, { data: currentSession, error: currentError }] = await Promise.all([
    supabase
      .from('live_sessions')
      .select('id,started_at,ended_at,total_paused_seconds,paused_at,live_substate,status')
      .eq('user_id', user.id)
      .gte('started_at', allowanceStart.toISOString())
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

  if (sessionsError || currentError) {
    return NextResponse.json({ error: 'Unable to load Live Mode allowance.' }, { status: 500, headers: cors })
  }

  const allowance = buildLiveModeAllowance({
    plan: profile?.plan || 'free',
    subscriptionStatus: profile?.subscription_status || 'none',
    trialEndsAt: profile?.trial_ends_at || null,
    sessions: sessions || [],
    currentSession: currentSession || null,
    now,
  })

  return NextResponse.json({ allowance }, { headers: cors })
}
