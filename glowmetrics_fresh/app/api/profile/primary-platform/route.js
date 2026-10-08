export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../lib/liveSession/auth'

// Sets the caller's primary platform ONCE (Free tier: full history on this
// platform, 31 days on others). It can never be changed afterwards: a profile
// that already has primary_pro_platform gets 409, and the update itself only
// matches rows where it is still NULL (no race between two requests). Writes ONLY the canonical field
// profiles.primary_pro_platform and keeps the compatibility field
// streaming_platforms primary-first — never any other column, so this route
// cannot be used to change plan or billing fields. RLS scopes it to the
// caller's own row. Values match onboarding's lowercase ids.
const ALLOWED = ['chaturbate', 'bongacams', 'myfreecams']

export async function POST(req) {
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body = {}
  try { body = await req.json() } catch (_) { /* empty body */ }
  const platform = String(body?.platform || '').trim().toLowerCase()
  if (!ALLOWED.includes(platform)) {
    return NextResponse.json({ error: 'Choose Chaturbate, BongaCams or MyFreeCams.' }, { status: 400 })
  }

  const { data: current, error: readErr } = await supabase
    .from('profiles').select('streaming_platforms, primary_pro_platform').eq('id', user.id).maybeSingle()
  if (readErr) return NextResponse.json({ error: 'Could not load your profile.' }, { status: 500 })
  if (current?.primary_pro_platform) {
    return NextResponse.json({ error: 'Your primary platform is already set and cannot be changed.' }, { status: 409 })
  }

  const others = (current?.streaming_platforms || [])
    .map((p) => String(p).toLowerCase())
    .filter((p) => p !== platform && ALLOWED.includes(p))
  const { data, error } = await supabase
    .from('profiles')
    .update({ primary_pro_platform: platform, streaming_platforms: [platform, ...others] })
    .eq('id', user.id)
    .is('primary_pro_platform', null)
    .select('primary_pro_platform, streaming_platforms')
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not save your primary platform.' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Your primary platform is already set and cannot be changed.' }, { status: 409 })

  return NextResponse.json({ primary_pro_platform: data.primary_pro_platform, streaming_platforms: data.streaming_platforms })
}
