// ============================================================
// CAMCASH — PRO TEASER CARDS (Soft Paywall)
// Truthful teasers built from the creator's stored data.
// ============================================================

// Product rule:
// - Free may see Platform Comparison as a full surface.
// - Other advanced insights are locked/blurred.
// - Stored history and non-selected-platform data may tell the user that a
//   discovery exists, but must not reveal the paid answer itself.
// - Never fabricate a teaser when no real underlying signal exists.
export function buildProTeasers({
  tips = [],
  analysisTips = [],
  whales = [],
  windowSummary = {},
  selectedPlatform = null,
  isPro = false,
} = {}) {
  if (isPro) return []

  const teasers = []
  const storedPlatforms = [...new Set(tips.map(t => t.platform).filter(Boolean))]
  const selected = selectedPlatform ? String(selectedPlatform).toLowerCase() : null
  const storedOutsideSelected = selected
    ? tips.filter(t => String(t.platform || '').toLowerCase() !== selected)
    : []

  // Older rows are actually present in storage but excluded from the 31-day
  // Free/trial analytics window.
  if ((windowSummary.excludedCount || 0) > 0) {
    teasers.push({
      id: 'older_history',
      tab: 'trends',
      title: 'More history is stored',
      description: `CamCash found ${windowSummary.excludedCount} stored record${windowSummary.excludedCount === 1 ? '' : 's'} outside your visible 31-day window.`,
      requirement: 'Upgrade to Pro to unlock the full historical analysis.',
      hasRealSignal: true,
      blurAnswer: true,
      ctaLabel: 'Unlock full history →',
    })
  }

  // Platform Comparison itself is FREE. This teaser is only for deeper
  // platform intelligence beyond the comparison surface.
  if (storedPlatforms.length >= 2) {
    teasers.push({
      id: 'advanced_platform_intelligence',
      tab: 'platforms',
      title: 'Deeper platform patterns found',
      description: `Your free comparison includes ${storedPlatforms.length} platform${storedPlatforms.length === 1 ? '' : 's'}. CamCash has additional platform-level patterns available.`,
      requirement: 'Platform Comparison stays free. Pro unlocks deeper timing, fan-mix, and historical platform intelligence.',
      hasRealSignal: true,
      blurAnswer: true,
      ctaLabel: 'See deeper analysis →',
    })
  }

  // Data uploaded for non-selected platforms is stored, not discarded. We can
  // truthfully tell the creator how much data is waiting without revealing the
  // advanced insight calculated from it.
  if (storedOutsideSelected.length > 0) {
    teasers.push({
      id: 'stored_other_platforms',
      tab: 'overview',
      title: 'More creator data is waiting',
      description: `CamCash is storing ${storedOutsideSelected.length} tip record${storedOutsideSelected.length === 1 ? '' : 's'} from your other platform${storedPlatforms.length > 2 ? 's' : ''}.`,
      requirement: 'Your selected platform keeps its free 31-day analytics view. Upgrade to unlock detailed insights across the rest of your stored data.',
      hasRealSignal: true,
      blurAnswer: true,
      ctaLabel: 'Unlock stored insights →',
    })
  }

  // Use already-computed fan signals only. Do not expose names, spend, cadence,
  // or risk details in the teaser; only say that real matches exist.
  const lapsedFans = whales.filter(w => {
    const daysSinceLast = Number(w.daysSinceLastTip)
    return Number.isFinite(daysSinceLast) && daysSinceLast > 30 && daysSinceLast < 90
  })

  if (lapsedFans.length > 0) {
    teasers.push({
      id: 'fan_churn',
      tab: 'fans',
      title: 'Fan activity needs attention',
      description: `CamCash found ${lapsedFans.length} fan relationship${lapsedFans.length === 1 ? '' : 's'} with a real re-engagement signal.`,
      requirement: 'Upgrade to Pro to reveal who they are and the full fan intelligence behind the signal.',
      hasRealSignal: true,
      blurAnswer: true,
      ctaLabel: 'Reveal fan insights →',
    })
  }

  // A visible-data teaser is useful when the selected 31-day window has enough
  // data for CamCash to know that deeper modules have something to analyze.
  if (analysisTips.length >= 25) {
    teasers.push({
      id: 'advanced_recent_insights',
      tab: 'overview',
      title: 'More insights are ready',
      description: `CamCash analyzed ${analysisTips.length} tips inside your current free 31-day window and found additional patterns to explore.`,
      requirement: 'Upgrade to reveal the advanced recommendations. Platform Comparison remains free.',
      hasRealSignal: true,
      blurAnswer: true,
      ctaLabel: 'Reveal insights →',
    })
  }

  return teasers.filter(t => t.hasRealSignal)
}
