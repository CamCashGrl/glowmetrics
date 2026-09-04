// ============================================================================
// CAMCASH — CONTEXTUAL UPGRADE CONTEXTS  (Phase 2C-4)
//
// One catalogue for "why is this creator being shown an upgrade right now".
// Every entry answers three things in order:
//
//   1. WHAT DID CAMCASH FIND?   the discovery, in its own numbers
//   2. WHY DOES IT MATTER?      one line, no hype
//   3. WHAT DOES PRO DO ABOUT IT? a deeper answer or action that already exists
//
// RULES THIS FILE OBEYS
//   - It COMPUTES NOTHING. Every figure is read from the analytics /
//     intelligence objects the dashboard already has.
//   - It NEVER FABRICATES A DISCOVERY. If the canonical insight behind a
//     context is not actually there, the discovery half is omitted and the
//     modal falls back to a plain, honest description of the feature. A
//     creator is never told CamCash found something it did not find.
//   - It PROMISES ONLY WHAT EXISTS. Each `unlock` line describes output the
//     fan/platform/planner layers already produce.
//   - NO income guarantees, no "make more money", no urgency, no scarcity, no
//     predictions. verify-contextual-upgrade.mjs asserts the banned phrases.
// ============================================================================

/** Canonical upgrade sources. The key is also the tracked feature name. */
export const UPGRADE_SOURCE = {
  WINDOW_FAN_OVERLAP: 'window_fan_overlap',
  PEAK_WINDOW: 'peak_window',
  PLATFORM_COMPARISON: 'platform_comparison',
  MULTI_PLATFORM: 'multi_platform',
  STREAM_PLANNER: 'stream_planner',
  MONEY_MAP: 'money_map',
  FAN_ROSTER_DEPTH: 'whales_cutoff',
  CREATOR_REPORT: 'creator_report',
  LIVE_MODE: 'live_mode_locked',
  IMPORT_DISCOVERY: 'import_discovery',
  DEFAULT: 'default',
}

const fmtHour = (h) => {
  const hh = ((Number(h) % 24) + 24) % 24
  return hh === 0 ? '12 AM' : hh < 12 ? `${hh} AM` : hh === 12 ? '12 PM' : `${hh - 12} PM`
}

/**
 * Static half of each context: what Pro does, and how the CTA reads.
 *
 * The CTA is written as the OUTCOME the creator wants ("See these fans with
 * Pro"), never as the feature's product name ("Unlock Fan Intelligence").
 */
const CONTEXTS = {
  [UPGRADE_SOURCE.WINDOW_FAN_OVERLAP]: {
    insightId: 'fan_behaviour',
    eyebrow: 'You found a pattern',
    fallbackHeadline: 'Your strongest window and your repeat supporters',
    unlock: 'With Pro, see which fans are behind the pattern and explore their recorded activity, including tip cadence, last seen, and re-engagement timing.',
    primaryCta: 'See these fans with Pro',
  },
  [UPGRADE_SOURCE.PEAK_WINDOW]: {
    insightId: 'peak_window',
    eyebrow: 'CamCash found your strongest streaming window',
    fallbackHeadline: 'Your strongest streaming window',
    unlock: 'With Pro, turn this pattern into a weekly streaming plan — every day and time block worth testing, not just tonight.',
    primaryCta: 'Turn this into a weekly plan',
  },
  [UPGRADE_SOURCE.PLATFORM_COMPARISON]: {
    insightId: 'cross_platform',
    eyebrow: 'Your platforms are showing different patterns',
    fallbackHeadline: 'How your platforms compare',
    unlock: 'With Pro, compare your platform performance in more detail and see how platform and streaming time interact across your recorded history.',
    primaryCta: 'Compare My Platforms',
  },
  [UPGRADE_SOURCE.MULTI_PLATFORM]: {
    insightId: 'cross_platform',
    eyebrow: "You're already tracking your current platforms",
    fallbackHeadline: 'Add another platform',
    unlock: 'Pro lets you add the additional platform and compare your performance across them.',
    primaryCta: 'Add the platform with Pro',
  },
  [UPGRADE_SOURCE.STREAM_PLANNER]: {
    // 2C-5: keyed to peak_window, because that is the discovery the creator
    // was looking at when she clicked. The ask preserves it.
    insightId: 'peak_window',
    eyebrow: 'Turn your strongest window into a weekly plan',
    fallbackHeadline: 'Your weekly streaming plan',
    unlock: 'With Pro, turn your recorded performance history into a personalized weekly streaming plan — every day and time block that has performed best, not just tonight.',
    primaryCta: 'Build My Weekly Plan',
  },
  [UPGRADE_SOURCE.MONEY_MAP]: {
    insightId: 'money_map',
    eyebrow: 'Your Money Map is built from real history',
    fallbackHeadline: 'Where your money comes from',
    unlock: 'With Pro, open 90-day and all-time history alongside session breakdowns and platform comparisons.',
    primaryCta: 'Open the full history',
  },
  [UPGRADE_SOURCE.FAN_ROSTER_DEPTH]: {
    insightId: 'top_supporters',
    eyebrow: 'You found your top supporters',
    fallbackHeadline: 'Your top supporters',
    unlock: 'With Pro, follow each supporter over time — tip cadence, last seen, and who has gone quiet.',
    primaryCta: 'See supporter history with Pro',
  },
  [UPGRADE_SOURCE.CREATOR_REPORT]: {
    insightId: 'plan_readiness',
    eyebrow: 'Your report has enough evidence for the deeper read',
    fallbackHeadline: 'Your Creator Report',
    unlock: 'With Pro, open the rest of your report — the per-window and per-platform detail behind the summary.',
    primaryCta: 'Open the full report',
  },
  [UPGRADE_SOURCE.LIVE_MODE]: {
    insightId: null,
    eyebrow: 'Track a stream as it happens',
    fallbackHeadline: 'Live Mode',
    unlock: 'With Pro, run Live Mode for a full stream and record tips as they land, then compare the session against your existing windows.',
    primaryCta: 'Start using Live Mode',
  },
  [UPGRADE_SOURCE.IMPORT_DISCOVERY]: {
    insightId: 'peak_window',
    eyebrow: 'CamCash found a pattern in what you just imported',
    fallbackHeadline: 'What your import revealed',
    unlock: 'With Pro, turn what CamCash just found into a weekly schedule, platform priorities, and the windows worth testing next.',
    primaryCta: 'Turn this into a plan',
  },
  [UPGRADE_SOURCE.DEFAULT]: {
    insightId: null,
    eyebrow: 'Creator Pro',
    fallbackHeadline: 'Go deeper on your own data',
    unlock: 'Pro opens the fan records, the cross-platform comparison and the full weekly plan built from the history you have already imported.',
    primaryCta: 'Continue with Pro',
  },
}

/**
 * The LIVE half: the discovery sentences, read from canonical outputs.
 *
 * Each builder returns an array of plain strings, or [] when the canonical
 * data is not there. An empty array is the signal that there is no discovery
 * to preserve, and the modal must not pretend otherwise.
 */
function discoveryFor(source, { analytics, trackedPlatformCount } = {}) {
  const bestWindow = analytics?.canonicalBestTimes?.bestWindow || null
  const overlap = analytics?.bestWindowFanOverlap || null
  const windowLabel = bestWindow
    ? `${bestWindow.localDay}s ${fmtHour(bestWindow.localHour)}–${fmtHour(bestWindow.localHour + 2)}`
    : null

  switch (source) {
    case UPGRADE_SOURCE.WINDOW_FAN_OVERLAP: {
      if (!bestWindow || !overlap?.count) return []
      const lines = [
        `${overlap.count} repeat fan${overlap.count === 1 ? ' has' : 's have'} tipped during your strongest window.`,
      ]
      if (overlap.topSupporterCount > 0) {
        lines.push(`${overlap.topSupporterCount} ${overlap.topSupporterCount === 1 ? 'is' : 'are'} among your Top Supporters.`)
      }
      return lines
    }
    case UPGRADE_SOURCE.PEAK_WINDOW:
    case UPGRADE_SOURCE.IMPORT_DISCOVERY: {
      if (!bestWindow) return []
      return [
        `${windowLabel} is your highest median rate at $${bestWindow.medianUsdPerHour}/hr,`,
        `measured over ${bestWindow.sessionCount} session${bestWindow.sessionCount === 1 ? '' : 's'}.`,
      ]
    }
    case UPGRADE_SOURCE.PLATFORM_COMPARISON: {
      // 2C-6: reads the canonical rankable set — the same array
      // bestPlatformByRate is chosen from, already gated on each platform's own
      // confidence. Fewer than two means there is no comparison to preserve, so
      // none is claimed.
      const rankable = analytics?.rankablePlatforms || []
      if (rankable.length < 2) return []
      const [lead, runnerUp] = rankable
      return [`Your recorded sessions show a stronger observed hourly rate on ${lead.platform} than ${runnerUp.platform}.`]
    }
    case UPGRADE_SOURCE.MULTI_PLATFORM: {
      const n = trackedPlatformCount || (analytics?.platforms || []).length
      if (!n) return []
      return [`You're already tracking ${n} platform${n === 1 ? '' : 's'}.`]
    }
    case UPGRADE_SOURCE.FAN_ROSTER_DEPTH: {
      const supporters = (analytics?.whales || []).filter(f => f.isTopSupporter).length
      if (!supporters) return []
      return [`${supporters} of your fans rank as Top Supporters.`]
    }
    case UPGRADE_SOURCE.MONEY_MAP: {
      const tips = analytics?.totalTips || 0
      if (!tips) return []
      return [`Your Money Map is drawn from ${tips.toLocaleString('en-US')} recorded tips.`]
    }
    case UPGRADE_SOURCE.STREAM_PLANNER: {
      if (!bestWindow) return []
      // Observed, past tense. Never a claim about a future stream.
      return [`You've identified ${windowLabel} as your strongest observed window.`]
    }
    default:
      return []
  }
}

/**
 * Build the full context for the modal.
 *
 * @param {string} source - an UPGRADE_SOURCE value (unknown falls back safely)
 * @param {Object} ctx
 * @param {Object} [ctx.analytics]
 * @param {number} [ctx.trackedPlatformCount]
 * @returns {{ source, insightId, eyebrow, headline, discovery: string[],
 *             unlock, primaryCta, hasDiscovery: boolean }}
 */
export function buildUpgradeContext(source, ctx = {}) {
  const key = CONTEXTS[source] ? source : UPGRADE_SOURCE.DEFAULT
  const base = CONTEXTS[key]
  const discovery = discoveryFor(key, ctx)
  return {
    source: key,
    insightId: base.insightId,
    eyebrow: discovery.length ? base.eyebrow : 'Creator Pro',
    headline: base.fallbackHeadline,
    discovery,
    unlock: base.unlock,
    primaryCta: base.primaryCta,
    hasDiscovery: discovery.length > 0,
  }
}

export const UPGRADE_CONTEXT_KEYS = Object.keys(CONTEXTS)
