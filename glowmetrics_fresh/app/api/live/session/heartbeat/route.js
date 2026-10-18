export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { shapeLiveSession, sanitizedErrorResponse } from '../../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../../lib/liveSession/cors'
import { buildLiveModeAllowance } from '../../../../../lib/liveModeAllowance'

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

export async function POST(req) {
  const cors = corsHeaders(req)
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  const { data, error } = await supabase.rpc('send_website_heartbeat')
  if (error) {
    const { status, body } = sanitizedErrorResponse(error)
    return NextResponse.json(body, { status, headers: cors })
  }

  if (data?.id) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan,subscription_status,trial_ends_at')
      .eq('id', user.id)
      .maybeSingle()

    // Never silently assume Free when billing entitlement cannot be read. A
    // transient profile error must not terminate a paid Pro creator's stream.
    // The client will retry the heartbeat and enforcement resumes once the
    // server can verify the entitlement.
    if (profileError || !profile) {
      return NextResponse.json({ error: 'Unable to verify Live Mode entitlement.' }, { status: 500, headers: cors })
    }

    const allowance = buildLiveModeAllowance({
      plan: profile.plan || 'free',
      subscriptionStatus: profile.subscription_status || 'none',
      trialEndsAt: profile.trial_ends_at || null,
      sessions: [data],
      currentSession: data,
      now: new Date(),
    })

    if (!allowance.isPro && allowance.limitReached) {
      const { data: stopped, error: stopError } = await supabase.rpc('stop_live_session')
      if (stopError) {
        const { status, body } = sanitizedErrorResponse(stopError)
        return NextResponse.json(body, { status, headers: cors })
      }
      return NextResponse.json({
        session: shapeLiveSession(stopped),
        endedByFreeLimit: true,
        code: allowance.isTrial ? 'TRIAL_LIVE_DURATION_LIMIT' : 'FREE_LIVE_DURATION_LIMIT',
        allowance,
      }, { headers: cors })
    }
  }

  return NextResponse.json({ session: shapeLiveSession(data) }, { headers: cors })
}
