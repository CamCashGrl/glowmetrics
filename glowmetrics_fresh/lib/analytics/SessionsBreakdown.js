"use client"
import { useState, useMemo } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { getSessionBreakdown, SESSION_PERF_BADGE } from "../../lib/analytics/sessionBreakdown"
import { computePaidSessionAnalytics } from "../../lib/analytics"
import SessionDrawer from "./SessionDrawer"

const C = {
  bg: "#05070f", card: "rgba(15,20,32,0.75)", border: "rgba(255,255,255,0.08)",
  cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B", purple: "#a855f7",
  green: "#10B981", red: "#F87171", orange: "#FB923C", white: "#F1F5F9",
  text: "#94A3B8", muted: "#475569",
}
const glassCard = { background: C.card, border: `1px solid ${C.border}`, backdropFilter: "blur(20px)", boxShadow: "0 0 40px rgba(59,130,246,0.10), 0 0 80px rgba(236,72,153,0.06)" }

const TYPE_META = {
  free: { label: "Free Chat", icon: "🎥", color: C.cyan },
  live: { label: "Live Mode", icon: "🔴", color: C.orange },
  paid: { label: "Paid / Private", icon: "💎", color: C.purple },
}
const PLATFORMS = ["Chaturbate", "BongaCams", "MyFreeCams", "Stripchat", "CamSoda"]
const RANGES = [{ id: "7d", label: "7D", days: 7 }, { id: "30d", label: "30D", days: 30 }, { id: "90d", label: "90D", days: 90 }, { id: "all", label: "ALL", days: null }]
const TYPES = [{ id: "all", label: "All Sessions" }, { id: "live", label: "Live Mode" }, { id: "free", label: "Free Chat" }, { id: "paid", label: "Paid" }]

const fmtUsd = (n) => `$${Number(n || 0).toFixed(2)}`
const fmtUsd0 = (n) => `$${Math.round(Number(n || 0)).toLocaleString("en-US")}`
const fmtHrs = (h) => h == null ? "—" : `${h.toFixed(1)}h`
const fmtDur = (mins) => {
  if (mins == null) return "—"
  const h = Math.floor(mins / 60), m = Math.round(mins % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
const fmtDateShort = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
const fmtDateTime = (d) => new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })

// ── Normalizers: pull the fields every row shape needs, per session type ──
function rowPlatform(type, s) { return type === "live" ? (s.stream_platform || "Chaturbate") : s.platform }
function rowDate(type, s) { return type === "free" ? s.startTime : type === "live" ? s.started_at : s.date_time }
function rowDurationMinutes(type, s) {
  if (type === "free") return s.durationUnknown ? null : s.durationMinutes
  if (type === "live") {
    if (!s.ended_at) return null
    const secs = (new Date(s.ended_at) - new Date(s.started_at)) / 1000 - (s.total_paused_seconds || 0)
    return secs > 0 ? secs / 60 : null
  }
  return null // paid — not tracked
}
function rowRevenue(type, s) { return type === "free" ? s.totalUSD : type === "live" ? (s.session_earnings_usd || 0) : (parseFloat(s.usd) || 0) }
function rowUsdPerHr(type, s) {
  const mins = rowDurationMinutes(type, s)
  if (!mins || mins <= 0) return type === "free" ? s.usdPerHour : null
  return parseFloat((rowRevenue(type, s) / (mins / 60)).toFixed(2))
}
function rowTopContributor(type, s) {
  if (type === "paid") return s.username || null
  if (type === "free") return s.topContributor || null
  return null
}
function cutoffFor(rangeId) {
  const r = RANGES.find(x => x.id === rangeId)
  if (!r || r.days == null) return null
  return Date.now() - r.days * 86400000
}
function computeReturningFans(freeRows, paidRows) {
  const counts = {}
  freeRows.forEach(s => {
    const seen = new Set()
    ;(s.tips || []).forEach(t => {
      const u = (t.username || "").toLowerCase()
      if (!u || seen.has(u)) return
      seen.add(u)
      counts[u] = (counts[u] || 0) + 1
    })
  })
  paidRows.forEach(s => {
    const u = (s.username || "").toLowerCase()
    if (!u) return
    counts[u] = (counts[u] || 0) + 1
  })
  return Object.values(counts).filter(c => c > 1).length
}

// ── Small building blocks ──────────────────────────────────────────────
function Pill({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 13px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer",
      border: `1px solid ${active ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.1)"}`,
      background: active ? "linear-gradient(135deg,rgba(34,211,238,0.16),rgba(168,85,247,0.10))" : "rgba(255,255,255,0.03)",
      color: active ? C.white : C.text, transition: "all .15s", whiteSpace: "nowrap",
    }}>{children}</button>
  )
}
function ScoreCard({ label, value, color = C.white, deltaPct, deltaGood = true }) {
  return (
    <div style={{ ...glassCard, borderRadius: 14, padding: "16px 16px" }}>
      <div style={{ fontSize: 10.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 800, color }}>{value}</div>
      {deltaPct != null && (
        <div style={{ fontSize: 11, marginTop: 4, fontWeight: 700, color: (deltaPct >= 0) === deltaGood ? C.green : C.orange }}>
          {deltaPct >= 0 ? "▲" : "▼"} {Math.abs(deltaPct)}% vs prior period
        </div>
      )}
    </div>
  )
}
function NoSessions({ hasHistory, onViewHistorical }) {
  return (
    <div style={{ ...glassCard, borderRadius: 16, padding: "44px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>🎥</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.white, marginBottom: 6 }}>No recent sessions</div>
      <div style={{ fontSize: 13, color: C.muted, maxWidth: 440, margin: "0 auto" }}>
        Once you stream, CamCash will start showing what worked, which fans contributed, and how your sessions are performing.
      </div>
      {hasHistory && (
        <button onClick={onViewHistorical} style={{ marginTop: 16, padding: "9px 18px", borderRadius: 10, background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.3)", color: C.cyan, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          View historical data
        </button>
      )}
    </div>
  )
}

export default function Sessions({
  sessions = [],                // analytics.allValidSessions
  meaningfulSessions = [],      // analytics.meaningfulSessions
  lowSignalSessionCount = 0,
  paidSessions = [],
  liveSessions = [],            // replaySessions
  liveSessionsLoading = false,
  coachingEventsBySession = {},
  loadCoachingEvents,
  coachingLoadingSessionId = null,
  recentCoachingEvents = [],
  recentCoachingLoading = false,
  tipsTotalUSD = null,
  liveTotalUSD = null,
  monthlyData = [],
  timezone = "UTC",
  onViewFan,
  meaningfulOnly = true,
  setMeaningfulOnly,
}) {
  const [range, setRange] = useState("30d")
  const [typeFilter, setTypeFilter] = useState("all")
  const [platform, setPlatform] = useState("all")
  const [sortBy, setSortBy] = useState("newest")
  const [page, setPage] = useState(1)
  const [trendMetric, setTrendMetric] = useState("usdPerHour")
  const [drawerRow, setDrawerRow] = useState(null)
  const PAGE_SIZE = 12

  const freeBase = meaningfulOnly ? meaningfulSessions : sessions
  const cutoff = cutoffFor(range)

  const inRange = (type, s) => {
    const t = new Date(rowDate(type, s)).getTime()
    if (cutoff != null && t < cutoff) return false
    if (platform !== "all" && rowPlatform(type, s) !== platform) return false
    return true
  }

  const filteredFree = useMemo(() => freeBase.filter(s => inRange("free", s)), [freeBase, cutoff, platform])
  const filteredLive = useMemo(() => liveSessions.filter(s => !s.is_inaccurate && inRange("live", s)), [liveSessions, cutoff, platform])
  const filteredPaid = useMemo(() => paidSessions.filter(s => inRange("paid", s)), [paidSessions, cutoff, platform])

  const hasAnyHistory = sessions.length > 0 || liveSessions.length > 0 || paidSessions.length > 0
  const hasFilteredData = filteredFree.length > 0 || filteredLive.length > 0 || filteredPaid.length > 0

  // ── Previous-period comparison (skipped for range === 'all') ──
  const prevWindow = useMemo(() => {
    const r = RANGES.find(x => x.id === range)
    if (!r || r.days == null) return null
    const end = Date.now() - r.days * 86400000
    const start = end - r.days * 86400000
    const inPrev = (type, s) => {
      const t = new Date(rowDate(type, s)).getTime()
      if (t < start || t >= end) return false
      if (platform !== "all" && rowPlatform(type, s) !== platform) return false
      return true
    }
    const pFree = freeBase.filter(s => inPrev("free", s))
    const pLive = liveSessions.filter(s => !s.is_inaccurate && inPrev("live", s))
    const pPaid = paidSessions.filter(s => inPrev("paid", s))
    return {
      sessions: pFree.length + pLive.length + pPaid.length,
      revenue: pFree.reduce((a, s) => a + s.totalUSD, 0) + pLive.reduce((a, s) => a + (s.session_earnings_usd || 0), 0) + pPaid.reduce((a, s) => a + (parseFloat(s.usd) || 0), 0),
    }
  }, [freeBase, liveSessions, paidSessions, range, platform])

  // ── Scorecard ──
  const scorecard = useMemo(() => {
    const totalSessions = filteredFree.length + filteredLive.length + filteredPaid.length
    const timedFree = filteredFree.filter(s => !s.durationUnknown)
    const timedLive = filteredLive.filter(s => rowDurationMinutes("live", s) != null)
    const totalHoursMins = timedFree.reduce((a, s) => a + s.durationMinutes, 0) + timedLive.reduce((a, s) => a + rowDurationMinutes("live", s), 0)
    const totalHours = totalHoursMins / 60
    const timedRevenue = timedFree.reduce((a, s) => a + s.totalUSD, 0) + timedLive.reduce((a, s) => a + (s.session_earnings_usd || 0), 0)
    const totalRevenue = filteredFree.reduce((a, s) => a + s.totalUSD, 0) + filteredLive.reduce((a, s) => a + (s.session_earnings_usd || 0), 0) + filteredPaid.reduce((a, s) => a + (parseFloat(s.usd) || 0), 0)
    const avgPerHr = totalHours > 0 ? timedRevenue / totalHours : null
    const avgSession = totalSessions > 0 ? totalRevenue / totalSessions : null
    const returningFans = computeReturningFans(filteredFree, filteredPaid)
    const revDelta = prevWindow && prevWindow.revenue > 0 ? Math.round(((totalRevenue - prevWindow.revenue) / prevWindow.revenue) * 100) : null
    const sessDelta = prevWindow && prevWindow.sessions > 0 ? Math.round(((totalSessions - prevWindow.sessions) / prevWindow.sessions) * 100) : null
    return { totalSessions, totalHours, totalRevenue, avgPerHr, avgSession, returningFans, revDelta, sessDelta }
  }, [filteredFree, filteredLive, filteredPaid, prevWindow])

  // ── Session type performance comparison ──
  const typePerf = useMemo(() => {
    const build = (rows, type, revenueFn) => {
      const timed = rows.filter(s => rowDurationMinutes(type, s) != null)
      const hours = timed.reduce((a, s) => a + rowDurationMinutes(type, s), 0) / 60
      const revenue = rows.reduce((a, s) => a + revenueFn(s), 0)
      const timedRevenue = timed.reduce((a, s) => a + revenueFn(s), 0)
      return {
        count: rows.length, hours,
        revenue, usdPerHr: hours > 0 ? timedRevenue / hours : null,
        avgSession: rows.length > 0 ? revenue / rows.length : null,
      }
    }
    return {
      free: build(filteredFree, "free", s => s.totalUSD),
      live: build(filteredLive, "live", s => s.session_earnings_usd || 0),
      paid: build(filteredPaid, "paid", s => parseFloat(s.usd) || 0),
    }
  }, [filteredFree, filteredLive, filteredPaid])

  // ── Recent session intelligence (respects type filter) ──
  const unified = useMemo(() => {
    const rows = []
    filteredFree.forEach(s => rows.push({ type: "free", session: s }))
    filteredLive.forEach(s => rows.push({ type: "live", session: s }))
    filteredPaid.forEach(s => rows.push({ type: "paid", session: s }))
    return typeFilter === "all" ? rows : rows.filter(r => r.type === typeFilter)
  }, [filteredFree, filteredLive, filteredPaid, typeFilter])

  const recent = useMemo(() => [...unified].sort((a, b) => new Date(rowDate(b.type, b.session)) - new Date(rowDate(a.type, a.session))).slice(0, 5), [unified])

  // ── Coaching performance ──
  const coachingScore = useMemo(() => {
    const decided = recentCoachingEvents.filter(e => e.action_status === "performed" || e.action_status === "skipped")
    if (decided.length < 5) return null
    const performed = decided.filter(e => e.action_status === "performed").length
    return { pct: Math.round((performed / decided.length) * 100), performed, total: decided.length }
  }, [recentCoachingEvents])

  // ── Paid session intelligence ──
  const paidStats = useMemo(() => computePaidSessionAnalytics(filteredPaid, timezone), [filteredPaid, timezone])

  // ── Trend data ──
  const trendData = useMemo(() => monthlyData.map(m => ({
    month: m.month,
    usdPerHour: m.usdPerHour,
    usd: m.usd,
    avgDurationMins: m.sessions > 0 ? parseFloat(((m.hours * 60) / m.sessions).toFixed(1)) : null,
  })), [monthlyData])

  // ── Sorted + paginated history ──
  const sorted = useMemo(() => {
    const arr = [...unified]
    if (sortBy === "newest") arr.sort((a, b) => new Date(rowDate(b.type, b.session)) - new Date(rowDate(a.type, a.session)))
    else if (sortBy === "revenue") arr.sort((a, b) => rowRevenue(b.type, b.session) - rowRevenue(a.type, a.session))
    else if (sortBy === "rate") arr.sort((a, b) => (rowUsdPerHr(b.type, b.session) || -1) - (rowUsdPerHr(a.type, a.session) || -1))
    else if (sortBy === "duration") arr.sort((a, b) => (rowDurationMinutes(b.type, b.session) || -1) - (rowDurationMinutes(a.type, a.session) || -1))
    return arr
  }, [unified, sortBy])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pageClamped = Math.min(page, totalPages)
  const pageRows = sorted.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE)

  const openDrawer = (row, comparablePopulation) => setDrawerRow({ ...row, comparablePopulation })

  const filtersRow = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 22 }}>
      <div style={{ display: "flex", gap: 6 }}>{RANGES.map(r => <Pill key={r.id} active={range === r.id} onClick={() => setRange(r.id)}>{r.label}</Pill>)}</div>
      <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)" }} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{TYPES.map(t => <Pill key={t.id} active={typeFilter === t.id} onClick={() => { setTypeFilter(t.id); setPage(1) }}>{t.label}</Pill>)}</div>
      <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)" }} />
      <select value={platform} onChange={e => setPlatform(e.target.value)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "7px 12px", color: C.white, fontSize: 12 }}>
        <option value="all">All Platforms</option>
        {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      {meaningfulSessions.length !== sessions.length && (
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: C.muted, marginLeft: "auto" }}>
          <input type="checkbox" checked={meaningfulOnly} onChange={e => setMeaningfulOnly?.(e.target.checked)} style={{ accentColor: C.cyan }} />
          Meaningful sessions only {lowSignalSessionCount > 0 && `(${lowSignalSessionCount} low-signal hidden)`}
        </label>
      )}
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: 6 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: C.white, marginBottom: 4 }}>SESSION INTELLIGENCE</h1>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Understand what worked, who drove your earnings, and what to do next.</p>
      </div>

      {filtersRow}

      {!hasFilteredData ? (
        <NoSessions hasHistory={hasAnyHistory} onViewHistorical={() => setRange("all")} />
      ) : (
        <>
          {/* ── 3. TOP PERFORMANCE SCORECARD ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
            <ScoreCard label="Total Sessions" value={scorecard.totalSessions} deltaPct={scorecard.sessDelta} />
            <ScoreCard label="Total Hours" value={fmtHrs(scorecard.totalHours)} color={C.cyan} />
            <ScoreCard label="Total Revenue" value={fmtUsd0(scorecard.totalRevenue)} color={C.green} deltaPct={scorecard.revDelta} />
            <ScoreCard label="Avg $/Hr" value={scorecard.avgPerHr != null ? fmtUsd(scorecard.avgPerHr) : "—"} color={C.gold} />
            <ScoreCard label="Avg Session" value={scorecard.avgSession != null ? fmtUsd(scorecard.avgSession) : "—"} color={C.pink} />
            <ScoreCard label="Returning Fans" value={scorecard.returningFans} color={C.purple} />
          </div>

          {/* ── 4. SESSION TYPE PERFORMANCE ── */}
          <div style={{ ...glassCard, borderRadius: 16, padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>Where is your time paying off?</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 560 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", textAlign: "left", color: C.muted }}>
                    {["Type", "Sessions", "Hours", "Revenue", "$/hr", "Avg Session"].map(h => <th key={h} style={{ padding: "6px 10px", fontWeight: 700 }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {["free", "live", "paid"].map(type => {
                    const d = typePerf[type]
                    const meta = TYPE_META[type]
                    return (
                      <tr key={type} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={{ padding: "9px 10px", fontWeight: 700, color: meta.color }}>{meta.icon} {meta.label}</td>
                        <td style={{ padding: "9px 10px", color: C.white }}>{d.count}</td>
                        <td style={{ padding: "9px 10px", color: C.text }}>{type === "paid" ? "—" : fmtHrs(d.hours)}</td>
                        <td style={{ padding: "9px 10px", color: C.green, fontWeight: 700 }}>{fmtUsd0(d.revenue)}</td>
                        <td style={{ padding: "9px 10px", color: C.cyan }}>{d.usdPerHr != null ? fmtUsd(d.usdPerHr) : "—"}</td>
                        <td style={{ padding: "9px 10px", color: C.white }}>{d.avgSession != null ? fmtUsd(d.avgSession) : "—"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 5. RECENT SESSION INTELLIGENCE ── */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Recent Session Intelligence</div>
            {recent.length === 0 && <div style={{ ...glassCard, borderRadius: 14, padding: 24, textAlign: "center", color: C.muted, fontSize: 13 }}>No sessions match this filter yet.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {recent.map((r, i) => {
                const meta = TYPE_META[r.type]
                const revenue = rowRevenue(r.type, r.session)
                const usdPerHr = rowUsdPerHr(r.type, r.session)
                const comparablePopulation = r.type === "free" ? filteredFree : []
                const bd = r.type === "free" ? getSessionBreakdown(r.session, comparablePopulation) : null
                const topContributor = rowTopContributor(r.type, r.session)
                return (
                  <div key={i} style={{ ...glassCard, borderRadius: 14, padding: "16px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: bd || r.type !== "free" ? 10 : 0 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: meta.color }}>{meta.icon} {meta.label}</span>
                          <span style={{ fontSize: 12, color: C.muted }}>· {rowPlatform(r.type, r.session)}</span>
                        </div>
                        <div style={{ fontSize: 13, color: C.white, fontWeight: 700 }}>{fmtDateTime(rowDate(r.type, r.session))}</div>
                        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{fmtDur(rowDurationMinutes(r.type, r.session))}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{fmtUsd(revenue)}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{usdPerHr != null ? `${fmtUsd(usdPerHr)}/hr` : "—"}</div>
                        <button onClick={() => openDrawer(r, comparablePopulation)} style={{ marginTop: 6, padding: "4px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: C.muted, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>View</button>
                      </div>
                    </div>
                    {bd && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: C.cyan, textTransform: "uppercase", marginBottom: 4 }}>What worked</div>
                          <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>{bd.insights[0] || "Not enough signal yet."}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: C.pink, textTransform: "uppercase", marginBottom: 4 }}>Who held the show</div>
                          <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>
                            {bd.topTippers.length ? bd.topTippers.slice(0, 2).map(t => `${t.username} — ${fmtUsd(t.usd)} (${t.pct}%)`).join(" · ") : "No tip data."}
                          </div>
                        </div>
                      </div>
                    )}
                    {r.type === "live" && (
                      <div style={{ fontSize: 12, color: C.text, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        {r.session.unique_tipper_count || 0} supporters · {r.session.tip_count || 0} tips{r.session.largest_tip_usd ? ` · largest tip ${fmtUsd(r.session.largest_tip_usd)}` : ""}
                      </div>
                    )}
                    {r.type === "paid" && topContributor && (
                      <div style={{ fontSize: 12, color: C.text, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        {r.session.session_type || "Paid session"} with <b style={{ color: C.white }}>{topContributor}</b>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── 6. LIVE MODE INTELLIGENCE ── */}
          <div style={{ ...glassCard, borderRadius: 16, padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.orange, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>🔴 Live Mode Intelligence</div>
            {liveSessionsLoading ? (
              <div style={{ color: C.muted, fontSize: 13 }}>Loading Live Mode history…</div>
            ) : filteredLive.length === 0 ? (
              <div style={{ color: C.muted, fontSize: 13 }}>No Live Mode sessions in this period.</div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 16 }}>
                  <ScoreCard label="Live Sessions" value={typePerf.live.count} />
                  <ScoreCard label="Live Hours" value={fmtHrs(typePerf.live.hours)} color={C.cyan} />
                  <ScoreCard label="Live Revenue" value={fmtUsd0(typePerf.live.revenue)} color={C.green} />
                  <ScoreCard label="Avg $/hr" value={typePerf.live.usdPerHr != null ? fmtUsd(typePerf.live.usdPerHr) : "—"} color={C.gold} />
                  <ScoreCard label="Avg Session" value={typePerf.live.avgSession != null ? fmtUsd(typePerf.live.avgSession) : "—"} color={C.pink} />
                  <ScoreCard label="Tips/Hour" value={typePerf.live.hours > 0 ? (filteredLive.reduce((a, s) => a + (s.tip_count || 0), 0) / typePerf.live.hours).toFixed(1) : "—"} color={C.purple} />
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60 }}>
                  {[...filteredLive].sort((a, b) => new Date(a.started_at) - new Date(b.started_at)).slice(-24).map((s, i) => {
                    const rev = s.session_earnings_usd || 0
                    const max = Math.max(...filteredLive.map(x => x.session_earnings_usd || 0), 0.01)
                    return <div key={i} title={`${fmtDateShort(s.started_at)}: ${fmtUsd(rev)}`} style={{ flex: 1, height: `${Math.max((rev / max) * 100, rev > 0 ? 6 : 2)}%`, background: C.orange, borderRadius: "2px 2px 0 0", minHeight: 2, opacity: 0.85 }} />
                  })}
                </div>
              </>
            )}
          </div>

          {/* ── 7. LIVE MODE COACHING HISTORY ── */}
          <div style={{ ...glassCard, borderRadius: 16, padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>🎯 Live Mode Coaching History</div>
            {recentCoachingLoading && <div style={{ color: C.muted, fontSize: 13 }}>Loading coaching history…</div>}
            {!recentCoachingLoading && recentCoachingEvents.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>No coaching prompts recorded yet — these appear once you use Live Mode.</div>}
            {!recentCoachingLoading && recentCoachingEvents.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recentCoachingEvents.slice(0, 12).map(e => (
                  <div key={e.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5 }}>
                    <span style={{ color: C.muted, minWidth: 92, fontVariantNumeric: "tabular-nums" }}>{fmtDateTime(e.shown_at)}</span>
                    <span style={{
                      padding: "1px 8px", borderRadius: 5, fontSize: 10.5, fontWeight: 700, flexShrink: 0,
                      background: e.action_status === "performed" ? "rgba(16,185,129,0.15)" : e.action_status === "skipped" ? "rgba(148,163,184,0.15)" : "rgba(245,158,11,0.15)",
                      color: e.action_status === "performed" ? C.green : e.action_status === "skipped" ? C.muted : C.gold,
                    }}>{e.action_status === "performed" ? "✓ Performed" : e.action_status === "skipped" ? "↩ Skipped" : "— No action recorded"}</span>
                    <span style={{ color: C.white, flex: 1 }}>{e.title || e.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 8. COACHING PERFORMANCE ── */}
          <div style={{ ...glassCard, borderRadius: 16, padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Coaching Performance</div>
            {coachingScore ? (
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ fontSize: 30, fontWeight: 900, color: C.green }}>{coachingScore.pct}%</div>
                <div style={{ fontSize: 12.5, color: C.text }}>{coachingScore.performed} of {coachingScore.total} recent coaching prompts followed</div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: C.muted }}>Building your coaching history — keep using Live Mode to unlock a coaching score.</div>
            )}
          </div>

          {/* ── 9. PAID SESSION INTELLIGENCE ── */}
          <div style={{ ...glassCard, borderRadius: 16, padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.purple, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>💎 Paid Session Intelligence</div>
            {!paidStats ? (
              <div style={{ color: C.muted, fontSize: 13 }}>No paid sessions in this period.</div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 4 }}>
                  <ScoreCard label="Paid Sessions" value={paidStats.totalCount} />
                  <ScoreCard label="Paid Revenue" value={fmtUsd0(paidStats.totalUSD)} color={C.green} />
                  <ScoreCard label="Avg Paid Session" value={fmtUsd(paidStats.avgSessionUSD)} color={C.pink} />
                  <ScoreCard label="Unique Clients" value={paidStats.uniqueClients} color={C.purple} />
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>Duration and $/hr aren't tracked for paid sessions yet — only tokens, revenue, and client are recorded.</div>
              </>
            )}
          </div>

          {/* ── 10. PERFORMANCE TREND ── */}
          {trendData.length > 1 && (
            <div style={{ ...glassCard, borderRadius: 16, padding: 20, marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: 0.5 }}>Performance Trend</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Pill active={trendMetric === "usdPerHour"} onClick={() => setTrendMetric("usdPerHour")}>$/HR</Pill>
                  <Pill active={trendMetric === "usd"} onClick={() => setTrendMetric("usd")}>Revenue</Pill>
                  <Pill active={trendMetric === "avgDurationMins"} onClick={() => setTrendMetric("avgDurationMins")}>Duration</Pill>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} />
                  <YAxis tick={{ fill: C.muted, fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#0a0e1a", border: "1px solid rgba(255,255,255,0.1)" }} formatter={v => trendMetric === "avgDurationMins" ? `${v} min` : trendMetric === "usdPerHour" || trendMetric === "usd" ? fmtUsd(v) : v} />
                  <Line type="monotone" dataKey={trendMetric} stroke={C.cyan} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── 11. SESSION HISTORY ── */}
          <div style={{ ...glassCard, borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: 0.5 }}>Session History ({sorted.length})</div>
              <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1) }} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "6px 10px", color: C.white, fontSize: 12 }}>
                <option value="newest">Newest</option>
                <option value="revenue">Highest Revenue</option>
                <option value="rate">Highest $/hr</option>
                <option value="duration">Longest Session</option>
              </select>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 720 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", textAlign: "left", color: C.muted }}>
                    {["Date", "Platform", "Type", "Duration", "Earnings", "$/hr", "Top Contributor", ""].map(h => <th key={h} style={{ padding: "7px 8px", fontWeight: 700 }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r, i) => {
                    const meta = TYPE_META[r.type]
                    const comparablePopulation = r.type === "free" ? filteredFree : []
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={{ padding: "8px", color: C.text }}>{fmtDateShort(rowDate(r.type, r.session))}</td>
                        <td style={{ padding: "8px", color: C.text }}>{rowPlatform(r.type, r.session)}</td>
                        <td style={{ padding: "8px", color: meta.color, fontWeight: 700 }}>{meta.icon} {meta.label}</td>
                        <td style={{ padding: "8px", color: C.text }}>{fmtDur(rowDurationMinutes(r.type, r.session))}</td>
                        <td style={{ padding: "8px", color: C.green, fontWeight: 700 }}>{fmtUsd(rowRevenue(r.type, r.session))}</td>
                        <td style={{ padding: "8px", color: C.cyan }}>{rowUsdPerHr(r.type, r.session) != null ? fmtUsd(rowUsdPerHr(r.type, r.session)) : "—"}</td>
                        <td style={{ padding: "8px", color: C.white }}>{rowTopContributor(r.type, r.session) || "—"}</td>
                        <td style={{ padding: "8px" }}>
                          <button onClick={() => openDrawer(r, comparablePopulation)} style={{ padding: "4px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: C.muted, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>View</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 16 }}>
              <button disabled={pageClamped <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: pageClamped <= 1 ? C.muted : C.white, fontSize: 12, cursor: pageClamped <= 1 ? "default" : "pointer", opacity: pageClamped <= 1 ? 0.5 : 1 }}>Previous</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, pageClamped - 3), Math.max(0, pageClamped - 3) + 5).map(n => (
                <button key={n} onClick={() => setPage(n)} style={{ width: 30, height: 30, borderRadius: 8, background: n === pageClamped ? "linear-gradient(135deg,rgba(34,211,238,0.25),rgba(168,85,247,0.18))" : "rgba(255,255,255,0.04)", border: `1px solid ${n === pageClamped ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.1)"}`, color: C.white, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{n}</button>
              ))}
              <button disabled={pageClamped >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: pageClamped >= totalPages ? C.muted : C.white, fontSize: 12, cursor: pageClamped >= totalPages ? "default" : "pointer", opacity: pageClamped >= totalPages ? 0.5 : 1 }}>Next</button>
            </div>
          </div>
        </>
      )}

      {drawerRow && (
        <SessionDrawer
          row={drawerRow}
          onClose={() => setDrawerRow(null)}
          coachingEvents={drawerRow.type === "live" ? coachingEventsBySession[drawerRow.session.id] : null}
          coachingLoading={coachingLoadingSessionId}
          onLoadCoaching={loadCoachingEvents}
        />
      )}
    </div>
  )
}
