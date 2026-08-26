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
    .select('plan, plan_expires_at, timezone, last_seen_intelligence')
    .eq('id', user.id)
    .maybeSingle()

  const isPro = isProPlan(profile)
  const { timezone } = resolveCreatorTimezone(profile?.timezone)

  // Ownership is structural — loadUserTips() is passed the server-derived
  // auth id, never anything from the request.
  const tips = await loadUserTips(supabase, user.id)
  const analytics = aggregateRows(tips, timezone)
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
  return NextResponse.json(payload)
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
