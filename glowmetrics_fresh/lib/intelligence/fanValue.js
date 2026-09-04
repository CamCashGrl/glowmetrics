// ============================================================================
// CAMCASH INTELLIGENCE — CANONICAL FAN-VALUE DEFINITIONS
//
// Three DISTINCT concepts, one definition each. Approved D-1 decision:
// "whale" stays in the product's language; the competing definitions do not.
//
//   TOP SUPPORTER   relative — rank within this creator's own audience
//   HIGH-VALUE FAN  absolute — monetary value, independent of anyone else
//   WHALE           absolute value + repeat behaviour + an evidence state
//
// ── PHASE 1 STATUS: DEFINED, NOT WIRED ──────────────────────────────────────
// Nothing imports this module yet. The three existing definitions below all
// remain live and unchanged. This file is the agreed destination; migrating
// each call site is later-phase work with before/after numbers, because
// switching any of them silently changes what a creator sees.
//
// ── INVENTORY OF WHAT EXISTS TODAY (verified by grep, 2026-08-26) ───────────
//
// 1. PERCENTILE TIERS — lib/analytics.js identifyWhales() lines 497-499
//      percentileRank <= 0.05 -> 'Whale'; <= 0.20 -> 'Shark'; else 'Regular';
//      daysSinceLastTip > max(60, avgDaysBetweenTips*3) -> 'Dormant'
//    Read by:
//      lib/analytics.js:589   generateWhaleAlerts()  new_whale alert
//      lib/analytics.js:707-708 generateInsights()   revenue-concentration line
//      lib/analytics.js:1012  topTippers[].status    '🐳 WHALE' badge
//      app/dashboard/page.js:4949  tier icon (💎/🦈/⭐/💤)
//      app/dashboard/page.js:4960  "Ultra high value" label (isTopSpender/percentile)
//      app/api/insights/whales/route.js:99  isTopSpender, spendPercentile
//      app/dashboard/Fans.js  priority rules (via canonical fan fields)
//    -> This is TOP SUPPORTER. It is the correct answer to "who are my
//       biggest supporters", and the wrong answer to "is this fan a whale".
//
// 2. ABSOLUTE TOKENS — lib/constants.js:59 WHALE_LIFETIME_TOKEN_THRESHOLD=500
//    Read by:
//      app/dashboard/StreamPlanner.js:12,243  detectWhales() local to that file
//      app/dashboard/MoneyMap.js:8,147        detectWhales() local to that file
//    -> Two separate local re-implementations sharing one constant. Tokens are
//       platform-dependent: 500 tokens is $25 on Chaturbate/MFC/Stripchat/
//       CamSoda and $12.50 on BongaCams (lib/constants.js token rates), so the
//       same "whale" bar is worth half as much to a BongaCams creator. This is
//       exactly why the canonical definition below is stated in USD.
//
// 3. ABSOLUTE USD + REPEAT — the formula-requirments skill doc
//      Whale = totalUSD >= 100 AND manualTipCount >= 10
//    Read by: NOTHING. Documented, never implemented.
//
// ── THE CANONICAL DEFINITION ────────────────────────────────────────────────
// Adopted from (3), because it is the only documented rule expressed in USD
// (the stated source of truth for value) and the only one that already
// requires repeat behaviour, which the D-1 decision makes mandatory.
//
// ⚠️ REQUIRES SIGN-OFF BEFORE ANY SURFACE READS IT. Adopting $100 changes who
// is called a whale on the two surfaces that use the 500-token rule: on
// Chaturbate that bar moves from $25 to $100, so materially fewer fans
// qualify. That is a visible change to live numbers and, per the standing
// instruction, must be shown as a before/after against the protected accounts
// before it is wired in. The constants are exported so that comparison can be
// run against them directly.
// ============================================================================

import { INSIGHT_STATE, EVIDENCE_KIND } from './states'

/** Lifetime USD at which a fan is high-value in absolute terms. */
export const HIGH_VALUE_FAN_USD = 100

/** Tips required alongside the value, so one big night is not a whale. */
export const WHALE_MIN_TIP_COUNT = 10

/**
 * Tips required before ANY behavioural read on a fan is trustworthy.
 * Not a new number: calcChurnRisk() already returns 'Unknown' below 3 tips,
 * and Fans.js already requires 3+ before making a timing claim.
 */
export const FAN_BEHAVIOUR_MIN_TIPS = 3

/**
 * Unique paying fans required before a RELATIVE rank means anything.
 * Not a new number: canShowWhales() and DEPENDENCY_MIN_FANS already use these
 * (10 and 5 respectively); 10 is taken because "top 5%" of fewer than 10 fans
 * is arithmetically always the single top fan.
 */
export const RELATIVE_RANK_MIN_FANS = 10

// NOTE: the Top Supporter rule itself lives in lib/analytics.js
// (TOP_SUPPORTER_PERCENTILE / _MIN_TIPS / _MIN_FANS) and is applied inside
// identifyWhales(). This module reads the resulting flag. Approved
// 2026-08-26: top 20% by value AND >= 3 tips AND >= 10 fans in the base.

/** Tips from one fan before their evidence is strong rather than thin. */
const FAN_EVIDENCE_BANDS = { developing: 6, high: 12 }

/**
 * Evidence state for a single fan, from tip count alone. Fan-level evidence
 * is genuinely a count of interactions — there is no bucket or coverage
 * dimension here — so this is the one place a simple count is the honest
 * measure, and it reuses the 3/6/12 bands already implied by calcChurnRisk()
 * and calcLifetimeValue()'s Low/Medium/High.
 */
export function fanEvidenceState(tipCount = 0) {
  if (tipCount <= 0) return INSIGHT_STATE.NOT_AVAILABLE
  if (tipCount < FAN_BEHAVIOUR_MIN_TIPS) return INSIGHT_STATE.CALIBRATING
  if (tipCount < FAN_EVIDENCE_BANDS.developing) return INSIGHT_STATE.EARLY_SIGNAL
  if (tipCount < FAN_EVIDENCE_BANDS.high) return INSIGHT_STATE.DEVELOPING
  return INSIGHT_STATE.SUPPORTED
}

/** Fan-value classifications. Distinct concepts, never synonyms. */
export const FAN_CLASS = {
  TOP_SUPPORTER: 'TOP_SUPPORTER',
  HIGH_VALUE_FAN: 'HIGH_VALUE_FAN',
  WHALE_CANDIDATE: 'WHALE_CANDIDATE',
  WHALE: 'WHALE',
  REGULAR: 'REGULAR',
}

export const FAN_CLASS_META = {
  [FAN_CLASS.TOP_SUPPORTER]: {
    label: 'Top Supporter',
    emoji: '👑',
    kind: EVIDENCE_KIND.FACT,
    definition: 'One of your highest-value fans, ranked within your own audience.',
  },
  [FAN_CLASS.HIGH_VALUE_FAN]: {
    label: 'High-Value Fan',
    emoji: '💎',
    kind: EVIDENCE_KIND.FACT,
    definition: `Has spent $${HIGH_VALUE_FAN_USD}+ with you lifetime.`,
  },
  [FAN_CLASS.WHALE_CANDIDATE]: {
    label: 'Whale Candidate',
    emoji: '🐳',
    kind: EVIDENCE_KIND.PATTERN,
    definition: `Spends like a whale, but hasn't tipped enough times yet to confirm the pattern.`,
  },
  [FAN_CLASS.WHALE]: {
    label: 'Whale',
    emoji: '🐳',
    kind: EVIDENCE_KIND.PATTERN,
    definition: `$${HIGH_VALUE_FAN_USD}+ lifetime across ${WHALE_MIN_TIP_COUNT}+ separate tips.`,
  },
  [FAN_CLASS.REGULAR]: {
    label: 'Supporter',
    emoji: '⭐',
    kind: EVIDENCE_KIND.FACT,
    definition: 'A paying fan.',
  },
}

/**
 * Classify one fan.
 *
 * @param {Object} fan - a row from identifyWhales(): { totalUSD, tipCount,
 *   percentileRank? , isTopSpender? }
 * @param {Object} ctx
 * @param {number} ctx.uniqueFanCount - size of this creator's paying audience
 * @returns {{ classification, state, evidence, isTopSupporter, reasons }}
 *
 * A fan can be BOTH a Top Supporter (relative) and a Whale (absolute); the
 * two answer different questions and are returned separately rather than
 * collapsed into one badge.
 */
export function classifyFan(fan = {}, { uniqueFanCount = 0 } = {}) {
  const usd = Number(fan.totalUSD) || 0
  const tips = Number(fan.tipCount) || 0
  const state = fanEvidenceState(tips)

  // Relative rank is only meaningful against a real audience. The
  // classification itself is computed once, canonically, by identifyWhales()
  // (see TOP_SUPPORTER_* in lib/analytics.js) — read here, never re-derived.
  // The fallback covers a fan object built before that field existed.
  const rankIsMeaningful = uniqueFanCount >= RELATIVE_RANK_MIN_FANS
  const isTopSupporter = fan.isTopSupporter ?? (
    rankIsMeaningful &&
    tips >= FAN_BEHAVIOUR_MIN_TIPS &&
    typeof fan.percentileRank === 'number' &&
    fan.percentileRank <= 0.20
  )

  const meetsValue = usd >= HIGH_VALUE_FAN_USD
  const meetsRepeat = tips >= WHALE_MIN_TIP_COUNT

  let classification = FAN_CLASS.REGULAR
  const reasons = []

  if (meetsValue && meetsRepeat) {
    classification = FAN_CLASS.WHALE
    reasons.push(`$${usd.toFixed(0)} lifetime across ${tips} tips`)
  } else if (meetsValue) {
    // High value, not yet enough separate tips to call the behaviour a
    // pattern — the "one huge tip is not a whale" rule from D-1.
    classification = FAN_CLASS.WHALE_CANDIDATE
    reasons.push(`$${usd.toFixed(0)} lifetime, but only ${tips} tip${tips === 1 ? '' : 's'} so far`)
    reasons.push(`${Math.max(0, WHALE_MIN_TIP_COUNT - tips)} more tips would confirm the pattern`)
  } else if (usd > 0) {
    classification = FAN_CLASS.REGULAR
    reasons.push(`$${usd.toFixed(0)} lifetime across ${tips} tip${tips === 1 ? '' : 's'}`)
  }

  // HIGH_VALUE_FAN is reported as its own flag rather than a competing
  // classification, so a Whale is always also high-value without the two
  // labels fighting for the same badge slot.
  const isHighValue = meetsValue

  return {
    classification,
    isTopSupporter,
    isHighValue,
    state,
    /** Countable evidence behind the classification, for the UI to state. */
    evidence: {
      lifetimeUsd: parseFloat(usd.toFixed(2)),
      tipCount: tips,
      tipsToWhale: meetsRepeat ? 0 : Math.max(0, WHALE_MIN_TIP_COUNT - tips),
      usdToHighValue: meetsValue ? 0 : parseFloat((HIGH_VALUE_FAN_USD - usd).toFixed(2)),
      rankIsMeaningful,
      uniqueFanCount,
    },
    reasons,
  }
}

/**
 * Phrasing helper for observed activity hours.
 *
 * identifyWhales().peakLocalHour is the hour a fan MOST OFTEN TIPPED, which
 * is conditional on the creator having been live — it is not evidence of when
 * the fan is available. Per the approved wording rule, never render it as
 * "usually online".
 */
export function observedActivityLabel(peakLocalHour, peakHourTipCount, fmtHour) {
  if (peakLocalHour == null || !peakHourTipCount) return null
  if (peakHourTipCount < FAN_BEHAVIOUR_MIN_TIPS) return null
  return `Most observed tipping activity around ${fmtHour(peakLocalHour)}`
}
