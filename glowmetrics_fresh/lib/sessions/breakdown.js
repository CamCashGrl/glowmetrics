// ════════════════════════════════════════════════════════════════════
// PER-SESSION BREAKDOWN — pure derivation.
//
// Moved VERBATIM out of app/dashboard/page.js, where it ran inline inside
// the Sessions tab's render. Nothing about the maths changed; the only edit
// is that `allSessions` — previously captured from the enclosing closure —
// is now an explicit parameter, so this is a pure function the Sessions
// component can call and a verification script can execute.
//
// Everything here is derived from the session's own tip rows. No fabricated
// multipliers: the one that existed ("could 2x your earnings") was already
// removed before this move, and the comment recording that is preserved.
// ════════════════════════════════════════════════════════════════════

// Presentation config for the performance badge, kept beside the
// classification that produces it.
export const PERFORMANCE_BADGE = {
  high:    { label: "\ud83d\udd25 High Performing", color: "#10B981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.3)" },
  average: { label: "\ud83d\udcca Average",          color: "#F59E0B", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)" },
  low:     { label: "\ud83d\udcc9 Underperforming",  color: "#F87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
}

export function getSessionBreakdown(s, allSessions = []) {
  const rawTips = s.tips || []
  if (rawTips.length === 0) return null

  const sorted = [...rawTips].sort((a, b) =>
    new Date(a.dateRaw || a.date_time) - new Date(b.dateRaw || b.date_time)
  )

  const startMs = new Date(s.startTime).getTime()
  const endMs   = new Date(s.endTime).getTime()
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
  const half = Math.floor(buckets.length / 2)
  const firstHalfUSD = buckets.slice(0, half).reduce((s, b) => s + b.usd, 0)
  const secondHalfUSD = buckets.slice(half).reduce((s, b) => s + b.usd, 0)
  const firstHalfPct = s.totalUSD > 0 ? Math.round((firstHalfUSD / s.totalUSD) * 100) : 0

  // ── TOP TIPPERS ─────────────────────────────────────────
  const tipperMap = {}
  sorted.forEach(t => {
    const u = t.username || "unknown"
    tipperMap[u] = (tipperMap[u] || 0) + (parseFloat(t.usd) || 0)
  })
  const topTippers = Object.entries(tipperMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([username, usd]) => ({
      username,
      usd: parseFloat(usd.toFixed(2)),
      pct: s.totalUSD > 0 ? Math.round((usd / s.totalUSD) * 100) : 0,
    }))

  // ── SPIKES (bucket > 2x avg) ─────────────────────────────
  const avgBucketUSD = s.totalUSD / buckets.length
  const spikes = buckets
    .map((b, i) => ({ ...b, idx: i }))
    .filter(b => b.usd >= avgBucketUSD * 2 && b.usd > 0)
    .map(b => ({
      minute: b.idx * 5,
      usd: parseFloat(b.usd.toFixed(2)),
      time: new Date(startMs + b.idx * 5 * 60000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }))

  // ── PERFORMANCE vs historical avg ────────────────────────
  const allAvg = allSessions.length > 0
    ? allSessions.reduce((s, x) => s + x.totalUSD, 0) / allSessions.length
    : 0
  const performance = s.totalUSD >= allAvg * 1.3
    ? "high"
    : s.totalUSD <= allAvg * 0.6
    ? "low"
    : "average"

  // ── REVENUE PER MINUTE ───────────────────────────────────
  const revenuePerMin = parseFloat((s.totalUSD / durationMins).toFixed(3))

  // ── INSIGHTS ────────────────────────────────────────────
  const insights = []
  if (firstHalfPct >= 60)
    insights.push(`You earned ${firstHalfPct}% of your revenue in the first half of the stream`)
  if (firstHalfPct <= 35 && durationMins > 20)
    insights.push(`Your stream warmed up slowly — earnings picked up in the second half`)
  if (topTippers[0] && topTippers[0].pct >= 40)
    insights.push(`${topTippers[0].username} drove ${topTippers[0].pct}% of this session's revenue`)
  if (spikes.length > 0)
    insights.push(`Your biggest spike was at ${spikes[0].time} — $${spikes[0].usd} in 5 minutes`)
  if (s.uniqueFans === 1)
    insights.push(`Only one fan tipped this session — great loyalty, but audience diversity helps`)
  if (s.uniqueFans >= 5)
    insights.push(`${s.uniqueFans} different fans tipped — strong audience engagement`)
  if (durationMins < 20 && s.totalUSD > 0)
    insights.push(`Short session (${Math.round(durationMins)} min) with solid earnings — your hook is working`)
  if (performance === "high")
    insights.push(`This was one of your top sessions — $${s.totalUSD} vs $${allAvg.toFixed(0)} avg`)
  if (performance === "low")
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
    // "could 2x your earnings" removed — that multiplier was hardcoded,
    // not derived from this creator's short-vs-long session history or
    // any calculation in the codebase, while reading as her own data.
    recommendations.push(`You earned $${s.totalUSD} in ${Math.round(durationMins)} min — short sessions give tipping momentum less time to build. Try extending to 45–60 min`)
  if (spikes.length >= 2)
    recommendations.push("Multiple spike moments detected — identify what triggered them and recreate it intentionally")
  if (revenuePerMin > 0 && revenuePerMin < 0.10)
    recommendations.push("Low revenue per minute — try setting a token goal every 15 min to maintain tipping momentum")
  if (performance === "high")
    recommendations.push("Replicate this stream: same time, same platform, similar energy — your data supports it")
  if (recommendations.length === 0)
    recommendations.push("Keep streaming consistently — more data helps us give you sharper recommendations")

  // ── REVENUE GAP vs COMPARABLE SESSIONS ──────────────────────────
  // Restored during the D8 redesign, where it was accidentally dropped.
  //
  // It also carried a real bug: the baseline was built from
  // `displaySessions` — whichever sessions happened to be rendered — so once
  // pagination landed, "your avg session" silently meant "the average of this
  // page". It now reads `allSessions`, the whole history, which is what the
  // surrounding copy always claimed and what verify-stream-report.mjs already
  // asserted was true.
  //
  // Prefers same-platform history, needs at least 2 comparable sessions, and
  // stays silent under a 10% difference so noise is not reported as a finding.
  const gapPool = allSessions.filter(x => x !== s && !x.durationUnknown)
  const samePlatform = gapPool.filter(x => x.platform === s.platform).slice(-5)
  const gapBase = samePlatform.length >= 3 ? samePlatform : gapPool.slice(-5)
  let revenueGap = null
  if (gapBase.length >= 2 && !s.durationUnknown) {
    const expected = gapBase.reduce((a, x) => a + x.totalUSD, 0) / gapBase.length
    const gap = expected - s.totalUSD
    const gapPct = expected > 0 ? Math.round((gap / expected) * 100) : 0
    if (Math.abs(gapPct) >= 10) {
      revenueGap = {
        expected: parseFloat(expected.toFixed(2)),
        gap: parseFloat(Math.abs(gap).toFixed(2)),
        gapPct: Math.abs(gapPct),
        isUnder: gap > 0,
        basedOn: gapBase.length,
        samePlatform: samePlatform.length >= 3,
      }
    }
  }

  return {
    revenueGap,
    buckets, peakTime, peakBucket, firstHalfPct,
    topTippers, spikes, performance, revenuePerMin,
    insights, recommendations,
  }
}
