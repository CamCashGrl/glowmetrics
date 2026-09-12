// ============================================================
// CAMCASH — PRO TEASER CARDS (Soft Paywall)
// Builds honest teaser cards with real signal detection.
// ============================================================

// Never fabricate or show teasers when real signal doesn't exist.
// A teaser only renders when:
// 1. Real underlying data exists (e.g., excluded older history, lapsed fans)
// 2. hasRealSignal === true (caller verified the signal before building the teaser)

export function buildProTeasers({
  tips = [],
  analysisTips = [],
  whales = [],
  windowSummary = {},
  isPro = false,
} = {}) {
  if (isPro) return [] // Pro users don't see teasers

  const teasers = []

  // ── TEASER: Older history exists (map/trends tabs) ────────────────────────
  if (windowSummary.excludedCount > 0) {
    teasers.push({
      id: 'older_history',
      tab: 'map',
      title: 'CamCash found a change worth watching',
      description: 'See trend analysis spanning your full history (beyond 31 days).',
      requirement: 'Upgrade to Pro to unlock full historical analysis.',
      hasRealSignal: true, // Real excluded data exists
      ctaLabel: 'View Plans →',
    })

    teasers.push({
      id: 'older_trends',
      tab: 'trends',
      title: 'Complete earning trends',
      description: 'Analyze your full earnings history, not just the recent 31 days.',
      requirement: 'Pro users see trends across all imported data.',
      hasRealSignal: true,
      ctaLabel: 'Upgrade →',
    })
  }

  // ── TEASER: Multi-platform insight (platforms tab) ──────────────────────────
  const platforms = [...new Set(tips.map(t => t.platform).filter(Boolean))]
  if (platforms.length >= 2) {
    teasers.push({
      id: 'cross_platform',
      tab: 'platforms',
      title: 'Compare platforms side-by-side',
      description: 'See which cam site pays you best by hour, day, and fan type.',
      requirement: 'Pro users unlock detailed cross-platform ROI analysis.',
      hasRealSignal: true, // Real multi-platform data exists
      ctaLabel: 'Upgrade →',
    })
  }

  // ── TEASER: Churn detection (fan recovery/stream planner logic) ──────────────
  // Only show if there are actually lapsed fans (reuse existing churn detection)
  const lapsedFans = whales.filter(w => {
    // A fan is lapsed if they haven't tipped in >30 days
    const daysSinceLast = w.daysSinceLastTip || Infinity
    return daysSinceLast > 30 && daysSinceLast < 90 // "Lapsed" not "Dormant"
  })

  if (lapsedFans.length > 0) {
    teasers.push({
      id: 'fan_churn',
      tab: 'fans',
      title: 'Re-engage your top fans',
      description: 'Get targeted insights on fans who might be slipping away.',
      requirement: `Pro users see churn risk for your ${lapsedFans.length} at-risk fan${lapsedFans.length === 1 ? '' : 's'}.`,
      hasRealSignal: true,
      ctaLabel: 'Upgrade →',
    })
  }

  return teasers.filter(t => t.hasRealSignal) // Never show teasers without real signal
}
