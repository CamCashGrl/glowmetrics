import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const supabase = createRouteHandlerClient({ cookies })

  // Auth check
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  // Get credentials from profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('chaturbate_username, chaturbate_stats_token')
    .eq('id', userId)
    .single()

  if (profileError || !profile?.chaturbate_stats_token) {
    return NextResponse.json({ error: 'No Stats API token configured' }, { status: 400 })
  }

  const { chaturbate_username, chaturbate_stats_token } = profile

  // Call Chaturbate Stats API
  const apiUrl = `https://chaturbate.com/statsapi/ts/token-stats/?username=${chaturbate_username}&token=${chaturbate_stats_token}&limit=1000`

  let statsData
  try {
    const res = await fetch(apiUrl, {
      headers: { 'User-Agent': 'CamCash/1.0' }
    })
    if (!res.ok) {
      return NextResponse.json({
        error: `Chaturbate API returned ${res.status}`
      }, { status: 502 })
    }
    statsData = await res.json()
  } catch (err) {
    return NextResponse.json({ error: 'Failed to reach Chaturbate API' }, { status: 502 })
  }

  // Parse tips from response
  // Chaturbate Stats API returns: { count, next, previous, results: [...] }
  // Each result has: date, username, tokens, note
  const results = statsData?.results || statsData?.tips || []

  if (results.length === 0) {
    return NextResponse.json({ message: 'No tips found', inserted: 0, skipped: 0 })
  }

  // Map to tips table schema
  const tips = results.map((r, i) => ({
    user_id: userId,
    date_time: new Date(r.date || r.created_at || r.timestamp).toISOString(),
    platform: 'Chaturbate',
    username: r.username || r.from_username || 'unknown',
    username_lower: (r.username || r.from_username || 'unknown').toLowerCase(),
    tokens: parseInt(r.tokens || r.amount || 0),
    usd: parseFloat(((parseInt(r.tokens || r.amount || 0)) * 0.05).toFixed(2)),
    tip_note: r.note || r.message || '',
    tip_ref: `cb_stats_${r.date || r.created_at}_${r.username}_${i}`,
    tip_type: 'tip'
  }))

  // Insert with deduplication via tip_ref
  let inserted = 0
  let skipped = 0

  for (const tip of tips) {
    const { error } = await supabase
      .from('tips')
      .insert(tip)
      .onConflict('tip_ref')
      .ignore()

    if (error) skipped++
    else inserted++
  }

  // Log sync job
  await supabase.from('sync_jobs').insert({
    user_id: userId,
    platform: 'Chaturbate',
    status: 'completed',
    mode: 'stats_api',
    records_inserted: inserted,
    records_skipped: skipped,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString()
  })

  return NextResponse.json({
    message: 'Sync complete',
    inserted,
    skipped,
    total: tips.length
  })
}
