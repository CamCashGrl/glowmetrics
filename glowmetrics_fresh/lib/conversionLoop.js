// ═══════════════════════════════════════════════════════════════════════════
// CONVERSION LOOP — the rotating line in the Command Center.
//
// One prompt at a time, rotating slowly, and every one of them CONDITIONAL on
// something already true in her data. That is the whole discipline: the line
// "we uncovered which supporters tip most in private" is only ever built when
// paid-session fans actually exist and CamCash can already see them. If the
// condition is false the prompt is not softened — it is absent.
//
// This is why the loop can be honest and still convert: each line names a
// real thing CamCash has already found and is not showing her in full. It
// never states an amount she would earn, a probability, or a forecast.
//
// COMPUTES NOTHING. Every condition reads a canonical field.
// ═══════════════════════════════════════════════════════════════════════════

import { rank, CLAIMABLE_FLOOR } from './intelligence/states'

const claimable = (intelligence, id) => {
  const s = intelligence?.insights?.[id]?.state
  return !!s && rank(s) >= rank(CLAIMABLE_FLOOR)
}

/**
 * Build the rotating prompts for this account. Pro sees none — there is
 * nothing left to unlock.
 *
 * @param {Object}  args
 * @param {Object}  args.analytics
 * @param {Object}  args.intelligence
 * @param {boolean} args.isPro
 * @returns {Array<{id,line,cta,source}>}
 */
export function conversionPrompts({ analytics, intelligence, isPro = false }) {
  if (isPro) return []
  const a = analytics || {}
  const out = []

  // PRIVATE / PAID SESSIONS — only when paid-session fans genuinely exist.
  const privateFans = (a.privateShowFans || []).length
  if (privateFans >= 3) {
    out.push({
      id: 'private_fans',
      line: `CamCash is showing you your top spenders — but it has also worked out which ${privateFans} supporters spend in private, and that is a different list.`,
      cta: 'See who they are',
      source: 'private_fans',
    })
  }

  // CROSS-PLATFORM — only when two or more platforms are genuinely comparable.
  if ((a.rankablePlatforms || []).length >= 2) {
    out.push({
      id: 'cross_platform',
      line: `Your platforms have been measured against each other. CamCash knows which one pays you more per hour streamed.`,
      cta: 'Compare my platforms',
      source: 'platform_comparison',
    })
  }

  // CHURN — only when the churn read is claimable and fans are actually flagged.
  const atRisk = (a.whales || []).filter(w => w.tipCount >= 3 && (w.churnRisk?.level === 'High' || w.churnRisk?.level === 'Medium')).length
  if (atRisk > 0 && claimable(intelligence, 'churn_risk')) {
    out.push({
      id: 'churn',
      line: `${atRisk} of your supporters have slipped past the rhythm they used to tip on. CamCash can name them and when they usually show up.`,
      cta: 'See who is slipping',
      source: 'fan_recovery',
    })
  }

  // PEAK WINDOW → PLAN. Only once the window itself is supported.
  if (claimable(intelligence, 'peak_window')) {
    const w = a.canonicalBestTimes?.bestWindow
    if (w?.localDay != null) {
      out.push({
        id: 'plan',
        line: `Your earnings cluster on ${w.localDay}s. CamCash can turn that into a weekly schedule built around every window it found, not just the strongest one.`,
        cta: 'Build my weekly plan',
        source: 'stream_planner',
      })
    }
  }

  // MONEY MAP — only when the grid has enough depth to be worth opening.
  if (claimable(intelligence, 'money_map')) {
    out.push({
      id: 'money_map',
      line: `Your day-by-hour earnings grid is filled in far beyond the preview you are seeing.`,
      cta: 'Open the full Money Map',
      source: 'money_map',
    })
  }

  // FAN PATTERNS — only when the roster is deep enough that a sample of three
  // is genuinely a sample.
  const fanCount = a.uniqueFanCount || 0
  if (fanCount > 10 && claimable(intelligence, 'fan_behaviour')) {
    out.push({
      id: 'fan_patterns',
      line: `CamCash has read the tipping rhythm of all ${fanCount.toLocaleString()} of your supporters. You are seeing it for three.`,
      cta: 'Unlock every fan',
      source: 'fan_profile',
    })
  }

  return out
}

/**
 * Which prompt to show right now. Rotates on a fixed interval derived from the
 * clock, so it advances on its own without a timer and stays stable across
 * re-renders within the same slot — no flicker, no spam.
 *
 * @param {Array}  prompts
 * @param {number} [intervalMs] - how long one prompt holds. Default 45s.
 * @param {number} [now]
 */
export function currentPrompt(prompts, intervalMs = 45000, now = Date.now()) {
  if (!prompts.length) return null
  return prompts[Math.floor(now / intervalMs) % prompts.length]
}
