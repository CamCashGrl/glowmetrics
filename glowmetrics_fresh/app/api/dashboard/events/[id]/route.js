import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Explicit state-transition endpoint. Only these two actions exist in
// Phase 1 — no raw field updates are exposed, matching the RPC-only write
// surface defined in the dashboard_events migration.
const ACTIONS = {
  seen: 'mark_dashboard_event_seen',
  dismiss: 'dismiss_dashboard_event',
}

export async function PATCH(req, { params }) {
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

  const { id } = params
  let body
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const action = body?.action
  const rpcName = ACTIONS[action]
  if (!rpcName) {
    return NextResponse.json(
      { error: `Invalid action. Expected one of: ${Object.keys(ACTIONS).join(', ')}` },
      { status: 400 }
    )
  }

  // The RPC itself re-verifies ownership (user_id = auth.uid()) before
  // writing anything — this route never trusts the id alone.
  const { data, error } = await supabase.rpc(rpcName, { p_event_id: id })

  if (error) {
    const notFound = error.message?.includes('not found')
    return NextResponse.json({ error: error.message }, { status: notFound ? 404 : 500 })
  }

  return NextResponse.json({ event: data })
}
