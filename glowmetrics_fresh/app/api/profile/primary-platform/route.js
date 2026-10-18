export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getLiveSessionCaller } from '../../../../lib/liveSession/auth'

// Selects the ONE platform whose detailed Free/trial analytics may be shown.
// Important: this selection NEVER grants unlimited history. The selected
// platform is still limited to the rolling 31-day analytics window; all other
// uploaded platform/history data stays stored for Platform Comparison and
// truthful locked Pro teasers.
//
// The choice remains one-time/immutable on Free so a user cannot rotate the
// selected platform to reveal each platform's locked detailed analytics one at
// a time. Paid Pro does not depend on this field for entitlement.
//
// We keep the existing column name `primary_pro_platform` for schema/backward
// compatibility, but its product meaning is now "selected analytics platform."
// This route writes only that field plus display-order `streaming_platforms`.
const ALLOWED = ['chaturbate', 'bongacams', 'myfreecams']

export async function POST(req) {
  const { user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body = {}
  try { body = await req.json() } catch (_) { /* empty body */ }
  const platform = String(body?.platform || '').trim().toLowerCase()
  if (!ALLOWED.includes(platform)) {
    return NextResponse.json({ error: 'Choose Chaturbate, BongaCams or MyFreeCams.' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const { data: current, error: readErr } = await admin
    .from('profiles')
    .select('streaming_platforms, primary_pro_platform')
    .eq('id', user.id)
    .maybeSingle()

  if (readErr) return NextResponse.json({ error: 'Could not load your profile.' }, { status: 500 })
  if (current?.primary_pro_platform) {
    return NextResponse.json({
      error: 'Your Free analytics platform is already selected. Upgrade to Pro to unlock detailed analytics across all stored platforms.',
      primary_pro_platform: current.primary_pro_platform,
    }, { status: 409 })
  }

  const others = (current?.streaming_platforms || [])
    .map((p) => String(p).toLowerCase())
    .filter((p) => p !== platform && ALLOWED.includes(p))

  const { data, error } = await admin
    .from('profiles')
    .update({ primary_pro_platform: platform, streaming_platforms: [platform, ...others] })
    .eq('id', user.id)
    .is('primary_pro_platform', null)
    .select('primary_pro_platform, streaming_platforms')
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Could not save your Free analytics platform.' }, { status: 500 })
  if (!data) {
    return NextResponse.json({
      error: 'Your Free analytics platform is already selected. Upgrade to Pro to unlock detailed analytics across all stored platforms.',
    }, { status: 409 })
  }

  return NextResponse.json({
    primary_pro_platform: data.primary_pro_platform,
    streaming_platforms: data.streaming_platforms,
    analytics_window_days: 31,
    full_history_unlocked: false,
  })
}
