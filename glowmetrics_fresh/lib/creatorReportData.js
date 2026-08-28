// ═══════════════════════════════════════════════════════════════════════════
// CREATOR REPORT DATA — the reflective view over the canonical analytics.
//
// The Command Center answers "what should I do now?". The report answers
// "what have I learned about my business?". Same engine, different question:
// the Command Center reads the live edge of the data, the report reads the
// shape of it over a period.
//
// THIS FILE COMPUTES NO METRIC. Every figure is read from aggregateRows()
// output. The only arithmetic here is period-over-period comparison — the
// difference between two canonical totals — and turning a canonical number
// into a sentence. No threshold, rate, multiplier or ranking is defined here.
//
// Period filtering re-runs the SAME engine over a date-bounded slice of the
// same rows, so "last 30 days" cannot disagree with "all time" about what a
// session, a meaningful session or an hourly rate is.
// ═══════════════════════════════════════════════════════════════════════════

export const REPORT_PERIODS = [
  { id: '7d',  label: '7 Days',   days: 7 },
  { id: '30d', label: '30 Days',  days: 30 },
  { id: '90d', label: '90 Days',  days: 90 },
  { id: 'all', label: 'All Time', days: null },
]

const tipTime = (t) => new Date(t.dateRaw || t.date_time || t.received_at).getTime()

/** Rows inside a period, and the equally-long period before it. */
export function splitByPeriod(tips = [], days, now = Date.now()) {
  if (!days) return { current: tips, previous: [] }
  const start = now - days * 86400000
  const prevStart = start - days * 86400000
  const current = [], previous = []
  for (const t of tips) {
    const ts = tipTime(t)
    if (Number.isNaN(ts)) continue
    if (ts >= start) current.push(t)
    else if (ts >= prevStart) previous.push(t)
  }
  return { current, previous }
}

/** Percentage change between two canonical totals. Null when not comparable. */
export function changePct(now, before) {
  if (!before || before <= 0 || now == null) return null
  return Math.round(((now - before) / before) * 100)
}

const fmtUsd0 = (n) => `$${Math.round(Number(n || 0)).toLocaleString('en-US')}`
const fmtUsd2 = (n) => `$${Number(n || 0).toFixed(2)}`
const fmtHour = (h) => {
  if (h == null) return null
  const H = ((h % 24) + 24) % 24
  return H === 0 ? '12 AM' : H < 12 ? `${H} AM` : H === 12 ? '12 PM' : `${H - 12} PM`
}

/** The four headline metrics, each with its comparison where one exists. */
export function buildKpis(a, prev) {
  return [
    { id: 'revenue',  label: 'Revenue',       value: fmtUsd0(a?.totalUSD),
      delta: changePct(a?.totalUSD, prev?.totalUSD) },
    { id: 'rate',     label: 'Earnings Rate', value: `${fmtUsd2(a?.estimatedHourlyRate)}/hr`,
      delta: changePct(a?.estimatedHourlyRate, prev?.estimatedHourlyRate) },
    { id: 'fans',     label: 'Fans',          value: Number(a?.uniqueFanCount || 0).toLocaleString('en-US'),
      delta: changePct(a?.uniqueFanCount, prev?.uniqueFanCount) },
    { id: 'sessions', label: 'Sessions',      value: Number(a?.meaningfulSessionCount || 0).toLocaleString('en-US'),
      delta: changePct(a?.meaningfulSessionCount, prev?.meaningfulSessionCount) },
  ]
}

/**
 * The at-a-glance paragraph. Assembled from clauses that are each conditional
 * on real data — a creator with no established pattern gets a shorter, honest
 * sentence rather than filler.
 */
export function buildSummary(a, prev, periodLabel) {
  const parts = []
  const revDelta = changePct(a?.totalUSD, prev?.totalUSD)
  if (revDelta != null && Math.abs(revDelta) >= 5) {
    parts.push(revDelta > 0
      ? `Your earnings are trending upward over the last ${periodLabel.toLowerCase()}, up ${revDelta}% on the period before it.`
      : `Your earnings are down ${Math.abs(revDelta)}% on the period before this one.`)
  } else if (revDelta != null) {
    parts.push(`Your earnings are tracking close to the previous ${periodLabel.toLowerCase()}.`)
  }

  const w = a?.canonicalBestTimes?.bestWindow
  if (w?.localDay != null && w?.localHour != null) {
    parts.push(`Your strongest results cluster on ${w.localDay}s around ${fmtHour(w.localHour)}.`)
  }

  const fe = a?.returningVsNew
  if (fe?.multiplier && fe.multiplier > 1) {
    parts.push(`Returning fans continue to spend ${fe.multiplier}× more than one-time tippers.`)
  }

  const best = a?.bestPlatformByRate
  if (best?.platform && (a?.rankablePlatforms || []).length >= 2) {
    parts.push(`${best.platform} is producing your strongest hourly rate.`)
  }

  if (!parts.length) return null
  return parts.join(' ')
}

/** Best day, best window, best platform, session sweet spot — explained. */
export function buildPatterns(a) {
  const out = []

  if (a?.bestDay?.day != null) {
    const worst = a?.worstDay
    const gap = worst?.avg > 0 && a.bestDay.avg > 0
      ? Math.round(((a.bestDay.avg - worst.avg) / worst.avg) * 100) : null
    out.push({
      id: 'best_day', label: 'Best day', type: 'timing',
      title: String(a.bestDay.day).toUpperCase(),
      description: 'Your strongest average daily earnings land on this day.',
      metric: fmtUsd0(a.bestDay.avg), metricLabel: 'average',
      note: gap && gap > 0 ? `+${gap}% vs your weakest day` : null,
    })
  }

  const w = a?.canonicalBestTimes?.bestWindow
  if (w?.localDay != null && w?.localHour != null) {
    out.push({
      id: 'best_window', label: 'Best streaming window', type: 'timing',
      title: `${String(w.localDay).toUpperCase()} · ${fmtHour(w.localHour)}`,
      description: 'This is where your earnings concentrate historically.',
      metric: `${fmtUsd2(w.medianUsdPerHour)}/hr`, metricLabel: 'typical rate',
      note: w.sessionCount ? `Based on ${w.sessionCount} session${w.sessionCount === 1 ? '' : 's'}` : null,
    })
  }

  const best = a?.bestPlatformByRate
  const rankable = a?.rankablePlatforms || []
  if (best?.platform && rankable.length >= 2) {
    const second = rankable.find(p => p.platform !== best.platform)
    const gap = second?.medianUsdPerHour > 0
      ? Math.round(((best.medianUsdPerHour - second.medianUsdPerHour) / second.medianUsdPerHour) * 100) : null
    out.push({
      id: 'best_platform', label: 'Most efficient platform', type: 'performance',
      title: best.platform,
      description: 'Measured by what an hour of streaming actually returns, not by tip size.',
      metric: `${fmtUsd2(best.medianUsdPerHour)}/hr`, metricLabel: 'median',
      note: gap && gap > 0 ? `+${gap}% vs ${second.platform}` : null,
    })
  }

  return out
}

/**
 * Revenue by session-length band. Bands are a presentation grouping of
 * canonical meaningful sessions — no session rule is redefined.
 */
export function buildSessionBands(a) {
  const sessions = (a?.meaningfulSessions || []).filter(s => !s.durationUnknown && s.durationHours > 0)
  if (sessions.length < 4) return null
  const bands = [
    { id: '0-15',  label: '0–15 min',  min: 0,   max: 0.25 },
    { id: '15-30', label: '15–30 min', min: 0.25, max: 0.5 },
    { id: '30-60', label: '30–60 min', min: 0.5,  max: 1 },
    { id: '60+',   label: '60+ min',   min: 1,    max: Infinity },
  ].map(b => {
    const inBand = sessions.filter(s => s.durationHours >= b.min && s.durationHours < b.max)
    const total = inBand.reduce((sum, s) => sum + (s.totalUSD || 0), 0)
    return { ...b, count: inBand.length, avgUSD: inBand.length ? total / inBand.length : 0 }
  })
  const withData = bands.filter(b => b.count > 0)
  if (withData.length < 2) return null
  const max = Math.max(...withData.map(b => b.avgUSD))
  const strongest = withData.reduce((a2, b) => (b.avgUSD > a2.avgUSD ? b : a2), withData[0])
  return { bands, max, strongest }
}

/** Fan economy — returning value and revenue concentration. */
export function buildFanEconomy(a) {
  return {
    economy: a?.returningVsNew || null,
    concentration: a?.topFanDependency || null,
    totalFans: a?.uniqueFanCount || 0,
  }
}

/** Trajectory, in human language. */
export function buildTrajectory(a, prev, periodLabel) {
  const delta = changePct(a?.totalUSD, prev?.totalUSD)
  if (delta == null) return null
  if (delta >= 10) return { dir: 'up', arrow: '↑', word: 'GROWING',
    text: `Your earnings are up ${delta}% compared with the previous ${periodLabel.toLowerCase()}.` }
  if (delta <= -10) return { dir: 'down', arrow: '↓', word: 'COOLING',
    text: `Your recent earnings are ${Math.abs(delta)}% below the previous ${periodLabel.toLowerCase()}.` }
  return { dir: 'flat', arrow: '→', word: 'STEADY',
    text: `Your recent earnings are tracking close to the previous ${periodLabel.toLowerCase()}.` }
}

/** 2–4 findings, each conditional on real data. */
export function buildWorking(a) {
  const out = []
  const w = a?.canonicalBestTimes?.bestWindow
  if (w?.localDay != null) out.push({ label: 'Timing', text: `${w.localDay}s around ${fmtHour(w.localHour)} are your strongest earning window.` })
  const fe = a?.returningVsNew
  if (fe?.multiplier > 1) out.push({ label: 'Retention', text: `Returning fans spend ${fe.multiplier}× more than one-time tippers.` })
  const bands = buildSessionBands(a)
  if (bands?.strongest) out.push({ label: 'Session length', text: `${bands.strongest.label} sessions currently perform best.` })
  const best = a?.bestPlatformByRate
  if (best?.platform && (a?.rankablePlatforms || []).length >= 2) {
    out.push({ label: 'Platform', text: `${best.platform} is returning more per hour streamed than your other platforms.` })
  }
  return out.slice(0, 4)
}

/**
 * What to work on. Framed as an opportunity, never as a loss — and never with
 * a speculative dollar figure attached (see the missed-window entry).
 */
export function buildWorkOn(a) {
  const out = []

  const missed = a?.missedRevenue
  const w = a?.canonicalBestTimes?.bestWindow
  if (missed?.missedWindows > 0 && w?.localDay != null) {
    out.push({
      label: 'Missed peak',
      text: `You have not streamed your ${w.localDay} ${fmtHour(w.localHour)} window ${missed.missedWindows} time${missed.missedWindows === 1 ? '' : 's'} recently. That window typically returns ${fmtUsd2(w.medianUsdPerHour)}/hr.`,
    })
  }

  const overdue = (a?.whales || []).filter(f => f.tipCount >= 3 && f.expectedNextTip === 'Overdue').length
  if (overdue > 0) {
    out.push({ label: 'Fan recovery', text: `${overdue} supporter${overdue === 1 ? ' is' : 's are'} past their usual tipping interval.` })
  }

  const dep = a?.topFanDependency
  if (dep?.top3Pct >= 50) {
    out.push({ label: 'Revenue spread', text: `Your top 3 fans generate ${dep.top3Pct}% of revenue. Widening your base of repeat supporters makes that steadier.` })
  }

  return out.slice(0, 4)
}

/** Three next moves, each supported by something already established. */
export function buildNextMoves(a) {
  const out = []
  const w = a?.canonicalBestTimes?.bestWindow
  if (w?.localDay != null) out.push(`Schedule your next stream around ${w.localDay} ${fmtHour(w.localHour)}.`)
  const overdue = (a?.whales || []).filter(f => f.tipCount >= 3 && f.expectedNextTip === 'Overdue').length
  if (overdue > 0) out.push(`Re-engage the ${overdue} supporter${overdue === 1 ? '' : 's'} past their usual interval.`)
  const bands = buildSessionBands(a)
  if (bands?.strongest && bands.strongest.id !== '0-15') out.push(`Aim for ${bands.strongest.label} sessions — that length is performing best for you.`)
  const best = a?.bestPlatformByRate
  if (best?.platform && (a?.rankablePlatforms || []).length >= 2) out.push(`Weight more of your streaming hours toward ${best.platform}.`)
  return out.slice(0, 3)
}
