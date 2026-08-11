"use client"
import { useMemo, useState } from "react"
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"

const CARD   = "#121826"
const BORDER = "#1e2d45"
const WHITE  = "#F1F5F9"
const MUTED  = "#8a93ab"
const FAINT  = "#5E647C"
const TOTAL  = "#F59E0B"
const NEW    = "#22D3EE"
const RETURNING = "#a855f7"

// Matches the palette already used on AnalyticsCharts.js so a platform is
// always the same color everywhere in the dashboard.
const PLATFORM_COLORS = {
  Chaturbate: "#a855f7",
  BongaCams:  "#ec4899",
  MyFreeCams: "#22d3ee",
}
const PLATFORM_FALLBACK = ["#60A5FA", "#34D399", "#FB923C"]
const platColor = (p, i = 0) => PLATFORM_COLORS[p] || PLATFORM_FALLBACK[i % PLATFORM_FALLBACK.length]

const MONTHS_SHOWN = 8

const monthKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })

// Cumulative unique-fan count over time, per platform + a total (all platforms,
// deduped by username) — "Fan Growth Historic".
function fanGrowthSeries(tips, platforms) {
  const firstSeenByPlatform = {}   // platform -> username -> monthKey of first tip
  const firstSeenGlobal = {}       // username -> monthKey of first tip on any platform
  for (const t of tips) {
    const d = new Date(t.date_time || t.dateRaw)
    if (isNaN(d.getTime())) continue
    const k = monthKey(d)
    const plat = t.platform || "Unknown"
    const user = t.username || "unknown"
    firstSeenByPlatform[plat] ||= {}
    if (!firstSeenByPlatform[plat][user] || k < firstSeenByPlatform[plat][user]) firstSeenByPlatform[plat][user] = k
    if (!firstSeenGlobal[user] || k < firstSeenGlobal[user]) firstSeenGlobal[user] = k
  }

  const allMonths = [...new Set(tips.map(t => {
    const d = new Date(t.date_time || t.dateRaw)
    return isNaN(d.getTime()) ? null : monthKey(d)
  }).filter(Boolean))].sort()
  const months = allMonths.slice(-MONTHS_SHOWN)
  if (months.length === 0) return []

  return months.map((k) => {
    const row = { key: k, label: MONTH_FMT.format(new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, 1))) }
    for (const plat of platforms) {
      const seen = firstSeenByPlatform[plat] || {}
      row[plat] = Object.values(seen).filter(fk => fk <= k).length
    }
    row.total = Object.values(firstSeenGlobal).filter(fk => fk <= k).length
    return row
  })
}

// Unique new vs returning fans per month, per platform — "new" means this
// month is the fan's first-ever tip on that specific platform.
function newVsReturningByPlatform(tips, platforms) {
  const out = {}
  for (const plat of platforms) {
    const platTips = tips.filter(t => (t.platform || "Unknown") === plat)
    const firstSeen = {}
    for (const t of platTips) {
      const d = new Date(t.date_time || t.dateRaw)
      if (isNaN(d.getTime())) continue
      const k = monthKey(d)
      const user = t.username || "unknown"
      if (!firstSeen[user] || k < firstSeen[user]) firstSeen[user] = k
    }
    const monthUsers = {} // month -> Set(usernames active that month)
    for (const t of platTips) {
      const d = new Date(t.date_time || t.dateRaw)
      if (isNaN(d.getTime())) continue
      const k = monthKey(d)
      monthUsers[k] ||= new Set()
      monthUsers[k].add(t.username || "unknown")
    }
    const allMonths = Object.keys(monthUsers).sort()
    const months = allMonths.slice(-MONTHS_SHOWN)
    out[plat] = months.map((k) => {
      let newCount = 0, returningCount = 0
      for (const user of monthUsers[k]) {
        if (firstSeen[user] === k) newCount++
        else returningCount++
      }
      return {
        key: k,
        label: MONTH_FMT.format(new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, 1))),
        new: newCount,
        returning: returningCount,
      }
    })
    out[plat].total = platTips.length ? new Set(platTips.map(t => t.username)).size : 0
  }
  return out
}

const FanGrowthTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "#1e2840", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
      <div style={{ color: MUTED, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || MUTED, marginBottom: 2 }}>
          <span style={{ fontWeight: 700 }}>{p.name}:</span> {Math.round(p.value).toLocaleString()} fans
        </div>
      ))}
    </div>
  )
}

function PlatformLegend({ platforms, extra = [] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
      {extra.map((e) => (
        <div key={e.label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, fontSize: 11.5, fontWeight: 600, color: MUTED }}>
          <span style={{ width: 8, height: 8, borderRadius: e.shape === "square" ? 2 : "50%", background: e.color, flexShrink: 0 }} />
          {e.label}
        </div>
      ))}
      {platforms.map((p, i) => (
        <div key={p} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, fontSize: 11.5, fontWeight: 600, color: MUTED }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: platColor(p, i), flexShrink: 0 }} />
          {p}
        </div>
      ))}
    </div>
  )
}

function FanGrowthSlide({ tips, sessions, platforms }) {
  const series = useMemo(() => fanGrowthSeries(tips, platforms), [tips, platforms])

  if (series.length < 2) {
    return <div style={{ padding: "40px 0", textAlign: "center", color: MUTED, fontSize: 13 }}>Not enough months of data yet — keep streaming and tracking.</div>
  }

  return (
    <>
      <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 10 }}>
        Cumulative unique fans over time — every platform, always labeled below.
      </div>
      <PlatformLegend platforms={platforms} extra={[{ label: "All Platforms (Total)", color: TOTAL }]} />
      <ResponsiveContainer width="100%" height={230}>
        <LineChart data={series} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip content={<FanGrowthTooltip />} wrapperStyle={{ zIndex: 50 }} />
          <Line type="monotone" dataKey="total" name="All Platforms (Total)" stroke={TOTAL} strokeWidth={2.5} dot={false} />
          {platforms.map((p, i) => (
            <Line key={p} type="monotone" dataKey={p} name={p} stroke={platColor(p, i)} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </>
  )
}

function NewVsReturningSlide({ tips, platforms }) {
  const byPlatform = useMemo(() => newVsReturningByPlatform(tips, platforms), [tips, platforms])
  const activePlatforms = platforms.filter(p => (byPlatform[p] || []).length >= 2)

  if (activePlatforms.length === 0) {
    return <div style={{ padding: "40px 0", textAlign: "center", color: MUTED, fontSize: 13 }}>Not enough months of data yet per platform — keep streaming and tracking.</div>
  }

  return (
    <>
      <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 10 }}>
        New vs. returning fans per month, historically — one panel per platform.
      </div>
      <PlatformLegend platforms={[]} extra={[
        { label: "New Fans", color: NEW, shape: "square" },
        { label: "Returning Fans", color: RETURNING, shape: "square" },
      ]} />
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(activePlatforms.length, 3)}, 1fr)`, gap: 14 }}>
        {activePlatforms.map((plat, i) => {
          const data = byPlatform[plat]
          return (
            <div key={plat} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 12px 6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: platColor(plat, i), flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: WHITE }}>{plat}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: MUTED, fontWeight: 600 }}>{data.total.toLocaleString()} fans</span>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: FAINT, fontSize: 9.5 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: FAINT, fontSize: 9.5 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<FanGrowthTooltip />} wrapperStyle={{ zIndex: 50 }} />
                  <Bar dataKey="returning" stackId="fans" name="Returning" fill={RETURNING} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="new" stackId="fans" name="New" fill={NEW} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )
        })}
      </div>
    </>
  )
}

export default function FanGrowthCarousel({ tips, sessions }) {
  const [slide, setSlide] = useState(0)
  const platforms = useMemo(() => [...new Set((tips || []).map(t => t.platform || "Unknown"))], [tips])

  if (!tips || tips.length === 0) return null

  const slides = [
    { id: "growth", title: "Fan Growth", render: () => <FanGrowthSlide tips={tips} sessions={sessions} platforms={platforms} /> },
    { id: "new-vs-returning", title: "New vs. Returning Fans", render: () => <NewVsReturningSlide tips={tips} platforms={platforms} /> },
  ]

  const go = (delta) => setSlide((s) => (s + delta + slides.length) % slides.length)

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: WHITE }}>{slides[slide].title}</div>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: "#22D3EE", background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.3)", borderRadius: 999, padding: "2px 9px" }}>
            {slide + 1} / {slides.length}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => go(-1)} aria-label="Previous chart" style={navBtnStyle}>‹</button>
          <button onClick={() => go(1)} aria-label="Next chart" style={navBtnStyle}>›</button>
        </div>
      </div>

      {slides[slide].render()}

      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
        {slides.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setSlide(i)}
            aria-label={`Go to ${s.title}`}
            style={{
              width: i === slide ? 20 : 7, height: 7, borderRadius: 5, border: "none", cursor: "pointer", padding: 0,
              background: i === slide ? "linear-gradient(90deg,#22D3EE,#EC4899)" : "rgba(255,255,255,0.15)",
              transition: "all 0.2s ease",
            }}
          />
        ))}
      </div>
    </div>
  )
}

const navBtnStyle = {
  width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.05)",
  border: `1px solid ${BORDER}`, color: MUTED, cursor: "pointer", fontSize: 15, lineHeight: "28px",
}
