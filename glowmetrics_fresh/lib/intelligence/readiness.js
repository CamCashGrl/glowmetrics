// ============================================================================
// CAMCASH INTELLIGENCE — computeIntelligence()
//
// The single evaluator. Takes the already-computed canonical analytics object
// and returns one state per insight, plus the calibration figure the Creator
// Report renders.
//
// RULES THIS FILE OBEYS:
//   1. It COMPUTES NO ANALYTICS. Every number read here comes from
//      aggregateRows() (lib/analytics.js). If a figure is not already on
//      `analytics`, this file does not invent it — same contract
//      CommandCenter.js and Fans.js already follow.
//   2. Every threshold comes from lib/intelligence/insights.js, which in turn
//      cites where in the codebase the number already existed.
//   3. Calibration is a measure of ESTABLISHED INTELLIGENCE, not of
//      "% of dashboard filled in". An insight contributes its weight in
//      proportion to how far up the ladder it has actually climbed.
//
// PHASE 1 STATUS: DEFINED, NOT WIRED. No surface calls this yet.
// ============================================================================

import {
  INSIGHT_STATE, rank, atLeast, fromConfidenceTier, fromAccountConfidence,
  promoteIfEstablished, capForComparison, CLAIMABLE_FLOOR, EVIDENCE_KIND,
} from './states'
import { INSIGHTS, INSIGHT_BY_ID, TOTAL_WEIGHT, GATE } from './insights'
import { calculateConfidence } from '../analytics'
import { RELATIVE_RANK_MIN_FANS, FAN_BEHAVIOUR_MIN_TIPS } from './fanValue'

/** Fraction of an insight's weight earned at each state. */
const STATE_CREDIT = {
  [INSIGHT_STATE.NOT_AVAILABLE]: 0,
  [INSIGHT_STATE.CALIBRATING]: 0.1,
  [INSIGHT_STATE.EARLY_SIGNAL]: 0.3,
  [INSIGHT_STATE.DEVELOPING]: 0.55,
  [INSIGHT_STATE.SUPPORTED]: 0.8,
  [INSIGHT_STATE.HIGH_CONFIDENCE]: 0.95,
  [INSIGHT_STATE.ESTABLISHED]: 1,
}

const entry = (state, observations, required, extra = {}) => ({
  state,
  observations,
  required,
  comparedAlternatives: 0,
  ...extra,
})

/** "N more X" phrasing, or null when the requirement is already met. */
function nextStep(observations, required, unit) {
  if (required == null) return null
  const remaining = Math.max(0, required - observations)
  if (remaining <= 0) return null
  // `have`/`need`/`pct` are ADDITIVE — they expose the same two numbers the
  // remaining count is already derived from, so the Creator Report can draw an
  // honest progress bar instead of inventing a denominator. No threshold is
  // introduced or changed here: `required` is the caller's existing one.
  return {
    remaining,
    unit,
    label: `${remaining} more ${unit}`,
    have: observations,
    need: required,
    pct: required > 0 ? Math.min(100, Math.round((observations / required) * 100)) : 0,
  }
}

/**
 * @param {Object} args
 * @param {Object} args.analytics - aggregateRows() output
 * @param {Object} [args.profile] - profiles row (plan, primary_platform)
 * @param {Date}   [args.now]
 * @returns {{ insights: Object, calibration: Object, evidence: Object }}
 */
export function computeIntelligence({ analytics, profile = null, now = new Date() } = {}) {
  const a = analytics || {}
  const grid = a.canonicalBestTimes?.grid || []
  const bestWindow = a.canonicalBestTimes?.bestWindow || null
  const earlySignal = a.canonicalBestTimes?.earlySignal || null
  const meaningful = a.meaningfulSessions || []
  const sessionCount = a.meaningfulSessionCount ?? meaningful.length
  const fans = a.whales || []
  const uniqueFanCount = a.uniqueFanCount ?? fans.length
  const streamedHours = (a.totalStreamMinutes || 0) / 60
  const out = {}

  // ── FACTS ────────────────────────────────────────────────────────────────
  out.earnings_total = entry(
    a.totalTips > 0 ? INSIGHT_STATE.ESTABLISHED : INSIGHT_STATE.NOT_AVAILABLE,
    a.totalTips || 0, 1,
    { explanation: `${a.totalTips || 0} tips imported.` }
  )

  out.session_history = entry(
    sessionCount >= 3 ? INSIGHT_STATE.ESTABLISHED
      : sessionCount > 0 ? INSIGHT_STATE.DEVELOPING
      : INSIGHT_STATE.NOT_AVAILABLE,
    sessionCount, 3,
    { explanation: `${sessionCount} meaningful session${sessionCount === 1 ? '' : 's'} detected.` }
  )

  out.fan_roster = entry(
    uniqueFanCount > 0 ? INSIGHT_STATE.ESTABLISHED : INSIGHT_STATE.NOT_AVAILABLE,
    uniqueFanCount, 1,
    { explanation: `${uniqueFanCount} unique fan${uniqueFanCount === 1 ? '' : 's'} identified.` }
  )

  // ── PEAK WINDOW ──────────────────────────────────────────────────────────
  // The comparison rule lives here. A window is only a BEST window if other
  // windows had enough evidence to lose to it.
  {
    const winner = bestWindow || earlySignal
    const winnerKey = winner ? `${winner.localDay}-${winner.localHour}` : null
    const comparable = grid.filter(g =>
      g.sessionCount >= 2 && `${g.localDay}-${g.localHour}` !== winnerKey
    )
    const distinctDays = new Set(grid.filter(g => g.sessionCount >= 2).map(g => g.localDay)).size
    const observations = winner?.sessionCount || 0

    let state = winner ? fromConfidenceTier(winner.tier) : INSIGHT_STATE.NOT_AVAILABLE
    if (!winner && grid.length > 0) state = INSIGHT_STATE.CALIBRATING
    state = capForComparison(state, comparable.length)

    const spanDays = sessionSpanDays(meaningful)
    state = promoteIfEstablished(state, {
      comparedAlternatives: comparable.length,
      spanDays,
    })

    const required = observations >= 6 ? null : observations >= 4 ? 6 : 4
    out.peak_window = entry(state, observations, required, {
      comparedAlternatives: comparable.length,
      distinctDaysCompared: distinctDays,
      spanDays,
      explanation: !winner
        ? 'No window has two sessions in it yet.'
        : comparable.length === 0
          ? `${observations} session${observations === 1 ? '' : 's'} in ${winner.localDay} ${winner.localHour}:00 — but no other window has enough sessions to compare against yet.`
          : `${observations} sessions in ${winner.localDay} ${winner.localHour}:00, compared against ${comparable.length} other window${comparable.length === 1 ? '' : 's'}.`,
      nextMilestone: comparable.length === 0
        ? { remaining: 2, unit: 'sessions in a different window', label: 'Stream a different slot twice so CamCash has something to compare' }
        : nextStep(observations, required, 'sessions in this window'),
      claimable: atLeast(state, CLAIMABLE_FLOOR),
    })
  }

  // ── PEAK DAY ─────────────────────────────────────────────────────────────
  {
    const byDay = {}
    for (const g of grid) byDay[g.localDay] = (byDay[g.localDay] || 0) + g.sessionCount
    const days = Object.entries(byDay).sort((x, y) => y[1] - x[1])
    const top = days[0]
    const qualifying = days.filter(([, n]) => n >= 3)
    const observations = top ? top[1] : 0
    let state = observations >= 6 ? INSIGHT_STATE.HIGH_CONFIDENCE
      : observations >= 3 ? INSIGHT_STATE.SUPPORTED
      : observations >= 2 ? INSIGHT_STATE.EARLY_SIGNAL
      : observations > 0 ? INSIGHT_STATE.CALIBRATING
      : INSIGHT_STATE.NOT_AVAILABLE
    state = capForComparison(state, Math.max(0, qualifying.length - 1))
    out.peak_day = entry(state, observations, 3, {
      comparedAlternatives: Math.max(0, qualifying.length - 1),
      explanation: top
        ? `${observations} session${observations === 1 ? '' : 's'} on ${top[0]}, across ${days.length} day${days.length === 1 ? '' : 's'} streamed.`
        : 'No sessions with a resolvable day yet.',
      nextMilestone: nextStep(observations, 3, `sessions on ${top ? top[0] : 'one weekday'}`),
      claimable: atLeast(state, CLAIMABLE_FLOOR),
    })
  }

  // ── HOURLY RATE ──────────────────────────────────────────────────────────
  {
    const conf = calculateConfidence(a.hourlyRateSessionCount ?? sessionCount, streamedHours)
    let state = fromAccountConfidence(conf.level)
    state = promoteIfEstablished(state, {
      comparedAlternatives: 2, // not a comparative insight; time is the gate
      spanDays: sessionSpanDays(meaningful),
    })
    const observations = a.hourlyRateSessionCount ?? sessionCount
    out.hourly_rate = entry(state, observations, 10, {
      streamedHours: parseFloat(streamedHours.toFixed(1)),
      explanation: `${observations} session${observations === 1 ? '' : 's'} and ${streamedHours.toFixed(1)} tracked hour${streamedHours === 1 ? '' : 's'} — ${conf.label.toLowerCase()}.`,
      nextMilestone: nextStep(observations, 10, 'sessions'),
      claimable: atLeast(state, CLAIMABLE_FLOOR),
    })
  }

  // ── SESSION LENGTH ───────────────────────────────────────────────────────
  {
    const timed = meaningful.filter(s => !s.durationUnknown)
    const long = timed.filter(s => s.durationMinutes >= 120).length
    const short = timed.filter(s => s.durationMinutes < 120).length
    const observations = Math.min(long, short)
    const state = observations >= 6 ? INSIGHT_STATE.HIGH_CONFIDENCE
      : observations >= 3 ? INSIGHT_STATE.SUPPORTED
      : observations >= 1 ? INSIGHT_STATE.EARLY_SIGNAL
      : timed.length > 0 ? INSIGHT_STATE.CALIBRATING
      : INSIGHT_STATE.NOT_AVAILABLE
    out.session_length = entry(state, observations, 3, {
      comparedAlternatives: observations > 0 ? 1 : 0,
      explanation: `${long} longer and ${short} shorter session${short === 1 ? '' : 's'} to compare.`,
      nextMilestone: nextStep(observations, 3, 'sessions of each length'),
      claimable: atLeast(state, CLAIMABLE_FLOOR),
    })
  }

  // ── PLATFORM ─────────────────────────────────────────────────────────────
  const platformSessionCounts = {}
  for (const s of meaningful) {
    if (!s.platform) continue
    platformSessionCounts[s.platform] = (platformSessionCounts[s.platform] || 0) + 1
  }
  const qualifyingPlatforms = Object.entries(platformSessionCounts).filter(([, n]) => n >= 3)

  {
    const topCount = Object.values(platformSessionCounts).sort((x, y) => y - x)[0] || 0
    let state = topCount >= 6 ? INSIGHT_STATE.HIGH_CONFIDENCE
      : topCount >= 3 ? INSIGHT_STATE.SUPPORTED
      : topCount >= 1 ? INSIGHT_STATE.EARLY_SIGNAL
      : INSIGHT_STATE.NOT_AVAILABLE
    // Ranking platforms is comparative; one platform cannot be "most profitable".
    state = capForComparison(state, Math.max(0, qualifyingPlatforms.length - 1))
    out.platform_profitability = entry(state, topCount, 3, {
      comparedAlternatives: Math.max(0, qualifyingPlatforms.length - 1),
      explanation: `${qualifyingPlatforms.length} platform${qualifyingPlatforms.length === 1 ? '' : 's'} with 3+ meaningful sessions.`,
      nextMilestone: nextStep(topCount, 3, 'meaningful sessions on this platform'),
      claimable: atLeast(state, CLAIMABLE_FLOOR),
    })
  }

  {
    const n = qualifyingPlatforms.length
    const state = n >= 3 ? INSIGHT_STATE.HIGH_CONFIDENCE
      : n === 2 ? INSIGHT_STATE.SUPPORTED
      : Object.keys(platformSessionCounts).length >= 2 ? INSIGHT_STATE.EARLY_SIGNAL
      : INSIGHT_STATE.NOT_AVAILABLE
    out.cross_platform = entry(state, n, 2, {
      comparedAlternatives: Math.max(0, n - 1),
      explanation: n >= 2
        ? `${n} platforms have enough sessions to compare.`
        : 'Only one platform has enough sessions to measure so far.',
      nextMilestone: nextStep(n, 2, 'platforms with 3+ sessions'),
      claimable: atLeast(state, CLAIMABLE_FLOOR),
    })
  }

  // ── OPPORTUNITY ──────────────────────────────────────────────────────────
  {
    const gaps = Object.keys(a.missedRevenue?.cumulative_by_platform || {}).length
    const state = gaps >= 2 ? INSIGHT_STATE.SUPPORTED
      : gaps === 1 ? INSIGHT_STATE.DEVELOPING
      : qualifyingPlatforms.length > 0 ? INSIGHT_STATE.CALIBRATING
      : INSIGHT_STATE.NOT_AVAILABLE
    out.revenue_opportunity = entry(state, gaps, 1, {
      explanation: gaps > 0
        ? `${gaps} platform${gaps === 1 ? '' : 's'} where your best window out-earns your typical hour.`
        : 'No measurable rate gap between your best window and your typical hour yet.',
      // Wording rule: a potential opportunity, never a dollar amount "lost".
      phrasing: 'potential opportunity',
      claimable: atLeast(state, CLAIMABLE_FLOOR),
    })
  }

  {
    const peakOk = atLeast(out.peak_window.state, CLAIMABLE_FLOOR)
    const hits = [a.missedRevenue?.today_missed, a.missedRevenue?.recent_streak_missed].filter(Boolean).length
    const state = !peakOk ? INSIGHT_STATE.NOT_AVAILABLE
      : hits > 0 ? INSIGHT_STATE.SUPPORTED
      : INSIGHT_STATE.DEVELOPING
    out.missed_peak = entry(state, hits, 1, {
      explanation: peakOk
        ? `Your peak window is established, so CamCash can tell when you miss it.`
        : 'Needs an established peak window first.',
      phrasing: 'potential opportunity',
      claimable: atLeast(state, CLAIMABLE_FLOOR),
    })
  }

  // ── FANS ─────────────────────────────────────────────────────────────────
  out.top_supporters = entry(
    uniqueFanCount >= 25 ? INSIGHT_STATE.HIGH_CONFIDENCE
      : uniqueFanCount >= RELATIVE_RANK_MIN_FANS ? INSIGHT_STATE.SUPPORTED
      : uniqueFanCount >= 3 ? INSIGHT_STATE.EARLY_SIGNAL
      : uniqueFanCount > 0 ? INSIGHT_STATE.CALIBRATING
      : INSIGHT_STATE.NOT_AVAILABLE,
    uniqueFanCount, RELATIVE_RANK_MIN_FANS,
    {
      explanation: uniqueFanCount >= RELATIVE_RANK_MIN_FANS
        ? `${uniqueFanCount} fans — enough of an audience to rank within.`
        : `${uniqueFanCount} fan${uniqueFanCount === 1 ? '' : 's'} so far. Ranking needs ${RELATIVE_RANK_MIN_FANS}+ to mean anything.`,
      nextMilestone: nextStep(uniqueFanCount, RELATIVE_RANK_MIN_FANS, 'fans'),
    }
  )

  const readableFans = fans.filter(f => (f.tipCount || 0) >= FAN_BEHAVIOUR_MIN_TIPS)
  out.fan_behaviour = entry(
    readableFans.length >= 10 ? INSIGHT_STATE.HIGH_CONFIDENCE
      : readableFans.length >= 5 ? INSIGHT_STATE.SUPPORTED
      : readableFans.length >= 1 ? INSIGHT_STATE.EARLY_SIGNAL
      : uniqueFanCount > 0 ? INSIGHT_STATE.CALIBRATING
      : INSIGHT_STATE.NOT_AVAILABLE,
    readableFans.length, 5,
    {
      explanation: `${readableFans.length} fan${readableFans.length === 1 ? '' : 's'} have tipped ${FAN_BEHAVIOUR_MIN_TIPS}+ times — enough to read a pattern.`,
      nextMilestone: nextStep(readableFans.length, 5, 'repeat fans'),
    }
  )

  out.churn_risk = entry(
    readableFans.length >= 10 ? INSIGHT_STATE.SUPPORTED
      : readableFans.length >= 3 ? INSIGHT_STATE.DEVELOPING
      : readableFans.length >= 1 ? INSIGHT_STATE.EARLY_SIGNAL
      : INSIGHT_STATE.NOT_AVAILABLE,
    readableFans.length, 10,
    {
      explanation: `Churn is read against each fan's own cadence; ${readableFans.length} fan${readableFans.length === 1 ? ' has' : 's have'} a readable one.`,
      // Every churn claim must be shown with the absolute observation beside it.
      pairWith: 'lastSeenAndCadence',
      nextMilestone: nextStep(readableFans.length, 10, 'repeat fans'),
    }
  )

  {
    // Uses the canonical definition's inputs WITHOUT changing any live label —
    // this is a count for the intelligence ladder only (see fanValue.js).
    const confirmed = fans.filter(f => (f.totalUSD || 0) >= 100 && (f.tipCount || 0) >= 10).length
    const candidates = fans.filter(f => (f.totalUSD || 0) >= 100 && (f.tipCount || 0) < 10).length
    out.whale_pattern = entry(
      confirmed >= 3 ? INSIGHT_STATE.SUPPORTED
        : confirmed >= 1 ? INSIGHT_STATE.DEVELOPING
        : candidates >= 1 ? INSIGHT_STATE.EARLY_SIGNAL
        : uniqueFanCount > 0 ? INSIGHT_STATE.CALIBRATING
        : INSIGHT_STATE.NOT_AVAILABLE,
      confirmed, 1,
      {
        candidates,
        explanation: confirmed > 0
          ? `${confirmed} fan${confirmed === 1 ? '' : 's'} with both high lifetime value and repeat tipping.`
          : candidates > 0
            ? `${candidates} high-value fan${candidates === 1 ? '' : 's'} without enough repeat tips to confirm the pattern yet.`
            : 'No high-value fans yet.',
      }
    )
  }

  out.dependency_risk = entry(
    a.dependencyRisk ? INSIGHT_STATE.SUPPORTED
      : uniqueFanCount > 0 ? INSIGHT_STATE.CALIBRATING
      : INSIGHT_STATE.NOT_AVAILABLE,
    uniqueFanCount, 5,
    {
      explanation: a.dependencyRisk
        ? 'Enough fans to measure how concentrated your revenue is.'
        : `Needs 5+ fans before concentration percentages mean anything.`,
      nextMilestone: nextStep(uniqueFanCount, 5, 'fans'),
    }
  )

  // ── TREND & FORECAST ─────────────────────────────────────────────────────
  {
    const months = (a.monthlyData || []).length
    out.growth_trend = entry(
      months >= 6 ? INSIGHT_STATE.HIGH_CONFIDENCE
        : months >= 3 ? INSIGHT_STATE.SUPPORTED
        : months === 2 ? INSIGHT_STATE.DEVELOPING
        : months === 1 ? INSIGHT_STATE.CALIBRATING
        : INSIGHT_STATE.NOT_AVAILABLE,
      months, 3,
      {
        comparedAlternatives: Math.max(0, months - 1),
        explanation: `${months} month${months === 1 ? '' : 's'} of history to compare.`,
        nextMilestone: nextStep(months, 3, 'months of history'),
      }
    )
  }

  {
    const t = a.predictions?.tonightStream
    out.forecast = entry(
      t ? (t.confidence === 'High' ? INSIGHT_STATE.SUPPORTED : INSIGHT_STATE.DEVELOPING)
        : sessionCount > 0 ? INSIGHT_STATE.CALIBRATING
        : INSIGHT_STATE.NOT_AVAILABLE,
      sessionCount, 8,
      {
        explanation: t
          ? 'Enough same-weekday sessions to project tonight as a range.'
          : 'Needs 3+ sessions on the same weekday before a range can be projected.',
        // A prediction: shown as a range, never as a single confident figure.
        phrasing: 'range',
      }
    )
  }

  // ── COMPOSITES ───────────────────────────────────────────────────────────
  {
    const recommendable = grid.filter(g => g.tier === 'supported' || g.tier === 'high').length
    const ready = atLeast(out.peak_window.state, CLAIMABLE_FLOOR)
      && recommendable >= 2
      && atLeast(out.hourly_rate.state, INSIGHT_STATE.DEVELOPING)
    out.plan_readiness = entry(
      ready ? INSIGHT_STATE.SUPPORTED
        : recommendable >= 1 ? INSIGHT_STATE.DEVELOPING
        : sessionCount > 0 ? INSIGHT_STATE.CALIBRATING
        : INSIGHT_STATE.NOT_AVAILABLE,
      recommendable, 2,
      {
        explanation: `${recommendable} window${recommendable === 1 ? '' : 's'} have enough sessions to be recommended.`,
        nextMilestone: nextStep(recommendable, 2, 'reliable windows'),
      }
    )
  }

  {
    const tips = a.totalTips || 0
    const ready = tips >= 50 && sessionCount >= 5
    out.money_map = entry(
      ready ? INSIGHT_STATE.SUPPORTED
        : tips > 0 ? INSIGHT_STATE.DEVELOPING
        : INSIGHT_STATE.NOT_AVAILABLE,
      tips, 50,
      {
        explanation: ready
          ? 'Enough history to trace where the money comes from.'
          : `${tips} of 50 tips and ${sessionCount} of 5 sessions.`,
        nextMilestone: nextStep(tips, 50, 'tips'),
      }
    )
  }

  // ── CALIBRATION ──────────────────────────────────────────────────────────
  let earned = 0
  for (const def of INSIGHTS) {
    const e = out[def.id]
    earned += def.weight * (STATE_CREDIT[e?.state] ?? 0)
  }
  const pct = Math.round((earned / TOTAL_WEIGHT) * 100)

  const established = INSIGHTS.filter(d => atLeast(out[d.id]?.state, CLAIMABLE_FLOOR))
  const building = INSIGHTS.filter(d =>
    !atLeast(out[d.id]?.state, CLAIMABLE_FLOOR)
    && rank(out[d.id]?.state) > rank(INSIGHT_STATE.NOT_AVAILABLE)
  )

  return {
    insights: out,
    calibration: {
      pct,
      establishedCount: established.length,
      buildingCount: building.length,
      totalCount: INSIGHTS.length,
      /** Countable evidence, for the Creator Report header. */
      evidence: {
        sessionsAnalyzed: sessionCount,
        tipsAnalyzed: a.totalTips || 0,
        fansIdentified: uniqueFanCount,
        windowsCompared: grid.filter(g => g.sessionCount >= 2).length,
        platformsQualifying: qualifyingPlatforms.length,
        streamedHours: parseFloat(streamedHours.toFixed(1)),
        spanDays: sessionSpanDays(meaningful),
      },
      /** What would most improve calibration next, highest weight first. */
      nextBestEvidence: INSIGHTS
        .filter(d => out[d.id]?.nextMilestone)
        .sort((x, y) =>
          (y.weight * (1 - (STATE_CREDIT[out[y.id]?.state] ?? 0))) -
          (x.weight * (1 - (STATE_CREDIT[out[x.id]?.state] ?? 0)))
        )
        .slice(0, 3)
        // insightLabel is the INSIGHT's name ("Peak earning window");
        // label/remaining/unit come from nextMilestone and describe the ACTION
        // ("2 more sessions in this window"). Kept under distinct keys because
        // spreading nextMilestone over a `label` key silently clobbered the
        // insight name, leaving callers unable to say what the evidence is for.
        .map(d => ({ id: d.id, insightLabel: d.label, ...out[d.id].nextMilestone })),
    },
    gates: Object.fromEntries(INSIGHTS.map(d => [d.id, d.gate])),
    computedAt: now.toISOString(),
  }
}

/** Calendar days between the first and last meaningful session. */
function sessionSpanDays(sessions) {
  if (!sessions || sessions.length < 2) return 0
  let min = Infinity, max = -Infinity
  for (const s of sessions) {
    const t = new Date(s.startTime).getTime()
    if (!Number.isFinite(t)) continue
    if (t < min) min = t
    if (t > max) max = t
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 0
  return Math.round((max - min) / 86400000)
}

/**
 * Snapshot for storage in profiles.last_seen_intelligence — just the states,
 * so a later import can diff against it without storing the whole payload.
 */
export function snapshot(intelligence) {
  const out = {}
  for (const [id, e] of Object.entries(intelligence?.insights || {})) out[id] = e.state
  const ev = intelligence?.calibration?.evidence || {}
  return {
    states: out,
    pct: intelligence?.calibration?.pct ?? 0,
    // The countable evidence behind the states, so the next import can report
    // what it actually ADDED ("+14 sessions analysed") rather than estimating.
    // Same figures the Creator Report header shows — not a second measurement.
    evidence: {
      sessionsAnalyzed: ev.sessionsAnalyzed ?? 0,
      tipsAnalyzed: ev.tipsAnalyzed ?? 0,
      fansIdentified: ev.fansIdentified ?? 0,
      windowsCompared: ev.windowsCompared ?? 0,
      platformsQualifying: ev.platformsQualifying ?? 0,
      streamedHours: ev.streamedHours ?? 0,
    },
  }
}

/**
 * What changed between two snapshots — the input to the post-import
 * "your report just got smarter" moment.
 */
export function diffSnapshots(prev, next) {
  const before = prev?.states || {}
  const after = next?.states || {}
  const improved = []
  for (const [id, state] of Object.entries(after)) {
    const was = before[id] || INSIGHT_STATE.NOT_AVAILABLE
    if (rank(state) > rank(was)) {
      const def = INSIGHT_BY_ID[id]
      const newlyClaimable = atLeast(state, CLAIMABLE_FLOOR) && !atLeast(was, CLAIMABLE_FLOOR)
      improved.push({
        id,
        label: def?.label || id,
        kind: def?.kind || null,
        from: was,
        to: state,
        newlyClaimable,
        // A DISCOVERY is a pattern or prediction crossing the claimable floor —
        // something CamCash now knows that it did not before. A FACT crossing
        // the same floor is bookkeeping ("sessions detected"), not a finding,
        // and must never trigger the "New insight unlocked" moment. Without
        // this, importing any file at all would celebrate.
        isDiscovery: newlyClaimable && def?.kind !== EVIDENCE_KIND.FACT,
      })
    }
  }
  // Evidence deltas. Only reported when BOTH snapshots carry the counter —
  // a baseline written before evidence was stored cannot be differenced, and
  // an estimate would be worse than saying nothing. Only positive deltas are
  // returned: an import adds data, it never removes it, so a negative here
  // would mean something else changed and must not be presented as a gain.
  const evBefore = prev?.evidence || null
  const evAfter = next?.evidence || null
  const evidenceDelta = {}
  if (evBefore && evAfter) {
    for (const key of Object.keys(evAfter)) {
      if (typeof evBefore[key] !== 'number' || typeof evAfter[key] !== 'number') continue
      const delta = parseFloat((evAfter[key] - evBefore[key]).toFixed(1))
      if (delta > 0) evidenceDelta[key] = { before: evBefore[key], after: evAfter[key], delta }
    }
  }

  return {
    improved,
    pctBefore: prev?.pct ?? 0,
    pctAfter: next?.pct ?? 0,
    pctDelta: (next?.pct ?? 0) - (prev?.pct ?? 0),
    evidenceDelta,
    /** True when the import moved nothing measurable — say so honestly. */
    isQuiet: improved.length === 0 && Object.keys(evidenceDelta).length === 0,
  }
}
