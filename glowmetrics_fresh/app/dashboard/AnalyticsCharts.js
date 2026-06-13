"use client"
import React, { useState, useMemo } from "react"

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG     = "#0a0e1a"
const CARD   = "rgba(255,255,255,0.03)"
const BORDER = "rgba(255,255,255,0.08)"
const TEXT   = "#94A3B8"
const WHITE  = "#F1F5F9"
const MUTED  = "#475569"

// Platform colors for carousel charts
const CC = {
  Chaturbate: "#a855f7",
  BongaCams:  "#ec4899",
  MyFreeCams: "#22d3ee",
}
const CC_FALLBACK = ["#60A5FA", "#34D399", "#FB923C"]

const WEEK     = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const WEEK_UTC = [1, 2, 3, 4, 5, 6, 0] // UTC getUTCDay() index per WEEK entry

const card = (extra = {}) => ({
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  padding: "20px 24px",
  ...extra,
})

function niceMax(v) {
  if (!v || v <= 0) return 10
  const mag  = Math.pow(10, Math.floor(Math.log10(v)))
  const n    = v / mag
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return nice * mag
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: 320, color: MUTED, gap: 8,
    }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3v18h18M7 16l4-4 4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div style={{ fontSize: 15, color: TEXT }}>Not enough data yet</div>
      <div style={{ fontSize: 13 }}>Analytics appear after 10+ tips are recorded</div>
    </div>
  )
}

// ─── SVG grouped bar chart (Charts 1 & 3) ────────────────────────────────────
function SVGGroupedBars({ data, platforms, formatY, colorMap }) {
  const W = 560, H = 210
  const ML = 58, MR = 12, MT = 10, MB = 36
  const plotW = W - ML - MR
  const plotH = H - MT - MB

  const maxVal  = Math.max(...data.flatMap(d => platforms.map(p => d[p] || 0)), 0.001)
  const yMax    = niceMax(maxVal)
  const YTICKS  = 4
  const dayW    = plotW / data.length
  const nP      = Math.max(platforms.length, 1)
  const barW    = Math.max(4, Math.floor((dayW * 0.7) / nP) - 2)
  const yScale  = v => plotH * (1 - v / yMax)
  const ticks   = Array.from({ length: YTICKS + 1 }, (_, i) => (yMax / YTICKS) * i)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
      {ticks.map((v, i) => {
        const y = MT + yScale(v)
        return (
          <g key={i}>
            <line x1={ML} x2={ML + plotW} y1={y} y2={y} stroke={BORDER} strokeWidth={1} />
            <text x={ML - 5} y={y + 4} textAnchor="end" fill={TEXT} fontSize={10}>{formatY(v)}</text>
          </g>
        )
      })}
      {data.map((d, di) => {
        const cx     = ML + di * dayW + dayW / 2
        const totalW = nP * barW + (nP - 1) * 2
        return (
          <g key={d.day}>
            {platforms.map((p, pi) => {
              const val  = d[p] || 0
              const barH = Math.max(0, (val / yMax) * plotH)
              const x    = cx - totalW / 2 + pi * (barW + 2)
              const y    = MT + plotH - barH
              return (
                <rect key={p} x={x} y={y} width={barW} height={barH}
                  fill={colorMap[p] || CC_FALLBACK[pi % CC_FALLBACK.length]} rx={2} />
              )
            })}
            <text x={cx} y={MT + plotH + 16} textAnchor="middle" fill={TEXT} fontSize={11}>
              {d.day}
            </text>
          </g>
        )
      })}
      <line x1={ML} x2={ML + plotW} y1={MT + plotH} y2={MT + plotH} stroke={BORDER} strokeWidth={1} />
    </svg>
  )
}

// ─── SVG single bar chart (Chart 2) ──────────────────────────────────────────
function SVGSingleBars({ data, color, formatY }) {
  const W = 560, H = 210
  const ML = 58, MR = 12, MT = 10, MB = 36
  const plotW = W - ML - MR
  const plotH = H - MT - MB

  const maxVal = Math.max(...data.map(d => d.value || 0), 0.001)
  const yMax   = niceMax(maxVal)
  const YTICKS = 4
  const dayW   = plotW / data.length
  const barW   = Math.max(8, Math.floor(dayW * 0.55))
  const yScale = v => plotH * (1 - v / yMax)
  const ticks  = Array.from({ length: YTICKS + 1 }, (_, i) => (yMax / YTICKS) * i)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
      {ticks.map((v, i) => {
        const y = MT + yScale(v)
        return (
          <g key={i}>
            <line x1={ML} x2={ML + plotW} y1={y} y2={y} stroke={BORDER} strokeWidth={1} />
            <text x={ML - 5} y={y + 4} textAnchor="end" fill={TEXT} fontSize={10}>{formatY(v)}</text>
          </g>
        )
      })}
      {data.map((d, di) => {
        const cx   = ML + di * dayW + dayW / 2
        const barH = Math.max(0, ((d.value || 0) / yMax) * plotH)
        return (
          <g key={d.day}>
            <rect x={cx - barW / 2} y={MT + plotH - barH} width={barW} height={barH} fill={color} rx={2} />
            <text x={cx} y={MT + plotH + 16} textAnchor="middle" fill={TEXT} fontSize={11}>
              {d.day}
            </text>
          </g>
        )
      })}
      <line x1={ML} x2={ML + plotW} y1={MT + plotH} y2={MT + plotH} stroke={BORDER} strokeWidth={1} />
    </svg>
  )
}

// ─── Color legend ─────────────────────────────────────────────────────────────
function ColorLegend({ platforms, colorMap }) {
  return (
    <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 12 }}>
      {platforms.map((p, i) => (
        <div key={p} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: colorMap[p] || CC_FALLBACK[i] }} />
          <span style={{ color: TEXT, fontSize: 12 }}>{p}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Session inference helper ─────────────────────────────────────────────────
function inferHoursByUTCDay(tips) {
  const sorted = [...tips].sort((a, b) => new Date(a.date_time) - new Date(b.date_time))
  const sessions = []
  let cur = null
  sorted.forEach(t => {
    const dt = new Date(t.date_time)
    if (!cur || dt - cur.end > 4 * 3600_000) {
      cur = { start: dt, end: dt }
      sessions.push(cur)
    } else {
      cur.end = dt
    }
  })
  const hours = [0, 0, 0, 0, 0, 0, 0]
  sessions.forEach(s => {
    hours[s.start.getUTCDay()] += Math.max(0.5, (s.end - s.start) / 3600_000)
  })
  return hours
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHART 1 — EARNINGS BY DAY
// ═══════════════════════════════════════════════════════════════════════════════
function EarningsByDayChart({ tips }) {
  const { data, platforms } = useMemo(() => {
    const plats = [...new Set(tips.map(t => t.platform).filter(Boolean))]
    const rows = WEEK.map((day, wi) => {
      const utcDay = WEEK_UTC[wi]
      const row = { day }
      plats.forEach(p => {
        row[p] = tips
          .filter(t => new Date(t.date_time).getUTCDay() === utcDay && t.platform === p)
          .reduce((s, t) => s + (parseFloat(t.usd) || 0), 0)
      })
      return row
    })
    return { data: rows, platforms: plats }
  }, [tips])

  return (
    <>
      <SVGGroupedBars
        data={data}
        platforms={platforms}
        formatY={v => v === 0 ? "$0" : v >= 100 ? `$${v.toFixed(0)}` : `$${v.toFixed(1)}`}
        colorMap={CC}
      />
      <ColorLegend platforms={platforms} colorMap={CC} />
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHART 2 — HOURS STREAMED BY DAY
// ═══════════════════════════════════════════════════════════════════════════════
function HoursStreamedChart({ tips }) {
  const data = useMemo(() => {
    const hoursByUTCDay = inferHoursByUTCDay(tips)
    return WEEK.map((day, wi) => ({
      day,
      value: parseFloat(hoursByUTCDay[WEEK_UTC[wi]].toFixed(1)),
    }))
  }, [tips])

  return (
    <SVGSingleBars
      data={data}
      color="#22d3ee"
      formatY={v => v === 0 ? "0h" : `${v < 10 ? v.toFixed(1) : v.toFixed(0)}h`}
    />
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHART 3 — REVENUE PER HOUR BY DAY
// ═══════════════════════════════════════════════════════════════════════════════
function RevPerHourChart({ tips }) {
  const { data, platforms } = useMemo(() => {
    const plats = [...new Set(tips.map(t => t.platform).filter(Boolean))]
    const hoursByUTCDay = inferHoursByUTCDay(tips)

    const rows = WEEK.map((day, wi) => {
      const utcDay = WEEK_UTC[wi]
      const hours  = hoursByUTCDay[utcDay] || 0
      const row = { day }
      plats.forEach(p => {
        const earnings = tips
          .filter(t => new Date(t.date_time).getUTCDay() === utcDay && t.platform === p)
          .reduce((s, t) => s + (parseFloat(t.usd) || 0), 0)
        row[p] = hours > 0 ? parseFloat((earnings / hours).toFixed(2)) : 0
      })
      return row
    })
    return { data: rows, platforms: plats }
  }, [tips])

  return (
    <>
      <SVGGroupedBars
        data={data}
        platforms={platforms}
        formatY={v => v === 0 ? "$0" : `$${v.toFixed(1)}`}
        colorMap={CC}
      />
      <ColorLegend platforms={platforms} colorMap={CC} />
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAROUSEL
// ═══════════════════════════════════════════════════════════════════════════════
const CHARTS = [
  {
    title: "Earnings by Day",
    sub: "Total USD per platform, by day of week",
    Component: EarningsByDayChart,
  },
  {
    title: "Hours Streamed by Day",
    sub: "Estimated streaming hours per day (inferred from sessions)",
    Component: HoursStreamedChart,
  },
  {
    title: "Revenue Per Hour by Day",
    sub: "USD ÷ hours streamed — true performance per hour",
    Component: RevPerHourChart,
  },
]

const arrowBtn = {
  width: 32, height: 32,
  border: `1px solid ${BORDER}`,
  borderRadius: 6,
  background: "transparent",
  color: WHITE,
  fontSize: 22,
  lineHeight: "30px",
  textAlign: "center",
  cursor: "pointer",
  userSelect: "none",
  padding: 0,
}

function ChartCarousel({ tips }) {
  const [idx, setIdx] = useState(0)
  const { title, sub, Component } = CHARTS[idx]
  const total = CHARTS.length

  return (
    <div style={card()}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ color: WHITE, fontWeight: 600, fontSize: 15 }}>{title}</div>
          <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>{sub}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: MUTED, fontSize: 12 }}>{idx + 1} of {total}</span>
          <button
            onClick={() => setIdx((idx - 1 + total) % total)}
            style={arrowBtn}
            aria-label="Previous chart"
          >‹</button>
          <button
            onClick={() => setIdx((idx + 1) % total)}
            style={arrowBtn}
            aria-label="Next chart"
          >›</button>
        </div>
      </div>
      <Component tips={tips} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export default function AnalyticsCharts({ tips = [] }) {
  if (!tips || tips.length < 10) {
    return (
      <div style={{ background: BG, minHeight: "100%", padding: "24px" }}>
        <div style={card()}>
          <EmptyState />
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: BG, minHeight: "100%", padding: "24px" }}>
      <ChartCarousel tips={tips} />
    </div>
  )
}
