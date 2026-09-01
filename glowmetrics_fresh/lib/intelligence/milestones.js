// ============================================================================
// CAMCASH INTELLIGENCE — MILESTONES
//
// Milestones are DERIVED, never independently counted. A milestone is reached
// exactly when its insight reaches its state — so this cannot drift out of
// agreement with the ladder, and it does not become a fifth progress system.
//
// Persistence target: the EXISTING public.dashboard_events table, which
// already has event_type, source, priority, status, fingerprint, title,
// message, metadata, seen_at, dismissed_at and expires_at. No new
// notification table is needed. toDashboardEvent() below emits exactly that
// shape; the fingerprint makes re-emitting the same milestone idempotent.
//
// PHASE 1 STATUS: DEFINED, NOT WIRED. Nothing writes these rows yet.
// ============================================================================

import { INSIGHT_STATE, atLeast, CLAIMABLE_FLOOR, rank } from './states'
import { INSIGHT_BY_ID } from './insights'

/**
 * requires: the insight id and the state that unlocks this milestone.
 * unlocks:  what the creator can now see.
 * next:     the id of the milestone this naturally leads to.
 * proCta:   the Pro action this discovery makes relevant — only ever offered
 *           AFTER the free discovery it follows, per the conversion rule.
 */
export const MILESTONES = [
  {
    id: 'first_import',
    name: 'First import analysed',
    emoji: '✨',
    requires: { insight: 'earnings_total', state: INSIGHT_STATE.ESTABLISHED },
    description: 'CamCash has your earnings history.',
    unlocks: 'Earnings, sessions and fan totals',
    next: 'first_sessions',
  },
  {
    id: 'first_sessions',
    name: 'Sessions detected',
    emoji: '📅',
    requires: { insight: 'session_history', state: INSIGHT_STATE.ESTABLISHED },
    description: 'Your tips have been grouped into real streaming sessions.',
    unlocks: 'Session breakdown and $/hour',
    next: 'rate_known',
  },
  {
    id: 'rate_known',
    name: 'Earning rate established',
    emoji: '💰',
    requires: { insight: 'hourly_rate', state: INSIGHT_STATE.SUPPORTED },
    description: 'Enough tracked hours to state what an hour is worth to you.',
    unlocks: 'Reliable $/hour across your history',
    next: 'peak_day_found',
  },
  {
    id: 'peak_day_found',
    name: 'Strongest day identified',
    emoji: '📈',
    requires: { insight: 'peak_day', state: INSIGHT_STATE.SUPPORTED },
    description: 'One weekday is measurably ahead of the others.',
    unlocks: 'Your strongest observed day',
    next: 'peak_window_found',
  },
  {
    id: 'peak_window_found',
    name: 'Peak window identified',
    emoji: '🔥',
    requires: { insight: 'peak_window', state: INSIGHT_STATE.SUPPORTED },
    description: 'A specific day and hour that out-earns your other windows.',
    unlocks: 'Your peak earning window, with confidence',
    next: 'plan_ready',
    proCta: { label: 'Build my streaming plan', target: 'streamPlanner' },
  },
  {
    id: 'fan_patterns',
    name: 'Fan patterns readable',
    emoji: '👥',
    requires: { insight: 'fan_behaviour', state: INSIGHT_STATE.SUPPORTED },
    description: 'Enough repeat interactions to read how your fans behave.',
    unlocks: 'Returning fans, cadence, cooling states',
    next: 'whale_found',
  },
  {
    id: 'whale_found',
    name: 'High-value fan pattern detected',
    emoji: '👑',
    requires: { insight: 'whale_pattern', state: INSIGHT_STATE.DEVELOPING },
    description: 'A fan with both high lifetime value and repeat tipping.',
    unlocks: 'Top supporter profiles',
    next: 'churn_watch',
    proCta: { label: 'See who to re-engage', target: 'fans' },
  },
  {
    id: 'churn_watch',
    name: 'Churn patterns readable',
    emoji: '⚠️',
    requires: { insight: 'churn_risk', state: INSIGHT_STATE.DEVELOPING },
    description: 'Enough fan history to notice when someone goes quiet.',
    unlocks: 'At-risk supporter alerts',
    next: null,
  },
  {
    id: 'platform_pattern',
    name: 'Platform pattern identified',
    emoji: '🏆',
    requires: { insight: 'platform_profitability', state: INSIGHT_STATE.SUPPORTED },
    description: 'A platform has enough sessions to measure properly.',
    unlocks: 'Per-platform $/hour',
    next: 'cross_platform_ready',
  },
  {
    id: 'cross_platform_ready',
    name: 'Cross-platform comparison ready',
    emoji: '⚖️',
    requires: { insight: 'cross_platform', state: INSIGHT_STATE.SUPPORTED },
    description: 'Two platforms both have enough sessions to compare fairly.',
    unlocks: 'Side-by-side platform rates',
    next: null,
    proCta: { label: 'Build my cross-platform week', target: 'streamPlanner' },
  },
  {
    id: 'opportunity_found',
    name: 'Revenue opportunity detected',
    emoji: '💡',
    requires: { insight: 'revenue_opportunity', state: INSIGHT_STATE.DEVELOPING },
    description: 'Your best window out-earns your typical hour by a measurable margin.',
    unlocks: 'Where the gap is',
    next: null,
    proCta: { label: 'Show me what the gap is worth', target: 'moneyMap' },
  },
  {
    id: 'forecast_ready',
    name: 'Forecast calibrated',
    emoji: '🔮',
    requires: { insight: 'forecast', state: INSIGHT_STATE.DEVELOPING },
    description: 'Enough same-weekday history to project tonight as a range.',
    unlocks: "Tonight's range",
    next: null,
  },
  {
    id: 'plan_ready',
    name: 'Personalised plan ready',
    emoji: '🧠',
    requires: { insight: 'plan_readiness', state: INSIGHT_STATE.SUPPORTED },
    description: 'Enough reliable windows to build a week around.',
    unlocks: 'A schedule built from your own data',
    next: null,
    proCta: { label: 'Build my plan', target: 'streamPlanner' },
  },
]

export const MILESTONE_BY_ID = Object.fromEntries(MILESTONES.map(m => [m.id, m]))

/** Which milestones the current intelligence satisfies. */
export function evaluateMilestones(intelligence) {
  const insights = intelligence?.insights || {}
  return MILESTONES.map(m => {
    const e = insights[m.requires.insight]
    const reached = Boolean(e) && atLeast(e.state, m.requires.state)
    return {
      ...m,
      reached,
      state: e?.state || INSIGHT_STATE.NOT_AVAILABLE,
      progress: e?.nextMilestone || null,
      insightLabel: INSIGHT_BY_ID[m.requires.insight]?.label || m.requires.insight,
    }
  })
}

/** The next milestone to chase — the first unreached one with real progress. */
export function nextMilestone(intelligence) {
  const all = evaluateMilestones(intelligence)
  return all.find(m => !m.reached && rank(m.state) > rank(INSIGHT_STATE.NOT_AVAILABLE))
    || all.find(m => !m.reached)
    || null
}

// ── DASHBOARD EVENTS ────────────────────────────────────────────────────────

export const EVENT_TYPE = {
  MILESTONE: 'milestone',
  CONFIDENCE_UP: 'confidence_increased',
}

/**
 * Row shaped for public.dashboard_events. `fingerprint` is deterministic, so
 * inserting the same milestone twice is a no-op at the database level rather
 * than a duplicate notification.
 */
export function toDashboardEvent(userId, milestone) {
  return {
    user_id: userId,
    event_type: EVENT_TYPE.MILESTONE,
    source: 'intelligence',
    priority: milestone.proCta ? 'high' : 'normal',
    status: 'new',
    fingerprint: `milestone:${milestone.id}`,
    title: `${milestone.emoji} ${milestone.name}`,
    message: milestone.description,
    metadata: {
      milestone_id: milestone.id,
      insight_id: milestone.requires.insight,
      state: milestone.requires.state,
      unlocks: milestone.unlocks,
      pro_cta: milestone.proCta || null,
    },
    related_entity_type: 'insight',
    related_entity_id: milestone.requires.insight,
  }
}

/**
 * Events for a confidence increase that did not cross a milestone — the
 * "📈 Pattern confidence increased" moment. Fingerprinted per transition so
 * the same jump is never announced twice.
 */
export function toConfidenceEvent(userId, change) {
  return {
    user_id: userId,
    event_type: EVENT_TYPE.CONFIDENCE_UP,
    source: 'intelligence',
    priority: 'normal',
    status: 'new',
    fingerprint: `confidence:${change.id}:${change.from}->${change.to}`,
    title: `📈 ${change.label} confidence increased`,
    message: `${change.from.replace(/_/g, ' ').toLowerCase()} → ${change.to.replace(/_/g, ' ').toLowerCase()}`,
    metadata: { insight_id: change.id, from: change.from, to: change.to },
    related_entity_type: 'insight',
    related_entity_id: change.id,
  }
}

/**
 * Turn a snapshot diff into the events an import should produce.
 * Milestone events win over plain confidence events for the same insight, so
 * one import never announces the same progress twice.
 */
export function eventsForDiff(userId, diff, intelligence) {
  const milestones = evaluateMilestones(intelligence).filter(m => m.reached)
  const improvedIds = new Set((diff?.improved || []).map(c => c.id))
  const events = []
  const claimed = new Set()

  for (const m of milestones) {
    if (!improvedIds.has(m.requires.insight)) continue
    events.push(toDashboardEvent(userId, m))
    claimed.add(m.requires.insight)
  }
  for (const c of diff?.improved || []) {
    if (claimed.has(c.id)) continue
    events.push(toConfidenceEvent(userId, c))
  }
  return events
}
