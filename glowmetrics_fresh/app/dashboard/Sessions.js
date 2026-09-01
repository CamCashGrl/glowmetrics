"use client"
import { useState, useMemo } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { getSessionBreakdown, SESSION_PERF_BADGE } from "../../lib/analytics/session-insights"
import { computePaidSessionAnalytics } from "../../lib/analytics"
import { computeRevenueMix } from "../../lib/analytics/revenueMix"
import SessionDrawer from "./SessionDrawer"

const TYPE_META = {
  free: { label: "Free Chat", icon: "🎥", color: "#22D3EE" },
  live: { label: "Live Mode", icon: "🔴", color: "#FB923C" },
  paid: { label: "Paid / Private", icon: "💎", color: "#A855F7" },
}
// Keyed by paid_sessions.session_type, matching PrivateSessions.js so the
// same session type is the same colour wherever it is shown.
// Six streams share one stacked bar, so every colour has to be separable from
// the other five. Private Chat was cyan, the same hue TYPE_META.free already
// uses, which rendered Free Chat and Private Chat as one indistinguishable
// cyan run. Cyan stays with free chat; paid types get their own hues.
// Display colours for the canonical REVENUE_STREAMS keys. Six streams share
// one stacked bar, so each hue has to be separable from the other five —
// revenueMix.js's own defaults put private_chat and full_private on adjacent
// purples, which is fine for a legend but not for abutting bar segments.
const STREAM_COLORS = {
  free_chat: "#22D3EE", live_mode: "#FB923C", private_chat: "#5B8DEF",
  full_private: "#A855F7", group_chat: "#FACC15", spy_mode: "#F472B6", other: "#64748B",
}
const PLATFORMS = ["Chaturbate", "BongaCams", "MyFreeCams", "Stripchat", "CamSoda"]
const RANGES = [{ id: "7d", label: "7D", days: 7 }, { id: "30d", label: "30D", days: 30 }, { id: "90d", label: "90D", days: 90 }, { id: "all", label: "ALL", days: null }]
const TYPES = [{ id: "all", label: "All Sessions" }, { id: "free", label: "Free Chat" }, { id: "live", label: "Live Mode" }, { id: "paid", label: "Paid Session" }]

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

function QualityBadge({ perf }) {
  if (!perf) return null
  const b = SESSION_PERF_BADGE[perf]
  return <span className="session-card-quality" style={{ color: b.color, background: b.bg, border: `1px solid ${b.border}` }}>{b.label}</span>
}

// ── Recent session intelligence card — the primary experience ───────────
function RecentCard({ row, onOpen, comparablePopulation = [], timezone = "UTC" }) {
  const { type, session: s } = row
  const meta = TYPE_META[type]
  const revenue = rowRevenue(type, s)
  const usdPerHr = rowUsdPerHr(type, s)
  // Passing [] here left allAvg at 0, so performance fell through to
  // "average" for every session and the quality badge on this card — the
  // primary experience — was a fixed label rather than a real verdict.
  const bd = type === "free" ? getSessionBreakdown(s, comparablePopulation, timezone) : null
  const perf = bd?.performance

  let whatWorked = null, whoDrove = [], opportunity = null
  if (type === "free" && bd) {
    whatWorked = bd.insights.slice(0, 2)
    whoDrove = bd.topTippers
    opportunity = bd.recommendations[0] || null
  } else if (type === "live") {
    whatWorked = (s.tip_count || 0) > 0 ? [`${s.unique_tipper_count || 0} supporters tipped, ${s.tip_count} total tips`] : []
    if (s.largest_tip_usd) whoDrove = [{ username: "Largest tip", usd: s.largest_tip_usd, count: null }]
  } else if (type === "paid") {
    whatWorked = [`${s.session_type || "Paid session"} — ${fmtUsd(s.usd)} for ${s.tokens || 0} tokens`]
    if (s.username) whoDrove = [{ username: s.username, usd: parseFloat(s.usd) || 0, count: 1, pct: 100 }]
  }

  return (
    <div className="session-card">
      <div className="session-card-top">
        <div>
          <div className="session-card-meta" style={{ color: meta.color }}>
            {meta.icon} {meta.label.toUpperCase()}
            <span style={{ color: "#687696", fontWeight: 600 }}>· {rowPlatform(type, s)}</span>
            <QualityBadge perf={perf} />
          </div>
          <div className="session-card-date">{fmtDateTime(rowDate(type, s))}</div>
        </div>
        <div className="session-money">
          <strong>{fmtUsd(revenue)}</strong>
          <span>{usdPerHr != null ? `${fmtUsd(usdPerHr)}/hr` : "—/hr"}</span>
        </div>
      </div>

      <div className="session-stats">
        <div className="session-stat-box"><div className="session-stat-label">Duration</div><div className="session-stat-value">{fmtDur(rowDurationMinutes(type, s))}</div></div>
        <div className="session-stat-box"><div className="session-stat-label">Tips</div><div className="session-stat-value">{type === "free" ? (s.tipCount ?? (s.tips || []).length) : type === "live" ? (s.tip_count ?? "—") : 1}</div></div>
        <div className="session-stat-box"><div className="session-stat-label">Quality</div><div className="session-stat-value">{perf ? SESSION_PERF_BADGE[perf].label.replace(/^[^\s]+\s/, "") : "—"}</div></div>
      </div>

      <div className="session-insight-grid">
        <div>
          <div className="insight-block-title" style={{ color: "#22D3EE" }}>💡 What Worked</div>
          {whatWorked && whatWorked.length > 0 ? whatWorked.map((w, i) => (
            <div className="insight-line positive" key={i}><span>→</span>{w}</div>
          )) : <div className="insight-line">Not enough data yet.</div>}
          {opportunity && (
            <>
              <div className="insight-block-title" style={{ color: "#ffc43d", marginTop: 14 }}>🚀 Next Opportunity</div>
              <div className="insight-line opportunity"><span>•</span>{opportunity}</div>
            </>
          )}
        </div>
        <div>
          <div className="insight-block-title" style={{ color: "#EC4899" }}>Who Drove The Session</div>
          <div className="who-drove-list">
            {whoDrove.length === 0 && <div className="insight-line">Not enough data yet.</div>}
            {whoDrove.map((t, i) => (
              <div className="top-tipper" key={i}>
                <span className="tipper-name">{t.username}</span>
                <span>{t.count != null ? `${t.count} tip${t.count === 1 ? "" : "s"}` : ""}</span>
                <strong>{fmtUsd(t.usd)}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button className="gradient-button" onClick={onOpen}>View Session →</button>
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
  const [sortBy, setSortBy] = useState("newest")
  const [page, setPage] = useState(1)
  const [drawerRow, setDrawerRow] = useState(null)
  const PAGE_SIZE = 10

  // Meaningful sessions are the canonical population for rates and averages.
  // This used to silently fall back to `sessions` (which still includes
  // low-signal ones) whenever there were no meaningful sessions, changing
  // what every KPI below measured with no change to any label. The fallback
  // is kept so a new creator still sees her data, but it is now surfaced.
  const usingFallbackPopulation = meaningfulSessions.length === 0 && sessions.length > 0
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

  const summary = useMemo(() => {
    const totalSessions = visible.length
    const timed = visible.filter(r => rowDurationMinutes(r.type, r.session) != null)
    const totalMins = timed.reduce((a, r) => a + rowDurationMinutes(r.type, r.session), 0)
    const totalRevenue = visible.reduce((a, r) => a + rowRevenue(r.type, r.session), 0)
    const timedRevenue = timed.reduce((a, r) => a + rowRevenue(r.type, r.session), 0)
    const avgPerHr = totalMins > 0 ? timedRevenue / (totalMins / 60) : null

    // A free/live row is a STREAM; a paid row is one booking (a single
    // private, group or spy view). Averaging revenue across both divided a
    // mixed total by a mixed count, so a creator with many small spy views
    // saw her "avg session" collapse even when her streams were unchanged.
    // Averaged over streams only, and the counts are surfaced separately.
    const streams = visible.filter(r => r.type !== "paid")
    const paidBookings = totalSessions - streams.length
    const streamRevenue = streams.reduce((a, r) => a + rowRevenue(r.type, r.session), 0)
    const avgSession = streams.length > 0 ? streamRevenue / streams.length : null

    const best = [...visible].sort((a, b) => rowRevenue(b.type, b.session) - rowRevenue(a.type, a.session))[0] || null
    return {
      totalSessions, streamCount: streams.length, paidBookings,
      totalHours: totalMins / 60, totalRevenue, avgPerHr, avgSession, best,
      untimedCount: totalSessions - timed.length,
    }
  }, [visible])

  const recent = useMemo(() => [...visible].sort((a, b) => new Date(rowDate(b.type, b.session)) - new Date(rowDate(a.type, a.session))).slice(0, 4), [visible])

  const typePerf = useMemo(() => {
    const build = (rows, type, revFn) => {
      const timed = rows.filter(s => rowDurationMinutes(type, s) != null)
      const hours = timed.reduce((a, s) => a + rowDurationMinutes(type, s), 0) / 60
      const revenue = rows.reduce((a, s) => a + revFn(s), 0)
      const timedRevenue = timed.reduce((a, s) => a + revFn(s), 0)
      return { count: rows.length, hours, revenue, usdPerHr: hours > 0 ? timedRevenue / hours : null }
    }
    return {
      free: build(filteredFree, "free", s => s.totalUSD),
      live: build(filteredLive, "live", s => s.session_earnings_usd || 0),
      paid: build(filteredPaid, "paid", s => parseFloat(s.usd) || 0),
    }
  }, [filteredFree, filteredLive, filteredPaid])

  const paidStats = useMemo(() => computePaidSessionAnalytics(filteredPaid, timezone), [filteredPaid, timezone])
  const mix = useMemo(() => computeRevenueMix({
    freeChatSessions: filteredFree,
    paidSessions: filteredPaid,
    liveTotalUSD: filteredLive.length ? typePerf.live.revenue : null,
  }), [filteredFree, filteredPaid, filteredLive, typePerf])
  const trendData = useMemo(() => monthlyData.filter(m => m.usdPerHour != null).map(m => ({ month: m.month, usdPerHour: m.usdPerHour })), [monthlyData])

  const sorted = useMemo(() => {
    const arr = [...visible]
    if (sortBy === "newest") arr.sort((a, b) => new Date(rowDate(b.type, b.session)) - new Date(rowDate(a.type, a.session)))
    else if (sortBy === "revenue") arr.sort((a, b) => rowRevenue(b.type, b.session) - rowRevenue(a.type, a.session))
    else if (sortBy === "rate") arr.sort((a, b) => (rowUsdPerHr(b.type, b.session) || -1) - (rowUsdPerHr(a.type, a.session) || -1))
    return arr
  }, [visible, sortBy])
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pageClamped = Math.min(page, totalPages)
  const pageRows = sorted.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE)

  const openDrawer = (row) => setDrawerRow({ ...row, comparablePopulation: row.type === "free" ? filteredFree : [] })

  return (
    <div className="sessions-page">
      <div className="sessions-header">
        <div>
          <div className="sessions-title">SESSION INTELLIGENCE</div>
          <div className="sessions-subtitle">See what happened in your streams, what worked, and where your next session can improve.</div>
        </div>
      </div>

      <div className="session-filters">
        <div className="session-pill-group">{TYPES.map(t => <button key={t.id} className={`session-pill${typeFilter === t.id ? " active" : ""}`} onClick={() => { setTypeFilter(t.id); setPage(1) }}>{t.label}</button>)}</div>
        <div className="session-pill-group">{RANGES.map(r => <button key={r.id} className={`session-pill${range === r.id ? " active" : ""}`} onClick={() => setRange(r.id)}>{r.label}</button>)}</div>
        <select className="session-platform-select" value={platform} onChange={e => setPlatform(e.target.value)}>
          <option value="all">All Platforms</option>
          {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {!hasFilteredData ? (
        <div className="glass-panel session-empty">
          <div className="session-empty-icon">🎥</div>
          <div className="session-empty-title">No recent sessions</div>
          <div className="session-empty-body">Once you stream, CamCash will start showing what worked, who held the room, and where your next session can improve.</div>
          {hasAnyHistory && <button className="gradient-button" style={{ maxWidth: 220, margin: "16px auto 0" }} onClick={() => setRange("all")}>View historical data</button>}
        </div>
      ) : (
        <>
          {usingFallbackPopulation && (
            <div className="insight-line" style={{ marginBottom: 12, color: "#ffc43d" }}>
              ⚠ No sessions meet the meaningful-session threshold yet, so these figures include low-signal sessions. Treat them as an early signal.
            </div>
          )}

          <div className="session-kpis">
            <div className="glass-panel session-kpi">
              <div className="session-kpi-label">Total Sessions</div>
              <div className="session-kpi-value">{summary.totalSessions}</div>
              <div className="session-kpi-sub">{summary.streamCount} stream{summary.streamCount === 1 ? "" : "s"}{summary.paidBookings > 0 ? ` · ${summary.paidBookings} paid booking${summary.paidBookings === 1 ? "" : "s"}` : ""}</div>
            </div>
            <div className="glass-panel session-kpi"><div className="session-kpi-label">Stream Time</div><div className="session-kpi-value" style={{ color: "#22D3EE" }}>{fmtHrs(summary.totalHours)}</div></div>
            <div className="glass-panel session-kpi"><div className="session-kpi-label">Total Revenue</div><div className="session-kpi-value" style={{ color: "#21d99a" }}>{fmtUsd0(summary.totalRevenue)}</div><div className="session-kpi-sub">All streams and paid bookings</div></div>
            <div className="glass-panel session-kpi">
              <div className="session-kpi-label">Avg $/hr</div>
              <div className="session-kpi-value" style={{ color: "#ffc43d" }}>{summary.avgPerHr != null ? fmtUsd(summary.avgPerHr) : "—"}</div>
              {/* Paid bookings carry no duration, so they are outside this rate
                  entirely while still counting toward Total Revenue above. */}
              <div className="session-kpi-sub">{summary.untimedCount > 0 ? `Timed sessions only · ${summary.untimedCount} excluded` : "Timed sessions only"}</div>
            </div>
            <div className="glass-panel session-kpi"><div className="session-kpi-label">Avg Session</div><div className="session-kpi-value" style={{ color: "#EC4899" }}>{summary.avgSession != null ? fmtUsd(summary.avgSession) : "—"}</div><div className="session-kpi-sub">Streams only</div></div>
            <div className="glass-panel session-kpi"><div className="session-kpi-label">Best Session</div><div className="session-kpi-value" style={{ color: "#A855F7" }}>{summary.best ? fmtUsd(rowRevenue(summary.best.type, summary.best.session)) : "—"}</div><div className="session-kpi-sub">{summary.best ? TYPE_META[summary.best.type].label : "—"}</div></div>
          </div>

          {/* ── EARNINGS BREAKDOWN — free chat vs Live Mode vs each paid
                 session type, over the same filtered window as everything
                 else on this page. Composition comes from computeRevenueMix(),
                 the one place allowed to add the three revenue tables
                 together; this only lays the result out. ── */}
          {(() => {
            if (!mix || mix.isEmpty) return null
            const rows = mix.byStream.map(r => ({ ...r, color: STREAM_COLORS[r.key] || "#64748B" }))
            return (
              <div className="glass-panel" style={{ padding: 20, marginTop: 22 }}>
                <div className="section-label">💰 Where your money came from</div>
                <div style={{ display: "flex", height: 30, borderRadius: 9, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 16 }}>
                  {rows.map(r => (
                    <div key={r.key} title={`${r.label}: ${fmtUsd(r.usd)} (${r.pct.toFixed(1)}%)`}
                      style={{ width: `${r.pct}%`, background: r.color, display: "flex", alignItems: "center", justifyContent: "center", transition: "width 0.35s" }}>
                      {r.pct >= 11 && <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(8,12,24,0.85)" }}>{Math.round(r.pct)}%</span>}
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
                  {rows.map(r => (
                    <div key={r.key}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 4, background: r.color, flexShrink: 0 }} />
                        <span className="session-kpi-label" style={{ marginBottom: 0 }}>{r.label}</span>
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: r.color }}>{fmtUsd(r.usd)}</div>
                      <div className="session-kpi-sub">
                        {Math.round(r.pct)}%{r.count > 0 ? ` · ${r.count} session${r.count === 1 ? "" : "s"}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10.5, color: "#687696", marginTop: 12, lineHeight: 1.5 }}>
                  Free chat, Live Mode and paid sessions are stored separately and each counted once — these add up, they never overlap.
                </div>
              </div>
            )
          })()}

          {trendData.length > 1 && (
            <div style={{ marginTop: 22 }}>
              <div className="glass-panel" style={{ padding: 20 }}>
                <div className="section-label">Session Performance — $/hr over time</div>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="month" tick={{ fill: "#687696", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#687696", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#0a0e1a", border: "1px solid rgba(255,255,255,0.1)" }} formatter={v => fmtUsd(v)} />
                    <Line type="monotone" dataKey="usdPerHour" stroke="#22D3EE" strokeWidth={2} dot={{ r: 3, fill: "#A855F7" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {(typeFilter === "all" || typeFilter === "live" || typeFilter === "paid") && (
            <div className="session-two-col" style={{ marginTop: 22 }}>
              {(typeFilter === "all" || typeFilter === "live") && (
                <div className="glass-panel" style={{ padding: 20 }}>
                  <div className="section-label" style={{ color: "#FB923C" }}>🔴 Live Mode Intelligence</div>
                  {liveSessionsLoading ? (
                    <div className="insight-line">Loading Live Mode history…</div>
                  ) : typePerf.live.count === 0 ? (
                    <div className="insight-line">No Live Mode sessions in this period.</div>
                  ) : (
                    <div className="session-kpis" style={{ gridTemplateColumns: "repeat(4,1fr)", margin: "0 0 18px" }}>
                      <div><div className="session-kpi-label">Live Sessions</div><div className="session-kpi-value" style={{ fontSize: 16 }}>{typePerf.live.count}</div></div>
                      <div><div className="session-kpi-label">Live Hours</div><div className="session-kpi-value" style={{ fontSize: 16, color: "#22D3EE" }}>{fmtHrs(typePerf.live.hours)}</div></div>
                      <div><div className="session-kpi-label">Revenue</div><div className="session-kpi-value" style={{ fontSize: 16, color: "#21d99a" }}>{fmtUsd0(typePerf.live.revenue)}</div></div>
                      <div><div className="session-kpi-label">$/hr</div><div className="session-kpi-value" style={{ fontSize: 16, color: "#ffc43d" }}>{typePerf.live.usdPerHr != null ? fmtUsd(typePerf.live.usdPerHr) : "—"}</div></div>
                    </div>
                  )}
                  <div className="drawer-section-label" style={{ marginTop: 4 }}>🎯 Coaching History</div>
                  {recentCoachingLoading && <div className="insight-line">Loading coaching history…</div>}
                  {!recentCoachingLoading && recentCoachingEvents.length === 0 && <div className="insight-line">Not enough coaching history yet.</div>}
                  {!recentCoachingLoading && recentCoachingEvents.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: 220, overflowY: "auto" }}>
                      {recentCoachingEvents.slice(0, 10).map(e => (
                        <div key={e.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12 }}>
                          <span style={{ color: "#687696", minWidth: 70, fontVariantNumeric: "tabular-nums" }}>{fmtDateShort(e.shown_at)}</span>
                          <span style={{ color: "#aeb9d5", flex: 1 }}>{e.title || e.message}</span>
                          <span style={{
                            fontWeight: 700, fontSize: 10.5,
                            color: e.action_status === "performed" ? "#21d99a" : e.action_status === "skipped" ? "#687696" : "#ffc43d",
                          }}>{e.action_status === "performed" ? "✓ Performed" : e.action_status === "skipped" ? "↩ Skipped" : "— Unmarked"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {(typeFilter === "all" || typeFilter === "paid") && (
                <div className="glass-panel" style={{ padding: 20 }}>
                  <div className="section-label" style={{ color: "#A855F7" }}>💎 Paid Session Intelligence</div>
                  {!paidStats ? (
                    <div className="insight-line">Not enough data yet.</div>
                  ) : (
                    <div className="session-kpis" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
                      <div><div className="session-kpi-label">Sessions</div><div className="session-kpi-value" style={{ fontSize: 16 }}>{paidStats.totalCount}</div></div>
                      <div><div className="session-kpi-label">Revenue</div><div className="session-kpi-value" style={{ fontSize: 16, color: "#21d99a" }}>{fmtUsd0(paidStats.totalUSD)}</div></div>
                      <div><div className="session-kpi-label">Avg Session</div><div className="session-kpi-value" style={{ fontSize: 16, color: "#EC4899" }}>{fmtUsd(paidStats.avgSessionUSD)}</div></div>
                      <div><div className="session-kpi-label">Unique Clients</div><div className="session-kpi-value" style={{ fontSize: 16, color: "#A855F7" }}>{paidStats.uniqueClients}</div></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="glass-panel" style={{ padding: 20, marginTop: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
              <div className="section-label" style={{ marginBottom: 0 }}>SESSION HISTORY</div>
              <select className="session-platform-select" style={{ marginLeft: 0 }} value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1) }}>
                <option value="newest">Sort by: Newest</option>
                <option value="revenue">Sort by: Highest Revenue</option>
                <option value="rate">Sort by: Highest $/hr</option>
              </select>
            </div>
            <div className="session-table-wrap">
              <div className="session-table-header">
                <div>DATE</div><div>PLATFORM</div><div>TYPE</div><div>DURATION</div><div>REVENUE</div><div>$/HR</div><div>QUALITY</div><div></div>
              </div>
              {pageRows.map((r, i) => {
                const meta = TYPE_META[r.type]
                const bd = r.type === "free" ? getSessionBreakdown(r.session, filteredFree, timezone) : null
                return (
                  <div className="session-table-row" key={i}>
                    <div>{fmtDateShort(rowDate(r.type, r.session))}</div>
                    <div>{rowPlatform(r.type, r.session)}</div>
                    <div style={{ color: meta.color, fontWeight: 700 }}>{meta.icon} {meta.label}</div>
                    <div>{fmtDur(rowDurationMinutes(r.type, r.session))}</div>
                    <div style={{ color: "#21d99a", fontWeight: 700 }}>{fmtUsd(rowRevenue(r.type, r.session))}</div>
                    <div style={{ color: "#22D3EE" }}>{rowUsdPerHr(r.type, r.session) != null ? fmtUsd(rowUsdPerHr(r.type, r.session)) : "—"}</div>
                    <div><QualityBadge perf={bd?.performance} /></div>
                    <div><button onClick={() => openDrawer(r)}>View</button></div>
                  </div>
                )
              })}
            </div>
            <div className="pagination">
              <button disabled={pageClamped <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button>
              <span style={{ fontSize: 12, color: "#aeb9d5" }}>Page {pageClamped} of {totalPages}</span>
              <button disabled={pageClamped >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</button>
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
          timezone={timezone}
        />
      )}
    </div>
  )
}
