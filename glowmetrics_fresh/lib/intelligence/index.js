// ============================================================================
// CAMCASH INTELLIGENCE — public surface
//
// One import for every consumer:
//   import { computeIntelligence, INSIGHT_STATE } from '@/lib/intelligence'
//
// WIRED AS OF PHASE 2C-1. All four former progress systems now resolve here:
// CreatorReport's CalibrationCard (2B-1), and getDashboardReadiness /
// getUnlockProgress / getModuleLockState / getFeatureLockState / canShow*
// (2C-1), which survive only as thin wrappers over this ladder via
// lib/intelligence/locks.js. The three fan-value definitions are unchanged.
//
// WHAT THIS MODULE REUSES RATHER THAN REDEFINES:
//   lib/analytics/bestTimes.js  CONFIDENCE_TIER      -> fromConfidenceTier()
//   lib/analytics.js            calculateConfidence  -> fromAccountConfidence()
//   lib/analytics/sessions.js   classifySession      -> read via analytics
//   lib/analytics/missedRevenue.js gates             -> read via analytics
//   DashboardPreview.js         module thresholds    -> restated with citation
//
// WHAT IT ADDS THAT DID NOT EXIST:
//   - the comparison requirement (capForComparison): a window cannot be
//     "best" when nothing was compared against it
//   - ESTABLISHED (evidence + coverage over 30+ days)
//   - the fact / pattern / prediction distinction (EVIDENCE_KIND)
// ============================================================================

export {
  INSIGHT_STATE,
  STATE_META,
  EVIDENCE_KIND,
  CLAIMABLE_FLOOR,
  ESTABLISHED_RULE,
  rank,
  atLeast,
  mayRenderProbability,
  fromConfidenceTier,
  fromAccountConfidence,
  promoteIfEstablished,
  capForComparison,
} from './states'

export {
  INSIGHTS,
  INSIGHT_BY_ID,
  TOTAL_WEIGHT,
  FREE_INSIGHT_IDS,
  GATE,
} from './insights'

export {
  computeIntelligence,
  snapshot,
  diffSnapshots,
} from './readiness'

export {
  MILESTONES,
  MILESTONE_BY_ID,
  EVENT_TYPE,
  evaluateMilestones,
  nextMilestone,
  toDashboardEvent,
  toConfidenceEvent,
  eventsForDiff,
} from './milestones'

export {
  FAN_CLASS,
  FAN_CLASS_META,
  HIGH_VALUE_FAN_USD,
  WHALE_MIN_TIP_COUNT,
  FAN_BEHAVIOUR_MIN_TIPS,
  RELATIVE_RANK_MIN_FANS,
  classifyFan,
  fanEvidenceState,
  observedActivityLabel,
} from './fanValue'

export {
  GATE_MAP,
  READINESS_INSIGHTS,
  stateOf,
  gateOpen,
  lockMessage,
  resolveIntelligence,
  resolveReadiness,
} from './locks'
