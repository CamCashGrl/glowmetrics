"use client"
import React, { useState, useMemo } from "react"
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ComposedChart, Line, LineChart,
  Cell,
} from "recharts"

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG      = "#0a0e1a"
const CARD    = "rgba(255,255,255,0.03)"
const BORDER  = "rgba(255,255,255,0.08)"
const TEXT    = "#94A3B8"
const WHITE   = "#F1F5F9"
const MUTED   = "#475569"

const PLATFORM_COLORS = {
  Chaturbate:  "#22d3ee",
  BongaCams:   "#e879f9",
  MyFreeCams:  "#a855f7",
}
const PLATFORM_FALLBACKS = ["#60A5FA", "#34D399", "#FB923C", "#F87171", "#FBBF24"]

const UTC_DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTH_NAMES    = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const card = (extra = {}) => ({
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  padding: "20px 24px",
  ...extra,
})

const heatColor = (val, max) => {
  if (!max || val === 0) return "rgba(255,255,255,0.04)"
  const t = Math.min(val / max, 1)
  return `rgba(34,211,238,${(0.08 + t * 0.82).toFixed(2)})`
}

const fmt$ = (v) => `$${Number(v).toFixed(2)}`
const fmtPct = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`

// ─── Custom Tooltip shells ────────────────────────────────────────────────────
const tipStyle = {
  background: "#0f1420",
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  padding: "8px 12px",
  color: WHITE,
  fontSize: 12,
}

function PlatformTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={tipStyle}>
      <div style={{ color: TEXT, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.dataKey}: {fmt$(p.value)}
        </div>
      ))}
    </div>
  )
}

function TokensTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={tipStyle}>
      <div style={{ color: TEXT, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.dataKey === "tokens" ? `Tokens: ${p.value.toLocaleString()}` : `Hours: ${p.value}`}
        </div>
      ))}
    </div>
  )
}

// ─── Toggle button ────────────────────────────────────────────────────────────
function Toggle({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            padding: "4px 12px",
            borderRadius: 6,
            border: `1px solid ${value === opt ? "#22d3ee" : BORDER}`,
            background: value === opt ? "rgba(34,211,238,0.12)" : "transparent",
            color: value === opt ? "#22d3ee" : TEXT,
            fontSize: 12,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function ChartHeader({ title, sub, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <div>
        <div style={{ color: WHITE, fontWeight: 600, fontSize: 15 }}>{title}</div>
        {sub && <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>{sub}</div>}
      </div>
      {right}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: 320, color: MUTED, gap: 8,
    }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3v18h18M7 16l4-4 4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div style={{ fontSize: 15, color: TEXT }}>Not enough data yet</div>
      <div style={{ fontSize: 13 }}>Analytics appear after 10+ tips are recorded</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHART 1 — EARNINGS HEATMAP
// ═══════════════════════════════════════════════════════════════════════════════
function EarningsHeatmap({ tips }) {
  const [mode, setMode] = useState("Overall")

  const { grid, maxAvg } = useMemo(() => {
    let filtered = tips
    const now = new Date()

    if (mode === "Daily") {
      const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      filtered = tips.filter((t) => new Date(t.date_time).getTime() >= start)
    } else if (mode === "Weekly") {
      const dow = now.getUTCDay()
      const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dow)
      filtered = tips.filter((t) => new Date(t.date_time).getTime() >= start)
    } else if (mode === "Monthly") {
      const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
      filtered = tips.filter((t) => new Date(t.date_time).getTime() >= start)
    }

    // grid[hour][day]
    const g = Array.from({ length: 24 }, () =>
      Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }))
    )

    filtered.forEach((t) => {
      const dt  = new Date(t.date_time)
      const h   = dt.getUTCHours()
      const d   = dt.getUTCDay()
      const usd = parseFloat(t.usd) || 0
      g[h][d].sum   += usd
      g[h][d].count += 1
    })

    let mx = 0
    const result = g.map((row) =>
      row.map((cell) => {
        const avg = cell.count > 0 ? cell.sum / cell.count : 0
        if (avg > mx) mx = avg
        return { avg, count: cell.count }
      })
    )

    return { grid: result, maxAvg: mx }
  }, [tips, mode])

  const hourLabel = (h) => {
    if (h === 0)  return "12a"
    if (h === 12) return "12p"
    return h < 12 ? `${h}a` : `${h - 12}p`
  }

  return (
    <div style={card()}>
      <ChartHeader
        title="Earnings Heatmap"
        sub="Average USD earned — hour of day × day of week (UTC)"
        right={<Toggle options={["Daily","Weekly","Monthly","Overall"]} value={mode} onChange={setMode} />}
      />

      {/* Day labels */}
      <div style={{ display: "grid", gridTemplateColumns: "32px repeat(7, 1fr)", gap: 2, marginBottom: 2 }}>
        <div />
        {UTC_DAYS_SHORT.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, color: MUTED }}>{d}</div>
        ))}
      </div>

      {/* Grid rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {grid.map((row, h) => (
          <div key={h} style={{ display: "grid", gridTemplateColumns: "32px repeat(7, 1fr)", gap: 2, alignItems: "center" }}>
            <div style={{ fontSize: 10, color: MUTED, textAlign: "right", paddingRight: 4 }}>
              {h % 3 === 0 ? hourLabel(h) : ""}
            </div>
            {row.map((cell, d) => (
              <div
                key={d}
                title={cell.count ? `${UTC_DAYS_SHORT[d]} ${hourLabel(h)}: avg ${fmt$(cell.avg)} (${cell.count} tips)` : ""}
                style={{
                  height: 11,
                  borderRadius: 2,
                  background: heatColor(cell.avg, maxAvg),
                  transition: "background 0.2s",
                  cursor: cell.count ? "pointer" : "default",
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, justifyContent: "flex-end" }}>
        <span style={{ fontSize: 11, color: MUTED }}>Low</span>
        {[0.1, 0.3, 0.5, 0.7, 0.9].map((t) => (
          <div
            key={t}
            style={{ width: 14, height: 14, borderRadius: 2, background: `rgba(34,211,238,${t})` }}
          />
        ))}
        <span style={{ fontSize: 11, color: MUTED }}>High</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHART 2 — PLATFORM COMPARISON BAR CHART
// ═══════════════════════════════════════════════════════════════════════════════
function PlatformComparisonChart({ tips }) {
  const { data, platforms } = useMemo(() => {
    const plats = [...new Set(tips.map((t) => t.platform).filter(Boolean))]

    const rows = UTC_DAYS_SHORT.map((day, dayIdx) => {
      const entry = { day }
      plats.forEach((p) => {
        entry[p] = tips
          .filter((t) => new Date(t.date_time).getUTCDay() === dayIdx && t.platform === p)
          .reduce((s, t) => s + (parseFloat(t.usd) || 0), 0)
      })
      return entry
    })

    return { data: rows, platforms: plats }
  }, [tips])

  const colorFor = (p, i) => PLATFORM_COLORS[p] || PLATFORM_FALLBACKS[i % PLATFORM_FALLBACKS.length]

  return (
    <div style={card()}>
      <ChartHeader
        title="Platform Comparison"
        sub="Total USD per platform by day of week"
      />
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} barGap={2} barCategoryGap="28%">
          <CartesianGrid stroke={BORDER} vertical={false} />
          <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: TEXT, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip content={<PlatformTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: TEXT, paddingTop: 8 }}
            formatter={(val) => <span style={{ color: colorFor(val, platforms.indexOf(val)) }}>{val}</span>}
          />
          {platforms.map((p, i) => (
            <Bar key={p} dataKey={p} fill={colorFor(p, i)} radius={[3, 3, 0, 0]} maxBarSize={28} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHART 3 — TOKENS VS HOURS ONLINE
// ═══════════════════════════════════════════════════════════════════════════════
function TokensVsHoursChart({ tips }) {
  const [timeframe, setTimeframe] = useState("Weekly")

  const chartData = useMemo(() => {
    // Group tips into sessions: tips within 4hr windows
    const sorted = [...tips].sort((a, b) => new Date(a.date_time) - new Date(b.date_time))

    const sessions = []
    let cur = null
    sorted.forEach((t) => {
      const dt = new Date(t.date_time)
      if (!cur || dt - cur.end > 4 * 3600_000) {
        cur = { start: dt, end: dt }
        sessions.push(cur)
      } else {
        cur.end = dt
      }
    })

    const bucketKey = (date) => {
      const d = new Date(date)
      if (timeframe === "Weekly") {
        const dow     = d.getUTCDay()
        const offset  = dow === 0 ? 6 : dow - 1   // Monday-based week
        const monday  = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - offset))
        const m       = monday.getUTCMonth()
        const day     = monday.getUTCDate()
        return `${MONTH_NAMES[m]} ${day}`
      } else {
        return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`
      }
    }

    const buckets = {}

    tips.forEach((t) => {
      const k = bucketKey(t.date_time)
      if (!buckets[k]) buckets[k] = { tokens: 0, hours: 0, _ts: new Date(t.date_time).getTime() }
      buckets[k].tokens += parseFloat(t.tokens) || 0
    })

    sessions.forEach((s) => {
      const k = bucketKey(s.start)
      if (!buckets[k]) buckets[k] = { tokens: 0, hours: 0, _ts: s.start.getTime() }
      const dur = Math.max(0.5, (s.end - s.start) / 3600_000)
      buckets[k].hours += dur
    })

    return Object.entries(buckets)
      .sort(([, a], [, b]) => a._ts - b._ts)
      .map(([date, v]) => ({
        date,
        tokens: Math.round(v.tokens),
        hours:  parseFloat(v.hours.toFixed(1)),
      }))
  }, [tips, timeframe])

  return (
    <div style={card()}>
      <ChartHeader
        title="Tokens vs Hours Online"
        sub="Weekly earnings rhythm — tokens (left) and stream hours (right)"
        right={<Toggle options={["Weekly","Monthly"]} value={timeframe} onChange={setTimeframe} />}
      />
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartData}>
          <CartesianGrid stroke={BORDER} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: TEXT, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="tokens"
            orientation="left"
            tick={{ fill: "#22d3ee", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
          />
          <YAxis
            yAxisId="hours"
            orientation="right"
            tick={{ fill: "#e879f9", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}h`}
          />
          <Tooltip content={<TokensTooltip />} cursor={{ stroke: BORDER }} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(val) => (
              <span style={{ color: val === "tokens" ? "#22d3ee" : "#e879f9" }}>
                {val === "tokens" ? "Tokens" : "Hours Online"}
              </span>
            )}
          />
          <Line
            yAxisId="tokens"
            type="monotone"
            dataKey="tokens"
            stroke="#22d3ee"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#22d3ee" }}
          />
          <Line
            yAxisId="hours"
            type="monotone"
            dataKey="hours"
            stroke="#e879f9"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#e879f9" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHART 4 — MONTHLY GROWTH CARD
// ═══════════════════════════════════════════════════════════════════════════════
function MonthlyGrowthCard({ tips }) {
  const { months, delta, deltaPercent, current } = useMemo(() => {
    const acc = {}
    tips.forEach((t) => {
      const dt  = new Date(t.date_time)
      const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`
      acc[key]  = (acc[key] || 0) + (parseFloat(t.usd) || 0)
    })

    const sorted = Object.entries(acc)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, usd]) => {
        const [, m] = key.split("-")
        return { month: MONTH_NAMES[parseInt(m) - 1], usd: parseFloat(usd.toFixed(2)) }
      })

    let delta       = null
    let deltaPercent = null
    if (sorted.length >= 2) {
      const curr = sorted[sorted.length - 1].usd
      const prev = sorted[sorted.length - 2].usd
      delta        = curr - prev
      deltaPercent = prev > 0 ? ((curr - prev) / prev) * 100 : null
    }

    return { months: sorted, delta, deltaPercent, current: sorted[sorted.length - 1]?.usd || 0 }
  }, [tips])

  const isPositive = delta !== null && delta >= 0
  const deltaColor = isPositive ? "#10B981" : "#F87171"

  return (
    <div style={card()}>
      <ChartHeader title="Monthly Growth" sub="Last 6 months — month-over-month USD change" />

      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ color: MUTED, fontSize: 12, marginBottom: 2 }}>This month</div>
          <div style={{ color: WHITE, fontSize: 28, fontWeight: 700, lineHeight: 1 }}>
            {fmt$(current)}
          </div>
        </div>
        {delta !== null && (
          <div style={{ paddingBottom: 2 }}>
            <div
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: isPositive ? "rgba(16,185,129,0.10)" : "rgba(248,113,113,0.10)",
                border: `1px solid ${isPositive ? "rgba(16,185,129,0.25)" : "rgba(248,113,113,0.25)"}`,
                borderRadius: 6, padding: "4px 10px",
                color: deltaColor, fontSize: 13, fontWeight: 600,
              }}
            >
              <span>{isPositive ? "▲" : "▼"}</span>
              <span>{fmt$(Math.abs(delta))}</span>
              {deltaPercent !== null && (
                <span style={{ opacity: 0.75 }}>({fmtPct(deltaPercent)})</span>
              )}
            </div>
            <div style={{ color: MUTED, fontSize: 11, marginTop: 3 }}>vs last month</div>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={80}>
        <BarChart data={months} barCategoryGap="20%">
          <XAxis dataKey="month" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div style={tipStyle}>{label}: {fmt$(payload[0].value)}</div>
              ) : null
            }
          />
          <Bar dataKey="usd" radius={[3, 3, 0, 0]} maxBarSize={32}>
            {months.map((entry, i) => (
              <Cell
                key={i}
                fill={i === months.length - 1 ? "#22d3ee" : "rgba(34,211,238,0.35)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
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
    <div style={{ background: BG, minHeight: "100%", padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Row 1 — Heatmap full-width */}
      <EarningsHeatmap tips={tips} />

      {/* Row 2 — Platform comparison */}
      <PlatformComparisonChart tips={tips} />

      {/* Row 3 — Tokens vs Hours + Monthly growth side-by-side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20 }}>
        <TokensVsHoursChart tips={tips} />
        <MonthlyGrowthCard tips={tips} />
      </div>

    </div>
  )
}
