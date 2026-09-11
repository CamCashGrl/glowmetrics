export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Vercel max for hobby plan

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  const supabase = getSupabase()

  // 1. Authenticate user via JWT
  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Get user's Chaturbate credentials from profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('chaturbate_username, chaturbate_api_token')
    .eq('id', user.id)
    .single()

  if (!profile?.chaturbate_username || !profile?.chaturbate_api_token) {
    return NextResponse.json({ error: 'No Chaturbate token configured' }, { status: 400 })
  }

  // 3. Poll Chaturbate Events API
  // Endpoint: https://eventsapi.chaturbate.com/events/{username}/{token}/
  const cbUrl = `https://eventsapi.chaturbate.com/events/${profile.chaturbate_username}/${profile.chaturbate_api_token}/`

  try {
    const cbResponse = await fetch(cbUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(55000), // slightly under Vercel limit
    })

    if (!cbResponse.ok) {
      return NextResponse.json({
        error: 'Chaturbate API error',
        status: cbResponse.status,
      }, { status: 502 })
    }

    const data = await cbResponse.json()

    // 4. Filter for tip events only
    const tipEvents = (data.events || []).filter(e => e.method === 'tip')

    // 5. Save tips to Supabase
    if (tipEvents.length > 0) {
      const rows = tipEvents.map(e => ({
        user_id: user.id,
        date_time: new Date(e.timestamp * 1000).toISOString(),
        platform: 'Chaturbate',
        username: e.object?.user?.username ?? 'anonymous',
        username_lower: (e.object?.user?.username ?? 'anonymous').toLowerCase(),
        tokens: e.object?.tip?.tokens ?? 0,
        usd: parseFloat(((e.object?.tip?.tokens ?? 0) * 0.05).toFixed(4)),
        usd_rounded: parseFloat(((e.object?.tip?.tokens ?? 0) * 0.05).toFixed(2)),
        tip_note: e.object?.tip?.message ?? null,
        tip_ref: `chaturbate:event:${e.id ?? Date.now()}`,
        tip_type: 'tip',
        tip_seq: 0,
      }))

      await supabase
        .from('tips')
        .upsert(rows, {
          onConflict: 'user_id,tip_ref',
          ignoreDuplicates: true,
        })
    }

    // 6. Return events + next_url for continued polling
    return NextResponse.json({
      events: tipEvents,
      next_url: data.next_url ?? null,
      tip_count: tipEvents.length,
    })

  } catch (err) {
    console.error('[CamCash Events API]', err)
    return NextResponse.json({ error: 'Failed to connect to Chaturbate' }, { status: 500 })
  }
}
