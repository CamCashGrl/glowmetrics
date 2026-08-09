import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// SECONDARY sweep path. The PRIMARY defense against a stale session sitting
// "live" forever with zero tabs open (acceptance Test 4) is the pg_cron job
// 'sweep-stale-live-sessions' (see supabase/migrations/
// 20260802e_schedule_live_session_sweep_via_pg_cron.sql), which runs
// sweep_all_stale_live_sessions() directly on the database every 5 minutes
// and needs no Vercel plan at all.
//
// This route exists as a redundant caller of the exact same idempotent
// function, in case pg_cron is ever paused/removed — but it is NOT relied
// on for the 5-minute cadence: Vercel Cron only supports sub-daily
// schedules on a paid plan, and this project has none, so vercel.json
// intentionally schedules this route once a day, not every 5 minutes.
// Everything else (send_website_heartbeat, send_extension_heartbeat) only
// ever runs sweep_stale_live_session() for the CALLING user, as a side
// effect of that user checking in — if nobody checks in, nothing sweeps
// through that path, which is exactly why the pg_cron job matters.
//
// Protected by CRON_SECRET so this can't be triggered by an arbitrary
// caller to force-expire sessions ahead of schedule — Vercel Cron sends
// this as a Bearer token automatically when the env var is set
// (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
//
// KNOWN GAP (documented, not fixed — see live-session-finalization audit,
// supabase/migrations/20260809_centralize_live_session_finalization.sql):
// sweep_all_stale_live_sessions() now finalizes session_earnings_usd/
// tip_count/etc. correctly for every session it auto-ends, same as every
// other termination path. But unlike stop_live_session() (via
// app/api/live/session/stop) and resolve_live_session() (via
// app/api/live/session/resolve), nothing here calls
// runStreamCompletionPipeline() (lib/intelligence/streamCompletion.js)
// afterward. A session that's finalized purely by this cron sweep — the
// user closed the tab/extension and never checked back in — can have
// fully correct, qualifying metrics and still never produce a
// stream_outperformed_baseline event, purely because this path has no
// per-session Node-side hook (sweep_all_stale_live_sessions() processes
// every stale session for every user in one SQL call; the intelligence
// pipeline needs a Supabase client + userId per session, which this route
// never has since it only gets back a swept count, not the session rows).
// Not fixed here — deliberately scoped out. Fixing it means either having
// the RPC return the finalized session rows so this route can loop over
// them, or a separate polling mechanism; either is real, additional
// design work belonging to its own change.
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
