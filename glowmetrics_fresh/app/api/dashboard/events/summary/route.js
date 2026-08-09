import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 }

// Data only, per Phase 1 scope — no badge/UI here. Gives a future dashboard
// everything it needs to render an unread count and decide what to
// interrupt rotation with, without recomputing anything client-side.
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

  // Same expiration rule as GET /api/dashboard/events — a row past its own
  // expires_at (currently only ever set by peak_window) never counts as a
  // current "new" event, regardless of status.
  const { data: newEvents, error } = await supabase
    .from('dashboard_events')
    .select('*')
    .eq('status', 'new')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const events = newEvents || []
  const highestPriority = events.length
    ? events.reduce((top, e) =>
        PRIORITY_RANK[e.priority] < PRIORITY_RANK[top.priority] ? e : top
      )
    : null

  return NextResponse.json({
    newCount: events.length,
    highestPriorityNew: highestPriority,
    mostRecentNew: events[0] || null,
  })
}
