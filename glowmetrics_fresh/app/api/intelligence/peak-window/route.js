export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../lib/liveSession/auth'
import { runPeakWindowPipeline } from '../../../../lib/intelligence/peakWindow'

// Smallest possible persistence endpoint for the peak_window dashboard
// event. The DECISION (evaluatePeakWindow) already ran client-side in
// app/dashboard/page.js, where the real browser timezone is available —
// this route re-runs the exact same pure evaluator server-side (imported,
// not reimplemented) against the values the client observed, then persists
// through the existing record_dashboard_event_if_new RPC if it qualifies.
//
// Trust boundary, by design (see design report — this is the direct
// consequence of the "client-side approach" decision, not an oversight):
// bestHour/confidenceLevel/nowHour/nowMinute are client-supplied. The
// alternative — the server independently recomputing bestHour to verify
// them — would require a server-side timezone, which is exactly what this
// event was deliberately built to avoid (profiles.timezone is never
// populated; see lib/serverAnalytics.js). Since record_dashboard_event_if_new
// is auth.uid()-scoped, the only account a caller can ever affect is their
// own — this mirrors every other purely client-observed signal already
// trusted elsewhere in the app (e.g. the extension's own tip timestamps).
//
// getLiveSessionCaller is reused as-is (Bearer-token-or-cookie auth
// resolution) rather than duplicated — it's generic despite its module
// path, not actually live-session-specific in its logic.
export async function POST(req) {
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try {
    body = await req.json()
  } catch (_) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { bestHour, confidenceLevel, nowHour, nowMinute, historicalSessionCount } = body || {}

  try {
    const { event, evaluation } = await runPeakWindowPipeline({
      supabase, bestHour, confidenceLevel, nowHour, nowMinute, historicalSessionCount,
    })
    return NextResponse.json({ event, reason: evaluation?.reason ?? null })
  } catch (err) {
    console.warn('[api/intelligence/peak-window] pipeline failed:', err.message)
    return NextResponse.json({ error: 'Failed to evaluate peak window' }, { status: 500 })
  }
}
