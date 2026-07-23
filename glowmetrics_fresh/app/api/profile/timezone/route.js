export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../lib/liveSession/auth'

// Persists the user's own timezone override (profiles.timezone). Null/empty
// clears it, falling back to browser-detected timezone everywhere that
// already reads this column. A basic sanity check via Intl — not an
// exhaustive IANA validator, but catches anything that clearly isn't a real
// zone before it reaches the database.
export async function POST(req) {
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let timezone = null
  try {
    const body = await req.json()
    timezone = body?.timezone || null
  } catch (_) {
    return NextResponse.json({ error: 'Missing timezone' }, { status: 400 })
  }

  if (timezone !== null) {
    try {
      Intl.DateTimeFormat('en-US', { timeZone: timezone })
    } catch (_) {
      return NextResponse.json({ error: 'Not a valid timezone' }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ timezone })
    .eq('id', user.id)
    .select('timezone')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Failed to save timezone' }, { status: 500 })
  }

  return NextResponse.json({ timezone: data?.timezone ?? null })
}
