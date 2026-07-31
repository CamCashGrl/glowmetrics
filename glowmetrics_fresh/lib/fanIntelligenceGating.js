// Pure gating logic for the Fan Intelligence panel (app/dashboard/page.js),
// pulled out so it's testable without rendering the whole dashboard.
//
// Rule: 3 complete fan summaries are free for everyone. The consolidated
// upgrade gate below them is a PAYMENT notice and must never show once a
// user is Pro — a Pro user who genuinely has 0 fans yet gets a neutral
// data notice instead, never a "upgrade to unlock" message.

export function shouldShowFanUpgradeGate(visibleFanCount, isPro) {
  return !isPro && visibleFanCount <= 3
}

export function shouldShowFanDataNotice(visibleFanCount, isPro) {
  return isPro && visibleFanCount === 0
}

// Picks the single highest-value at-risk fan to tease in the post-upload
// reveal and the whales_empty upgrade gate. Never returns anything for a
// Pro user (they already see everything) or when no fan genuinely meets
// the churn-risk + real-spend bar — no fallback/fabricated pick.
export function pickAtRiskWhale(whales = [], isPro = false) {
  if (isPro) return null
  const candidates = whales.filter(
    (w) =>
      (w.churnRisk?.level === 'High' || w.churnRisk?.level === 'Critical') &&
      w.totalUSD > 0 &&
      Number.isFinite(w.daysSinceLastTip)
  )
  if (candidates.length === 0) return null
  return [...candidates].sort((a, b) => b.totalUSD - a.totalUSD)[0]
}

export function additionalFanCount(totalWhaleCount, freeVisibleCount = 3) {
  return Math.max(0, totalWhaleCount - freeVisibleCount)
}
