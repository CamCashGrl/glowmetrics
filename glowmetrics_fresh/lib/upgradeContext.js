// ============================================================
// CAMCASH — CONTEXTUAL UPGRADE PROMPTS
//
// One place that answers "what is this creator actually missing right now?",
// so every CTA, modal headline and benefit list is derived from the same
// state instead of each surface hardcoding its own pitch.
//
// WHY THIS EXISTS
// The upgrade prompts had drifted apart. The post-import screen said "Unlock
// Full History" for every situation — including one where the creator's real
// blocker was the platform cap, not history. The modal showed the same six
// generic benefits no matter what the creator clicked, so a click on
// "Compare More Platforms" opened a pitch led by fan predictions. And the
// platform copy still read "You've tracked 1 platform" long after Free moved
// to three.
//
// RULES THIS ENFORCES
//   - The CTA names the thing the creator is actually blocked on.
//   - The modal repeats that same thing back, so the click is not a bait.
//   - Benefits are the ones that apply to THIS creator's state.
//   - Nothing here computes analytics or invents a number; callers pass in
//     facts the canonical engine already produced.
// ============================================================

import { FREE_MAX_PLATFORMS, FREE_HISTORY_DAYS } from './planLimits'

export const UPGRADE_SOURCES = {
  HISTORY: 'csv_history',
  PLATFORMS: 'csv_platform_limit',
  DEEPER: 'deeper_analysis',
}

// Benefit lines, keyed so a context can pick the ones that actually apply.
// Deliberately concrete and checkable — no "15+ insights", no predictions we
// do not make, no invented percentages.
const BENEFIT = {
  history: { icon: '📈', text: `Your full history analysed, not just the last ${FREE_HISTORY_DAYS} days` },
  trends: { icon: '📊', text: 'Long-term earnings trends across every month you have uploaded' },
  fans: { icon: '🐳', text: 'Every supporter ranked by lifetime value, not just your top few' },
  windows: { icon: '⏰', text: 'Your strongest earning windows, once enough sessions back them' },
  platforms: { icon: '🔀', text: `Track more than ${FREE_MAX_PLATFORMS} platforms` },
  compare: { icon: '⚖️', text: 'Compare platforms side by side to see where your time pays best' },
  sessions: { icon: '🗂️', text: 'Full session history with performance patterns' },
  noReupload: { icon: '⚡', text: 'History you already uploaded unlocks instantly — no re-upload' },
}

/**
 * Decide what to say, from what the creator actually has.
 *
 * @param {object} state
 * @param {number} state.lockedTips      rows outside the Free window (already stored)
 * @param {number} state.lockedUsd       their earnings total
 * @param {number} state.platformCount   supported platforms currently tracked
 * @param {boolean} state.hasBlockedPlatform  a platform in this upload exceeded the cap
 * @param {boolean} state.hasDeeperInsights   real locked previews exist (trend/fans/sessions)
 */
export function resolveUpgradeContext(state = {}) {
  const {
    lockedTips = 0, lockedUsd = 0, platformCount = 0,
    hasBlockedPlatform = false, hasDeeperInsights = false,
  } = state

  const atPlatformCap = platformCount >= FREE_MAX_PLATFORMS
  const hasHistory = lockedTips > 0

  // A platform that could not be stored is the most concrete blocker: the
  // creator handed over data the product refused. It outranks history, which
  // is merely not being analysed yet.
  if (hasBlockedPlatform) {
    return {
      source: UPGRADE_SOURCES.PLATFORMS,
      cta: 'Compare More Platforms →',
      headline: 'Unlock the platform we could not add',
      subhead: `Free tracks up to ${FREE_MAX_PLATFORMS} platforms. Pro adds the rest, so you can compare where your time actually pays best.`,
      benefits: [BENEFIT.platforms, BENEFIT.compare, BENEFIT.history, BENEFIT.trends],
    }
  }

  if (hasHistory) {
    return {
      source: UPGRADE_SOURCES.HISTORY,
      cta: 'Unlock Full History →',
      headline: lockedUsd > 0
        ? `Unlock the ${formatUsd(lockedUsd)} we found in your history`
        : 'Unlock the history we found in your data',
      subhead: `${lockedTips.toLocaleString()} tips in your upload sit outside the Free ${FREE_HISTORY_DAYS}-day window. They are already saved — Pro analyses them right away.`,
      benefits: [BENEFIT.history, BENEFIT.trends, BENEFIT.fans, BENEFIT.noReupload],
    }
  }

  if (hasDeeperInsights) {
    return {
      source: UPGRADE_SOURCES.DEEPER,
      cta: 'Unlock Your Deeper Analysis →',
      headline: 'Unlock the deeper analysis in your data',
      subhead: 'Your upload already contains patterns Free does not analyse. Pro opens them up.',
      benefits: [BENEFIT.trends, BENEFIT.windows, BENEFIT.fans, BENEFIT.sessions],
    }
  }

  if (atPlatformCap) {
    return {
      source: UPGRADE_SOURCES.PLATFORMS,
      cta: 'Compare More Platforms →',
      headline: `You are using all ${FREE_MAX_PLATFORMS} Free platform slots`,
      subhead: 'Pro adds more platforms and compares them side by side, so you can see which one is actually worth your hours.',
      benefits: [BENEFIT.platforms, BENEFIT.compare, BENEFIT.history, BENEFIT.trends],
    }
  }

  return null
}

function formatUsd(n) {
  return `$${Number(n || 0).toFixed(2)}`
}
