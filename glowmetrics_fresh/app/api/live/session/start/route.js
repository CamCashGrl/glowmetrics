export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { shapeLiveSession, sanitizedErrorResponse } from '../../../../../lib/liveSession/shape'
import { verifyLiveModeProfile } from '../../../../../lib/liveSession/paidEntitlement'
import { corsHeaders } from '../../../../../lib/liveSession/cors'
import { buildLiveModeAllowance, startOfUtcWeek, trialWindowStart } from '../../../../../lib/liveModeAllowance'
import { isTrialStatus } from '../../../../../lib/planLimits'

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

  // Reopening an already-running session never consumes another allowance slot.
  if (existing) {
    return NextResponse.json({ session: shapeLiveSession(existing) }, { headers: cors })
  }

  const now = new Date()
  const { data: storedProfile, error: profileError } = await supabase
    .from('profiles')
    .select('plan,subscription_status,trial_ends_at,stripe_subscription_id,stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ error: 'Unable to verify Live Mode allowance.' }, { status: 500, headers: cors })
  }

  let profile
  try { profile = await verifyLiveModeProfile(storedProfile) } catch (_) {
    return NextResponse.json({ error: 'Unable to verify Live Mode entitlement.' }, { status: 503, headers: cors })
  }

  const trialing = isTrialStatus(profile?.subscription_status, profile?.trial_ends_at, now)
  const trialStart = trialing ? trialWindowStart(profile?.trial_ends_at) : null
  const allowanceStart = trialStart || startOfUtcWeek(now)

  const { data: sessions, error: sessionsError } = await supabase
    .from('live_sessions')
    .select('id,started_at,ended_at,total_paused_seconds,paused_at,live_substate,status')
    .eq('user_id', user.id)
    .gte('started_at', allowanceStart.toISOString())

  if (sessionsError) {
    return NextResponse.json({ error: 'Unable to verify Live Mode allowance.' }, { status: 500, headers: cors })
  }

  const allowance = buildLiveModeAllowance({
    plan: profile?.plan || 'free',
    subscriptionStatus: profile?.subscription_status || 'none',
    trialEndsAt: profile?.trial_ends_at || null,
    sessions: sessions || [],
    currentSession: null,
    now,
  })

  if (allowance.locked) {
    const trial = allowance.scope === 'trial'
    return NextResponse.json({
      error: allowance.trialMetadataInvalid
        ? 'Unable to verify your trial allowance. Please retry or contact support.'
        : trial
        ? 'You’ve used both Live Mode sessions included in your 7-day trial. Upgrade to paid Pro for unlimited Live Mode.'
        : 'You’ve used both Free Live Mode streams for this week. Upgrade to Pro for unlimited Live Mode.',
      code: allowance.trialMetadataInvalid ? 'TRIAL_METADATA_INVALID' : trial ? 'TRIAL_LIVE_TOTAL_LIMIT' : 'FREE_LIVE_WEEKLY_LIMIT',
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
