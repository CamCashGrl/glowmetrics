"use client"
import { useState, useMemo } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { getSessionBreakdown, SESSION_PERF_BADGE } from "../../lib/analytics/session-insights"
import { computePaidSessionAnalytics } from "../../lib/analytics"
import SessionDrawer from "./SessionDrawer"
// Approved master card templates. Every card surface on this page is one of
// them; nothing here defines its own glass, border, radius or glow. The
// specialised displays that genuinely need their own structure — the session
// history table, the Recharts trend, the SessionDrawer — keep it, and sit
// inside a template rather than defining a surface of their own.
import Card from "../../components/ui/Card"
import { StandardCard } from "../../components/ui/cards"
// Shared platform list/selector — the same one Performance.js's colours are
// now sourced from (lib/platforms.js), so a platform reads the same name
// and colour on both tabs instead of two separate copies drifting apart.
import { PLATFORM_NAMES, styleForPlatform } from "../../lib/platforms"
import PlatformFilter from "../../components/ui/PlatformFilter"

const TYPE_META = {
  free: { label: "Free Chat", icon: "🎥", color: "#22D3EE" },
  live: { label: "Live Mode", icon: "🔴", color: "#FB923C" },
  paid: { label: "Paid / Private", icon: "💎", color: "#A855F7" },
}
// Keyed by paid_sessions.session_type, matching PrivateSessions.js so the
// same session type is the same colour wherever it is shown.
const PAID_TYPE_COLORS = { "Private Chat": "#22d3ee", "Full-Private Chat": "#a855f7", "Group Chat": "#f59e0b", "Spy Mode": "#f472b6" }
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

// One cell of the summary strip. Deliberately NOT a MetricCard: the six of
// them share a single surface, and a MetricCard inside that surface would be
// a card inside a card. MetricCard is reserved for a true headline metric,
// and none of these six is the headline — together they are the summary.
// Uses the page's existing KPI type classes, so nothing about the type scale
// or the density changes.
function SessionKpi({ label, value, color, sub }) {
  return (
    <div className="session-kpi-cell">
      <div className="session-kpi-label">{label}</div>
      <div className="session-kpi-value" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="session-kpi-sub">{sub}</div>}
    </div>
  )
}

// ── WHALE INTERSECTION ────────────────────────────────────────────────────
// No function anywhere already answers "which whales tipped in THIS
// session" — identifyWhales() (lib/analytics.js) computes tiers across the
// WHOLE account, and no session object carries a tier. This joins the two
// real outputs: a lowercase username -> tier map from the account's already-
// computed whale list, checked against the session's own tip usernames.
// Nothing is classified here that identifyWhales() didn't already classify.
function buildWhaleTierMap(whales) {
  const map = {}
  for (const w of whales) if (w?.username) map[String(w.username).toLowerCase()] = w.tier
  return map
}
// Only meaningful where a session actually carries tipper identities.
// Free-chat sessions do: each tip has a username. Live Mode sessions don't —
// live_sessions stores aggregate counts only (tip_count, unique_tipper_count),
// never who tipped, so "whales tracked" cannot be calculated for them and is
// not shown, rather than guessed at or shown as a false 0. Paid sessions carry
// exactly one identity (the client on that booking).
function whalesInSession(type, s, tierMap) {
  if (type === "free") {
    const seen = new Set()
    let count = 0
    for (const t of (s.tips || [])) {
      const u = String(t.username || "").toLowerCase()
      if (!u || seen.has(u)) continue
      seen.add(u)
      if (tierMap[u] === "Whale") count++
    }
    return count
  }
  if (type === "paid" && s.username) {
    return tierMap[String(s.username).toLowerCase()] === "Whale" ? 1 : 0
  }
  return null // not trackable for this session type
}

// ── Session bucket — the old Sessions information architecture, redrawn on
// the current CamCashGrl system at far higher density. ───────────────────
// The previous version of this page put "what happened" and "who drove it"
// one click away in SessionDrawer; that buried the exact intelligence a
// creator opens Sessions to see. This card surfaces it directly:
//   SNAPSHOT        — earnings, duration, tips, $/hr, platform, type
//   WHO DROVE IT     — real top tippers with $ and % share; whales tracked
//   WHAT DROVE IT    — the engine's own timing/concentration/audience
//                       insights (session-insights.js) — the same real
//                       signals that answer both "what influenced this
//                       session" and "what drove it": there is one insights
//                       array, not two, so this reads as one honest section
//                       instead of two headers repeating the same sentence
// The full per-tip timeline, spike detail and coaching thread stay in
// SessionDrawer — genuinely deep detail, not the summary intelligence above.
function SessionBucket({ row, onOpen, onViewFan, comparablePopulation = [], tierMap = {}, timezone = "UTC" }) {
  const { type, session: s } = row
  const meta = TYPE_META[type]
  const revenue = rowRevenue(type, s)
  const usdPerHr = rowUsdPerHr(type, s)
  const bd = type === "free" ? getSessionBreakdown(s, comparablePopulation, timezone) : null
  const perf = bd?.performance
  const platform = rowPlatform(type, s)
  const pStyle = styleForPlatform(platform)
  const whaleCount = whalesInSession(type, s, tierMap)

  // Who drove it — real identities where the session type carries them.
  let whoDrove = []
  let tipsCount = null
  if (type === "free") {
    tipsCount = s.tipCount ?? (s.tips || []).length
    whoDrove = bd?.topTippers || []
  } else if (type === "live") {
    tipsCount = s.tip_count ?? null
    // No usernames in live_sessions — the honest "who drove it" here is the
    // real aggregate the table does carry, not an invented name.
  } else if (type === "paid") {
    tipsCount = 1
    if (s.username) whoDrove = [{ username: s.username, usd: parseFloat(s.usd) || 0, pct: 100 }]
  }

  // What drove it — the engine's own insights, not a re-derivation. Kept to
  // the two most substantive lines so the card stays dense; the rest is in
  // the drawer.
  const droveLines = type === "free" && bd ? bd.insights.slice(0, 2) : []

  // Performance-vs-average — the same real allAvg getSessionBreakdown
  // already computes, shown as one prominent line rather than buried in the
  // insights paragraph. "average" tier gets no banner, same as the drawer.
  let perfBanner = null
  if (type === "free" && bd && bd.performance !== "average" && bd.allAvg) {
    const diff = s.totalUSD - bd.allAvg
    const pct = Math.round((Math.abs(diff) / bd.allAvg) * 100)
    perfBanner = bd.performance === "high"
      ? { good: true, text: `$${diff.toFixed(0)} above your avg session — top ${pct}% performance` }
      : { good: false, text: `$${Math.abs(diff).toFixed(0)} below your avg session ($${bd.allAvg.toFixed(0)}) — ${pct}% shortfall` }
  }

  return (
    <StandardCard variant="glass" padding="md" className="session-bucket">
      <div className="bucket-head">
        <div className="bucket-type" style={{ color: meta.color }}>
          {meta.icon} {meta.label}
          <span className="bucket-platform" style={{ color: pStyle.accent }} title={platform}>· {platform}</span>
        </div>
        <QualityBadge perf={perf} />
      </div>
      <div className="bucket-date">{fmtDateTime(rowDate(type, s))}</div>

      {perfBanner && (
        <div className={`bucket-perf-banner ${perfBanner.good ? "is-good" : "is-low"}`}>
          {perfBanner.good ? "✅" : "⚠️"} {perfBanner.text}
        </div>
      )}

      {/* SNAPSHOT */}
      <div className="bucket-snapshot">
        <div><span>Earnings</span><strong>{fmtUsd(revenue)}</strong></div>
        <div><span>$/hr</span><strong>{usdPerHr != null ? fmtUsd(usdPerHr) : "—"}</strong></div>
        <div><span>Duration</span><strong>{fmtDur(rowDurationMinutes(type, s))}</strong></div>
        <div><span>Tips</span><strong>{tipsCount != null ? tipsCount : "—"}</strong></div>
      </div>

      {/* Peak-time callout — bd.peakTime/peakBucket, the same values the
          drawer's earnings-timeline chart is built from. */}
      {type === "free" && bd?.peakBucket?.usd > 0 && (
        <div className="bucket-meta-line" style={{ marginTop: 8 }}>
          🔥 Peaked at {new Date(bd.peakTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone })} — {fmtUsd(bd.peakBucket.usd)} in 5 minutes
        </div>
      )}

      {/* WHO DROVE IT */}
      {(whoDrove.length > 0 || whaleCount != null || (type === "live" && s.unique_tipper_count != null)) && (
        <div className="bucket-section">
          <div className="bucket-label">Who drove it</div>
          {whoDrove.length > 0 && (
            <div className="bucket-tippers">
              {whoDrove.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  className="bucket-tipper-row"
                  disabled={!onViewFan}
                  onClick={onViewFan ? (e) => { e.stopPropagation(); onViewFan(t.username) } : undefined}
                >
                  <span className="bucket-tipper-name">{t.username}</span>
                  <span className="bucket-tipper-pct">{t.pct != null ? `${t.pct}%` : ""}</span>
                  <strong>{fmtUsd(t.usd)}</strong>
                </button>
              ))}
            </div>
          )}
          {type === "live" && s.unique_tipper_count != null && (
            <div className="bucket-meta-line">
              {s.unique_tipper_count} supporter{s.unique_tipper_count === 1 ? "" : "s"} tipped
              {s.largest_tip_usd ? ` · largest tip ${fmtUsd(s.largest_tip_usd)}` : ""}
            </div>
          )}
          {whaleCount != null && (
            <div className="bucket-meta-line">
              🐋 {whaleCount} whale{whaleCount === 1 ? "" : "s"} tracked this session
            </div>
          )}
        </div>
      )}

      {/* WHAT DROVE IT — real engine insights (timing, concentration,
          audience) doing double duty as "what influenced" and "what drove"
          this session, since both ask the same real signal. */}
      {droveLines.length > 0 && (
        <div className="bucket-section">
          <div className="bucket-label">What drove it</div>
          {droveLines.map((line, i) => <div key={i} className="bucket-drove-line">→ {line}</div>)}
        </div>
      )}

      <button type="button" className="bucket-foot-link" onClick={onOpen}>
        View full session →
      </button>
    </StandardCard>
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
  // Account-wide whale tiers (analytics.whales — identifyWhales() output),
  // reused for the per-session "who drove it" / "whales tracked" join. Not
  // a second whale calculation — the tiers are already computed; this page
  // only checks which of them tipped in a given session.
  whales = [],
  onViewFan,
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

  // Session buckets carry real "who drove it" detail now, not just a
  // scannable summary, so 4 — not the interim design's 6 — is the right
  // count for the space they need.
  const recent = useMemo(() => [...visible].sort((a, b) => new Date(rowDate(b.type, b.session)) - new Date(rowDate(a.type, a.session))).slice(0, 4), [visible])
  const whaleTierMap = useMemo(() => buildWhaleTierMap(whales), [whales])

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
        {/* Shared selector (components/ui/PlatformFilter.jsx) — the same
            component Money Map/other tabs can reuse rather than each
            building their own platform picker. */}
        <PlatformFilter platforms={PLATFORM_NAMES} value={platform} onChange={(p) => { setPlatform(p); setPage(1) }} />
      </div>

      {!hasFilteredData ? (
        <StandardCard className="session-empty" padding="lg">
          <div className="session-empty-icon">🎥</div>
          <div className="session-empty-title">No recent sessions</div>
          <div className="session-empty-body">Once you stream, CamCash will start showing what worked, who held the room, and where your next session can improve.</div>
          {hasAnyHistory && <button className="gradient-button" style={{ maxWidth: 220, margin: "16px auto 0" }} onClick={() => setRange("all")}>View historical data</button>}
        </StandardCard>
      ) : (
        <>
          {usingFallbackPopulation && (
            <div className="insight-line" style={{ marginBottom: 12, color: "#ffc43d" }}>
              ⚠ No sessions meet the meaningful-session threshold yet, so these figures include low-signal sessions. Treat them as an early signal.
            </div>
          )}

          {/* ── SUMMARY ────────────────────────────────────────────────
                One compact intelligence strip, not six competing boxes. A
                master template is a composition, not a mandatory wrapper:
                six MetricCards side by side made six equal surfaces out of
                what is really one summary, so the KPIs now share a single
                surface and the strip reads as one object. Every value,
                colour and qualifier is the one that was already here. ── */}
          <Card variant="glass" glow="cyan" padding="md" className="session-summary">
            <div className="session-kpis" style={{ margin: 0 }}>
              <SessionKpi label="Total Sessions" value={summary.totalSessions}
                sub={`${summary.streamCount} stream${summary.streamCount === 1 ? "" : "s"}${summary.paidBookings > 0 ? ` · ${summary.paidBookings} paid booking${summary.paidBookings === 1 ? "" : "s"}` : ""}`} />
              <SessionKpi label="Stream Time" value={fmtHrs(summary.totalHours)} color="#22D3EE" />
              <SessionKpi label="Total Revenue" value={fmtUsd0(summary.totalRevenue)} color="#21d99a" sub="All streams and paid bookings" />
              {/* Paid bookings carry no duration, so they are outside this rate
                  entirely while still counting toward Total Revenue above. */}
              <SessionKpi label="Avg $/hr" value={summary.avgPerHr != null ? fmtUsd(summary.avgPerHr) : "—"} color="#ffc43d"
                sub={summary.untimedCount > 0 ? `Timed sessions only · ${summary.untimedCount} excluded` : "Timed sessions only"} />
              <SessionKpi label="Avg Session" value={summary.avgSession != null ? fmtUsd(summary.avgSession) : "—"} color="#EC4899" sub="Streams only" />
              <SessionKpi label="Best Session" value={summary.best ? fmtUsd(rowRevenue(summary.best.type, summary.best.session)) : "—"} color="#A855F7"
                sub={summary.best ? TYPE_META[summary.best.type].label : "—"} />
            </div>
          </Card>

          {/* ── ANALYSIS ───────────────────────────────────────────────
                One analytical area, not two cards. "Where the money came
                from" and "how the rate moved" are halves of the same
                question, so they share a surface with a rule between them
                instead of competing as separate containers. Everything is
                rendered from figures that are already computed (typePerf,
                paidStats.sessionTypeBreakdown, monthlyData); no revenue and
                no rate is re-derived here. The Recharts figure keeps its own
                structure — a chart genuinely needs it. ── */}
          {(() => {
            const rows = [
              { key: "free", label: "Free Chat", color: TYPE_META.free.color, usd: typePerf.free.revenue, count: typePerf.free.count, note: "Public tips in open chat" },
              { key: "live", label: "Live Mode", color: TYPE_META.live.color, usd: typePerf.live.revenue, count: typePerf.live.count, note: "Earned during a tracked Live Mode stream" },
              ...(paidStats?.sessionTypeBreakdown || []).map(t => ({
                key: `paid:${t.type}`, label: t.type, color: PAID_TYPE_COLORS[t.type] || TYPE_META.paid.color,
                usd: t.usd, count: t.count, note: `${t.clients} client${t.clients === 1 ? "" : "s"}`,
              })),
            ].filter(r => r.usd > 0)
            const total = rows.reduce((a, r) => a + r.usd, 0)
            const hasSplit = rows.length > 0 && total > 0
            const hasTrend = trendData.length > 1
            if (!hasSplit && !hasTrend) return null
            const withPct = rows.map(r => ({ ...r, pct: (r.usd / total) * 100 })).sort((a, b) => b.usd - a.usd)
            return (
              <Card variant="glass" glow="purple" padding="lg" style={{ marginTop: 22 }}>
                {hasSplit && (
                  <>
                    <div className="section-label">💰 Session type breakdown</div>
                    <div style={{ display: "flex", height: 30, borderRadius: 9, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 16 }}>
                      {withPct.map(r => (
                        <div key={r.key} title={`${r.label}: ${fmtUsd(r.usd)} (${r.pct.toFixed(1)}%)`}
                          style={{ width: `${r.pct}%`, background: r.color, display: "flex", alignItems: "center", justifyContent: "center", transition: "width 0.35s" }}>
                          {r.pct >= 11 && <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(8,12,24,0.85)" }}>{Math.round(r.pct)}%</span>}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
                      {withPct.map(r => (
                        <div key={r.key}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 4, background: r.color, flexShrink: 0 }} />
                            <span className="session-kpi-label" style={{ marginBottom: 0 }}>{r.label}</span>
                          </div>
                          <div style={{ fontSize: 17, fontWeight: 800, color: r.color }}>{fmtUsd(r.usd)}</div>
                          <div className="session-kpi-sub">{Math.round(r.pct)}% · {r.count} session{r.count === 1 ? "" : "s"}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 10.5, color: "#687696", marginTop: 12, lineHeight: 1.5 }}>
                      Free chat, Live Mode and paid sessions are stored separately and each counted once — these add up, they never overlap.
                    </div>
                  </>
                )}

                {hasSplit && hasTrend && (
                  <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "20px 0 16px" }} />
                )}

                {hasTrend && (
                  <>
                    <div className="section-label">Session performance — $/hr over time</div>
                    <ResponsiveContainer width="100%" height={150}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="month" tick={{ fill: "#687696", fontSize: 11 }} />
                        <YAxis tick={{ fill: "#687696", fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: "#0a0e1a", border: "1px solid rgba(255,255,255,0.1)" }} formatter={v => fmtUsd(v)} />
                        <Line type="monotone" dataKey="usdPerHour" stroke="#22D3EE" strokeWidth={2} dot={{ r: 3, fill: "#A855F7" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </>
                )}
              </Card>
            )
          })()}

          {/* ── BREAKDOWN BY SESSION TYPE ──────────────────────────────
                Live Mode and Paid Session intelligence answer the same
                question — "how does each kind of session perform?" — so they
                are two columns of one section rather than two independent
                cards. Each column keeps its own specialised content: the
                Live column's coaching history is a scrolling log, not a
                metric grid, and stays one. ── */}
          {(typeFilter === "all" || typeFilter === "live" || typeFilter === "paid") && (
            <StandardCard eyebrow="Breakdown by session type" style={{ marginTop: 22 }}>
              <div className="session-two-col" style={{ marginTop: 14 }}>
                {(typeFilter === "all" || typeFilter === "live") && (
                  <div>
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
                  </div>
                )}
                {(typeFilter === "all" || typeFilter === "paid") && (
                  <div>
                    <div className="section-label" style={{ color: "#A855F7" }}>💎 Paid Session Intelligence</div>
                    {!paidStats ? (
                      <div className="insight-line">Not enough data yet.</div>
                    ) : (
                      <div className="session-kpis" style={{ gridTemplateColumns: "repeat(2,1fr)", margin: 0 }}>
                        <div><div className="session-kpi-label">Sessions</div><div className="session-kpi-value" style={{ fontSize: 16 }}>{paidStats.totalCount}</div></div>
                        <div><div className="session-kpi-label">Revenue</div><div className="session-kpi-value" style={{ fontSize: 16, color: "#21d99a" }}>{fmtUsd0(paidStats.totalUSD)}</div></div>
                        <div><div className="session-kpi-label">Avg Session</div><div className="session-kpi-value" style={{ fontSize: 16, color: "#EC4899" }}>{fmtUsd(paidStats.avgSessionUSD)}</div></div>
                        <div><div className="session-kpi-label">Unique Clients</div><div className="session-kpi-value" style={{ fontSize: 16, color: "#A855F7" }}>{paidStats.uniqueClients}</div></div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </StandardCard>
          )}

          {/* ── LIVE MODE COACHING REPORT ──────────────────────────────
                NOT the raw prompt feed — that lives in the Live Mode tab,
                unintrusively, while a creator is streaming. This is a
                summary: how much of what fired was actually actionable, and
                whether it got acted on. "Actionable" is a real distinction
                already encoded in lib/coaching/triggers.js's own priority
                scale (1-2 = called for a behavior change: dead air, pace
                dropping, fatigue; 3-4 = positive reinforcement / FYI: pace
                is good, goal hit, a whale is near). Priority 3-4 events are
                excluded here rather than padding the count with "you're
                doing great" notices.
                A true outcomes report — which specific prompts measurably
                helped — needs coaching_events.estimated_impact, a column
                that exists in the schema but that no trigger populates yet.
                Until that's wired up, this stays a count, not a claim. ── */}
          {(typeFilter === "all" || typeFilter === "live") && (
            <StandardCard eyebrow="🎯 Live Mode coaching report" style={{ marginTop: 22 }}>
              {recentCoachingLoading && <div className="insight-line">Loading coaching history…</div>}
              {!recentCoachingLoading && recentCoachingEvents.length === 0 && (
                <div className="insight-line">Not enough Live Mode coaching history yet — this fills in as you stream with Live Mode on.</div>
              )}
              {!recentCoachingLoading && recentCoachingEvents.length > 0 && (() => {
                const actionable = recentCoachingEvents.filter(e => (e.priority ?? 99) <= 2)
                if (actionable.length === 0) {
                  return <div className="insight-line">Nothing actionable fired in your recent Live Mode sessions — a quiet stream, in a good way.</div>
                }
                const performed = actionable.filter(e => e.action_status === "performed").length
                const skipped = actionable.filter(e => e.action_status === "skipped").length
                const unmarked = actionable.length - performed - skipped
                return (
                  <>
                    <div className="bucket-snapshot" style={{ borderTop: 0, paddingTop: 0 }}>
                      <div><span>Actionable prompts</span><strong>{actionable.length}</strong></div>
                      <div><span>Performed</span><strong style={{ color: "#21d99a" }}>{performed}</strong></div>
                      <div><span>Skipped</span><strong style={{ color: "#687696" }}>{skipped}</strong></div>
                      <div><span>Unmarked</span><strong style={{ color: "#ffc43d" }}>{unmarked}</strong></div>
                    </div>
                    <div className="insight-line" style={{ color: "#687696", fontSize: 11.5 }}>
                      Across your last {new Set(actionable.map(e => e.session_id)).size} Live Mode session{new Set(actionable.map(e => e.session_id)).size === 1 ? "" : "s"} with coaching history. A full performance report — which prompts actually moved the numbers — needs more Live Mode session history to build reliably; this sharpens as you stream more with it on.
                    </div>
                  </>
                )
              })()}
            </StandardCard>
          )}

          {/* Streaming/hourly statistics for this page are the KPI strip's
              Stream Time + Avg $/hr and the analysis card's $/hr-over-time
              trend above — real historical performance, not a ranked
              recommendation. A ranked "best hours to stream" pick already
              exists elsewhere in the product (Overview / Platforms); adding
              a second one here would be the exact duplicate the brief
              called out, so it was removed rather than kept alongside it. */}

          {/* ── INDIVIDUAL SESSIONS ────────────────────────────────────
                These stay cards, because here the card IS the content: each
                one is a single session, and the surface is what separates
                one from the next. This is the only place on the page where
                a repeated card is the right answer. ── */}
          <div className="section-label" style={{ marginTop: 26 }}>✨ Recent Session Intelligence</div>
          <div className="recent-session-grid">
            {recent.map((r, i) => (
              <SessionBucket
                key={i} row={r} onOpen={() => openDrawer(r)} onViewFan={onViewFan}
                comparablePopulation={filteredFree} tierMap={whaleTierMap} timezone={timezone}
              />
            ))}
          </div>

          {/* ── HISTORY ────────────────────────────────────────────────
                A real interactive table — sorting, pagination and a per-row
                drawer — which is why it is not a ComparisonCard: that
                template's static cell model would strip all three. It sits
                on a plain page section rather than another card, so the end
                of the page reads as the record rather than as one more
                container competing with the analysis above it. ── */}
          <div className="session-history" style={{ marginTop: 26 }}>
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
