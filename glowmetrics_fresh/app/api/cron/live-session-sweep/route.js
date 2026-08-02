import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// The one thing that makes the Live Engine's inactivity timeout actually
// work with zero browser tabs or the extension open (acceptance Test 4).
// Everything else (send_website_heartbeat, send_extension_heartbeat) only
// ever runs sweep_stale_live_session() for the CALLING user, as a side
// effect of that user checking in — if nobody checks in, nothing sweeps.
// This route is the backend-scheduled authority: it runs
// sweep_all_stale_live_sessions() (SECURITY DEFINER, service_role only, see
// the collapse_live_engine_state_machine migration) on a fixed interval
// regardless of who is or isn't connected.
//
// Protected by CRON_SECRET so this can't be triggered by an arbitrary
// caller to force-expire sessions ahead of schedule — Vercel Cron sends
// this as a Bearer token automatically when the env var is set
// (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
export async function GET(req) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data, error } = await supabaseAdmin.rpc('sweep_all_stale_live_sessions')

    if (error) {
      console.error('[cron/live-session-sweep] sweep failed:', error.message)
      return NextResponse.json({ success: false, error: 'Sweep failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true, swept: data })
  } catch (err) {
    console.error('[cron/live-session-sweep] unexpected error:', err.message)
    return NextResponse.json({ success: false, error: 'Unexpected error' }, { status: 500 })
  }
}
