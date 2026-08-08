import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Phase 1 of the Living Dashboard Intelligence System. Reads only —
// listing an event here must never mark it seen (see
// mark_dashboard_event_seen in supabase/migrations/20260808_add_dashboard_events.sql
// for the only place status is allowed to change).
export async function GET(req) {
  const auth = req.headers.get('Authorization')
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = auth.replace('Bearer ', '')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: { user }, error: ue } = await supabase.auth.getUser(token)
  if (ue || !user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') // 'new' | 'seen' | 'dismissed' | omitted = all
  const priority = searchParams.get('priority') // 'critical' | 'high' | 'medium' | 'low'
  const limitParam = parseInt(searchParams.get('limit'), 10)
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 25

  let query = supabase
    .from('dashboard_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ events: data || [] })
}
