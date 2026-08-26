// ============================================================================
// CAMCASH INTELLIGENCE — LEGACY READINESS/LOCK ADAPTER  (Phase 2C-1)
//
// PURPOSE
// The dashboard historically carried its own progress and gating maths:
//   getDashboardReadiness()  5-state ladder from raw counters
//   getUnlockProgress()      two invented target tiers (25/3/5/$10, 100/8/20/$50)
//   getModuleLockState()     12 per-module counter rules
//   getFeatureLockState()    11 per-feature counter rules
//   canShow*()               6 inline counter comparisons
//
// Every one of those was a SECOND opinion about how much CamCash knows, and
// they disagreed with each other and with the intelligence ladder.
//
// This module is the single translation layer between the canonical insight
// states (lib/intelligence/readiness.js) and the legacy call signatures those
// surfaces still use. It INVENTS NO THRESHOLDS: every gate below is a floor on
// the canonical ladder for a named canonical insight. The only numbers that
// remain here are PLAN limits (FREE_MAX_PLATFORMS), which are commercial, not
// analytical, and one "have you ever done this once" fact (Live Mode), which
// is not an analytics threshold at all.
//
// The messages are generated from the canonical insight's own nextMilestone,
// so the UI can never quote a requirement that no longer governs the gate.
// ============================================================================

import { INSIGHT_STATE, atLeast, rank, CLAIMABLE_FLOOR } from './states'
import { computeIntelligence } from './readiness'

const S = INSIGHT_STATE

/**
 * Every legacy gate key -> the canonical insight it actually depends on, and
 * the floor on the ladder at which it opens. Feature keys and module keys that
 * describe the same thing deliberately point at the same row.
 */
export const GATE_MAP = {
  // timing
  bestStreamingTimes:     { insight: 'peak_window',     floor: CLAIMABLE_FLOOR, label: 'Peak Earning Windows' },
  streamPlanner:          { insight: 'peak_window',     floor: CLAIMABLE_FLOOR, label: 'Stream Planner' },
  crossPlatformBestTimes: { insight: 'cross_platform',  floor: CLAIMABLE_FLOOR, label: 'Cross-Platform Best Times' },

  // rate + sessions
  avgHourlyRate:          { insight: 'hourly_rate',     floor: S.EARLY_SIGNAL,  label: 'Average $/Hour' },
  averageHourly:          { insight: 'hourly_rate',     floor: S.EARLY_SIGNAL,  label: 'Average $/Hour' },
  sessionBreakdown:       { insight: 'session_history', floor: CLAIMABLE_FLOOR, label: 'Session Breakdown' },
  sessionPerformance:     { insight: 'session_history', floor: CLAIMABLE_FLOOR, label: 'Session Performance' },

  // fans
  topFans:                { insight: 'top_supporters',  floor: S.EARLY_SIGNAL,  label: 'Top Fans' },
  whales:                 { insight: 'top_supporters',  floor: CLAIMABLE_FLOOR, label: 'Fan value ranking' },
  fanRecovery:            { insight: 'churn_risk',      floor: CLAIMABLE_FLOOR, label: 'Fan Recovery' },
  retention:              { insight: 'churn_risk',      floor: CLAIMABLE_FLOOR, label: 'Retention' },

  // platforms
  platformROI:            { insight: 'cross_platform',  floor: CLAIMABLE_FLOOR, label: 'Platform ROI' },
  platformComparison:     { insight: 'cross_platform',  floor: CLAIMABLE_FLOOR, label: 'Platform Comparison' },

  // composites
  moneyMap:               { insight: 'money_map',       floor: CLAIMABLE_FLOOR, label: 'Money Map' },
  forecasting:            { insight: 'forecast',        floor: S.DEVELOPING,    label: 'Forecasting' },
}

/**
 * The derived insights whose ladder positions describe how far along an
 * account is. The three FACT insights (earnings_total, session_history,
 * fan_roster) are deliberately excluded: they reach the top of the ladder on
 * the first import, so they cannot grade anything.
 */
export const READINESS_INSIGHTS = ['peak_window', 'hourly_rate', 'top_supporters']

/** Insight state, safely, from a computeIntelligence() result. */
export function stateOf(intelligence, id) {
  return intelligence?.insights?.[id]?.state || S.NOT_AVAILABLE
}

/**
 * Resolve an intelligence object for a caller that only has counters.
 *
 * There is exactly ONE evaluator: computeIntelligence(). When a surface has
 * real analytics it passes them (or the already-computed intelligence) and
 * every insight is graded properly. When it only has counters, those counters
 * are mapped onto the analytics field names computeIntelligence() reads, so
 * the count-driven insights are still graded by the canonical rules and the
 * evidence-driven ones (peak window, platform mix) simply have no evidence —
 * they report NOT_AVAILABLE rather than being graded by a second system.
 */
export function resolveIntelligence({
  intelligence = null, analytics = null,
  totalTips = 0, totalSessions = 0, totalFans = 0, totalStreamMinutes = 0,
} = {}) {
  if (intelligence) return intelligence
  if (analytics) return computeIntelligence({ analytics })
  return computeIntelligence({
    analytics: {
      totalTips,
      meaningfulSessionCount: totalSessions,
      meaningfulSessions: [],
      uniqueFanCount: totalFans,
      whales: [],
      totalStreamMinutes,
    },
  })
}

/** The sentence a locked surface shows, built from canonical evidence only. */
export function lockMessage(intelligence, key) {
  const gate = GATE_MAP[key]
  if (!gate) return null
  const insight = intelligence?.insights?.[gate.insight]
  const step = insight?.nextMilestone?.label
  if (step) return `${gate.label} unlocks after ${step}.`
  return `${gate.label} unlocks once CamCash has enough evidence to state it.`
}

/**
 * Is a canonically-gated surface open?
 * @returns {boolean}
 */
export function gateOpen(intelligence, key) {
  const gate = GATE_MAP[key]
  if (!gate) return true
  return atLeast(stateOf(intelligence, gate.insight), gate.floor)
}

/**
 * The 5-state legacy readiness word, derived from ladder positions only.
 * No counter thresholds: an account moves up as its derived insights move up.
 */
export function resolveReadiness(intelligence) {
  const hasData = rank(stateOf(intelligence, 'earnings_total')) > rank(S.NOT_AVAILABLE)
  if (!hasData) return 'setup'
  const states = READINESS_INSIGHTS.map(id => stateOf(intelligence, id))
  const anySignal   = states.some(s => atLeast(s, S.EARLY_SIGNAL))
  const claimable   = states.filter(s => atLeast(s, CLAIMABLE_FLOOR)).length
  if (!anySignal) return 'building'
  if (claimable === 0) return 'starter'
  if (claimable < states.length) return 'warming'
  return 'ready'
}
