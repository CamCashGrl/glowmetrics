// ============================================================
// CAMCASH DASHBOARD INTELLIGENCE — WEEKLY REVENUE MOMENTUM (Phase 7)
// ============================================================
//
// Proves TWO events: weekly_momentum_up / weekly_momentum_down. Reuses
// generateInsights()'s existing weekly comparison rule (lib/analytics.js:
// 715-724, candidate "B" from the weekly/monthly audit) exactly as it
// already exists — never a new formula, never a new threshold:
//
//   - last 7 days vs. the prior 7 days (days 8-14 back), same window
//     boundaries (`d <= 7` / `d > 7 && d <= 14`).
//   - total USD comparison (toUsdNumber-guarded sum), same as B.
//   - fires only when |change%| >= 10 — B's own threshold, reused verbatim.
//   - requires at least 1 tip in EACH window — B's own minimum-data gate,
//     reused verbatim. No new confidence system layered on top.
//
// This does NOT call generateInsights() itself (that would require
// re-deriving bestDay/worstDay/whales just to reach one unrelated insight
// buried in its output) — it replicates B's exact filter/threshold logic
// directly against `tips`, using the same toUsdNumber() guard B's parent
// function uses everywhere else. The semantics are identical; only the
// output shape differs (structured metadata here vs. a rendered sentence
// in the insights array).
//
// One addition beyond B, not a new threshold: B's own formula divides by
// `lastRev` without checking it's positive — if every tip in the prior
// week summed to $0 (unlikely but possible: token-only rows, refund
// corrections), B's percentage would be `Infinity` or `NaN`. Guarding
// `lastRev > 0` before dividing isn't a new business rule, it's the same
// "never fabricate a percentage" discipline every other evaluator in this
// codebase already applies (see stream_outperformed_baseline's
// `velocity.pctVsAvg === null` check).
//
// Two event names (not one) because "up" and "down" are meaningfully
// different notifications a creator would want to act on differently —
// same reasoning stream_outperformed_baseline / stream_below_baseline
// already established. Both share the SAME priority: B's own `priority: 2`
// field treats up and down identically (no tiered bands the way
// computeRevenueVelocity's excellent/good/slow/poor gave Pace its
// asymmetric priority split) — so inventing an asymmetric priority here
// would be adding behavior B never had.

import { toUsdNumber } from '../analytics/sessions'

const WINDOW_DAYS = 7
const CHANGE_THRESHOLD_PCT = 10 // reused verbatim from generateInsights()

// Pure decision function — no I/O. Takes the account's raw `tips` array
// (same shape aggregateRows() consumes) and returns either a fully-formed
// event payload or null. Never fabricates a comparison: returns null at
// every stage where the data isn't reliable enough to say anything.
export function evaluateWeeklyMomentum({ tips, now = Date.now() }) {
  if (!tips || !tips.length) return null

  const thisWeek = tips.filter(t => {
    const days = (now - new Date(t.dateRaw || t.date_time).getTime()) / 86400000
    return days >= 0 && days <= WINDOW_DAYS
  })
  const lastWeek = tips.filter(t => {
    const days = (now - new Date(t.dateRaw || t.date_time).getTime()) / 86400000
    return days > WINDOW_DAYS && days <= WINDOW_DAYS * 2
  })
  if (!(thisWeek.length > 0 && lastWeek.length > 0)) return null

  const thisRev = thisWeek.reduce((s, t) => s + toUsdNumber(t.usd), 0)
  const lastRev = lastWeek.reduce((s, t) => s + toUsdNumber(t.usd), 0)
  if (!(lastRev > 0)) return null // guards B's unguarded division — see file header

  const change = Math.round(((thisRev - lastRev) / lastRev) * 100)
  if (!Number.isFinite(change)) return null
  if (Math.abs(change) < CHANGE_THRESHOLD_PCT) return null

  const isUp = change >= 0
  const eventType = isUp ? 'weekly_momentum_up' : 'weekly_momentum_down'

  return {
    eventType,
    priority: 'medium', // same for both directions — see file header
    title: isUp ? '📈 Weekly Revenue Up' : '📉 Weekly Revenue Down',
    message: isUp
      ? `You're up ${change}% this week vs last week ($${thisRev.toFixed(0)} vs $${lastRev.toFixed(0)}) — keep the momentum going.`
      : `You're down ${Math.abs(change)}% this week vs last ($${thisRev.toFixed(0)} vs $${lastRev.toFixed(0)}) — increase stream frequency to recover.`,
    fingerprint: `weekly_momentum:${isUp ? 'up' : 'down'}`,
    metadata: {
      change_pct: change,
      this_week_usd: parseFloat(thisRev.toFixed(2)),
      last_week_usd: parseFloat(lastRev.toFixed(2)),
      this_week_tip_count: thisWeek.length,
      last_week_tip_count: lastWeek.length,
      direction: isUp ? 'up' : 'down',
    },
  }
}

// Orchestration — records the event via the existing dashboard_events RPC
// (unmodified shape), using a 7-day cooldown matching the comparison
// window itself (not an invented number — the event can't meaningfully
// re-evaluate to something new until the 7-day window has actually
// rolled over). Never fails or blocks the caller — matches the established
// non-fatal pattern from every other intelligence pipeline.
const COOLDOWN_SECONDS = 7 * 24 * 60 * 60

export async function runWeeklyMomentumPipeline({ userId, supabase, tips }) {
  if (!userId || !supabase) throw new Error('runWeeklyMomentumPipeline requires userId and a Supabase client')

  const evaluation = evaluateWeeklyMomentum({ tips })
  if (!evaluation) return { event: null, evaluation: null }

  let event = null
  try {
    const { data, error } = await supabase.rpc('record_dashboard_event_if_new', {
      p_event_type: evaluation.eventType,
      p_source: 'analytics',
      p_priority: evaluation.priority,
      p_title: evaluation.title,
      p_message: evaluation.message,
      p_fingerprint: evaluation.fingerprint,
      p_metadata: evaluation.metadata,
      p_cooldown_seconds: COOLDOWN_SECONDS,
    })
    if (error) throw error
    event = data
  } catch (eventErr) {
    console.warn(`[intelligence] Failed to record ${evaluation.eventType} event:`, eventErr.message)
  }

  return { event, evaluation }
}
