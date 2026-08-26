// Server-Side Insight Service — Layer B (orchestration) + Layer C
// (entitlement/redaction) of the approved architecture:
//
//   RAW DATA -> CANONICAL ANALYTICS -> SERVER-SIDE INSIGHT SERVICE ->
//   ENTITLEMENT/REDACTION -> UI
//
// This route does NOT recompute any analytics itself — it loads this user's
// tips, runs the same canonical Layer-A functions (lib/analytics.js,
// lib/analytics/bestTimes.js, lib/analytics/missedRevenue.js) already used
// client-side, and applies the shared redact() helper (lib/entitlement.js)
// before anything leaves the response. get_user_insights (the existing
// SQL RPC) is not superseded by this route in Phase 1 — both currently
// compute best-time/missed-revenue independently; consolidating the SQL
// path onto this same canonical JS source is out of Phase 1 scope (SQL
// can't import Node modules) and is tracked as follow-up work.
import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '../../../lib/supabase-server'
import { isProPlan } from '../../../lib/plan'
import { resolveCreatorTimezone } from '../../../lib/timezone'
import { aggregateRows } from '../../../lib/analytics'
import { computeMissedRevenue } from '../../../lib/analytics/missedRevenue'
import { redact } from '../../../lib/entitlement'
import { loadUserTips } from '../../../lib/serverTips'

export async function GET() {
  const supabase = createSupabaseRouteClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at, timezone')
    .eq('id', user.id)
    .maybeSingle()
  const isPro = isProPlan(profile)
  const { timezone } = resolveCreatorTimezone(profile?.timezone)

  // Ownership is enforced structurally here — .eq('user_id', user.id) is
  // always the server-derived auth user, never a client-supplied id, so
  // this route has no IDOR surface analogous to the one fixed in
  // get_user_insights (see supabase/migrations/20260814_restrict_get_user_insights_to_self.sql).
  // Paging/ordering moved verbatim to lib/serverTips.js so the intelligence
  // route reuses the same loader rather than carrying a second copy.
  const tips = await loadUserTips(supabase, user.id)

  if (!tips.length) {
    return NextResponse.json({
      timezone,
      best_time: redact({ isPro, category: 'timing', summary: 'Not enough data yet.', count: 0, data: null }),
      missed_revenue: redact({ isPro, category: 'missed_revenue', summary: 'Not enough data yet.', count: 0, data: null }),
    })
  }

  const analytics = aggregateRows(tips, timezone)
  const meaningfulSessions = analytics.meaningfulSessions || []
  const missed = computeMissedRevenue(meaningfulSessions, timezone)

  const bestWindow = analytics.canonicalBestTimes?.bestWindow || null
  const missedCount = [missed.today_missed, missed.recent_streak_missed].filter(Boolean).length
    + Object.keys(missed.cumulative_by_platform || {}).length

  return NextResponse.json({
    timezone,
    best_time: redact({
      isPro,
      category: 'timing',
      summary: bestWindow ? 'You have a predictable earning pattern.' : 'Keep streaming to build a reliable pattern.',
      count: bestWindow ? 1 : 0,
      data: { grid: analytics.canonicalBestTimes.grid, bestWindow, earlySignal: analytics.canonicalBestTimes.earlySignal },
    }),
    missed_revenue: redact({
      isPro,
      category: 'missed_revenue',
      summary: missedCount > 0 ? 'You have sessions that underperformed your peak window.' : 'No missed windows detected recently.',
      count: missedCount,
      data: missed,
    }),
  })
}
