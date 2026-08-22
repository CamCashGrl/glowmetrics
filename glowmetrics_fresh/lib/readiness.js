// ════════════════════════════════════════════════════════════════════════
// PROGRESSIVE READINESS
//
// The Creator Report used to gate itself behind `tips >= 10 && sessions >= 2`
// and show a "warming up" wall to everyone below it. A creator who had just
// finished their first import — the exact moment they are deciding whether
// this product is worth anything — got a page telling them to come back later.
//
// This module replaces that single all-or-nothing gate with per-capability
// thresholds, so the report can say what is ready NOW and what specifically
// unlocks next, using the creator's real counts.
//
// These are READINESS thresholds: the point at which a recommendation stops
// being noise, not a claim of statistical significance. Nothing here asserts
// confidence intervals, and the copy must not either. "More data makes this
// smarter" is the honest framing; "all the data needed" is not, because there
// is no point at which CamCash has all of it.
// ════════════════════════════════════════════════════════════════════════

/**
 * Every capability the report reports on, in the order a creator unlocks them.
 * `metric` picks which count the threshold is measured against.
 */
export const CAPABILITIES = [
  { id: 'totals',       label: 'Earnings & tip totals',   metric: 'tips',     need: 10,
    ready: 'Your totals are live and update with every import.',
    waiting: 'A few more tips and your totals become meaningful.' },
  { id: 'topFans',      label: 'Top supporters',          metric: 'tips',     need: 10,
    ready: 'CamCash can rank who supports you most.',
    waiting: 'Ranking your supporters needs a few more tips.' },
  { id: 'whales',       label: 'Whale detection',         metric: 'tips',     need: 20,
    ready: 'Your highest-value supporters are identified.',
    waiting: 'Spotting whales takes a bit more tip history.' },
  { id: 'peakWindow',   label: 'Peak earning window',     metric: 'sessions', need: 3,
    ready: 'CamCash can see when your money actually arrives.',
    waiting: "We're learning when you earn most." },
  { id: 'sessionCompare', label: 'Session comparisons',   metric: 'sessions', need: 5,
    ready: 'Your streams can be compared against each other.',
    waiting: 'Comparing streams needs a few more sessions.' },
  { id: 'bestTime',     label: 'Best streaming time',     metric: 'sessions', need: 5,
    ready: 'Your best streaming window is ready.',
    waiting: "We're still learning your best streaming window." },
  { id: 'planner',      label: 'Stream Planner',          metric: 'sessions', need: 5,
    ready: 'Your personalised streaming plan is ready to build.',
    waiting: 'Your first personalised Stream Planner needs more sessions.' },
  { id: 'dayTime',      label: 'Day & time recommendations', metric: 'sessions', need: 7,
    ready: 'Day-and-time recommendations are reliable enough to act on.',
    waiting: 'Recommending specific days needs a longer run of streams.' },
  { id: 'trends',       label: 'Long-term trends',        metric: 'sessions', need: 10,
    ready: 'CamCash can see how you are trending over time.',
    waiting: 'Trends need more history before they mean anything.' },
]

/**
 * @param {{tips:number, sessions:number}} counts — the creator's REAL counts.
 * @returns {Array<{id,label,ready:boolean,have:number,need:number,remaining:number,message:string}>}
 */
export function assessReadiness({ tips = 0, sessions = 0 } = {}) {
  const have = { tips, sessions }
  return CAPABILITIES.map(c => {
    const got = have[c.metric] || 0
    const ready = got >= c.need
    return {
      id: c.id,
      label: c.label,
      metric: c.metric,
      ready,
      have: got,
      need: c.need,
      remaining: Math.max(0, c.need - got),
      message: ready ? c.ready : c.waiting,
    }
  })
}

/**
 * The single next thing to unlock — the nearest unmet threshold. Drives the
 * report's "what to do next", so the creator gets ONE instruction rather than
 * a wall of everything they lack.
 */
export function nextUnlock(readiness) {
  return readiness.filter(r => !r.ready).sort((a, b) => a.remaining - b.remaining)[0] || null
}

/**
 * Phrasing for a pending capability, using the creator's own numbers.
 * Deliberately never says "all the data needed".
 */
export function unlockCopy(item) {
  if (!item) return null
  const unit = item.metric === 'sessions'
    ? (item.remaining === 1 ? 'completed session' : 'completed sessions')
    : (item.remaining === 1 ? 'tip' : 'tips')
  return `${item.remaining} more ${unit} unlocks ${item.label.toLowerCase()}.`
}

/**
 * A creator is never "not ready" outright — the report always renders. This
 * only distinguishes the earliest state, where the honest thing to say is
 * "this is your baseline" rather than to imply patterns exist.
 */
export function isBaseline({ tips = 0, sessions = 0 } = {}) {
  return sessions <= 1 || tips < 10
}
