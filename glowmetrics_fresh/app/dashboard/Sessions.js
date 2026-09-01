"use client"
import { useState, useMemo } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { getSessionBreakdown, SESSION_PERF_BADGE } from "../../lib/analytics/session-insights"
import { computePaidSessionAnalytics } from "../../lib/analytics"
import SessionDrawer from "./SessionDrawer"

const C = {
  bg: "#05070f", card: "rgba(13,17,28,0.72)", border: "rgba(255,255,255,0.08)",
  cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B", purple: "#A855F7",
  green: "#10B981", red: "#F87171", orange: "#FB923C", white: "#F1F5F9",
  text: "#94A3B8", muted: "#475569",
}
const glass = {
  background: "linear-gradient(160deg, rgba(20,24,40,0.85), rgba(12,15,26,0.85))",
  border: `1px solid ${C.border}`, backdropFilter: "blur(20px)",
  boxShadow: "0 0 1px rgba(255,255,255,0.05) inset, 0 12px 40px rgba(0,0,0,0.35), 0 0 60px rgba(168,85,247,0.06)",
}
const gradientText = { background: "linear-gradient(90deg,#22D3EE,#A855F7,#EC4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }

const TYPE_META = {
  free: { label: "Free Chat", icon: "🎥", color: C.cyan },
  live: { label: "Live Mode", icon: "🔴", color: C.orange },
  paid: { label: "Paid / Private", icon: "💎", color: C.purple },
}
const PLATFORMS = ["Chaturbate", "BongaCams", "MyFreeCams", "Stripchat", "CamSoda"]
const RANGES = [{ id: "7d", label: "7D", days: 7 }, { id: "30d", label: "30D", days: 30 }, { id: "90d", label: "90D", days: 90 }, { id: "all", label: "ALL", days: null }]
const TYPES = [{ id: "all", label: "All" }, { id: "free", label: "Free Chat" }, { id: "live", label: "Live Mode" }, { id: "paid", label: "Paid / Private" }]

const fmtUsd = (n) => `$${Number(n || 0).toFixed(2)}`
const fmtUsd0 = (n) => `$${Math.round(Number(n || 0)).toLocaleString("en-US")}`
const fmtHrs = (h) => h == null ? "—" : `${h.toFixed(1)}h`
const fmtDur = (mins) => { if (mins == null) return "—"; const h = Math.floor(mins / 60), m = Math.round(mins % 60); return h > 0 ? `${h}h ${m}m` : `${m}m` }
const fmtDateShort = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
const fmtDateTime = (d) => new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })

function rowPlatform(type, s) { return type === "live" ? (s.stream_platform || "Chaturbate") : s.platform }
function rowDate(type, s) { return type === "free" ? s.startTime : type === "live" ? s.started_at : s.date_time }
function rowDurationMinutes(type, s) {
  if (type === "free") return s.durationUnknown ? null : s.durationMinutes
  if (type === "live") {
    if (!s.ended_at) return null
    const secs = (new Date(s.ended_at) - new Date(s.started_at)) / 1000 - (s.total_paused_seconds || 0)
    return secs > 0 ? secs / 60 : null
  }
  return null
}
function rowRevenue(type, s) { return type === "free" ? s.totalUSD : type === "live" ? (s.session_earnings_usd || 0) : (parseFloat(s.usd) || 0) }
function rowUsdPerHr(type, s) {
  const mins = rowDurationMinutes(type, s)
  if (!mins || mins <= 0) return type === "free" ? s.usdPerHour : null
  return parseFloat((rowRevenue(type, s) / (mins / 60)).toFixed(2))
}
function cutoffFor(rangeId) { const r = RANGES.find(x => x.id === rangeId); return (!r || r.days == null) ? null : Date.now() - r.days * 86400000 }

// ── Small building blocks ──────────────────────────────────────────────
function Pill({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer",
      border: `1px solid ${active ? "rgba(34,211,238,0.45)" : "rgba(255,255,255,0.1)"}`,
      background: active ? "linear-gradient(135deg,rgba(34,211,238,0.18),rgba(168,85,247,0.14),rgba(236,72,153,0.10))" : "rgba(255,255,255,0.03)",
      color: active ? C.white : C.text, transition: "all .15s", whiteSpace: "nowrap",
    }}>{children}</button>
  )
}
function QualityBadge({ perf }) {
  if (!perf) return null
  const b = SESSION_PERF_BADGE[perf]
  return <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 10.5, fontWeight: 800, color: b.color, background: b.bg, border: `1px solid ${b.border}` }}>{b.label}</span>
}
function EmptyState({ hasHistory, onViewHistorical }) {
  return (
    <div style={{ ...glass, borderRadius: 18, padding: "48px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 38, marginBottom: 10 }}>🎥</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.white, marginBottom: 6 }}>No recent sessions</div>
      <div style={{ fontSize: 13, color: C.muted, maxWidth: 420, margin: "0 auto" }}>
        Once you stream, CamCash will start showing what worked, who held the room, and where your next session can improve.
      </div>
      {hasHistory && (
        <button onClick={onViewHistorical} style={{ marginTop: 16, padding: "9px 20px", borderRadius: 10, background: "linear-gradient(135deg,#22D3EE,#A855F7)", border: "none", color: "#05070f", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
          View historical data
        </button>
      )}
    </div>
  )
}

// ── Recent session intelligence card — the centerpiece of the page ──────
function RecentCard({ row, onOpen }) {
  const { type, session: s } = row
  const meta = TYPE_META[type]
  const revenue = rowRevenue(type, s)
  const usdPerHr = rowUsdPerHr(type, s)
  const bd = type === "free" ? getSessionBreakdown(s, []) : null
  const perf = bd?.performance

  let whatWorked = null, whoHeldRoom = null, opportunity = null
  if (type === "free" && bd) {
    whatWorked = bd.insights[0] || null
    whoHeldRoom = bd.topTippers.length ? `${bd.topTippers[0].username} — ${fmtUsd(bd.topTippers[0].usd)} (${bd.topTippers[0].pct}%)` : null
    opportunity = bd.recommendations[0] || null
  } else if (type === "live") {
    whatWorked = (s.tip_count || 0) > 0 ? `${s.unique_tipper_count || 0} supporters tipped, ${s.tip_count} total tips` : null
    whoHeldRoom = s.largest_tip_usd ? `Largest single tip: ${fmtUsd(s.largest_tip_usd)}` : null
    opportunity = null
  } else if (type === "paid") {
    whatWorked = `${s.session_type || "Paid session"} — ${fmtUsd(s.usd)} for ${s.tokens || 0} tokens`
    whoHeldRoom = s.username ? `${s.username} — 100% of session revenue` : null
    opportunity = null
  }

  return (
    <div style={{ ...glass, borderRadius: 18, padding: 20, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)`, opacity: 0.6 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: meta.color, letterSpacing: 0.3 }}>{meta.icon} {meta.label.toUpperCase()}</span>
            <span style={{ fontSize: 11.5, color: C.muted }}>· {rowPlatform(type, s)}</span>
            <QualityBadge perf={perf} />
          </div>
          <div style={{ fontSize: 14, color: C.white, fontWeight: 700 }}>{fmtDateTime(rowDate(type, s))}</div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{fmtDur(rowDurationMinutes(type, s))}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 900, ...gradientText }}>{fmtUsd(revenue)}</div>
          <div style={{ fontSize: 11.5, color: C.muted }}>{usdPerHr != null ? `${fmtUsd(usdPerHr)}/hr` : "—/hr"}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: C.cyan, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>💡 What worked</div>
          <div style={{ fontSize: 12, color: C.text, lineHeight: 1.45 }}>{whatWorked || "Not enough data yet."}</div>
        </div>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: C.pink, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>🏆 Who held the room</div>
          <div style={{ fontSize: 12, color: C.text, lineHeight: 1.45 }}>{whoHeldRoom || "Not enough data yet."}</div>
        </div>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: C.gold, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>🚀 Opportunity</div>
          <div style={{ fontSize: 12, color: C.text, lineHeight: 1.45 }}>{opportunity || "Not enough data yet."}</div>
        </div>
      </div>

      <button onClick={onOpen} style={{
        marginTop: 14, width: "100%", padding: "9px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer",
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: C.white,
      }}>View full session →</button>
    </div>
  )
}

export default function Sessions({
  sessions = [],
  meaningfulSessions = [],
  paidSessions = [],
  liveSessions = [],
  liveSessionsLoading = false,
  coachingEventsBySession = {},
  loadCoachingEvents,
  coachingLoadingSessionId = null,
  recentCoachingEvents = [],
  recentCoachingLoading = false,
  monthlyData = [],
  timezone = "UTC",
}) {
  const [range, setRange] = useState("30d")
  const [typeFilter, setTypeFilter] = useState("all")
  const [platform, setPlatform] = useState("all")
  const [page, setPage] = useState(1)
  const [drawerRow, setDrawerRow] = useState(null)
  const PAGE_SIZE = 10

  const freeBase = meaningfulSessions.length > 0 ? meaningfulSessions : sessions
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

  const unifiedAll = useMemo(() => {
    const rows = []
    filteredFree.forEach(s => rows.push({ type: "free", session: s }))
    filteredLive.forEach(s => rows.push({ type: "live", session: s }))
    filteredPaid.forEach(s => rows.push({ type: "paid", session: s }))
    return rows
  }, [filteredFree, filteredLive, filteredPaid])

  const visible = typeFilter === "all" ? unifiedAll : unifiedAll.filter(r => r.type === typeFilter)
  const hasFilteredData = visible.length > 0

  // ── Top summary row ──
  const summary = useMemo(() => {
    const totalSessions = visible.length
    const timed = visible.filter(r => rowDurationMinutes(r.type, r.session) != null)
    const totalMins = timed.reduce((a, r) => a + rowDurationMinutes(r.type, r.session), 0)
    const totalRevenue = visible.reduce((a, r) => a + rowRevenue(r.type, r.session), 0)
    const timedRevenue = timed.reduce((a, r) => a + rowRevenue(r.type, r.session), 0)
    const avgPerHr = totalMins > 0 ? timedRevenue / (totalMins / 60) : null
    const best = [...visible].sort((a, b) => rowRevenue(b.type, b.session) - rowRevenue(a.type, a.session))[0] || null
    return { totalSessions, totalHours: totalMins / 60, totalRevenue, avgPerHr, best }
  }, [visible])

  // ── Recent session intelligence (3-5 cards) ──
  const recent = useMemo(() => [...visible].sort((a, b) => new Date(rowDate(b.type, b.session)) - new Date(rowDate(a.type, a.session))).slice(0, 5), [visible])

  // ── Live Mode intelligence ──
  const liveStats = useMemo(() => {
    const timed = filteredLive.filter(s => rowDurationMinutes("live", s) != null)
    const hours = timed.reduce((a, s) => a + rowDurationMinutes("live", s), 0) / 60
    const revenue = filteredLive.reduce((a, s) => a + (s.session_earnings_usd || 0), 0)
    const timedRevenue = timed.reduce((a, s) => a + (s.session_earnings_usd || 0), 0)
    return { count: filteredLive.length, hours, revenue, usdPerHr: hours > 0 ? timedRevenue / hours : null }
  }, [filteredLive])

  // ── Paid / Private ──
  const paidStats = useMemo(() => computePaidSessionAnalytics(filteredPaid, timezone), [filteredPaid, timezone])

  // ── Performance trend ($/hr) ──
  const trendData = useMemo(() => monthlyData.filter(m => m.usdPerHour != null).map(m => ({ month: m.month, usdPerHour: m.usdPerHour })), [monthlyData])

  // ── Sorted + paginated history (newest first, fixed) ──
  const sorted = useMemo(() => [...visible].sort((a, b) => new Date(rowDate(b.type, b.session)) - new Date(rowDate(a.type, a.session))), [visible])
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pageClamped = Math.min(page, totalPages)
  const pageRows = sorted.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE)

  const openDrawer = (row) => setDrawerRow({ ...row, comparablePopulation: row.type === "free" ? filteredFree : [] })

  return (
    <div>
      <h1 style={{ fontSize: 27, fontWeight: 900, marginBottom: 6, ...gradientText }}>SESSION INTELLIGENCE</h1>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 22, maxWidth: 560 }}>
        See what happened in your streams, what worked, and where your next session can improve.
      </p>

      {/* ── Filters ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 6 }}>{TYPES.map(t => <Pill key={t.id} active={typeFilter === t.id} onClick={() => { setTypeFilter(t.id); setPage(1) }}>{t.label}</Pill>)}</div>
        <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)" }} />
        <div style={{ display: "flex", gap: 6 }}>{RANGES.map(r => <Pill key={r.id} active={range === r.id} onClick={() => setRange(r.id)}>{r.label}</Pill>)}</div>
        <select value={platform} onChange={e => setPlatform(e.target.value)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "7px 12px", color: C.white, fontSize: 12, marginLeft: "auto" }}>
          <option value="all">All Platforms</option>
          {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {!hasFilteredData ? (
        <EmptyState hasHistory={hasAnyHistory} onViewHistorical={() => setRange("all")} />
      ) : (
        <>
          {/* ── 1. Summary row ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 26 }}>
            {[
              { label: "Total Sessions", value: summary.totalSessions, color: C.white },
              { label: "Stream Time", value: fmtHrs(summary.totalHours), color: C.cyan },
              { label: "Earnings", value: fmtUsd0(summary.totalRevenue), color: C.green },
              { label: "Avg $/hr", value: summary.avgPerHr != null ? fmtUsd(summary.avgPerHr) : "—", color: C.gold },
              { label: "Best Session", value: summary.best ? fmtUsd(rowRevenue(summary.best.type, summary.best.session)) : "—", color: C.pink },
            ].map(c => (
              <div key={c.label} style={{ ...glass, borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>{c.label}</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* ── 2. RECENT SESSION INTELLIGENCE — the centerpiece ── */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.white, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              ✨ Recent Session Intelligence
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {recent.map((r, i) => <RecentCard key={i} row={r} onOpen={() => openDrawer(r)} />)}
            </div>
          </div>

          {/* ── Live Mode intelligence (shown for All + Live Mode filter) ── */}
          {(typeFilter === "all" || typeFilter === "live") && (
            <div style={{ ...glass, borderRadius: 18, padding: 20, marginBottom: 22 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: C.orange, marginBottom: 14 }}>🔴 Live Mode Intelligence</div>
              {liveSessionsLoading ? (
                <div style={{ color: C.muted, fontSize: 13 }}>Loading Live Mode history…</div>
              ) : liveStats.count === 0 ? (
                <div style={{ color: C.muted, fontSize: 13 }}>No Live Mode sessions in this period.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 18 }}>
                  <div><div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase" }}>Live Sessions</div><div style={{ fontSize: 18, fontWeight: 800, color: C.white }}>{liveStats.count}</div></div>
                  <div><div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase" }}>Live Hours</div><div style={{ fontSize: 18, fontWeight: 800, color: C.cyan }}>{fmtHrs(liveStats.hours)}</div></div>
                  <div><div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase" }}>Revenue</div><div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{fmtUsd0(liveStats.revenue)}</div></div>
                  <div><div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase" }}>$/hr</div><div style={{ fontSize: 18, fontWeight: 800, color: C.gold }}>{liveStats.usdPerHr != null ? fmtUsd(liveStats.usdPerHr) : "—"}</div></div>
                </div>
              )}

              <div style={{ fontSize: 11, fontWeight: 800, color: C.text, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 14 }}>🎯 Coaching Feed</div>
              {recentCoachingLoading && <div style={{ color: C.muted, fontSize: 13 }}>Loading coaching history…</div>}
              {!recentCoachingLoading && recentCoachingEvents.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>Not enough coaching history yet.</div>}
              {!recentCoachingLoading && recentCoachingEvents.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: 260, overflowY: "auto" }}>
                  {recentCoachingEvents.map(e => (
                    <div key={e.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12 }}>
                      <span style={{ color: C.muted, minWidth: 92, fontVariantNumeric: "tabular-nums" }}>{fmtDateTime(e.shown_at)}</span>
                      <span style={{
                        padding: "1px 8px", borderRadius: 5, fontSize: 10.5, fontWeight: 700, flexShrink: 0,
                        background: e.action_status === "performed" ? "rgba(16,185,129,0.15)" : e.action_status === "skipped" ? "rgba(148,163,184,0.15)" : "rgba(245,158,11,0.15)",
                        color: e.action_status === "performed" ? C.green : e.action_status === "skipped" ? C.muted : C.gold,
                      }}>{e.action_status === "performed" ? "✓ Performed" : e.action_status === "skipped" ? "↩ Skipped" : "— Unmarked"}</span>
                      <span style={{ color: C.white, flex: 1 }}>{e.title || e.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Paid / Private (shown for All + Paid filter) ── */}
          {(typeFilter === "all" || typeFilter === "paid") && (
            <div style={{ ...glass, borderRadius: 18, padding: 20, marginBottom: 22 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: C.purple, marginBottom: 14 }}>💎 Paid / Private</div>
              {!paidStats ? (
                <div style={{ color: C.muted, fontSize: 13 }}>Not enough data yet.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
                  <div><div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase" }}>Sessions</div><div style={{ fontSize: 18, fontWeight: 800, color: C.white }}>{paidStats.totalCount}</div></div>
                  <div><div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase" }}>Revenue</div><div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{fmtUsd0(paidStats.totalUSD)}</div></div>
                  <div><div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase" }}>Avg Session</div><div style={{ fontSize: 18, fontWeight: 800, color: C.pink }}>{fmtUsd(paidStats.avgSessionUSD)}</div></div>
                  <div><div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase" }}>Unique Clients</div><div style={{ fontSize: 18, fontWeight: 800, color: C.purple }}>{paidStats.uniqueClients}</div></div>
                  <div><div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase" }}>Repeat Rate</div><div style={{ fontSize: 18, fontWeight: 800, color: C.cyan }}>{paidStats.repeatClientPct}%</div></div>
                </div>
              )}
            </div>
          )}

          {/* ── Session performance trend ── */}
          {trendData.length > 1 && (
            <div style={{ ...glass, borderRadius: 18, padding: 20, marginBottom: 22 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: C.white, marginBottom: 10 }}>Session Performance — $/hr over time</div>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} />
                  <YAxis tick={{ fill: C.muted, fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#0a0e1a", border: "1px solid rgba(255,255,255,0.1)" }} formatter={v => fmtUsd(v)} />
                  <Line type="monotone" dataKey="usdPerHour" stroke={C.cyan} strokeWidth={2} dot={{ r: 3, fill: C.purple }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Session History ── */}
          <div style={{ ...glass, borderRadius: 18, padding: 20 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: C.white, marginBottom: 14 }}>SESSION HISTORY</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 700 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", textAlign: "left", color: C.muted }}>
                    {["Date", "Platform", "Type", "Duration", "Earnings", "$/hr", "Quality", ""].map(h => <th key={h} style={{ padding: "7px 8px", fontWeight: 700 }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r, i) => {
                    const meta = TYPE_META[r.type]
                    const bd = r.type === "free" ? getSessionBreakdown(r.session, filteredFree) : null
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={{ padding: "9px 8px", color: C.text }}>{fmtDateShort(rowDate(r.type, r.session))}</td>
                        <td style={{ padding: "9px 8px", color: C.text }}>{rowPlatform(r.type, r.session)}</td>
                        <td style={{ padding: "9px 8px", color: meta.color, fontWeight: 700 }}>{meta.icon} {meta.label}</td>
                        <td style={{ padding: "9px 8px", color: C.text }}>{fmtDur(rowDurationMinutes(r.type, r.session))}</td>
                        <td style={{ padding: "9px 8px", color: C.green, fontWeight: 700 }}>{fmtUsd(rowRevenue(r.type, r.session))}</td>
                        <td style={{ padding: "9px 8px", color: C.cyan }}>{rowUsdPerHr(r.type, r.session) != null ? fmtUsd(rowUsdPerHr(r.type, r.session)) : "—"}</td>
                        <td style={{ padding: "9px 8px" }}><QualityBadge perf={bd?.performance} /></td>
                        <td style={{ padding: "9px 8px" }}>
                          <button onClick={() => openDrawer(r)} style={{ padding: "4px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: C.muted, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>View</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, marginTop: 16 }}>
              <button disabled={pageClamped <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: pageClamped <= 1 ? C.muted : C.white, fontSize: 12, cursor: pageClamped <= 1 ? "default" : "pointer", opacity: pageClamped <= 1 ? 0.5 : 1 }}>Previous</button>
              <span style={{ fontSize: 12, color: C.text }}>Page {pageClamped} of {totalPages}</span>
              <button disabled={pageClamped >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: pageClamped >= totalPages ? C.muted : C.white, fontSize: 12, cursor: pageClamped >= totalPages ? "default" : "pointer", opacity: pageClamped >= totalPages ? 0.5 : 1 }}>Next</button>
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
