// Soft-paywall teasers: honest upgrade prompts that ONLY render when real
// signals exist. Never fabricate. Used in app/dashboard/page.js to render
// LockedInsightCards at strategic points for Free users.

export function buildProTeasers({ tips, analysisTips, whales, windowSummary, isPro }) {
  if (isPro) return [] // No teasers for Pro users

  const teasers = []

  // ── HISTORICAL DEPTH: Old data excluded by the 31-day window ──────────────
  // Signal: windowSummary.excludedCount > 0 (real older data exists on file)
  if (windowSummary?.excludedCount > 0) {
    const oldestDate = windowSummary.excludedCount > 0 ? windowSummary.oldestExcludedDate : null
    teasers.push({
      id: 'historical_depth',
      tab: 'map', // or 'trends' — appears alongside time-series analysis
      title: 'CamCash found a change worth watching',
      description: 'Your earnings history goes back further. Full historical analysis is Pro-only.',
      requirement: `Upgrade to Pro to analyze beyond the most recent 31 days.${oldestDate ? ` Your oldest data is from ${new Date(oldestDate).toLocaleDateString()}.` : ''}`,
      hasRealSignal: true,
    })
  }

  // ── MULTI-PLATFORM COMPARISON ──────────────────────────────────────────────
  // Signal: ≥2 platforms with real revenue (not tiny test data)
  const platformsWithRevenue = [...new Set(analysisTips.map(t => t.platform))].filter(p => {
    const platformTips = analysisTips.filter(t => t.platform === p)
    const revenue = platformTips.reduce((s, t) => s + (t.usd || 0), 0)
    return revenue >= 10 // Threshold: at least $10 real revenue to count
  })

  if (platformsWithRevenue.length >= 2) {
    teasers.push({
      id: 'multi_platform',
      tab: 'platforms',
      title: 'See your performance across platforms',
      description: 'Compare earnings, audience, and timing between your platforms.',
      requirement: 'Upgrade to Pro to unlock cross-platform comparison.',
      hasRealSignal: true,
    })
  }

  // ── FAN CHURN & RE-ENGAGEMENT ───────────────────────────────────────────────
  // Signal: whales contains fans in 'At Risk' or 'Dormant' behavioral states
  // (from main's calcFanBehavioralState, not invented here)
  const atRiskFans = whales?.filter(w => w.behavioralState === 'At Risk' || w.behavioralState === 'Dormant') || []

  if (atRiskFans.length > 0) {
    teasers.push({
      id: 'fan_churn',
      tab: 'whales', // StreamPlanner context where re-engagement is discussed
      title: 'Key fans need your attention',
      description: 'Track which fans are at risk of churning and get re-engagement strategies.',
      requirement: `${atRiskFans.length} of your top fans show early signs of disengagement. Upgrade to Pro for detailed re-engagement coaching.`,
      hasRealSignal: true,
    })
  }

  return teasers
}
