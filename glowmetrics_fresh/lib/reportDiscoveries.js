// ============================================================================
// CREATOR REPORT — DISCOVERY ASSEMBLY
//
// Turns the canonical analytics + intelligence objects into the ordered list
// of discoveries the Creator Report narrates. It is a MAPPER, not an engine:
//
//   - it computes no metric, no rate, no threshold and no confidence
//   - every figure is read from aggregateRows() / computeIntelligence()
//   - every claim is gated on the canonical ladder, never on a local rule
//   - a discovery whose canonical data is absent is simply not in the list
//
// Ordering is by evidence strength, then by the fixed priority the report's
// narrative needs (timing first, then rate, then comparison, then fans), so a
// creator reads her strongest finding first rather than a fixed template.
//
// WORDING RULES THIS FILE OBEYS
//   FACTs (what was recorded) and PATTERNS (what was inferred) are tagged
//   separately, so the report can present them differently and never dress a
//   count up as an insight. Every `meaning` string describes recorded history
//   in the past tense. Nothing here may say a creator will earn, is likely to,
//   or should expect anything — verify-creator-report.mjs asserts it.
// ============================================================================

import { atLeast, rank, CLAIMABLE_FLOOR, INSIGHT_STATE } from './intelligence/states'

const fmtHour = (h) => {
  const hh = ((Number(h) % 24) + 24) % 24
  return hh === 0 ? '12 AM' : hh < 12 ? `${hh} AM` : hh === 12 ? '12 PM' : `${hh - 12} PM`
}
const fmtUsd0 = (v) => `$${Math.round(Number(v) || 0).toLocaleString('en-US')}`
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

/** Fixed narrative order, used to break ties between equally-strong states. */
const NARRATIVE_ORDER = ['peak_window', 'peak_day', 'hourly_rate', 'cross_platform', 'fan_behaviour']

/**
 * @param {Object} args
 * @param {Object} args.analytics     - aggregateRows() output
 * @param {Object} [args.intelligence]- computeIntelligence() output
 * @returns {Array<Object>} ordered discoveries; [] when nothing is measurable
 */
export function buildReportDiscoveries({ analytics, intelligence } = {}) {
  const a = analytics || {}
  const insightOf = (id) => intelligence?.insights?.[id] || null
  const stateOf = (id) => insightOf(id)?.state || INSIGHT_STATE.NOT_AVAILABLE
  const claimable = (id) => atLeast(stateOf(id), CLAIMABLE_FLOOR)

  const bestWindow = a.canonicalBestTimes?.bestWindow || null
  const earlySignal = a.canonicalBestTimes?.earlySignal || null
  const overlap = a.bestWindowFanOverlap || null
  const rankable = a.rankablePlatforms || []

  const out = []

  // ── PEAK STREAMING WINDOW ────────────────────────────────────────────────
  {
    const e = insightOf('peak_window')
    const shown = claimable('peak_window') ? bestWindow : earlySignal
    if (e && shown) {
      const ok = claimable('peak_window')
      out.push({
        id: 'peak_window',
        insightId: 'peak_window',
        kind: 'PATTERN',
        eyebrow: ok ? 'Your peak streaming window' : 'Your strongest window so far',
        title: `${shown.localDay}s · ${fmtHour(shown.localHour)}–${fmtHour(shown.localHour + 2)}`,
        evidence: [
          { label: 'Sessions in this window', value: String(shown.sessionCount ?? 0) },
          { label: 'Windows compared', value: String(e.comparedAlternatives ?? 0) },
          { label: 'Median rate', value: `$${shown.medianUsdPerHour}/hr` },
          ...(shown.totalUsd > 0 ? [{ label: 'Earned in it so far', value: fmtUsd0(shown.totalUsd) }] : []),
        ],
        meaning: ok
          ? `Across your recorded sessions, ${shown.localDay}s at this hour have produced your highest median hourly rate. It is the pattern your history shows, not a prediction about a future stream.`
          : `${shown.localDay}s at this hour are ahead so far, but not by enough sessions to call it your peak yet.`,
        claimable: ok,
        nextMilestone: ok ? null : e.nextMilestone?.label || null,
        action: ok ? { label: 'Build a weekly plan around it', source: 'stream_planner' } : null,
      })
    }
  }

  // ── BEST DAY ─────────────────────────────────────────────────────────────
  {
    const e = insightOf('peak_day')
    if (e && bestWindow?.localDay && rank(e.state) > rank(INSIGHT_STATE.NOT_AVAILABLE)) {
      const ok = claimable('peak_day')
      out.push({
        id: 'peak_day',
        insightId: 'peak_day',
        kind: 'PATTERN',
        eyebrow: ok ? 'Your strongest day' : 'Your day pattern',
        title: `${bestWindow.localDay}s`,
        evidence: [
          { label: 'Sessions on this day', value: String(e.observations ?? 0) },
          { label: 'Days compared', value: String(e.comparedAlternatives ?? 0) },
        ],
        meaning: ok
          ? `${bestWindow.localDay} carries more of your recorded streaming than any other weekday, across enough days to compare against.`
          : `${bestWindow.localDay} is ahead so far, but the other weekdays do not yet have enough sessions to compare against.`,
        claimable: ok,
        nextMilestone: ok ? null : e.nextMilestone?.label || null,
        action: null,
      })
    }
  }

  // ── HOURLY RATE ──────────────────────────────────────────────────────────
  {
    const e = insightOf('hourly_rate')
    const rate = a.estimatedHourlyRate || 0
    if (e && rate > 0 && rank(e.state) > rank(INSIGHT_STATE.NOT_AVAILABLE)) {
      const ok = claimable('hourly_rate')
      out.push({
        id: 'hourly_rate',
        insightId: 'hourly_rate',
        kind: 'PATTERN',
        eyebrow: 'What an hour of streaming has been worth',
        title: `$${rate.toFixed(2)}/hr`,
        evidence: [
          { label: 'Eligible sessions', value: String(a.hourlyRateSessionCount ?? e.observations ?? 0) },
          { label: 'Tracked hours', value: `${e.streamedHours ?? 0}h` },
        ],
        meaning: ok
          ? 'This is what your tracked streaming time has actually returned per hour, weighted across every rate-eligible session.'
          : 'This is what your tracked time has returned so far, on a sample still too thin to rely on.',
        claimable: ok,
        nextMilestone: ok ? null : e.nextMilestone?.label || null,
        action: null,
      })
    }
  }

  // ── PLATFORM COMPARISON ──────────────────────────────────────────────────
  {
    const e = insightOf('cross_platform')
    if (e && rankable.length >= 2) {
      const [lead, runnerUp] = rankable
      const ok = claimable('cross_platform')
      out.push({
        id: 'cross_platform',
        insightId: 'cross_platform',
        kind: 'PATTERN',
        eyebrow: 'How your platforms compare',
        title: `${lead.platform} vs ${runnerUp.platform}`,
        evidence: [
          { label: lead.platform, value: `$${lead.medianUsdPerHour}/hr · ${plural(lead.sessions, 'session', 'sessions')}` },
          { label: runnerUp.platform, value: `$${runnerUp.medianUsdPerHour}/hr · ${plural(runnerUp.sessions, 'session', 'sessions')}` },
        ],
        meaning: `Your recorded sessions show a stronger observed hourly rate on ${lead.platform} than on ${runnerUp.platform}. That is a difference in what has already happened, not a projection.`,
        claimable: ok,
        nextMilestone: ok ? null : e.nextMilestone?.label || null,
        action: ok ? { label: 'Compare them in detail', source: 'platform_comparison' } : null,
      })
    }
  }

  // ── FAN OVERLAP ──────────────────────────────────────────────────────────
  {
    const e = insightOf('fan_behaviour')
    if (e && bestWindow && overlap?.count > 0) {
      const ok = claimable('fan_behaviour')
      const top = overlap.topSupporterCount || 0
      out.push({
        id: 'fan_overlap',
        insightId: 'fan_behaviour',
        kind: 'PATTERN',
        eyebrow: 'Who shows up in that window',
        title: `${plural(overlap.count, 'repeat fan', 'repeat fans')}`,
        evidence: [
          { label: 'Repeat fans in the window', value: String(overlap.count) },
          { label: 'Of those, Top Supporters', value: String(top) },
          ...(overlap.totalUSD > 0 ? [{ label: 'Their combined lifetime value', value: fmtUsd0(overlap.totalUSD) }] : []),
        ],
        meaning: top > 0
          ? `${plural(overlap.count, 'repeat fan has', 'repeat fans have')} tipped during that window, and ${top} of them ${top === 1 ? 'is' : 'are'} among your Top Supporters. Counted from tips already recorded — it does not mean they are online then or that they will tip again.`
          : `${plural(overlap.count, 'repeat fan has', 'repeat fans have')} tipped during that window. Counted from tips already recorded — it does not mean they are online then or that they will tip again.`,
        claimable: ok,
        nextMilestone: ok ? null : e.nextMilestone?.label || null,
        action: ok ? { label: 'See who they are', source: 'window_fan_overlap' } : null,
      })
    }
  }

  // Strongest evidence first; the narrative order breaks ties.
  return out.sort((x, y) => {
    const byState = rank(stateOf(y.insightId)) - rank(stateOf(x.insightId))
    if (byState !== 0) return byState
    return NARRATIVE_ORDER.indexOf(x.id === 'fan_overlap' ? 'fan_behaviour' : x.id)
         - NARRATIVE_ORDER.indexOf(y.id === 'fan_overlap' ? 'fan_behaviour' : y.id)
  })
}

/**
 * The report's factual header line: what CamCash actually read.
 * Counts only — nothing here is an inference.
 */
export function buildReportFacts({ analytics, tips = [] } = {}) {
  const a = analytics || {}
  const dates = tips
    .map(t => new Date(t.date_time || t.dateRaw))
    .filter(d => !Number.isNaN(d.getTime()))
    .sort((x, y) => x - y)
  return {
    tips: a.totalTips ?? tips.length,
    sessions: a.meaningfulSessionCount ?? 0,
    fans: a.uniqueFanCount ?? 0,
    hours: Math.round(((a.totalStreamMinutes || 0) / 60) * 10) / 10,
    earnings: a.totalUSD || 0,
    from: dates[0] || null,
    to: dates[dates.length - 1] || null,
  }
}

/** The actions worth offering, derived only from claimable discoveries. */
export function buildReportActions(discoveries = []) {
  return discoveries.filter(d => d.claimable && d.action).map(d => ({
    ...d.action,
    insightId: d.insightId,
    because: d.title,
  }))
}
