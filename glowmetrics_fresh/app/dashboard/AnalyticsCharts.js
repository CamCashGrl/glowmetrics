"use client"
import React, { useMemo, useState } from "react"
import { calculateConfidence } from "../../lib/analytics"

// ─── Design tokens (matches the rest of the dashboard) ───────────────────────
const BG     = "#0a0e1a"
const CARD   = "rgba(255,255,255,0.03)"
const BORDER = "rgba(255,255,255,0.08)"
const TEXT   = "#94A3B8"
const WHITE  = "#F1F5F9"
const MUTED  = "#475569"
const CYAN   = "#22D3EE"
const GOLD   = "#F59E0B"
const PURPLE = "#a855f7"
const GREEN  = "#22c55e"
const RED    = "#f87171"

const PLATFORM_COLORS = {
  Chaturbate: "#a855f7",
  BongaCams:  "#ec4899",
  MyFreeCams: "#22d3ee",
}
const PLATFORM_FALLBACK = ["#60A5FA", "#34D399", "#FB923C"]
const platColor = (p, i = 0) => PLATFORM_COLORS[p] || PLATFORM_FALLBACK[i % PLATFORM_FALLBACK.length]

const card = (extra = {}) => ({
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  padding: "20px 24px",
  ...extra,
})

const sectionTitle = (title, sub) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ color: WHITE, fontWeight: 600, fontSize: 15 }}>{title}</div>
    {sub && <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>{sub}</div>}
  </div>
)

function niceMax(v) {
  if (!v || v <= 0) return 10
  const mag  = Math.pow(10, Math.floor(Math.log10(v)))
  const n    = v / mag
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return nice * mag
}

function quantile(sortedArr, q) {
  if (!sortedArr.length) return 0
  const pos = (sortedArr.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  return sortedArr[base + 1] !== undefined
    ? sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base])
    : sortedArr[base]
}

const fmtUSD = v => v == null ? "—" : `$${Number(v).toFixed(v >= 100 ? 0 : 2)}`
const fmtDur = mins => mins == null ? "—" : mins < 60 ? `${Math.round(mins)}m` : `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`
// Session dates on the creator's clock (creatorTz from the dashboard); undefined → device clock.
const fmtDate = (iso, tz) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: tz })

// ─── Empty / low-data states ──────────────────────────────────────────────────
function EmptyState({ title = "Not enough data yet", sub = "Session diagnostics appear once you have enough recorded sessions." }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: 220, color: MUTED, gap: 8, textAlign: "center", padding: "0 24px",
    }}>
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3v18h18M7 16l4-4 4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div style={{ fontSize: 14, color: TEXT }}>{title}</div>
      <div style={{ fontSize: 12.5 }}>{sub}</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. METRIC RELATIONSHIPS — scatter of one session metric against revenue
// ═══════════════════════════════════════════════════════════════════════════════
const RELATIONSHIP_PAIRS = [
  { id: "duration", label: "Duration → Revenue", xLabel: "Session length (min)", getX: s => s.durationMinutes, needsKnownDuration: true, xFormat: v => `${Math.round(v)}m` },
  { id: "tips",     label: "Tips → Revenue",      xLabel: "Tip count",           getX: s => s.tipCount,          needsKnownDuration: false, xFormat: v => `${Math.round(v)}` },
  { id: "fans",     label: "Fans → Revenue",       xLabel: "Unique paying fans",  getX: s => s.uniqueFans,        needsKnownDuration: false, xFormat: v => `${Math.round(v)}` },
]

function Scatter({ points, xFormat, tz }) {
  const W = 560, H = 240
  const ML = 54, MR = 16, MT = 14, MB = 34
  const plotW = W - ML - MR
  const plotH = H - MT - MB

  const xMax = niceMax(Math.max(...points.map(p => p.x), 0.001))
  const yMax = niceMax(Math.max(...points.map(p => p.y), 0.001))
  const xScale = v => ML + (v / xMax) * plotW
  const yScale = v => MT + plotH - (v / yMax) * plotH
  const XT = 4, YT = 4

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
      {Array.from({ length: YT + 1 }, (_, i) => (yMax / YT) * i).map((v, i) => (
        <g key={`y${i}`}>
          <line x1={ML} x2={ML + plotW} y1={yScale(v)} y2={yScale(v)} stroke={BORDER} strokeWidth={1} />
          <text x={ML - 6} y={yScale(v) + 4} textAnchor="end" fill={TEXT} fontSize={10}>{fmtUSD(v)}</text>
        </g>
      ))}
      {Array.from({ length: XT + 1 }, (_, i) => (xMax / XT) * i).map((v, i) => (
        <text key={`x${i}`} x={xScale(v)} y={MT + plotH + 18} textAnchor="middle" fill={TEXT} fontSize={10}>{xFormat(v)}</text>
      ))}
      <line x1={ML} x2={ML + plotW} y1={MT + plotH} y2={MT + plotH} stroke={BORDER} strokeWidth={1} />
      <line x1={ML} x2={ML} y1={MT} y2={MT + plotH} stroke={BORDER} strokeWidth={1} />
      {points.map((p, i) => (
        <circle key={i} cx={xScale(p.x)} cy={yScale(p.y)} r={4} fill={platColor(p.platform)} fillOpacity={0.75} stroke={BG} strokeWidth={0.5}>
          <title>{`${p.platform} · ${xFormat(p.x)} · ${fmtUSD(p.y)} · ${fmtDate(p.startTime, tz)}`}</title>
        </circle>
      ))}
    </svg>
  )
}

function ColorLegend({ platforms }) {
  return (
    <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 10, flexWrap: "wrap" }}>
      {platforms.map((p, i) => (
        <div key={p} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: platColor(p, i) }} />
          <span style={{ color: TEXT, fontSize: 12 }}>{p}</span>
        </div>
      ))}
    </div>
  )
}

function MetricRelationshipsCard({ sessions, tz }) {
  const [pairId, setPairId] = useState("duration")
  const pair = RELATIONSHIP_PAIRS.find(p => p.id === pairId)

  const { points, platforms } = useMemo(() => {
    const pool = pair.needsKnownDuration ? sessions.filter(s => !s.durationUnknown) : sessions
    const pts = pool.map(s => ({ x: pair.getX(s), y: s.totalUSD, platform: s.platform || "Unknown", startTime: s.startTime }))
    return { points: pts, platforms: [...new Set(pts.map(p => p.platform))] }
  }, [sessions, pairId])

  return (
    <div style={card()}>
      {sectionTitle("Metric Relationships", "How session traits relate to revenue, one session = one point")}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {RELATIONSHIP_PAIRS.map(p => (
          <button key={p.id} onClick={() => setPairId(p.id)} style={{
            padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: `1px solid ${pairId === p.id ? CYAN : BORDER}`,
            background: pairId === p.id ? "rgba(34,211,238,0.12)" : "transparent",
            color: pairId === p.id ? CYAN : TEXT,
          }}>{p.label}</button>
        ))}
      </div>
      {points.length < 3 ? (
        <EmptyState sub="Need at least 3 comparable sessions to plot this relationship." />
      ) : (
        <>
          <Scatter points={points} xFormat={pair.xFormat} tz={tz} />
          <ColorLegend platforms={platforms} />
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PERFORMANCE DISTRIBUTION — histogram of $/hour across sessions
// ═══════════════════════════════════════════════════════════════════════════════
function Histogram({ values, median, p75 }) {
  const W = 560, H = 240
  const ML = 54, MR = 16, MT = 14, MB = 34
  const plotW = W - ML - MR
  const plotH = H - MT - MB

  const min = Math.min(...values), max = Math.max(...values)
  const binCount = Math.max(5, Math.min(10, Math.round(Math.sqrt(values.length))))
  const span = Math.max(max - min, 0.01)
  const binW = span / binCount
  const bins = Array.from({ length: binCount }, (_, i) => ({ from: min + i * binW, to: min + (i + 1) * binW, count: 0 }))
  values.forEach(v => {
    let idx = Math.floor((v - min) / binW)
    if (idx >= binCount) idx = binCount - 1
    if (idx < 0) idx = 0
    bins[idx].count++
  })
  const maxCount = niceMax(Math.max(...bins.map(b => b.count), 1))
  const xScale = v => ML + ((v - min) / span) * plotW
  const yScale = c => MT + plotH - (c / maxCount) * plotH
  const barW = Math.max(2, plotW / binCount - 3)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
      {Array.from({ length: 4 + 1 }, (_, i) => (maxCount / 4) * i).map((c, i) => (
        <g key={i}>
          <line x1={ML} x2={ML + plotW} y1={yScale(c)} y2={yScale(c)} stroke={BORDER} strokeWidth={1} />
          <text x={ML - 6} y={yScale(c) + 4} textAnchor="end" fill={TEXT} fontSize={10}>{Math.round(c)}</text>
        </g>
      ))}
      {bins.map((b, i) => {
        const x = xScale(b.from)
        const barH = Math.max(0, plotH - (yScale(b.count) - MT))
        return (
          <g key={i}>
            <rect x={x} y={yScale(b.count)} width={barW} height={barH} fill={CYAN} fillOpacity={0.55} rx={2}>
              <title>{`${fmtUSD(b.from)}–${fmtUSD(b.to)}/hr · ${b.count} session${b.count === 1 ? "" : "s"}`}</title>
            </rect>
          </g>
        )
      })}
      {[median, p75].map((v, i) => (
        v == null ? null : (
          <line key={i} x1={xScale(v)} x2={xScale(v)} y1={MT} y2={MT + plotH}
            stroke={i === 0 ? GOLD : PURPLE} strokeWidth={1.5} strokeDasharray="4 3" />
        )
      ))}
      {[0, 0.5, 1].map(f => {
        const v = min + span * f
        return <text key={f} x={xScale(v)} y={MT + plotH + 18} textAnchor="middle" fill={TEXT} fontSize={10}>{fmtUSD(v)}</text>
      })}
      <line x1={ML} x2={ML + plotW} y1={MT + plotH} y2={MT + plotH} stroke={BORDER} strokeWidth={1} />
    </svg>
  )
}

function PerformanceDistributionCard({ sessions }) {
  const { values, median, p75 } = useMemo(() => {
    const vals = sessions.filter(s => !s.durationUnknown && s.usdPerHour != null).map(s => s.usdPerHour).sort((a, b) => a - b)
    return {
      values: vals,
      median: vals.length ? quantile(vals, 0.5) : null,
      p75: vals.length ? quantile(vals, 0.75) : null,
    }
  }, [sessions])

  return (
    <div style={card()}>
      {sectionTitle("Performance Distribution", "Spread of $/hour across sessions with a known duration")}
      {values.length < 3 ? (
        <EmptyState sub="Need at least 3 timed sessions to show a distribution." />
      ) : (
        <>
          <Histogram values={values} median={median} p75={p75} />
          <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 14, height: 2, background: GOLD }} />
              <span style={{ color: TEXT, fontSize: 12 }}>Median: {fmtUSD(median)}/hr</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 14, height: 2, background: PURPLE }} />
              <span style={{ color: TEXT, fontSize: 12 }}>75th percentile: {fmtUSD(p75)}/hr</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. OUTLIER INVESTIGATION — IQR-based flagging on $/hour
// ═══════════════════════════════════════════════════════════════════════════════
// IQR needs a sturdier sample than a plain average — below this, a couple of
// whale-driven sessions can swing Q1/Q3 enough to flag most of the sample.
// Lines up with the "High confidence" floor used elsewhere (calculateConfidence).
const OUTLIER_MIN_SESSIONS = 10
const WHALE_CONTRIBUTION_PCT = 70

function outlierReason(s, medianDuration) {
  if (s.topContributorPct >= WHALE_CONTRIBUTION_PCT) return `Driven by one fan (${s.topContributorPct}% of revenue)`
  if (medianDuration > 0 && s.durationMinutes <= medianDuration * 0.5) return "Unusually short session"
  if (medianDuration > 0 && s.durationMinutes >= medianDuration * 2) return "Unusually long session"
  return null
}

function OutlierCard({ sessions, tz }) {
  const outliers = useMemo(() => {
    const timed = sessions.filter(s => !s.durationUnknown && s.usdPerHour != null)
    if (timed.length < OUTLIER_MIN_SESSIONS) return { ready: false, high: [], low: [] }
    const sortedVals = [...timed].map(s => s.usdPerHour).sort((a, b) => a - b)
    const q1 = quantile(sortedVals, 0.25)
    const q3 = quantile(sortedVals, 0.75)
    const iqr = q3 - q1
    const lowerBound = q1 - 1.5 * iqr
    const upperBound = q3 + 1.5 * iqr
    const medianDuration = quantile([...timed].map(s => s.durationMinutes).sort((a, b) => a - b), 0.5)
    const highAll = timed.filter(s => s.usdPerHour > upperBound).sort((a, b) => b.usdPerHour - a.usdPerHour)
    const lowAll  = timed.filter(s => s.usdPerHour < lowerBound && s.usdPerHour >= 0).sort((a, b) => a.usdPerHour - b.usdPerHour)
    return {
      ready: true,
      high: highAll.slice(0, 5), highTotal: highAll.length,
      low: lowAll.slice(0, 5), lowTotal: lowAll.length,
      upperBound, lowerBound, medianDuration,
    }
  }, [sessions])

  const Row = ({ s, kind, medianDuration }) => {
    const reason = outlierReason(s, medianDuration)
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: platColor(s.platform), flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ color: WHITE, fontSize: 13, fontWeight: 600 }}>{s.platform} · {fmtDate(s.startTime, tz)}</div>
            <div style={{ color: MUTED, fontSize: 11.5 }}>
              {fmtDur(s.durationMinutes)} · {s.tipCount} tips · {s.uniqueFans} fan{s.uniqueFans === 1 ? "" : "s"}
            </div>
            {reason && <div style={{ color: kind === "high" ? GREEN : RED, fontSize: 11, marginTop: 2, opacity: 0.85 }}>{reason}</div>}
          </div>
        </div>
        <div style={{ color: kind === "high" ? GREEN : RED, fontSize: 14, fontWeight: 700, flexShrink: 0, marginLeft: 12 }}>
          {fmtUSD(s.usdPerHour)}/hr
        </div>
      </div>
    )
  }

  return (
    <div style={card()}>
      {sectionTitle("Outlier Investigation", "Sessions whose $/hour falls outside the typical IQR range (1.5× beyond Q1/Q3)")}
      {!outliers.ready ? (
        <EmptyState sub={`Need at least ${OUTLIER_MIN_SESSIONS} timed sessions before outliers can be identified reliably.`} />
      ) : outliers.highTotal === 0 && outliers.lowTotal === 0 ? (
        <div style={{ color: TEXT, fontSize: 13, padding: "12px 0" }}>No statistical outliers — your session performance is consistent.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <div style={{ color: GREEN, fontSize: 12, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
              ↑ Overperformed ({outliers.highTotal})
            </div>
            {outliers.highTotal === 0
              ? <div style={{ color: MUTED, fontSize: 12.5 }}>None found</div>
              : (
                <>
                  {outliers.high.map(s => <Row key={s.id} s={s} kind="high" medianDuration={outliers.medianDuration} />)}
                  {outliers.highTotal > outliers.high.length && (
                    <div style={{ color: MUTED, fontSize: 11.5, marginTop: 8 }}>Showing top {outliers.high.length} of {outliers.highTotal}</div>
                  )}
                </>
              )}
          </div>
          <div>
            <div style={{ color: RED, fontSize: 12, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
              ↓ Underperformed ({outliers.lowTotal})
            </div>
            {outliers.lowTotal === 0
              ? (
                <div style={{ color: MUTED, fontSize: 12.5, lineHeight: 1.5 }}>
                  None found — $/hour can't go below $0, so this side only flags sessions far below your typical range. That doesn't mean every session was strong, just that none were statistical extremes.
                </div>
              )
              : (
                <>
                  {outliers.low.map(s => <Row key={s.id} s={s} kind="low" medianDuration={outliers.medianDuration} />)}
                  {outliers.lowTotal > outliers.low.length && (
                    <div style={{ color: MUTED, fontSize: 11.5, marginTop: 8 }}>Showing top {outliers.low.length} of {outliers.lowTotal}</div>
                  )}
                </>
              )}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. PERIOD COMPARISON — last 30 days vs prior 30 days, at session level
// ═══════════════════════════════════════════════════════════════════════════════
function periodStats(sessions) {
  const count = sessions.length
  const timed = sessions.filter(s => !s.durationUnknown)
  const totalUSD = sessions.reduce((s, x) => s + x.totalUSD, 0)
  const totalHours = timed.reduce((s, x) => s + x.durationHours, 0)
  const totalTimedUSD = timed.reduce((s, x) => s + x.totalUSD, 0)
  return {
    count,
    avgSessionValue: count > 0 ? totalUSD / count : null,
    avgHourlyRate: totalHours > 0 ? totalTimedUSD / totalHours : null,
    avgDurationMin: timed.length > 0 ? timed.reduce((s, x) => s + x.durationMinutes, 0) / timed.length : null,
  }
}

function DeltaBadge({ current, prior, unit = "" }) {
  if (current == null || prior == null) return <span style={{ color: MUTED, fontSize: 12 }}>—</span>
  if (prior === 0) {
    return current > 0 ? <span style={{ color: GREEN, fontSize: 12, fontWeight: 700 }}>New activity</span> : <span style={{ color: MUTED, fontSize: 12 }}>—</span>
  }
  const pct = Math.round(((current - prior) / prior) * 100)
  const color = pct > 0 ? GREEN : pct < 0 ? RED : MUTED
  return <span style={{ color, fontSize: 12, fontWeight: 700 }}>{pct > 0 ? "▲" : pct < 0 ? "▼" : "→"} {Math.abs(pct)}%</span>
}

function PeriodComparisonCard({ sessions }) {
  const { prior, current, ready } = useMemo(() => {
    const now = Date.now()
    const ms30 = 30 * 24 * 60 * 60 * 1000
    const curSessions = sessions.filter(s => now - new Date(s.startTime).getTime() <= ms30)
    const priorSessions = sessions.filter(s => {
      const age = now - new Date(s.startTime).getTime()
      return age > ms30 && age <= ms30 * 2
    })
    return { current: periodStats(curSessions), prior: periodStats(priorSessions), ready: curSessions.length >= 3 }
  }, [sessions])

  const rows = [
    { label: "Sessions", cur: current.count, pri: prior.count, fmt: v => v == null ? "—" : String(v) },
    { label: "Avg $/hour", cur: current.avgHourlyRate, pri: prior.avgHourlyRate, fmt: fmtUSD },
    { label: "Avg session value", cur: current.avgSessionValue, pri: prior.avgSessionValue, fmt: fmtUSD },
    { label: "Avg duration", cur: current.avgDurationMin, pri: prior.avgDurationMin, fmt: fmtDur },
  ]

  return (
    <div style={card()}>
      {sectionTitle("Period Comparison", "Last 30 days vs. the 30 days before that, at the session level")}
      {!ready ? (
        <EmptyState sub="Need at least 3 sessions in the last 30 days to compare periods." />
      ) : (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 0.8fr", gap: 8, padding: "0 0 8px", borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ color: MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Metric</div>
            <div style={{ color: MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "right" }}>Prior 30d</div>
            <div style={{ color: MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "right" }}>Last 30d</div>
            <div style={{ color: MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "right" }}>Change</div>
          </div>
          {rows.map(r => (
            <div key={r.label} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 0.8fr", gap: 8, padding: "10px 0", borderBottom: `1px solid ${BORDER}`, alignItems: "center" }}>
              <div style={{ color: WHITE, fontSize: 13 }}>{r.label}</div>
              <div style={{ color: TEXT, fontSize: 13, textAlign: "right" }}>{prior.count < 3 ? "—" : r.fmt(r.pri)}</div>
              <div style={{ color: WHITE, fontSize: 13, fontWeight: 600, textAlign: "right" }}>{r.fmt(r.cur)}</div>
              <div style={{ textAlign: "right" }}>{prior.count < 3 ? <span style={{ color: MUTED, fontSize: 12 }}>—</span> : <DeltaBadge current={r.cur} prior={r.pri} />}</div>
            </div>
          ))}
          {prior.count < 3 && (
            <div style={{ color: MUTED, fontSize: 12, marginTop: 10 }}>Not enough prior-period data yet to calculate change — showing the last 30 days only.</div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. DATA RELIABILITY — session quality breakdown + confidence band
// ═══════════════════════════════════════════════════════════════════════════════
const CONFIDENCE_COLOR = { "Very Low": MUTED, "Low": GOLD, "Medium": CYAN, "High": GREEN }

function ReliabilityCard({ allValidSessions, meaningfulSessions }) {
  const meaningfulTimed = meaningfulSessions.filter(s => !s.durationUnknown)
  const streamedHours = meaningfulTimed.reduce((s, x) => s + x.durationHours, 0)
  const lowSignalCount = allValidSessions.length - meaningfulSessions.length
  const confidence = calculateConfidence(meaningfulSessions.length, streamedHours)
  const meaningfulPct = allValidSessions.length > 0 ? Math.round((meaningfulSessions.length / allValidSessions.length) * 100) : 0
  const knownDurationPct = meaningfulSessions.length > 0 ? Math.round((meaningfulTimed.length / meaningfulSessions.length) * 100) : 0

  return (
    <div style={card()}>
      {sectionTitle("Data Reliability", "How much to trust the patterns above")}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{
          padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700,
          background: `${CONFIDENCE_COLOR[confidence.level]}22`, color: CONFIDENCE_COLOR[confidence.level],
          border: `1px solid ${CONFIDENCE_COLOR[confidence.level]}55`,
        }}>
          {confidence.label}
        </div>
        <div style={{ color: MUTED, fontSize: 12 }}>
          {meaningfulSessions.length} usable session{meaningfulSessions.length === 1 ? "" : "s"} · {streamedHours.toFixed(1)}h streamed with a known duration
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ color: TEXT, fontSize: 12.5 }}>Meaningful sessions</span>
          <span style={{ color: WHITE, fontSize: 12.5, fontWeight: 600 }}>{meaningfulSessions.length} of {allValidSessions.length} ({meaningfulPct}%)</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden", display: "flex" }}>
          <div style={{ width: `${meaningfulPct}%`, background: GREEN }} />
          <div style={{ width: `${100 - meaningfulPct}%`, background: MUTED }} />
        </div>
        <div style={{ color: MUTED, fontSize: 11.5, marginTop: 4 }}>
          {lowSignalCount} low-signal session{lowSignalCount === 1 ? "" : "s"} excluded from the analysis above (short and low-revenue)
        </div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ color: TEXT, fontSize: 12.5 }}>Known session duration</span>
          <span style={{ color: WHITE, fontSize: 12.5, fontWeight: 600 }}>{meaningfulTimed.length} of {meaningfulSessions.length} ({knownDurationPct}%)</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden", display: "flex" }}>
          <div style={{ width: `${knownDurationPct}%`, background: CYAN }} />
          <div style={{ width: `${100 - knownDurationPct}%`, background: MUTED }} />
        </div>
        <div style={{ color: MUTED, fontSize: 11.5, marginTop: 4 }}>
          Session boundaries are inferred from tip timestamps (a platform change or a gap of more than 60 minutes starts a new session) — not a verified stream start/end time.
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export default function AnalyticsCharts({ analytics, tz }) {
  const allValidSessions = analytics?.allValidSessions || []
  const meaningfulSessions = analytics?.meaningfulSessions || allValidSessions.filter(s => s.sessionQuality === "meaningful")

  if (allValidSessions.length === 0) {
    return (
      <div style={{ background: BG, minHeight: "100%", padding: "24px" }}>
        <div style={card()}>
          <EmptyState sub="Session diagnostics appear after enough sessions are detected in your tip history." />
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: BG, minHeight: "100%", padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ color: WHITE, fontWeight: 800, fontSize: 22, marginBottom: 4 }}>Session Diagnostics</div>
        <div style={{ color: MUTED, fontSize: 13 }}>Deep session-level analysis — how metrics relate, how performance is distributed, what's an outlier, and how much to trust it</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 20 }}>
        <MetricRelationshipsCard sessions={meaningfulSessions} tz={tz} />
        <PerformanceDistributionCard sessions={meaningfulSessions} />
      </div>

      <OutlierCard sessions={meaningfulSessions} tz={tz} />
      <PeriodComparisonCard sessions={meaningfulSessions} />
      <ReliabilityCard allValidSessions={allValidSessions} meaningfulSessions={meaningfulSessions} />
    </div>
  )
}
