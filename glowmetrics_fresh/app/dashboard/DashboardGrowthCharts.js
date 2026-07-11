"use client"
import { useMemo, useState } from "react"
import {
  ComposedChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"

const CARD   = "#121826"
const BORDER = "#1e2d45"
const CYAN   = "#22D3EE"
const PINK   = "#EC4899"
const RED    = "#F87171"
const GREEN  = "#10B981"
const WHITE  = "#F1F5F9"
const TEXT   = "#94A3B8"
const MUTED  = "#475569"

const fmtUsd = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

function isoWeekStart(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() || 7 // Mon=1 .. Sun=7
  d.setUTCDate(d.getUTCDate() - day + 1)
  return d
}
const dayKey   = (date) => date.toISOString().slice(0, 10)
const weekKey  = (date) => isoWeekStart(date).toISOString().slice(0, 10)
const monthKey = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`

const DAY_FMT   = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
const WEEK_FMT  = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })
const TIME_FMT  = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: true, timeZone: "UTC" })

const MODE_CONFIG = {
  daily:   { keyFn: dayKey,   fmt: DAY_FMT,   label: "Daily",   unit: "days",   take: 14 },
  weekly:  { keyFn: weekKey,  fmt: WEEK_FMT,  label: "Weekly",  unit: "weeks",  take: 12 },
  monthly: { keyFn: monthKey, fmt: MONTH_FMT, label: "Monthly", unit: "months", take: 12 },
  time:    { keyFn: (d) => String(d.getUTCHours()), fmt: TIME_FMT, label: "Time of Day", unit: "hours", take: 24 },
}

function tokensVsHoursSeries(tips, sessions, mode) {
  const { keyFn, take } = MODE_CONFIG[mode]
  const isTime = mode === "time"
  const map = {}
  for (const t of tips) {
    const d = new Date(t.date_time || t.dateRaw)
    if (isNaN(d.getTime())) continue
    const k = keyFn(d)
    if (!map[k]) map[k] = { key: k, sortDate: d, tokens: 0, hours: 0 }
    map[k].tokens += Number(t.tokens || 0)
  }
  for (const s of sessions) {
    const d = new Date(s.startTime)
    if (isNaN(d.getTime())) continue
    const k = keyFn(d)
    if (!map[k]) map[k] = { key: k, sortDate: d, tokens: 0, hours: 0 }
    map[k].hours += Number(s.durationHours || 0)
  }
  const rows = Object.values(map).sort((a, b) =>
    isTime ? Number(a.key) - Number(b.key) : a.key.localeCompare(b.key)
  )
  return (isTime ? rows : rows.slice(-take)).map((row) => ({
    ...row,
    label: isTime
      ? TIME_FMT.format(new Date(Date.UTC(2000, 0, 1, Number(row.key))))
      : MODE_CONFIG[mode].fmt.format(row.sortDate),
    hours: parseFloat(row.hours.toFixed(1)),
  }))
}

function monthlyUsdSeries(tips) {
  const map = {}
  for (const t of tips) {
    const d = new Date(t.date_time || t.dateRaw)
    if (isNaN(d.getTime())) continue
    const k = monthKey(d)
    if (!map[k]) map[k] = { key: k, sortDate: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)), usd: 0 }
    map[k].usd += Number(t.usd || 0)
  }
  return Object.values(map)
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-6)
    .map((row) => ({ ...row, label: MONTH_FMT.format(row.sortDate), usd: parseFloat(row.usd.toFixed(2)) }))
}

const GrowthTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "#1e2840", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
      <div style={{ color: MUTED, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || TEXT, marginBottom: 2 }}>
          <span style={{ fontWeight: 700 }}>{p.name}:</span>{" "}
          {p.dataKey === "tokens" ? `${Math.round(p.value).toLocaleString()} tokens`
            : p.dataKey === "hours" ? `${p.value.toFixed(1)}h`
            : fmtUsd(p.value)}
        </div>
      ))}
    </div>
  )
}

export default function DashboardGrowthCharts({ tips, sessions }) {
  const [mode, setMode] = useState("weekly")

  const series = useMemo(() => tokensVsHoursSeries(tips, sessions || [], mode), [tips, sessions, mode])
  const monthly = useMemo(() => monthlyUsdSeries(tips), [tips])

  const thisMonth = monthly[monthly.length - 1] || null
  const prevMonth = monthly[monthly.length - 2] || null
  const growthPct = thisMonth && prevMonth && prevMonth.usd > 0
    ? Math.round(((thisMonth.usd - prevMonth.usd) / prevMonth.usd) * 100)
    : null
  const isPositive = growthPct !== null && growthPct >= 0

  if (!tips || tips.length === 0) return null

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
      {/* Tokens vs Hours Online */}
      <div style={{ flex: "2 1 420px", minWidth: 320, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: WHITE }}>Tokens vs Hours Online</div>
            <div style={{ fontSize: 11, color: MUTED }}>
              {MODE_CONFIG[mode].label} earnings rhythm — tokens (left) and stream hours (right)
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 3, flexWrap: "wrap" }}>
            {[["daily", "Day"], ["weekly", "Week"], ["monthly", "Month"], ["time", "Time"]].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                style={{
                  padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 600,
                  background: mode === id ? "rgba(34,211,238,0.15)" : "transparent",
                  color: mode === id ? CYAN : MUTED,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {series.length < 2 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: MUTED, fontSize: 13 }}>
            Not enough {MODE_CONFIG[mode].unit} of data yet — keep streaming and tracking.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={series} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} interval={mode === "daily" ? "preserveStartEnd" : mode === "time" ? 2 : 0} />
              <YAxis yAxisId="left" tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${Math.round(v)}`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}h`} />
              <Tooltip content={<GrowthTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: MUTED }} />
              <Line yAxisId="left" type="monotone" dataKey="tokens" name="Tokens" stroke={CYAN} strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="hours" name="Hours Online" stroke={PINK} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Monthly Growth */}
      <div style={{ flex: "1 1 260px", minWidth: 240, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "18px 20px" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: WHITE, marginBottom: 2 }}>Monthly Growth</div>
        <div style={{ fontSize: 11, color: MUTED, marginBottom: 14 }}>Last {monthly.length} months — month-over-month USD change</div>

        {thisMonth ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>This month</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: WHITE }}>{fmtUsd(thisMonth.usd)}</div>
              </div>
              {growthPct !== null && (
                <div style={{
                  padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                  background: isPositive ? "rgba(16,185,129,0.12)" : "rgba(248,113,113,0.12)",
                  color: isPositive ? GREEN : RED,
                }}>
                  {isPositive ? "▲" : "▼"} {Math.abs(growthPct)}%
                  <span style={{ color: MUTED, fontWeight: 500, marginLeft: 4 }}>vs last month</span>
                </div>
              )}
            </div>

            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={monthly} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<GrowthTooltip />} />
                <Bar dataKey="usd" name="$ Earned" radius={[4, 4, 0, 0]}>
                  {monthly.map((m, i) => (
                    <Cell key={m.key} fill={i === monthly.length - 1 ? CYAN : "rgba(34,211,238,0.3)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        ) : (
          <div style={{ padding: "24px 0", textAlign: "center", color: MUTED, fontSize: 13 }}>
            Upload more history to see monthly growth.
          </div>
        )}
      </div>
    </div>
  )
}
