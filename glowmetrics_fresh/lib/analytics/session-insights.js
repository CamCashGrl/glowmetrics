// ═══════════════════════════════════════════════════════════════════════════
// SESSION BREAKDOWN ENGINE — "what happened in this session and why"
//
// Extracted verbatim (formulas untouched) from the closure that used to live
// inside app/dashboard/page.js's "sessions" (Free Chat Sessions) tab. Now the
// single source of truth for per-session insights/recommendations, reused by
// both the consolidated Sessions Intelligence page (app/dashboard/Sessions.js)
// and the Session Detail drawer (app/dashboard/SessionDrawer.js).
//
// Operates on one session (the finalizeSession() shape from ./sessions.js —
// startTime/endTime/durationMinutes/totalUSD/tips[]/etc) plus the population
// of comparable sessions it should be judged against (same shape array).
// Returns null when there isn't enough signal (no tips) rather than
// fabricating an insight.
// ═══════════════════════════════════════════════════════════════════════════

export function getSessionBreakdown(s, comparablePopulation = [], timezone = 'UTC') {
  const rawTips = s.tips || []
  if (rawTips.length === 0) return null

  const sorted = [...rawTips].sort((a, b) =>
    new Date(a.dateRaw || a.date_time) - new Date(b.dateRaw || b.date_time)
  )

  const startMs = new Date(s.startTime).getTime()
  const durationMins = Math.max(s.durationMinutes || 1, 1)

  // ── TIMELINE BUCKETS (5-min intervals) ──────────────────
  const bucketCount = Math.max(Math.ceil(durationMins / 5), 1)
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    label: `${i * 5}m`,
    usd: 0,
    count: 0,
  }))
  sorted.forEach(t => {
    const tMs = new Date(t.dateRaw || t.date_time).getTime()
    const minOffset = (tMs - startMs) / 60000
    const idx = Math.min(Math.floor(minOffset / 5), bucketCount - 1)
    if (idx >= 0 && idx < buckets.length) {
      buckets[idx].usd += parseFloat(t.usd) || 0
      buckets[idx].count += 1
    }
  })

  // ── PEAK BUCKET ─────────────────────────────────────────
  const peakBucket = [...buckets].sort((a, b) => b.usd - a.usd)[0]
  const peakBucketIdx = buckets.indexOf(peakBucket)
  const peakMinute = peakBucketIdx * 5
  const peakTime = new Date(startMs + peakMinute * 60000)

  // ── FIRST HALF vs SECOND HALF ────────────────────────────
  // Read off the session — finalizeSession() already split it at the
  // timestamp midpoint, which is the same split velocityTrend uses. Halving
  // by 5-minute bucket index here disagreed with the momentum badge on any
  // odd bucket count.
  const firstHalfPct = s.firstHalfPct ?? 0

  // ── TOP TIPPERS ─────────────────────────────────────────
  const tipperMap = {}
  sorted.forEach(t => {
    const u = t.username || "unknown"
    if (!tipperMap[u]) tipperMap[u] = { usd: 0, count: 0 }
    tipperMap[u].usd += (parseFloat(t.usd) || 0)
    tipperMap[u].count += 1
  })
  const topTippers = Object.entries(tipperMap)
    .sort((a, b) => b[1].usd - a[1].usd)
    .slice(0, 3)
    .map(([username, d]) => ({
      username,
      usd: parseFloat(d.usd.toFixed(2)),
      count: d.count,
      pct: s.totalUSD > 0 ? Math.round((d.usd / s.totalUSD) * 100) : 0,
    }))

  // ── SPIKES (bucket > 2x avg) ─────────────────────────────
  const avgBucketUSD = s.totalUSD / buckets.length
  const spikes = buckets
    .map((b, i) => ({ ...b, idx: i }))
    .filter(b => b.usd >= avgBucketUSD * 2 && b.usd > 0)
    .map(b => ({
      minute: b.idx * 5,
      usd: parseFloat(b.usd.toFixed(2)),
      time: new Date(startMs + b.idx * 5 * 60000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: timezone }),
    }))

  // ── BIGGEST SPIKE ────────────────────────────────────────
  // `spikes` stays chronological for the timeline, so spikes[0] is the
  // EARLIEST spike. Anything describing the "biggest" one must sort by USD.
  const topSpike = spikes.length
    ? [...spikes].sort((a, b) => b.usd - a.usd)[0]
    : null

  // ── PERFORMANCE vs comparable population ─────────────────
  const allAvg = comparablePopulation.length > 0
    ? comparablePopulation.reduce((sum, x) => sum + x.totalUSD, 0) / comparablePopulation.length
    : 0
  const performance = allAvg > 0
    ? (s.totalUSD >= allAvg * 1.3 ? "high" : s.totalUSD <= allAvg * 0.6 ? "low" : "average")
    : "average"

  // ── REVENUE PER MINUTE ───────────────────────────────────
  // s.usdPerMinute is null on durationUnknown sessions. Deriving it here as
  // totalUSD/durationMins produced a confident rate for a session whose
  // duration is not actually known.
  const revenuePerMin = s.usdPerMinute ?? null

  // ── INSIGHTS ────────────────────────────────────────────
  const insights = []
  if (firstHalfPct >= 60)
    insights.push(`You earned ${firstHalfPct}% of your revenue in the first half of the stream`)
  if (firstHalfPct <= 35 && durationMins > 20)
    insights.push(`Your stream warmed up slowly — earnings picked up in the second half`)
  if (topTippers[0] && topTippers[0].pct >= 40)
    insights.push(`${topTippers[0].username} drove ${topTippers[0].pct}% of this session's revenue`)
  if (topSpike)
    insights.push(`Your biggest spike was at ${topSpike.time} — $${topSpike.usd} in 5 minutes`)
  if (s.uniqueFans === 1)
    insights.push(`Only one fan tipped this session — great loyalty, but audience diversity helps`)
  if (s.uniqueFans >= 5)
    insights.push(`${s.uniqueFans} different fans tipped — strong audience engagement`)
  if (durationMins < 20 && s.totalUSD > 0)
    insights.push(`Short session (${Math.round(durationMins)} min) with solid earnings — your hook is working`)
  if (performance === "high" && allAvg > 0)
    insights.push(`This was one of your top sessions — $${s.totalUSD} vs $${allAvg.toFixed(0)} avg`)
  if (performance === "low" && allAvg > 0)
    insights.push(`Below your average session ($${allAvg.toFixed(0)}) — see recommendations below`)

  // ── RECOMMENDATIONS ─────────────────────────────────────
  const recommendations = []
  if (firstHalfPct >= 60)
    recommendations.push("Your best earnings happen early — open with high energy and a strong tip goal right away")
  if (firstHalfPct <= 35)
    recommendations.push("Slow start detected — open with a countdown goal or shoutout to get early tipping momentum")
  if (topTippers[0] && topTippers[0].pct >= 50)
    recommendations.push(`Retain ${topTippers[0].username} — they drove half your session. Give them public recognition next time`)
  if (s.uniqueFans <= 2 && s.tipCount > 10)
    recommendations.push("Diversify your audience — most tips came from 1–2 fans. Engage lurkers with low-barrier goals")
  if (durationMins < 30 && s.totalUSD > 0)
    recommendations.push(`You earned $${s.totalUSD} in ${Math.round(durationMins)} min — short sessions give tipping momentum less time to build. Try extending to 45–60 min`)
  if (spikes.length >= 2)
    recommendations.push("Multiple spike moments detected — identify what triggered them and recreate it intentionally")
  if (revenuePerMin !== null && revenuePerMin > 0 && revenuePerMin < 0.10)
    recommendations.push("Low revenue per minute — try setting a token goal every 15 min to maintain tipping momentum")
  if (performance === "high")
    recommendations.push("Replicate this stream: same time, same platform, similar energy — your data supports it")
  if (recommendations.length === 0)
    recommendations.push("Keep streaming consistently — more data helps us give you sharper recommendations")

  return {
    buckets, peakTime, peakBucket, firstHalfPct,
    // allAvg was already computed above to classify `performance` — exposed
    // here so callers (the performance-vs-average banner) can show the real
    // number and percentage without recomputing the same average a second
    // time from comparablePopulation.
    topTippers, spikes, topSpike, performance, allAvg, revenuePerMin,
    insights, recommendations,
  }
}

// Performance badge config — shared so the page and drawer render identical labels/colors.
export const SESSION_PERF_BADGE = {
  high:    { label: "🔥 High Performing", color: "#10B981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.3)" },
  average: { label: "📊 Average",          color: "#F59E0B", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)" },
  low:     { label: "📉 Underperforming",  color: "#F87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
}
