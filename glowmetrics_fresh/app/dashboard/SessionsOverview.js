"use client"

// Sessions tab — three zones, freshest first, nothing more on the default view:
//   1. Hero: LIVE NOW (running show) or Latest Performance (last finished)
//   2. Today so far | Platform performance (two columns on desktop)
//   3. Recent sessions (3 newest; "View all" opens the full filtered list;
//      each row has "View details")
// Every figure comes from lib/sessions/normalize.js (one source per formula);
// freshness lines come from real timestamps only. Visual primitives are the
// existing CamCash ones (Command Center card/hero gradient, Platforms
// MetricStrip/PlatformCell, Stream Planner Pill/PlatChip, ShowCard).

import React, { useEffect, useMemo, useState } from "react"
import { platformDisplayName, platformColor } from "../../lib/constants"
import {
  SUPPORTED_PLATFORMS, buildSessionHistory, filterSessionHistory, isShortTipSession, dailySessionStats,
  liveSessionSnapshot, latestPerformance, withTodayDerived, todaySignal, typicalSameWeekdayByNow,
  recentActivity, leaderShift, todayHourly, timeAgo, fanKey,
} from "../../lib/sessions/normalize"
import { ShowCard, fmtUsd, fmtDuration } from "./LatestShows"
import { card, HERO_GRADIENT } from "./CommandCenter"
import { MetricStrip, PlatformCell } from "./PlatformsIntelligence"
import { Pill, PlatChip } from "./StreamPlanner"

const C = {
  cyan: "#22D3EE", green: "#10B981", gold: "#F59E0B", pink: "#EC4899", indigo: "#7C5CFF",
  white: "#F1F5F9", text: "#94A3B8", muted: "#64748B", border: "#1e2d45",
}
const label = { fontSize: 10.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted }

const TYPE_LABEL = { live: "LIVE MODE", free_chat: "FREE CHAT", private: "PRIVATE", imported: "IMPORTED" }
const TYPE_FILTERS = [["all", "All"], ["live", "Live Mode"], ["free_chat", "Free chat"], ["private", "Private"], ["imported", "Imported"]]
const RECENT = 3
const PAGE_SIZE = 25

const pName = (p) => platformDisplayName(p) || p

function fmtMinutes(mins, estimated) {
  const m = Number(mins) || 0
  if (m > 0 && m < 1) return estimated ? "~<1m" : "<1m"
  const r = Math.round(m)
  const h = Math.floor(r / 60)
  const txt = h ? `${h}h ${r % 60}m` : `${r}m`
  return estimated ? `~${txt}` : txt
}
const T = ({ id, children }) => <span data-testid={id}>{children}</span>

// Ticks only while mounted; a fixed `now` (tests) disables it.
function useNow(fixed, everyMs) {
  const [t, setT] = useState(() => (fixed ? new Date(fixed) : new Date()))
  useEffect(() => {
    if (fixed) { setT(new Date(fixed)); return undefined }
    const id = setInterval(() => setT(new Date()), everyMs)
    return () => clearInterval(id)
  }, [fixed, everyMs])
  return t
}

function Bar({ pct, color }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: color, borderRadius: 3, transition: "width .6s ease" }} />
    </div>
  )
}

function Sparkline({ values, testId }) {
  const max = Math.max(...values, 0)
  if (max <= 0) return null
  return (
    <svg data-testid={testId} viewBox="0 0 96 24" width="96" height="24" aria-label="Earnings by hour today" role="img">
      {values.map((v, i) => {
        const h = v > 0 ? Math.max(2, (v / max) * 22) : 0
        return <rect key={i} x={i * 4} y={24 - h} width={3} height={h} rx={1} fill={C.cyan} opacity={v > 0 ? 0.9 : 0} />
      })}
    </svg>
  )
}

function PlatformMix({ split }) {
  if (!split?.length) return null
  return (
    <div data-testid="hero-platforms" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {split.map((p) => (
        <div key={p.platform} data-testid={`hero-platform-${p.platform}`} style={{ display: "grid", gridTemplateColumns: "110px 1fr 90px", alignItems: "center", gap: 10, fontSize: 12 }}>
          <span style={{ color: C.white }}><PlatformCell platform={pName(p.platform)} /></span>
          <Bar pct={p.share} color={platformColor(p.platform) || C.cyan} />
          <span style={{ color: C.text, textAlign: "right" }}>{fmtUsd(p.usd)} · {p.share}%</span>
        </div>
      ))}
    </div>
  )
}

// ── 1. HERO ────────────────────────────────────────────────────────────────
function Hero({ testId, eyebrow, live, badge, value, sub, fresh, metrics, side }) {
  return (
    <div data-testid={testId} className="sx-hero" style={card({ background: HERO_GRADIENT, padding: "18px 22px", display: "grid", gridTemplateColumns: "minmax(220px, 0.9fr) 2fr", gap: 22, alignItems: "center" })}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {live && <span className="sx-pulse" aria-hidden="true" />}
          <span style={{ ...label, color: live ? C.green : C.muted }}>{eyebrow}</span>
          {badge}
        </div>
        <div data-testid={`${testId}-total`} className="hero-revenue-shimmer" style={{ fontSize: "clamp(34px, 4.6vw, 46px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.05, marginTop: 6 }}>{value}</div>
        <div style={{ fontSize: 12.5, color: C.text, marginTop: 4 }}>{sub}</div>
        {fresh && <div data-testid={`${testId}-fresh`} style={{ fontSize: 12.5, color: C.green, marginTop: 6, fontWeight: 700 }}>{fresh}</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <MetricStrip items={metrics} />
        {side}
      </div>
    </div>
  )
}

function LiveHero({ snap, activity, now }) {
  const fresh = activity.count > 0
    ? `+${fmtUsd(activity.usd)} in the last ${activity.minutes} min · ${activity.count} tip${activity.count === 1 ? "" : "s"}`
    : snap.lastUpdated ? `Last tip ${timeAgo(snap.lastUpdated, now)}` : "Waiting for the first tip"
  return (
    <Hero testId="hero-live" live eyebrow={`LIVE NOW · ${fmtDuration(snap.durationSeconds)}${snap.paused ? " · PAUSED" : ""}`}
      value={fmtUsd(snap.publicUSD)} sub="public tips this session — private is added at Stop" fresh={fresh}
      metrics={[
        { label: "Tips", value: <T id="live-tips">{snap.tipCount}</T> },
        { label: "Unique tippers", value: <T id="live-unique">{snap.uniqueTippers}</T> },
        { label: "Duration", value: <T id="live-duration">{fmtDuration(snap.durationSeconds)}</T> },
        { label: "Largest tip", value: <T id="live-largest">{fmtUsd(snap.largestTipUSD)}</T> },
        { label: "Private", value: <T id="live-private">{snap.privateNow ? `In private · ${fmtMinutes(snap.privateNow.minutes)}` : "Not in private"}</T>, color: snap.privateNow ? C.indigo : C.muted },
      ]}
      side={<>
        <div style={{ fontSize: 12.5, color: C.text }}>
          🏆 Top tipper: <span style={{ color: C.gold, fontWeight: 800 }}>{snap.topTipper ? `${snap.topTipper.username} (${fmtUsd(snap.topTipper.usd)}) · ${pName(snap.topTipper.platform)}` : "—"}</span>
        </div>
        <PlatformMix split={snap.platformSplit} />
      </>} />
  )
}

function LatestHero({ entry, now }) {
  const isLive = entry.type === "live"
  const split = (entry.platformBreakdown || []).filter((p) => p.usd > 0).map((p) => ({
    ...p, share: entry.publicUSD > 0 ? Math.round((p.usd / entry.publicUSD) * 100) : 0,
  }))
  const badge = entry.isNew
    ? <span data-testid="hero-new-badge" style={{ background: C.green, color: "#052e1c", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, letterSpacing: 0.6 }}>NEW · JUST ENDED</span>
    : <PlatChip name={TYPE_LABEL[entry.type]} i={0} />
  return (
    <Hero testId="hero-latest" eyebrow="Latest Performance" badge={badge} value={fmtUsd(entry.totalUSD)}
      sub={`${isLive ? "Live Mode show" : "Tip session (estimated length)"} · ended ${timeAgo(entry.endTime, now)}`}
      metrics={[
        { label: "Public", value: <T id="latest-public">{fmtUsd(entry.publicUSD)}</T> },
        { label: "Private", value: <T id="latest-private">{fmtUsd(entry.privateUSD)}</T>, color: C.indigo },
        { label: "Tips", value: <T id="latest-tips">{entry.tipCount}</T> },
        { label: "Unique tippers", value: <T id="latest-unique">{entry.uniqueTippers}</T> },
        { label: "Duration", value: <T id="latest-duration">{isLive ? fmtDuration(entry.durationMinutes * 60) : fmtMinutes(entry.durationMinutes, true)}</T> },
      ]}
      side={<>
        <div style={{ fontSize: 12.5, color: C.text }}>
          🏆 Top tipper: <span style={{ color: C.gold, fontWeight: 800 }}>{entry.topTipper ? `${entry.topTipper.username} (${fmtUsd(entry.topTipper.usd)})` : "—"}</span>
        </div>
        <PlatformMix split={split} />
      </>} />
  )
}

// ── 2. TODAY + PLATFORMS ────────────────────────────────────────────────────
function TodayCard({ today, hourly, comparison, signal, updated }) {
  return (
    <div data-testid="today-stats" style={card({ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 })}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: C.white }}>Today so far</span>
        <span style={{ fontSize: 11.5, color: C.muted }}>Updated {updated}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 30, fontWeight: 900, color: C.cyan, lineHeight: 1 }}><T id="today-total">{fmtUsd(today.totalUSD)}</T></div>
          {comparison && (
            <div data-testid="today-comparison" style={{ fontSize: 12, marginTop: 4, color: comparison.deltaPct >= 0 ? C.green : "#F87171", fontWeight: 700 }}>
              {comparison.deltaPct >= 0 ? "↑" : "↓"}{Math.abs(comparison.deltaPct)}% vs your typical {comparison.weekday} by now
              <span style={{ color: C.muted, fontWeight: 400 }}> · public tips, median of {comparison.days}</span>
            </div>
          )}
        </div>
        <Sparkline values={hourly} testId="today-sparkline" />
      </div>
      <MetricStrip items={[
        { label: "Public / free chat", value: <T id="today-public">{fmtUsd(today.publicUSD)}</T> },
        { label: "Private", value: <T id="today-private">{fmtUsd(today.privateUSD)}</T>, color: C.indigo },
        { label: "Tips", value: <T id="today-tips">{today.tipCount}</T> },
      ]} />
      <MetricStrip items={[
        { label: "Unique tippers", value: <T id="today-unique">{today.uniqueTippers}</T> },
        { label: today.streamedEstimated ? "Streamed (~est.)" : "Streamed", value: <T id="today-streamed">{fmtMinutes(today.streamedMinutes, today.streamedEstimated)}</T> },
        { label: "Sessions", value: <T id="today-completed">{today.completedSessions}</T>, color: C.gold },
      ]} />
      {signal && <div data-testid="today-signal" style={{ fontSize: 12.5, color: C.cyan, fontWeight: 700 }}>📈 {signal}</div>}
    </div>
  )
}

function PlatformsCard({ today, shift }) {
  return (
    <div data-testid="today-by-platform" style={card({ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 })}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: C.white }}>Platform performance</span>
        <span style={{ fontSize: 11.5, color: C.muted }}>
          Best: <T id="today-best-platform">{today.bestPlatform ? pName(today.bestPlatform) : "Not enough data yet"}</T>
        </span>
      </div>
      {shift && <div data-testid="leader-shift" style={{ fontSize: 12.5, color: C.green, fontWeight: 700 }}>⬆ {pName(shift.platform)} moved into #1 today in the last {shift.minutes} min</div>}
      {!today.platforms.length && <div style={{ fontSize: 13, color: C.text }}>Not enough data yet</div>}
      {today.platforms.map((p) => {
        const best = p.platform === today.bestPlatform
        const color = platformColor(p.platform) || C.cyan
        return (
          <div key={p.platform} data-testid={`today-platform-${p.platform}`} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 10px", borderRadius: 10, border: `1px solid ${best ? `${C.cyan}66` : "transparent"}`, background: best ? "rgba(34,211,238,0.05)" : "transparent" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: C.white, display: "flex", alignItems: "center", gap: 8 }}>
                <PlatformCell platform={pName(p.platform)} />
                {best && <span data-testid="best-platform-badge" style={{ ...label, color: C.cyan }}>#1 today</span>}
              </span>
              <span style={{ fontSize: 16, fontWeight: 900, color: C.white }}>{fmtUsd(p.totalUSD)} <span style={{ fontSize: 12, color: best ? C.cyan : C.text, fontWeight: 700 }}>{p.share}%</span></span>
            </div>
            <Bar pct={p.share} color={color} />
            <div style={{ fontSize: 11.5, color: C.text }}>
              {fmtUsd(p.publicUSD)} public · {fmtUsd(p.privateUSD)} private · {p.tipCount} tip{p.tipCount === 1 ? "" : "s"} · {p.uniqueTippers} tipper{p.uniqueTippers === 1 ? "" : "s"}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── 3. RECENT SESSIONS ──────────────────────────────────────────────────────
function SessionDetails({ entry }) {
  if (entry.type === "live") return <ShowCard show={entry.show} />
  if (entry.type === "private") {
    return <MetricStrip items={[
      { label: "Private", value: fmtUsd(entry.privateUSD), color: C.indigo },
      { label: "Fan", value: entry.fan || "—" },
      { label: "Type", value: entry.sessionType || "private" },
      { label: "Charges", value: entry.chargeCount },
      { label: "Charge span", value: entry.chargeSpanMinutes != null ? fmtMinutes(entry.chargeSpanMinutes) : "Single charge", sub: "first to last charge; length not in import" },
    ]} />
  }
  const fans = new Map()
  for (const t of entry.session?.tips || []) {
    const k = fanKey(t.platform, t.username)
    const f = fans.get(k) || { username: t.username, usd: 0, n: 0 }
    f.usd += Number(t.usd) || 0
    f.n += 1
    fans.set(k, f)
  }
  const top = [...fans.values()].sort((a, b) => b.usd - a.usd).slice(0, 5)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <MetricStrip items={[
        { label: "Earned", value: fmtUsd(entry.totalUSD) },
        { label: "Length (est.)", value: entry.durationUnknown ? "Single tip" : fmtMinutes(entry.durationMinutes, true) },
        { label: "Tips", value: entry.tipCount },
        { label: "Avg tip", value: entry.tipCount ? fmtUsd(entry.totalUSD / entry.tipCount) : "—" },
        { label: "Tippers", value: entry.uniqueTippers },
      ]} />
      {top.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={label}>Fan contribution</span>
          {top.map((f) => (
            <div key={f.username} style={{ display: "grid", gridTemplateColumns: "120px 1fr 110px", gap: 10, alignItems: "center", fontSize: 12 }}>
              <span style={{ color: C.white, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.username}</span>
              <Bar pct={entry.totalUSD > 0 ? (f.usd / entry.totalUSD) * 100 : 0} color={C.gold} />
              <span style={{ color: C.text, textAlign: "right" }}>{fmtUsd(f.usd)} · {f.n} tip{f.n === 1 ? "" : "s"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SessionRow({ entry, tz, open, onToggle }) {
  const when = new Date(entry.startTime).toLocaleString([], { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  const len = entry.type === "live" ? fmtDuration(entry.durationMinutes * 60)
    : entry.type === "private" ? (entry.chargeSpanMinutes != null ? fmtMinutes(entry.chargeSpanMinutes) : "—") : entry.durationUnknown ? "Single tip" : fmtMinutes(entry.durationMinutes, true)
  return (
    <div data-testid={`history-${entry.id}`} style={card({ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10 })}>
      <div className="sx-row" style={{ display: "grid", gridTemplateColumns: "150px 1fr 90px 70px 60px auto", gap: 12, alignItems: "center", fontSize: 13 }}>
        <span style={{ color: C.text }}>{when}</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", minWidth: 0 }}>
          <span data-testid={`type-badge-${entry.type}`} style={{ ...label, color: entry.type === "live" ? C.green : entry.type === "private" ? C.indigo : C.cyan }}>
            {entry.type === "private" && entry.sessionType ? `PRIVATE · ${String(entry.sessionType).toUpperCase()}` : TYPE_LABEL[entry.type]}
          </span>
          {entry.platforms.map((p, i) => <span key={p} data-testid={`platform-badge-${p}`}><PlatChip name={pName(p)} i={i} /></span>)}
          {entry.isNew && <span data-testid="row-new-badge" style={{ background: C.green, color: "#052e1c", fontSize: 9.5, fontWeight: 800, padding: "1px 6px", borderRadius: 999 }}>NEW</span>}
        </span>
        <span style={{ color: C.white, fontWeight: 800, textAlign: "right" }}>
          {fmtUsd(entry.totalUSD)}
          {entry.privateUSD > 0 && entry.publicUSD > 0 && <div style={{ fontSize: 10.5, color: C.indigo, fontWeight: 600 }}>{fmtUsd(entry.privateUSD)} private</div>}
        </span>
        <span style={{ color: C.text, textAlign: "right" }}>{len}</span>
        <span style={{ color: C.text, textAlign: "right" }}>{entry.type === "private" ? `${entry.chargeCount} charge${entry.chargeCount === 1 ? "" : "s"}` : `${entry.tipCount} tips`}</span>
        <span data-testid={`details-${entry.id}`}><Pill active={open} onClick={onToggle}>{open ? "Hide" : "View details"}</Pill></span>
      </div>
      {open && <SessionDetails entry={entry} />}
    </div>
  )
}

export default function SessionsOverview({ tips, shows, paidSessions, tz, showsLoading, showsError, now: fixedNow, live }) {
  const now = useNow(fixedNow, live?.session ? 5000 : 15000)
  const [showAll, setShowAll] = useState(false)
  const [typeFilter, setTypeFilter] = useState("all")
  const [platformFilter, setPlatformFilter] = useState("all")
  const [includeShort, setIncludeShort] = useState(false)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [openId, setOpenId] = useState(null)
  const [loadedAt, setLoadedAt] = useState(() => new Date())
  useEffect(() => { setLoadedAt(new Date()) }, [tips, shows, paidSessions])

  const T0 = tips || [], S0 = shows || [], P0 = paidSessions || []
  const history = useMemo(() => buildSessionHistory({ tips: T0, shows: S0, paidSessions: P0 }), [tips, shows, paidSessions]) // eslint-disable-line react-hooks/exhaustive-deps
  const minuteKey = Math.floor(now.getTime() / 60000)
  const today = useMemo(() => withTodayDerived(dailySessionStats({ tips: T0, history, paidSessions: P0, tz, now })), [history, tz, minuteKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const hourly = useMemo(() => todayHourly({ tips: T0, tz, now }), [tips, tz, minuteKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const comparison = useMemo(() => typicalSameWeekdayByNow({ tips: T0, tz, now }), [tips, tz, minuteKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const shift = useMemo(() => leaderShift({ tips: T0, history, paidSessions: P0, tz, now }), [history, tz, minuteKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const snap = live?.session ? liveSessionSnapshot({ session: live.session, tips: T0, privateInterval: live.privateInterval, now }) : null
  const activity = recentActivity({ tips: snap ? T0.filter((t) => t.live_session_id === snap.id) : T0, now })
  const latest = useMemo(() => latestPerformance(history), [history])
  const visibleAll = useMemo(() => filterSessionHistory(history, { type: typeFilter, platform: platformFilter, includeShort }), [history, typeFilter, platformFilter, includeShort])
  const recent = useMemo(() => filterSessionHistory(history).slice(0, RECENT), [history])
  const shortCount = useMemo(() => history.filter(isShortTipSession).length, [history])
  const signal = todaySignal(today, pName)
  const rows = showAll ? visibleAll.slice(0, limit) : recent
  const pick = (setter, v) => { setter(v); setLimit(PAGE_SIZE) }
  const toggle = (id) => setOpenId((cur) => (cur === id ? null : id))

  return (
    <div data-testid="sessions-overview" className="sx-root" style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 24 }}>
      <style>{`
        .sx-root .sx-pulse { width: 9px; height: 9px; border-radius: 50%; background: ${C.green}; box-shadow: 0 0 0 0 rgba(16,185,129,.6); animation: sxPulse 1.6s infinite; }
        @keyframes sxPulse { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,.55); } 70% { box-shadow: 0 0 0 9px rgba(16,185,129,0); } 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }
        @media (prefers-reduced-motion: reduce) { .sx-root .sx-pulse { animation: none; } }
        @media (max-width: 1000px) { .sx-root .sx-hero, .sx-root .sx-two { grid-template-columns: 1fr !important; } }
        @media (max-width: 700px) { .sx-root .pi-strip { grid-template-columns: repeat(2, minmax(0,1fr)) !important; } .sx-root .sx-row { grid-template-columns: 1fr auto !important; } }
      `}</style>

      <h1 style={{ fontSize: 26, fontWeight: 800, color: C.white, margin: 0 }}>🎥 Sessions</h1>

      {snap ? <LiveHero snap={snap} activity={activity} now={now} /> : latest ? <LatestHero entry={latest} now={now} /> : null}

      <div className="sx-two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <TodayCard today={today} hourly={hourly} comparison={comparison} signal={signal} updated={timeAgo(loadedAt.toISOString(), now)} />
        <PlatformsCard today={today} shift={shift} />
      </div>

      <div data-testid="session-history" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: C.white }}>{showAll ? "All sessions" : "Recent sessions"}</span>
          {history.length > 0 && (
            <span data-testid="view-all"><Pill active={showAll} onClick={() => { setShowAll(!showAll); setLimit(PAGE_SIZE) }}>{showAll ? "Show recent only" : "View all & filter →"}</Pill></span>
          )}
        </div>
        {showAll && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TYPE_FILTERS.map(([k, l]) => <span key={k} data-testid={`filter-type-${k}`}><Pill active={typeFilter === k} onClick={() => pick(setTypeFilter, k)}>{l}</Pill></span>)}
            <span style={{ width: 8 }} />
            <span data-testid="filter-platform-all"><Pill active={platformFilter === "all"} onClick={() => pick(setPlatformFilter, "all")}>All platforms</Pill></span>
            {SUPPORTED_PLATFORMS.map((p) => <span key={p} data-testid={`filter-platform-${p}`}><Pill active={platformFilter === p} onClick={() => pick(setPlatformFilter, p)}>{pName(p)}</Pill></span>)}
            {shortCount > 0 && <span data-testid="filter-short"><Pill active={includeShort} onClick={() => pick(setIncludeShort, !includeShort)}>{includeShort ? "Hide" : "Show"} short tip groups ({shortCount})</Pill></span>}
          </div>
        )}
        {showsError && <div style={{ color: C.text, fontSize: 12 }}>Couldn&apos;t load your Live Mode shows. They&apos;ll appear on the next refresh.</div>}
        {showsLoading && !history.length && <div style={{ color: C.text, fontSize: 12 }}>Loading…</div>}
        {!showsLoading && !history.length && <div data-testid="history-empty" style={{ color: C.text, fontSize: 13 }}>No sessions yet. Start a Live Mode show or import your tip history.</div>}
        {history.length > 0 && !rows.length && (
          <div data-testid="history-filter-empty" style={{ color: C.text, fontSize: 13 }}>
            No sessions match these filters.{!includeShort && shortCount > 0 ? " Short tip groups (under 30 min or a single tip) are hidden." : ""}
          </div>
        )}
        {rows.map((e) => <SessionRow key={e.id} entry={e} tz={tz} open={openId === e.id} onToggle={() => toggle(e.id)} />)}
        {showAll && visibleAll.length > limit && (
          <span data-testid="history-more"><Pill active={false} onClick={() => setLimit((n) => n + PAGE_SIZE)}>Show more ({visibleAll.length - limit} older)</Pill></span>
        )}
      </div>
    </div>
  )
}
