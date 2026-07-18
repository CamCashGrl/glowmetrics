// ============================================================
// CAMCASH — COACHING ACTIVITY SUMMARY (factual behavior only)
// This is a behavior summary, never a performance/effectiveness claim.
// Do not add earnings-lift, ranking, or causal language here.
// ============================================================

/**
 * @param {Array<{ category: string, actionStatus: 'unmarked'|'performed'|'skipped' }>} events
 */
export function computeCoachingSummary(events) {
  const list = events || []
  const promptsShown = list.length
  const performedPromptCount = list.filter(e => e.actionStatus === 'performed').length
  const skippedPromptCount = list.filter(e => e.actionStatus === 'skipped').length
  const unmarkedPromptCount = list.filter(e => e.actionStatus === 'unmarked').length
  const markedPromptCount = performedPromptCount + skippedPromptCount
  const categories = Array.from(new Set(list.map(e => e.category))).sort()

  return {
    promptsShown,
    performedPromptCount,
    skippedPromptCount,
    unmarkedPromptCount,
    markedPromptCount,
    categories,
    // Unmarked prompts are excluded from the denominator — an unmarked
    // response must never be treated as (or count toward) "skipped".
    followThroughRate: markedPromptCount > 0 ? performedPromptCount / markedPromptCount : null,
  }
}
