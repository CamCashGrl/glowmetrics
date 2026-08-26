// ============================================================================
// CAMCASH INTELLIGENCE — CANONICAL INSIGHT STATES
//
// One vocabulary for "how much does CamCash actually know about this?",
// replacing the four independent progress systems that exist today:
//
//   getDashboardReadiness()  (DashboardPreview.js)  setup/building/starter/warming/ready
//   getUnlockProgress()      (DashboardPreview.js)  % per counter, two target tiers
//   getModuleLockState()     (DashboardPreview.js)  needs_data / requires_pro
//   CalibrationCard          (CreatorReport.js)     private 4-boolean percentage
//
// PHASE 2C-1 UPDATE: the three DashboardPreview.js systems above have been
// retired. They survive only as thin compatibility wrappers over this ladder
// (see lib/intelligence/locks.js), so they no longer hold thresholds of their
// own. CreatorReport's CalibrationCard was re-pointed in 2B-1.
//
// THIS MODULE INVENTS NO THRESHOLDS. Every state below is derived from a
// threshold that already exists in the codebase:
//   - lib/analytics/bestTimes.js  CONFIDENCE_TIER  (session count per bucket)
//   - lib/analytics.js            calculateConfidence()  (sessions + hours)
// Where an insight needs evidence those two don't describe, the requirement is
// declared in insights.js against a documented existing number, never a new
// one invented here.
// ============================================================================

/**
 * The canonical ladder. Ordered — compare with rank(), never with string
 * equality chains, so a surface can ask "is this at least SUPPORTED?".
 */
export const INSIGHT_STATE = {
  /** No qualifying data at all. The insight is not applicable yet. */
  NOT_AVAILABLE: 'NOT_AVAILABLE',
  /** Data exists but nothing can be claimed from it yet. */
  CALIBRATING: 'CALIBRATING',
  /** Weak evidence. Show it, label it, never state it as a finding. */
  EARLY_SIGNAL: 'EARLY_SIGNAL',
  /** Real but thin evidence. May be stated as a tendency, not a conclusion. */
  DEVELOPING: 'DEVELOPING',
  /** Enough evidence to state as a finding. */
  SUPPORTED: 'SUPPORTED',
  /** Strong, repeated evidence. */
  HIGH_CONFIDENCE: 'HIGH_CONFIDENCE',
  /** Strong evidence AND sustained coverage over time. See ESTABLISHED_RULE. */
  ESTABLISHED: 'ESTABLISHED',
}

const ORDER = [
  INSIGHT_STATE.NOT_AVAILABLE,
  INSIGHT_STATE.CALIBRATING,
  INSIGHT_STATE.EARLY_SIGNAL,
  INSIGHT_STATE.DEVELOPING,
  INSIGHT_STATE.SUPPORTED,
  INSIGHT_STATE.HIGH_CONFIDENCE,
  INSIGHT_STATE.ESTABLISHED,
]

/** Numeric rank, for ordering and for "at least X" comparisons. */
export function rank(state) {
  const i = ORDER.indexOf(state)
  return i === -1 ? 0 : i
}

/** True when `state` is at or above `floor` on the ladder. */
export function atLeast(state, floor) {
  return rank(state) >= rank(floor)
}

/**
 * The lowest state at which an insight may be stated as a finding rather than
 * a hint. Below this, copy must hedge ("emerging", "so far", "one to watch")
 * and must never use the words "best", "peak" or "your strongest".
 *
 * SUPPORTED is chosen because it is the exact point lib/analytics/bestTimes.js
 * already allows a bucket to be labelled a best time (CAN_BE_BEST_TIME), so
 * this is that existing rule generalised, not a new one.
 */
export const CLAIMABLE_FLOOR = INSIGHT_STATE.SUPPORTED

/** Display metadata. The only place a confidence word is spelled. */
export const STATE_META = {
  [INSIGHT_STATE.NOT_AVAILABLE]: {
    label: 'Not available yet',
    short: 'Locked',
    emoji: '🌑',
    tone: 'muted',
    blurb: 'CamCash needs data of this kind before it can look at this.',
  },
  [INSIGHT_STATE.CALIBRATING]: {
    label: 'Calibrating',
    short: 'Calibrating',
    emoji: '⏳',
    tone: 'muted',
    blurb: 'CamCash is collecting evidence. Nothing to claim yet.',
  },
  [INSIGHT_STATE.EARLY_SIGNAL]: {
    label: 'Early signal',
    short: 'Early',
    emoji: '🌱',
    tone: 'info',
    blurb: 'Something is showing up, but it is too early to rely on.',
  },
  [INSIGHT_STATE.DEVELOPING]: {
    label: 'Developing',
    short: 'Developing',
    emoji: '📊',
    tone: 'info',
    blurb: 'A tendency is forming. More evidence will firm it up.',
  },
  [INSIGHT_STATE.SUPPORTED]: {
    label: 'Supported',
    short: 'Supported',
    emoji: '🔥',
    tone: 'good',
    blurb: 'Enough repeated evidence to state this as a finding.',
  },
  [INSIGHT_STATE.HIGH_CONFIDENCE]: {
    label: 'High confidence',
    short: 'High',
    emoji: '🎯',
    tone: 'good',
    blurb: 'Strong, repeated evidence across your history.',
  },
  [INSIGHT_STATE.ESTABLISHED]: {
    label: 'Established',
    short: 'Established',
    emoji: '🧠',
    tone: 'strong',
    blurb: 'Strong evidence, sustained over time and compared against alternatives.',
  },
}

// ── BADGE VOCABULARY (Phase 2C-2) ───────────────────────────────────────────
// THE one confidence vocabulary the dashboard renders. It replaces four local
// copies that had drifted apart:
//   CreatorReport.js  STATE_LABEL      7 states, different wording
//   CommandCenter.js  TIER_COPY        3 bucket tiers
//   Performance.js    TIER_COPY (read) 3 bucket tiers
//   StreamPlanner.js  CONF / ConfBadge 4 bucket tiers
//
// NO NEW STATES AND NO NEW THRESHOLDS. Every entry is keyed by an existing
// INSIGHT_STATE and takes its words from STATE_META above.
//
// `emphasis` is presentation only. It encodes the approved rule that the badge
// must be LOUDEST WHERE THE CLAIM IS WEAKEST: a creator whose every insight is
// established should barely notice the badges, while a thin window that the
// hero copy states confidently must be visibly qualified.
export const BADGE_EMPHASIS = {
  /** Prominent: the reader must not miss that this is not yet a finding. */
  STRONG: 'strong',
  /** Visible but restrained: a stated finding, flagged as such. */
  MEDIUM: 'medium',
  /** Subtle: the claim stands on its own; the badge is a footnote. */
  SUBTLE: 'subtle',
}

const BADGE_EMPHASIS_BY_STATE = {
  [INSIGHT_STATE.NOT_AVAILABLE]:   BADGE_EMPHASIS.SUBTLE,
  [INSIGHT_STATE.CALIBRATING]:     BADGE_EMPHASIS.STRONG,
  [INSIGHT_STATE.EARLY_SIGNAL]:    BADGE_EMPHASIS.STRONG,
  [INSIGHT_STATE.DEVELOPING]:      BADGE_EMPHASIS.STRONG,
  [INSIGHT_STATE.SUPPORTED]:       BADGE_EMPHASIS.MEDIUM,
  [INSIGHT_STATE.HIGH_CONFIDENCE]: BADGE_EMPHASIS.SUBTLE,
  [INSIGHT_STATE.ESTABLISHED]:     BADGE_EMPHASIS.SUBTLE,
}

/**
 * Everything a badge needs for one state, or null when there is nothing
 * honest to render.
 *
 * Returns null for an unknown/absent state — which is what a component gets
 * while intelligence is still loading. A loading dashboard must render NO
 * badge rather than "Not available yet", because an absent measurement and a
 * measurement that found nothing are different claims.
 *
 * NOT_AVAILABLE returns null for the same reason: the canonical layer uses it
 * for "no data of this kind exists", and a card that is on screen showing a
 * number is not in that position. A card that genuinely has nothing to show
 * is handled by the lock layer (lib/intelligence/locks.js), not by a badge.
 *
 * @param {string} state - an INSIGHT_STATE
 * @returns {{state, label, short, emoji, tone, blurb, emphasis}|null}
 */
export function badgeFor(state) {
  const meta = STATE_META[state]
  if (!meta) return null
  if (state === INSIGHT_STATE.NOT_AVAILABLE) return null
  return {
    state,
    label: meta.label,
    short: meta.short,
    emoji: meta.emoji,
    tone: meta.tone,
    blurb: meta.blurb,
    emphasis: BADGE_EMPHASIS_BY_STATE[state] || BADGE_EMPHASIS.SUBTLE,
  }
}

/**
 * The badge for one insight id inside a computeIntelligence() result.
 * Null when intelligence is absent (loading) or the insight is unknown, so a
 * caller can always write {badgeForInsight(intel, 'peak_window')} directly.
 */
export function badgeForInsight(intelligence, insightId) {
  const state = intelligence?.insights?.[insightId]?.state
  if (!state) return null
  return badgeFor(state)
}

// ── EVIDENCE KIND ───────────────────────────────────────────────────────────
// The product must never blur these three. A fact needs no confidence state;
// a prediction may never be shown as a number unless something calibrates it.
export const EVIDENCE_KIND = {
  /** Directly observed in the imported data. Always true, no hedging needed. */
  FACT: 'FACT',
  /** Derived from repeated observations. Carries a state from this ladder. */
  PATTERN: 'PATTERN',
  /** A statement about the future or the unobserved. Carries a state AND
   *  must be phrased as a likelihood, never as a figure, unless a calibrated
   *  model backs the figure. Nothing in the engine currently calibrates one. */
  PREDICTION: 'PREDICTION',
}

/**
 * Whether a numeric probability may be rendered for this evidence kind.
 * Always false for PREDICTION today — calcTipProbability()'s 85/70/50/30/15
 * ladder is uncalibrated (documented in Fans.js), so the level may be shown
 * and the percentage may not. Kept as a function so the day a calibrated
 * model exists, exactly one line changes.
 */
export function mayRenderProbability(kind) {
  return kind === EVIDENCE_KIND.FACT
}

// ── MAPPERS FROM THE EXISTING CONFIDENCE SYSTEMS ────────────────────────────

/**
 * lib/analytics/bestTimes.js CONFIDENCE_TIER -> ladder state.
 *
 * The tiers are session counts within a single day x hour bucket:
 *   insufficient (<2) · promising (2-3) · supported (4-5) · high (6+)
 *
 * DEVELOPING is deliberately not produced here: the bucket tiers have no band
 * between "promising" and "supported", and inventing one would mean inventing
 * a session count. Bucket-derived insights reach DEVELOPING only through
 * coverage (see insights.js's peak-window rule), never through this mapper.
 */
export function fromConfidenceTier(tier) {
  switch (tier) {
    case 'high': return INSIGHT_STATE.HIGH_CONFIDENCE
    case 'supported': return INSIGHT_STATE.SUPPORTED
    case 'promising': return INSIGHT_STATE.EARLY_SIGNAL
    case 'insufficient': return INSIGHT_STATE.CALIBRATING
    default: return INSIGHT_STATE.NOT_AVAILABLE
  }
}

/**
 * lib/analytics.js calculateConfidence() level -> ladder state.
 * Very Low ("Not enough data yet") · Low ("Early signal") ·
 * Medium ("Likely pattern") · High ("Strong pattern")
 */
export function fromAccountConfidence(level) {
  switch (level) {
    case 'High': return INSIGHT_STATE.HIGH_CONFIDENCE
    case 'Medium': return INSIGHT_STATE.DEVELOPING
    case 'Low': return INSIGHT_STATE.EARLY_SIGNAL
    case 'Very Low': return INSIGHT_STATE.CALIBRATING
    default: return INSIGHT_STATE.NOT_AVAILABLE
  }
}

/**
 * The one rule that promotes HIGH_CONFIDENCE to ESTABLISHED.
 *
 * ESTABLISHED means the finding survived comparison and time, which is the
 * distinction that matters for a creator who has only ever streamed one slot:
 * 20 Friday-9PM sessions make that window well MEASURED, not proven BEST,
 * because nothing was compared against it.
 *
 *   comparedAlternatives — how many OTHER buckets/platforms/options had enough
 *     evidence to be weighed against the winner (>= 2)
 *   spanDays — calendar days between first and last qualifying observation
 *     (>= 30, i.e. the finding held across more than one month of behaviour)
 *
 * Both are counts of real observations, not new statistical thresholds: "at
 * least two alternatives" is the minimum for the word "best" to mean anything,
 * and 30 days is the window lib/planLimits.js and the SQL trend insight
 * already treat as one period of behaviour.
 */
export const ESTABLISHED_RULE = { minComparedAlternatives: 2, minSpanDays: 30 }

export function promoteIfEstablished(state, { comparedAlternatives = 0, spanDays = 0 } = {}) {
  if (state !== INSIGHT_STATE.HIGH_CONFIDENCE) return state
  const { minComparedAlternatives, minSpanDays } = ESTABLISHED_RULE
  if (comparedAlternatives >= minComparedAlternatives && spanDays >= minSpanDays) {
    return INSIGHT_STATE.ESTABLISHED
  }
  return state
}

/**
 * The comparison guard, applied BEFORE promotion. An insight whose whole
 * meaning is "this one is the best of several" cannot exceed DEVELOPING while
 * there is nothing to compare against, however many sessions back the winner.
 *
 * Applies only to comparative insights (peak window, best day, best platform).
 * Non-comparative insights (total earnings, session length) never call this.
 */
export function capForComparison(state, comparedAlternatives = 0) {
  if (comparedAlternatives >= 1) return state
  return rank(state) > rank(INSIGHT_STATE.DEVELOPING) ? INSIGHT_STATE.DEVELOPING : state
}
