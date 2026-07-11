// ============================================================
// CAMCASH — COACHING PROMPT OUTCOME WINDOW CAPTURE
// Pure data collection only — computes raw before/after activity numbers
// around a shown coaching prompt. Never derive an effectiveness claim,
// percentage, or "this worked" conclusion here. That's a separate,
// future feature once enough real sessions exist.
// ============================================================

import { COACHING_OUTCOME_WINDOWS_MS } from './constants'

/**
 * @typedef {{ timestamp: string|Date, usd: number, username?: string|null }} OutcomeTip
 */

function usdInRange(tips, startMs, endMs) {
  return tips
    .filter(t => {
      const ms = new Date(t.timestamp).getTime()
      return ms > startMs && ms <= endMs
    })
    .reduce((sum, t) => sum + (t.usd || 0), 0)
}

function tipsInRange(tips, startMs, endMs) {
  return tips.filter(t => {
    const ms = new Date(t.timestamp).getTime()
    return ms > startMs && ms <= endMs
  })
}

function uniqueTippers(tips) {
  return new Set(tips.map(t => (t.username || '').toLowerCase()).filter(Boolean)).size
}

/**
 * @param {object} params
 * @param {string|Date} params.promptShownAt
 * @param {OutcomeTip[]} params.tips - the full session's tips (or enough of them to cover the windows)
 * @param {string|null} [params.relatedTipperName]
 * @param {number|null} [params.paceBeforePrompt] - $/min immediately before the prompt, supplied by the caller
 * @returns {object} the numeric CoachingPromptOutcome fields (caller adds ids/status)
 */
export function computeCoachingOutcomeWindows({ promptShownAt, tips, relatedTipperName = null, paceBeforePrompt = null }) {
  const promptMs = new Date(promptShownAt).getTime()
  const w = COACHING_OUTCOME_WINDOWS_MS
  const list = tips || []

  // The "before" window ends just short of the prompt moment so a tip that
  // lands exactly at promptMs is counted as "after", never both/neither.
  const beforeBoundaryMs = promptMs - 1
  const before5m = tipsInRange(list, promptMs - w.before5m, beforeBoundaryMs)
  const after5m = tipsInRange(list, promptMs - 1, promptMs + w.after5m)
  const after10m = tipsInRange(list, promptMs - 1, promptMs + w.after10m)
  const after20m = tipsInRange(list, promptMs - 1, promptMs + w.after20m)

  const relatedLower = relatedTipperName ? relatedTipperName.toLowerCase() : null
  const relatedTippedAgain = (windowTips) =>
    relatedLower === null ? null : windowTips.some(t => (t.username || '').toLowerCase() === relatedLower)

  const earningsAfter10m = usdInRange(list, promptMs - 1, promptMs + w.after10m)

  return {
    earningsBefore5m: parseFloat(usdInRange(list, promptMs - w.before5m, beforeBoundaryMs).toFixed(2)),
    earningsAfter5m: parseFloat(usdInRange(list, promptMs - 1, promptMs + w.after5m).toFixed(2)),
    earningsAfter10m: parseFloat(earningsAfter10m.toFixed(2)),
    earningsAfter20m: parseFloat(usdInRange(list, promptMs - 1, promptMs + w.after20m).toFixed(2)),

    tipsBefore5m: before5m.length,
    tipsAfter5m: after5m.length,
    tipsAfter10m: after10m.length,
    tipsAfter20m: after20m.length,

    uniqueTippersBefore5m: uniqueTippers(before5m),
    uniqueTippersAfter5m: uniqueTippers(after5m),
    uniqueTippersAfter10m: uniqueTippers(after10m),
    uniqueTippersAfter20m: uniqueTippers(after20m),

    relatedSupporterTippedAgain5m: relatedTippedAgain(after5m),
    relatedSupporterTippedAgain10m: relatedTippedAgain(after10m),

    paceBeforePrompt: paceBeforePrompt,
    paceAfter10m: parseFloat((earningsAfter10m / 10).toFixed(3)),

    promptShownAt: new Date(promptShownAt).toISOString(),
  }
}

/**
 * Keeps only the last outcome per coachingEventId — mirrors the unique
 * constraint on coaching_prompt_outcomes.coaching_event_id so a re-run of
 * the capture job (or a batch containing the same event twice) never
 * produces duplicate outcome records.
 *
 * @param {Array<{ coachingEventId: string|number }>} outcomes
 */
export function dedupeOutcomesByEventId(outcomes) {
  const byId = new Map()
  for (const outcome of outcomes || []) {
    byId.set(outcome.coachingEventId, outcome)
  }
  return Array.from(byId.values())
}
