// ============================================================================
// CAMCASH INTELLIGENCE — INSIGHT CATALOGUE
//
// Every insight CamCash can establish, with ITS OWN evidence requirement.
// Deliberately NOT one universal session count: "total earnings" needs one
// tip, "peak streaming window" needs several qualifying sessions AND enough
// variety to have compared anything, "fan tipping pattern" needs repeated
// interactions with one person. Those are different questions about different
// evidence and are scored separately.
//
// EVERY THRESHOLD HERE ALREADY EXISTS ELSEWHERE IN THE CODEBASE. Each entry
// names its source. The only genuinely new rule in this file is the
// COMPARISON requirement (see capForComparison in states.js), which was added
// because a creator who has only ever streamed Friday 9 PM cannot be told
// that Friday 9 PM is her BEST window — nothing was weighed against it.
//
// PHASE 1 STATUS: DEFINED, NOT WIRED. No surface reads this yet.
// ============================================================================

import { EVIDENCE_KIND, INSIGHT_STATE } from './states'

/** Who the insight is for once established. */
export const GATE = { FREE: 'free', PRO: 'pro' }

/**
 * The catalogue. `weight` is the insight's share of the calibration figure —
 * higher for the insights the product is actually about (timing, rate, fans),
 * lower for the ones that arrive almost immediately.
 *
 * `id` values are stable and are what dashboard_events rows will reference,
 * so they must not be renamed casually once milestones exist in the database.
 */
export const INSIGHTS = [
  // ── EARNINGS & ACTIVITY (facts — available almost immediately) ───────────
  {
    id: 'earnings_total',
    label: 'Earnings total',
    kind: EVIDENCE_KIND.FACT,
    gate: GATE.FREE,
    weight: 1,
    unit: 'tips',
    source: 'aggregateRows().totalUSD',
    thresholdNote: 'A fact. One tip is enough to state it truthfully.',
  },
  {
    id: 'session_history',
    label: 'Session history',
    kind: EVIDENCE_KIND.FACT,
    gate: GATE.FREE,
    weight: 1,
    unit: 'meaningful sessions',
    source: 'detectSessions() + classifySession()',
    thresholdNote: 'Meaningful = 15+ min or $10+ (lib/analytics/sessions.js).',
  },
  {
    id: 'fan_roster',
    label: 'Fan roster',
    kind: EVIDENCE_KIND.FACT,
    gate: GATE.FREE,
    weight: 1,
    unit: 'unique fans',
    source: 'aggregateRows().uniqueFanCount',
    thresholdNote: 'A fact — a count of people who paid you.',
  },

  // ── TIMING (patterns — the product's core claim) ─────────────────────────
  {
    id: 'peak_window',
    label: 'Peak earning window',
    kind: EVIDENCE_KIND.PATTERN,
    gate: GATE.FREE,
    weight: 4,
    comparative: true,
    unit: 'sessions in the winning window',
    source: 'computeCanonicalBestTimes() CONFIDENCE_TIER',
    thresholdNote: '2-3 promising, 4-5 supported, 6+ high (bestTimes.js). Plus: at least one other bucket with 2+ sessions to compare against.',
  },
  {
    id: 'peak_day',
    label: 'Strongest day',
    kind: EVIDENCE_KIND.PATTERN,
    gate: GATE.FREE,
    weight: 2,
    comparative: true,
    unit: 'active dates on that weekday',
    source: 'computeBestTimes() — 3 distinct active dates per weekday',
    thresholdNote: 'Existing 3-active-date floor; comparison needs 2+ weekdays qualifying.',
  },
  {
    id: 'hourly_rate',
    label: 'Earnings efficiency ($/hour)',
    kind: EVIDENCE_KIND.PATTERN,
    gate: GATE.FREE,
    weight: 3,
    unit: 'sessions',
    source: 'calculateConfidence(sessions, streamedHours)',
    thresholdNote: 'Very Low <3 sessions or <3 h; High at 10+ sessions AND 20+ h (lib/analytics.js).',
  },
  {
    id: 'session_length',
    label: 'Session-length pattern',
    kind: EVIDENCE_KIND.PATTERN,
    gate: GATE.FREE,
    weight: 2,
    unit: 'long/short sessions compared',
    source: 'generateInsights() — 3 long AND 3 short',
    thresholdNote: 'Existing 3-and-3 rule; comparison is inherent to it.',
  },

  // ── PLATFORM ─────────────────────────────────────────────────────────────
  {
    id: 'platform_profitability',
    label: 'Platform profitability',
    kind: EVIDENCE_KIND.PATTERN,
    gate: GATE.FREE,
    weight: 2,
    comparative: true,
    unit: 'platforms with 3+ meaningful sessions',
    source: 'computeMissedRevenue() per-platform 3-session gate',
    thresholdNote: 'Existing 3-session-per-platform floor, applied here to ranking too — today bestPlatformByRate has no floor at all.',
  },
  {
    id: 'cross_platform',
    label: 'Cross-platform comparison',
    kind: EVIDENCE_KIND.PATTERN,
    gate: GATE.FREE,
    weight: 2,
    comparative: true,
    unit: 'qualifying platforms',
    source: 'rankablePlatformCount + the same 3-session floor',
    thresholdNote: 'Needs 2 platforms each with 3+ meaningful sessions. Pro turns the comparison into an allocation plan.',
  },

  // ── OPPORTUNITY ──────────────────────────────────────────────────────────
  {
    id: 'revenue_opportunity',
    label: 'Revenue opportunity',
    kind: EVIDENCE_KIND.PATTERN,
    gate: GATE.FREE,
    weight: 2,
    unit: 'platforms with a measured rate gap',
    source: 'computeMissedRevenue().cumulative_by_platform',
    thresholdNote: '3+ platform sessions, window beats median by >1.2x, gap >= $1/hr. Reports a RATE GAP and a potential opportunity — never a dollar amount "lost".',
  },
  {
    id: 'missed_peak',
    label: 'Missed peak window',
    kind: EVIDENCE_KIND.PATTERN,
    gate: GATE.PRO,
    weight: 1,
    unit: 'qualifying peak window',
    source: 'computeMissedRevenue().today_missed / recent_streak_missed',
    thresholdNote: 'Requires peak_window at SUPPORTED or above — you cannot miss a window that was never established.',
  },

  // ── FANS ─────────────────────────────────────────────────────────────────
  {
    id: 'top_supporters',
    label: 'Top supporters',
    kind: EVIDENCE_KIND.FACT,
    gate: GATE.FREE,
    weight: 2,
    unit: 'unique paying fans',
    source: 'identifyWhales() percentile + RELATIVE_RANK_MIN_FANS',
    thresholdNote: '10 unique fans before a relative rank means anything (canShowWhales already uses 10).',
  },
  {
    id: 'fan_behaviour',
    label: 'Fan tipping patterns',
    kind: EVIDENCE_KIND.PATTERN,
    gate: GATE.FREE,
    weight: 2,
    unit: 'fans with 3+ tips',
    source: 'calcChurnRisk() 3-tip floor, per fan',
    thresholdNote: 'Counts fans whose own history supports a read, not total tips.',
  },
  {
    id: 'churn_risk',
    label: 'Churn risk',
    kind: EVIDENCE_KIND.PREDICTION,
    gate: GATE.FREE,
    weight: 2,
    unit: 'fans with a readable cadence',
    source: 'calcChurnRisk()',
    thresholdNote: 'Relative to each fan\'s own cadence; always paired with the absolute observation ("last seen 24 d ago, usually every ~9 d").',
  },
  {
    id: 'whale_pattern',
    label: 'Whale pattern',
    kind: EVIDENCE_KIND.PATTERN,
    gate: GATE.FREE,
    weight: 2,
    unit: 'confirmed whales',
    source: 'lib/intelligence/fanValue.js classifyFan()',
    thresholdNote: 'Value AND repeat behaviour. Value alone is a Whale Candidate. NOT WIRED — pending the before/after sign-off.',
  },
  {
    id: 'dependency_risk',
    label: 'Revenue concentration',
    kind: EVIDENCE_KIND.PATTERN,
    gate: GATE.FREE,
    weight: 1,
    unit: 'unique fans',
    source: 'aggregateRows().dependencyRisk (DEPENDENCY_MIN_FANS = 5)',
    thresholdNote: 'Existing 5-fan floor — below it the percentages are arithmetically trivial.',
  },

  // ── TREND & FORECAST ─────────────────────────────────────────────────────
  {
    id: 'growth_trend',
    label: 'Growth trend',
    kind: EVIDENCE_KIND.PATTERN,
    gate: GATE.FREE,
    weight: 1,
    unit: 'months with data',
    source: 'aggregateRows().monthlyData',
    thresholdNote: '2 months to compare at all; 6 for a trend rather than a step.',
  },
  {
    id: 'forecast',
    label: 'Earnings forecast',
    kind: EVIDENCE_KIND.PREDICTION,
    gate: GATE.PRO,
    weight: 2,
    unit: 'sessions on the same weekday',
    source: 'predictRevenue().tonightStream — 3 same-weekday sessions, 5+ for high',
    thresholdNote: 'Existing floor. The 7/30-day figures have no floor today and are excluded from this scoring until they get one.',
  },

  // ── COMPOSITES ───────────────────────────────────────────────────────────
  {
    id: 'plan_readiness',
    label: 'Personalised plan readiness',
    kind: EVIDENCE_KIND.PATTERN,
    gate: GATE.PRO,
    weight: 3,
    composite: true,
    unit: 'recommendable windows',
    source: 'isRecommendableWindow() — supported/high tiers only',
    thresholdNote: 'Needs peak_window >= SUPPORTED, 2+ recommendable windows, and hourly_rate >= DEVELOPING.',
  },
  {
    id: 'money_map',
    label: 'Money Map depth',
    kind: EVIDENCE_KIND.FACT,
    gate: GATE.FREE,
    weight: 1,
    composite: true,
    unit: 'tips and sessions',
    source: 'getModuleLockState().moneyMap — 50 tips + 5 sessions',
    thresholdNote: 'Existing module gate, restated here so one system owns it.',
  },
]

export const INSIGHT_BY_ID = Object.fromEntries(INSIGHTS.map(i => [i.id, i]))

/** Total weight, for the calibration denominator. */
export const TOTAL_WEIGHT = INSIGHTS.reduce((n, i) => n + i.weight, 0)

/**
 * Insights that count toward the FREE experience feeling complete. Used by a
 * later phase to assert that a free creator with real data never sees a
 * dashboard made mostly of locks.
 */
export const FREE_INSIGHT_IDS = INSIGHTS.filter(i => i.gate === GATE.FREE).map(i => i.id)

/** Default state for an insight nothing has evaluated yet. */
export const UNEVALUATED = {
  state: INSIGHT_STATE.NOT_AVAILABLE,
  observations: 0,
  required: null,
  comparedAlternatives: 0,
  explanation: 'Not evaluated.',
  nextMilestone: null,
}
