// CANONICAL READINESS ENDPOINT
//
// The single place any surface asks "how much does CamCash know about this
// creator, and what changed since they last looked?". Creator Report, the
// dashboard preview, sticky insights, milestone cards and (later) the Stream
// Planner all read this one answer, so no component computes readiness of its
// own — the four competing progress systems collapse here.
//
// IT COMPUTES NO ANALYTICS. It loads tips through the shared loader, runs the
// existing canonical engine (aggregateRows), and passes the result to
// computeIntelligence(), which itself only reads fields the engine already
// produced. No threshold lives in this file.
//
// GET  — read readiness. Does not write; safe to call on every render.
// POST — read readiness AND record the snapshot as the new baseline, so the
//        next GET reports "what changed" against this moment. Called when the
//        creator has actually been SHOWN the report, never on background loads.

import { NextResponse } from 'next/server'
import { resolvePlatformEntitlement, filterEntitledRows } from '../../../lib/platformEntitlement'
import { buildReportDiscoveries } from '../../../lib/reportDiscoveries'
import { createSupabaseRouteClient } from '../../../lib/supabase-server'
import { isProPlan } from '../../../lib/plan'
import { resolveCreatorTimezone } from '../../../lib/timezone'
import { aggregateRows } from '../../../lib/analytics'
import { loadUserTips } from '../../../lib/serverTips'
import { computeIntelligence, snapshot, diffSnapshots } from '../../../lib/intelligence/readiness'
import { evaluateMilestones, nextMilestone, eventsForDiff } from '../../../lib/intelligence/milestones'
import { GATE } from '../../../lib/intelligence/insights'

async function build(supabase, user) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at, timezone, last_seen_intelligence, primary_pro_platform')
    .eq('id', user.id)
    .maybeSingle()

  const isPro = isProPlan(profile)
  const { timezone } = resolveCreatorTimezone(profile?.timezone)

  // Ownership is structural — loadUserTips() is passed the server-derived
  // auth id, never anything from the request.
  const tips = await loadUserTips(supabase, user.id)
  // Same entitlement boundary the dashboard applies, so this route and the
  // client can never disagree about what is in scope. Access only — the stored
  // rows are untouched, and a free plan is filtered by nothing.
  const entitlement = resolvePlatformEntitlement({ profile, rows: tips })
  const entitledTips = filterEntitledRows(entitlement, tips)
  const analytics = aggregateRows(entitledTips, timezone)
  const intelligence = computeIntelligence({ analytics, profile })

  const current = snapshot(intelligence)
  const baseline = profile?.last_seen_intelligence || null
  // No baseline yet means this is the creator's first read since the feature
  // shipped: record it silently rather than announcing every insight they
  // already had as newly unlocked.
  const diff = baseline ? diffSnapshots(baseline, current) : null

  const milestones = evaluateMilestones(intelligence)

  return {
    isPro,
    profile,
    intelligence,
    current,
    payload: {
      timezone,
      calibration: intelligence.calibration,
      insights: intelligence.insights,
      gates: intelligence.gates,
      /** Which insights are Pro-gated, so the UI never has to decide. */
      proInsightIds: Object.entries(intelligence.gates)
        .filter(([, gate]) => gate === GATE.PRO).map(([id]) => id),
      milestones: milestones.map(m => ({
        id: m.id, name: m.name, emoji: m.emoji, description: m.description,
        unlocks: m.unlocks, reached: m.reached, state: m.state,
        progress: m.progress, proCta: m.proCta || null,
      })),
      nextMilestone: nextMilestone(intelligence),
      /** The ordered canonical discoveries, so onboarding and any other
       *  surface can render the creator's strongest finding without a second
       *  analytics path. Same mapper the Creator Report and Command Center use. */
      discoveries: buildReportDiscoveries({ analytics, intelligence }),
      /** Counts only — used by onboarding's first-aha fan line. */
      fanOverlap: analytics.bestWindowFanOverlap
        ? {
            count: analytics.bestWindowFanOverlap.count,
            topSupporterCount: analytics.bestWindowFanOverlap.topSupporterCount || 0,
          }
        : null,
      /** null on a first read — see the baseline note above. */
      changed: diff,
      isFirstRead: !baseline,
      computedAt: intelligence.computedAt,
    },
  }
}

export async function GET() {
  const supabase = createSupabaseRouteClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { payload } = await build(supabase, user)

  // The sticky insight: the highest-priority undismissed discovery this
  // creator has not yet acted on. Read from the EXISTING dashboard_events
  // table — no new notification store. One at a time, never a feed.
  const { data: sticky } = await supabase
    .from('dashboard_events')
    .select('id, event_type, priority, title, message, metadata, created_at')
    .eq('user_id', user.id)
    .eq('source', 'intelligence')
    .is('dismissed_at', null)
    .in('status', ['new', 'seen'])
    // Priority is ordered semantically in pickSticky() below — an alphabetical
    // SQL sort would put 'high' after 'critical' but 'low' before 'medium'.
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    ...payload,
    stickyInsight: pickSticky(sticky || []),
  })
}

// Priority order is semantic, not alphabetical, so it is applied here rather
// than in the query. Matches the dashboard_events CHECK constraint's values.
const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 }

function pickSticky(rows) {
  if (!rows.length) return null
  const sorted = [...rows].sort((a, b) =>
    (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) ||
    new Date(b.created_at) - new Date(a.created_at)
  )
  return sorted[0]
}

export async function POST() {
  const supabase = createSupabaseRouteClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { payload, current, intelligence } = await build(supabase, user)

  // Milestone rows go to the EXISTING dashboard_events table. fingerprint is
  // deterministic per milestone, so re-acknowledging the same report never
  // produces a duplicate notification.
  if (payload.changed?.improved?.length) {
    const events = eventsForDiff(user.id, payload.changed, intelligence)
    if (events.length) {
      await supabase
        .from('dashboard_events')
        .upsert(events, { onConflict: 'user_id,fingerprint', ignoreDuplicates: true })
    }
  }

  // Writes only the caller's own row — RLS on profiles enforces this too.
  await supabase
    .from('profiles')
    .update({ last_seen_intelligence: current })
    .eq('id', user.id)

  return NextResponse.json({ ...payload, acknowledged: true })
}
