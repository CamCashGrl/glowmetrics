"use client"

// Sessions tab, composed to the approved reference:
//   Row 1  title + subtitle | range (Today / 7 Days / 30 Days) + freshness
//   Row 2  "Today so far" glass hero: gradient total + real trend | 8 inset cells
//   Row 3  three equal platform cards (BongaCams | Chaturbate | MyFreeCams)
//   Row 4  master–detail: Recent Sessions (45%) | Session Details (55%)
// Additive, same rows: content adapts to the data the creator has
// (sessionsMode). CSV-only → Overall Performance hero; Live + CSV → a
// Today | Overall switch (Today default); one platform, or the Overall scope
// → Session Performance cards in Row 3 instead of platform comparison.
// Every number comes from lib/sessions/normalize.js (one formula each);
// visuals reuse CamCash primitives (Command Center card / hero gradient,
// Platforms PlatformCell, Stream Planner Pill / PlatChip, platform colors).

import React, { useEffect, useMemo, useRef, useState } from "react"
import { platformDisplayName, platformColor } from "../../lib/constants"
import {
  SUPPORTED_PLATFORMS, buildSessionHistory, filterSessionHistory, dailySessionStats,
  liveSessionSnapshot, withTodayDerived, todaySignal, vsYesterdayByNow, todayCumulative,
  sessionTimeline, timeAgo, sessionsMode, overallSessionStats, sessionPerformance, overallSignal,
} from "../../lib/sessions/normalize"
import { fmtUsd, fmtDuration } from "./LatestShows"
import { card, HERO_GRADIENT } from "./CommandCenter"
import { PlatformCell } from "./PlatformsIntelligence"
import { Pill, PlatChip } from "./StreamPlanner"
import { PrimaryPlatformControl } from "./PrimaryPlatformPrompt"

const C = {
  cyan: "#22D3EE", green: "#10B981", gold: "#F59E0B", pink: "#EC4899", violet: "#a855f7", indigo: "#7C5CFF",
  white: "#F1F5F9", text: "#94A3B8", muted: "#64748B", line: "rgba(255,255,255,0.08)",
}
const eyebrow = { fontSize: 11, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: C.text }
const inset = { background: "rgba(8,11,22,0.72)", border: `1px solid ${C.line}`, borderRadius: 12 }

const TYPE = {
  live: { label: "LIVE MODE", color: C.green },
  free_chat: { label: "FREE CHAT", color: C.cyan },
  private: { label: "PRIVATE", color: C.violet },
  imported: { label: "IMPORTED", color: C.muted },
}
const FILTERS = [["all", "All"], ["live", "Live"], ["free_chat", "Free Chat"], ["private", "Private"], ["imported", "Imported"]]
const RANGES = [[1, "Today"], [7, "7 Days"], [30, "30 Days"]]
const ROWS = 5

const pName = (p) => platformDisplayName(p) || p
const T = ({ id, children }) => <span data-testid={id}>{children}</span>

function fmtMinutes(mins, estimated) {
  const m = Number(mins) || 0
  if (m > 0 && m < 1) return estimated ? "~<1m" : "<1m"
  const r = Math.round(m)
  const h = Math.floor(r / 60)
  const txt = h ? `${h}h ${r % 60}m` : `${r}m`
  return estimated ? `~${txt}` : txt
}

function useNow(fixed, everyMs) {
  const [t, setT] = useState(() => (fixed ? new Date(fixed) : new Date()))
  useEffect(() => {
    if (fixed) { setT(new Date(fixed)); return undefined }
    const id = setInterval(() => setT(new Date()), everyMs)
    return () => clearInterval(id)
  }, [fixed, everyMs])
  return t
}

// Brief highlight when a value actually changes (real new data only).
function useFlash(value) {
  const prev = useRef(value)
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value
      setOn(true)
      const id = setTimeout(() => setOn(false), 1200)
      return () => clearTimeout(id)
    }
    return undefined
  }, [value])
  return on
}

function sessionTitle(e, tz) {
  if (e.type === "live" && e.isNew) return "Just ended show"
  if (e.type === "live" && e.running) return "Live now"
  if (e.type === "private") { const t = String(e.sessionType || "private"); return `${t.charAt(0).toUpperCase()}${t.slice(1)} session` }
  if (e.type === "imported") return "Imported session"
  const h = Number(new Date(e.startTime).toLocaleString("en-US", { timeZone: tz, hour: "numeric", hour12: false })) % 24
  const part = h < 5 ? "Late-night" : h < 12 ? "Morning" : h < 17 ? "Afternoon" : h < 22 ? "Evening" : "Late-night"
  return `${part} ${e.type === "live" ? "show" : "free chat"}`
}
const whenText = (iso, tz) => new Date(iso).toLocaleString([], { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
const lengthText = (e) => e.type === "live" ? fmtDuration((e.durationMinutes || 0) * 60)
  : e.type === "private" ? (e.chargeSpanMinutes != null ? fmtMinutes(e.chargeSpanMinutes) : "—")
  : e.durationUnknown ? "Single tip" : fmtMinutes(e.durationMinutes, true)

function Badge({ text, color, testId }) {
  return <span data-testid={testId} style={{ border: `1px solid ${color}`, color, background: `${color}1a`, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>{text}</span>
}

function Cell({ icon, value, label, testId, accent, sub, strong }) {
  return (
    <div style={{ ...inset, padding: "12px 14px", display: "flex", gap: 12, alignItems: "center", minWidth: 0, ...(strong ? { border: `1px solid ${C.violet}88`, boxShadow: `0 0 22px ${C.violet}33, inset 0 0 18px ${C.violet}14` } : {}) }}>
      {icon && <span aria-hidden="true" style={{ fontSize: 20, width: 26, textAlign: "center", flexShrink: 0 }}>{icon}</span>}
      <div style={{ minWidth: 0 }}>
        <div data-testid={testId} style={{ fontSize: String(value).length >= 9 ? 15 : String(value).length >= 7 || strong ? 18 : 21, fontWeight: 900, color: accent || C.white, lineHeight: 1.15, ...(/^[$\d.,\s~↑↓%-]+$/.test(String(value)) ? { whiteSpace: "nowrap" } : { overflowWrap: "break-word" }) }}>{value}</div>
        <div style={{ fontSize: 11.5, color: C.text, marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

function TrendLine({ values }) {
  if (!values || values.length < 2 || values[values.length - 1] <= 0) return null
  const max = Math.max(...values)
  const w = 220, h = 90
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 6 - (v / max) * (h - 14)])
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")
  return (
    <svg data-testid="today-trend" viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" role="img" aria-label="Cumulative public tips today" style={{ overflow: "hidden", maxWidth: w, display: "block" }}>
      <defs><linearGradient id="sxTrend" x1="0" x2="1"><stop offset="0" stopColor={C.cyan} /><stop offset=".55" stopColor={C.indigo} /><stop offset="1" stopColor={C.pink} /></linearGradient></defs>
      <path d={d} fill="none" stroke="url(#sxTrend)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 6px ${C.indigo})` }} />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill={C.pink} />
    </svg>
  )
}

// ── Row 2: hero ──────────────────────────────────────────────────────────────
function Hero({ stats, range, comparison, trend, live, now, noData = false }) {
  const flash = useFlash(stats.totalUSD)
  const title = range === 1 ? "Today so far" : `Last ${range} days`
  return (
    <div data-testid="today-stats" className="sx-hero" style={card({
      background: `radial-gradient(120% 140% at 0% 0%, rgba(34,211,238,0.20) 0%, transparent 45%), radial-gradient(120% 140% at 100% 100%, rgba(236,72,153,0.20) 0%, transparent 45%), ${HERO_GRADIENT}, rgba(10,13,26,0.86)`,
      border: "1px solid rgba(124,92,255,0.45)", boxShadow: "0 0 50px rgba(34,211,238,0.14), 0 0 70px rgba(236,72,153,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
      padding: "22px 24px", display: "grid", gridTemplateColumns: "minmax(320px, 0.95fr) 1.6fr", gap: 22, alignItems: "stretch",
    })}>
      <div style={{ position: "relative", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={eyebrow}>{title}</span>
          {noData
            ? <span data-testid="hero-no-data" style={{ fontSize: 10, fontWeight: 800, color: C.text, border: `1px solid ${C.line}`, background: "rgba(255,255,255,0.04)", padding: "3px 10px", borderRadius: 999 }}>NO DATA YET · import your tip history or start a Live Mode show</span>
            : live
            ? <span data-testid="hero-live" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 800, color: C.green, border: `1px solid ${C.green}66`, background: `${C.green}14`, padding: "3px 10px", borderRadius: 999 }}><span className="sx-pulse" />LIVE NOW · {fmtDuration(live.durationSeconds)}</span>
            : <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 800, color: C.green, border: `1px solid ${C.green}55`, background: `${C.green}10`, padding: "3px 10px", borderRadius: 999 }}><span style={{ width: 7, height: 7, borderRadius: 4, background: C.green }} />LIVE DATA</span>}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div data-testid="today-total" className={`hero-revenue-shimmer${flash ? " sx-flash" : ""}`} style={{ fontSize: "clamp(48px, 5.6vw, 72px)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.02, marginTop: 10, filter: "drop-shadow(0 0 18px rgba(124,92,255,0.45))" }}>{fmtUsd(stats.totalUSD)}</div>
            <div style={{ fontSize: 16, color: C.white, opacity: 0.9, marginTop: 4 }}>Total Earned (Public + Private)</div>
            {comparison && range === 1 && (
              <div data-testid="today-comparison" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
                <span style={{ color: comparison.deltaPct >= 0 ? C.green : "#F87171", fontWeight: 800, background: comparison.deltaPct >= 0 ? `${C.green}1f` : "rgba(248,113,113,0.12)", padding: "3px 10px", borderRadius: 999 }}>{comparison.deltaPct >= 0 ? "↑" : "↓"} {Math.abs(comparison.deltaPct)}%</span>
                <span style={{ color: C.text }}>public tips vs. yesterday by now</span>
              </div>
            )}
          </div>
          {range === 1 && <div style={{ flex: "0 1 220px", minWidth: 0, overflow: "hidden", paddingTop: 6 }}><TrendLine values={trend} /></div>}
        </div>
      </div>
      <div className="sx-cells" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <Cell icon="👥" value={fmtUsd(stats.publicUSD)} label="Public Earnings" testId="today-public" />
        <Cell icon="🔒" value={fmtUsd(stats.privateUSD)} label="Private Earnings" testId="today-private" accent="#c4b5fd" />
        <Cell icon="💗" value={stats.tipCount} label="Tips" testId="today-tips" />
        <Cell icon="🧑‍🤝‍🧑" value={stats.uniqueTippers} label="Unique Tippers" testId="today-unique" />
        <Cell icon="⏱" value={fmtMinutes(stats.streamedMinutes)} label="Streamed Time (Live)" testId="today-streamed"
          sub={stats.activitySpanMinutes > 0 ? `+ ${fmtMinutes(stats.activitySpanMinutes, true)} est. tip activity (not stream time)` : null} />
        <Cell icon="🎥" value={fmtMinutes(stats.privateMinutes)} label="Private Time (Live)" testId="today-private-time" />
        <Cell icon="✅" value={stats.completedSessions} label="Completed Sessions" testId="today-completed" />
        <Cell icon="🏆" strong value={stats.bestPlatform ? pName(stats.bestPlatform) : "Not enough data yet"} label="Best Platform" testId="today-best-platform" accent={stats.bestPlatform ? C.pink : C.muted}
          sub={stats.bestPlatform ? `${(stats.platforms.find((p) => p.platform === stats.bestPlatform) || {}).share || 0}% of ${range === 1 ? "today's" : "these"} earnings` : null} />
      </div>
    </div>
  )
}

// ── Row 3: platform cards ────────────────────────────────────────────────────
function PlatformCard({ platform, p, best, range }) {
  const color = platformColor(platform) || C.cyan
  const q = p || { totalUSD: 0, publicUSD: 0, privateUSD: 0, tipCount: 0, uniqueTippers: 0, share: 0 }
  return (
    <div data-testid={`today-platform-${platform}`} style={card({
      padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, minWidth: 0,
      background: `radial-gradient(90% 120% at 0% 0%, ${color}26 0%, transparent 55%), rgba(12,15,28,0.82)`,
      border: `1px solid ${color}${best ? "cc" : "66"}`, boxShadow: best ? `0 0 34px ${color}40` : `0 0 18px ${color}1f`,
    })}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 19, fontWeight: 900, color: C.white }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: color, display: "grid", placeItems: "center", fontSize: 13, color: "#0b0e1a" }}>{pName(platform).slice(0, platform === "myfreecams" ? 3 : 1).toUpperCase()}</span>
          {pName(platform)}
          {best && <span data-testid="best-platform-badge" style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1, color, border: `1px solid ${color}88`, padding: "2px 7px", borderRadius: 999, whiteSpace: "nowrap" }}>BEST {range === 1 ? "TODAY" : "IN RANGE"}</span>}
        </span>
        <span style={{ textAlign: "right" }}>
          <div style={{ fontSize: 15, fontWeight: 900, color }}>{q.share}%</div>
          <div style={{ fontSize: 11, color: C.text }}>of {range === 1 ? "today's" : "range"} earnings</div>
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "end", gap: 14 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.white, lineHeight: 1 }}>{fmtUsd(q.totalUSD)}</div>
          <div style={{ fontSize: 12.5, color: C.text, marginTop: 4 }}>Total Earned</div>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 8 }}>
          <div style={{ width: `${q.share}%`, height: "100%", background: color, boxShadow: `0 0 10px ${color}` }} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
        {[[fmtUsd(q.publicUSD), "Public"], [fmtUsd(q.privateUSD), "Private"], [q.tipCount, q.tipCount === 1 ? "Tip" : "Tips"], [q.uniqueTippers, q.uniqueTippers === 1 ? "Tipper" : "Tippers"]].map(([v, l], i) => (
          <div key={l} style={{ paddingLeft: i ? 12 : 0, borderLeft: i ? `1px solid ${C.line}` : "none" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.white }}>{v}</div>
            <div style={{ fontSize: 11.5, color: C.text }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Row 2 (Overall scope): same hero shell, overall history ──────────────────
const dateText = (iso, tz) => new Date(iso).toLocaleDateString([], { timeZone: tz, month: "short", day: "numeric", year: "numeric" })
function OverallHero({ o, sourceLabel, historyNote, tz }) {
  return (
    <div data-testid="overall-stats" className="sx-hero" style={card({
      background: `radial-gradient(120% 140% at 0% 0%, rgba(34,211,238,0.20) 0%, transparent 45%), radial-gradient(120% 140% at 100% 100%, rgba(236,72,153,0.20) 0%, transparent 45%), ${HERO_GRADIENT}, rgba(10,13,26,0.86)`,
      border: "1px solid rgba(124,92,255,0.45)", boxShadow: "0 0 50px rgba(34,211,238,0.14), 0 0 70px rgba(236,72,153,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
      padding: "22px 24px", display: "grid", gridTemplateColumns: "minmax(320px, 0.95fr) 1.6fr", gap: 22, alignItems: "stretch",
    })}>
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={eyebrow}>Overall Performance</span>
          <span data-testid="overall-source" style={{ fontSize: 10, fontWeight: 800, color: C.text, border: `1px solid ${C.line}`, background: "rgba(255,255,255,0.04)", padding: "3px 10px", borderRadius: 999 }}>{sourceLabel}</span>
        </div>
        <div data-testid="overall-total" className="hero-revenue-shimmer" style={{ fontSize: "clamp(48px, 5.6vw, 72px)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.02, marginTop: 10, filter: "drop-shadow(0 0 18px rgba(124,92,255,0.45))" }}>{fmtUsd(o.totalUSD)}</div>
        <div style={{ fontSize: 16, color: C.white, opacity: 0.9, marginTop: 4 }}>Total Earned (Public + Private)</div>
        {o.firstAt && <div data-testid="overall-range" style={{ fontSize: 12.5, color: C.text, marginTop: 8 }}>{dateText(o.firstAt, tz)} – {dateText(o.lastAt, tz)}</div>}
        {historyNote && <div data-testid="overall-history-note" style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{historyNote}</div>}
      </div>
      <div className="sx-cells" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <Cell icon="👥" value={fmtUsd(o.publicUSD)} label="Public Earnings" testId="overall-public" />
        <Cell icon="🔒" value={fmtUsd(o.privateUSD)} label="Private Earnings" testId="overall-private" accent="#c4b5fd" />
        <Cell icon="💗" value={o.tipCount} label="Tips" testId="overall-tips" />
        <Cell icon="🧑‍🤝‍🧑" value={o.uniqueTippers} label="Unique Tippers" testId="overall-unique" />
        <Cell icon="✅" value={o.meaningfulSessions} label="Meaningful Sessions" sub="30+ min and 2+ tips" testId="overall-meaningful" />
        <Cell icon="📊" value={o.medianSessionUSD == null ? "—" : fmtUsd(o.medianSessionUSD)} label="Median Session" sub={o.avgSessionUSD == null ? null : `avg ${fmtUsd(o.avgSessionUSD)}`} testId="overall-median" />
        <Cell icon="👑" value={o.topTipper ? o.topTipper.username : "—"} label="Top Tipper" sub={o.topTipper ? `${fmtUsd(o.topTipper.usd)} · ${pName(o.topTipper.platform)}` : null} testId="overall-top-tipper" />
        <Cell icon="🏆" strong value={o.largestTip ? fmtUsd(o.largestTip.usd) : "—"} label="Largest Tip" sub={o.largestTip ? `${o.largestTip.username} · ${pName(o.largestTip.platform)}` : null} testId="overall-largest" accent={C.pink} />
      </div>
    </div>
  )
}

// ── Row 3 (one platform / Overall scope): Session Performance cards ─────────
function PerfCard({ title, color, testId, children }) {
  return (
    <div data-testid={testId} style={card({
      padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, minWidth: 0,
      background: `radial-gradient(90% 120% at 0% 0%, ${color}26 0%, transparent 55%), rgba(12,15,28,0.82)`, border: `1px solid ${color}66`, boxShadow: `0 0 18px ${color}1f`,
    })}>
      <span style={{ fontSize: 17, fontWeight: 900, color: C.white }}>{title}</span>
      {children}
    </div>
  )
}
const NotEnough = ({ need }) => <div style={{ color: C.muted, fontSize: 13 }}>Not enough data yet{need ? ` · needs ${need}` : ""}</div>
const Big = ({ v, l, id }) => <div><div data-testid={id} style={{ fontSize: 28, fontWeight: 900, color: C.white, lineHeight: 1 }}>{v}</div><div style={{ fontSize: 12.5, color: C.text, marginTop: 4 }}>{l}</div></div>
function SessionPerformanceCards({ perf }) {
  const { typical, momentum, audience } = perf
  return (
    <div className="sx-plat" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14 }}>
      <PerfCard title="Typical Session" color={C.cyan} testId="perf-typical">
        {typical ? <>
          <Big v={fmtUsd(typical.medianUSD)} l="Median earnings per meaningful session" id="perf-typical-median" />
          <div style={{ fontSize: 12.5, color: C.text }}><T id="perf-typical-tips">{typical.medianTips}</T> tips in a typical session · from <T id="perf-typical-count">{typical.sessions}</T> sessions{typical.early ? " · Early signal" : ""}</div>
        </> : <NotEnough need="3 meaningful sessions" />}
      </PerfCard>
      <PerfCard title="Recent Momentum" color={C.indigo} testId="perf-momentum">
        {momentum ? <>
          <Big v={momentum.deltaPct == null ? "—" : `${momentum.deltaPct >= 0 ? "↑" : "↓"} ${Math.abs(momentum.deltaPct)}%`} l={`Last ${momentum.window} sessions vs the ${momentum.window} before`} id="perf-momentum-delta" />
          <div style={{ fontSize: 12.5, color: C.text }}>avg <T id="perf-momentum-recent">{fmtUsd(momentum.recentAvgUSD)}</T> vs <T id="perf-momentum-prior">{fmtUsd(momentum.priorAvgUSD)}</T> per session</div>
        </> : <NotEnough need="6 meaningful sessions" />}
      </PerfCard>
      <PerfCard title="Audience Strength" color={C.pink} testId="perf-audience">
        {audience ? <>
          <Big v={audience.uniqueTippers} l={`Unique tippers · ${audience.repeatFans} repeat fan${audience.repeatFans === 1 ? "" : "s"}`} id="perf-audience-unique" />
          <div style={{ fontSize: 12.5, color: C.text }}>
            Top 3 fans: <T id="perf-audience-top">{audience.topFans.map((f) => `${f.username} (${fmtUsd(f.usd)})`).join(", ")}</T>
            {audience.topFansSharePct != null && <> · <T id="perf-audience-share">{audience.topFansSharePct}%</T> of public tips</>}
          </div>
        </> : <NotEnough />}
      </PerfCard>
    </div>
  )
}

// ── Row 4 left: sessions list ────────────────────────────────────────────────
function SessionRow({ e, tz, selected, onSelect }) {
  const t = TYPE[e.type]
  const status = e.running ? { label: "LIVE NOW", color: C.green } : e.isNew ? { label: "JUST ENDED", color: C.pink } : t
  return (
    <button data-testid={`history-${e.id}`} onClick={onSelect} aria-pressed={selected} className="sx-row" style={{
      ...inset, width: "100%", textAlign: "left", cursor: "pointer", padding: "10px 14px", display: "grid",
      gridTemplateColumns: "32px minmax(0,1fr) 70px 50px 44px 10px", gap: 8, alignItems: "center", color: C.white,
      ...(selected ? { border: `1px solid ${C.pink}`, boxShadow: `0 0 0 1px ${C.indigo}55, 0 0 22px ${C.pink}40`, background: "rgba(30,18,52,0.75)" } : {}),
    }}>
      <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 9, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.05)", color: e.type === "imported" ? C.text : C.cyan, fontSize: 14 }}>{e.type === "imported" ? "▤" : e.type === "private" ? "🔒" : "▶"}</span>
      <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", overflow: "hidden" }}>
          <span style={{ fontWeight: 800, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis" }}>{sessionTitle(e, tz)}</span>
          {e.isNew && <span data-testid="row-new-badge" style={{ display: "none" }}>NEW</span>}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: C.text, whiteSpace: "nowrap", overflow: "hidden" }}>
          <Badge text={status.label} color={status.color} testId={`type-badge-${e.type}`} />
          {e.platforms.slice(0, 1).map((p, i) => <span key={p} data-testid={`platform-badge-${p}`}><PlatChip name={pName(p)} i={i} /></span>)}
          {e.platforms.length > 1 && <span title={e.platforms.slice(1).map(pName).join(", ")} style={{ color: C.text }}>+{e.platforms.length - 1}</span>}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>· {whenText(e.startTime, tz)}</span>
        </span>
      </span>
      <span><div style={{ fontWeight: 900, fontSize: 14 }}>{fmtUsd(e.totalUSD)}</div><div style={{ fontSize: 11, color: C.text }}>Total Earned</div></span>
      <span><div style={{ fontWeight: 800, fontSize: 13 }}>{lengthText(e)}</div><div style={{ fontSize: 11, color: C.text }}>{e.type === "live" ? "Duration" : e.type === "private" ? "Charge span" : "Est. span"}</div></span>
      <span><div style={{ fontWeight: 800, fontSize: 13 }}>{e.type === "private" ? e.chargeCount : e.tipCount}</div><div style={{ fontSize: 11, color: C.text }}>{e.type === "private" ? (e.chargeCount === 1 ? "Charge" : "Charges") : (e.tipCount === 1 ? "Tip" : "Tips")}</div></span>
      <span aria-hidden="true" style={{ color: C.text, fontSize: 16 }}>›</span>
    </button>
  )
}

// ── Row 4 right: details ─────────────────────────────────────────────────────
function Timeline({ data }) {
  if (!data) return <div data-testid="details-timeline-empty" style={{ fontSize: 12.5, color: C.muted, padding: "18px 0" }}>Not enough time-stamped activity in this session to chart.</div>
  const max = Math.max(...data.buckets.map((b) => Math.max(b.public, b.private)), 0.01)
  const H = 70
  const fmtT = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  return (
    <div data-testid="details-timeline">
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: H + 14, paddingTop: 10 }}>
        {data.buckets.map((b, i) => (
          <div key={i} style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 1, height: H, position: "relative" }}>
            {b.tips > 0 && <span style={{ position: "absolute", top: -10, left: "50%", width: 6, height: 6, marginLeft: -3, borderRadius: 3, background: C.pink, boxShadow: `0 0 6px ${C.pink}` }} />}
            <div title={`Public ${fmtUsd(b.public)}`} style={{ flex: 1, height: `${(b.public / max) * 100}%`, minHeight: b.public > 0 ? 3 : 0, borderRadius: 3, background: `linear-gradient(180deg, ${C.cyan}, ${C.indigo})` }} />
            <div title={`Private ${fmtUsd(b.private)}`} style={{ flex: 1, height: `${(b.private / max) * 100}%`, minHeight: b.private > 0 ? 3 : 0, borderRadius: 3, background: `linear-gradient(180deg, ${C.pink}, ${C.violet})` }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: C.muted, marginTop: 4 }}>
        <span>{fmtT(data.start)}</span><span>{fmtT(data.end)}</span>
      </div>
    </div>
  )
}

function Details({ e, tips, tz, today, signal }) {
  if (!e) return <div style={{ color: C.text, fontSize: 13 }}>Select a session to see its details.</div>
  const t = TYPE[e.type]
  const status = e.running ? { label: "LIVE NOW", color: C.green } : e.isNew ? { label: "JUST ENDED", color: C.pink } : t
  const leader = today.platforms.find((p) => p.platform === today.bestPlatform)
  return (
    <div data-testid="session-details-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...inset, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
          <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 20, display: "grid", placeItems: "center", border: `2px solid ${C.cyan}`, color: C.cyan, fontWeight: 900 }}>{(pName(e.platforms[0] || "") || "?").slice(0, 1)}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 900, fontSize: 16, color: C.white }}>{sessionTitle(e, tz)}</span>
              <Badge text={status.label} color={status.color} />
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11.5, color: C.text, marginTop: 4, flexWrap: "wrap" }}>
              {e.platforms.map((p) => <PlatformCell key={p} platform={pName(p)} />)}
              <span>· {whenText(e.startTime, tz)}</span>
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div data-testid="details-total" style={{ fontSize: 26, fontWeight: 900, color: C.green }}>{fmtUsd(e.totalUSD)}</div>
          <div style={{ fontSize: 11.5, color: C.text }}>Total Earned</div>
        </div>
      </div>
      <div className="sx-dgrid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8 }}>
        <Cell value={fmtUsd(e.publicUSD)} label="Public" testId="details-public" />
        <Cell value={fmtUsd(e.privateUSD)} label="Private" testId="details-private" accent={C.pink} />
        <Cell value={e.type === "private" ? `${e.chargeCount} ${e.chargeCount === 1 ? "charge" : "charges"}` : e.tipCount} label={e.type === "private" ? "Billing" : "Tips"} testId="details-tips" />
        <Cell value={e.uniqueTippers} label="Unique Tippers" testId="details-unique" />
        <Cell value={e.type === "live" ? fmtUsd(e.show?.largestTipUsd) : e.type === "private" ? "—" : fmtUsd(Math.max(0, ...(e.session?.tips || []).map((x) => Number(x.usd) || 0)))} label="Largest Tip" testId="details-largest" />
        <Cell value={e.topTipper ? e.topTipper.username : e.fan || "—"} label={e.type === "private" ? "Fan" : "Top Tipper"} testId="details-top" />
        <Cell value={lengthText(e)} label={e.type === "private" ? "Charge span" : e.type === "live" ? "Duration" : "Est. span (first→last tip)"} testId="details-duration" />
        <Cell value={e.type === "live" ? fmtDuration(e.show?.privateSeconds || 0) : "—"} label="Private Time" testId="details-private-time" />
      </div>
      <div style={{ ...inset, padding: "12px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 800, fontSize: 13.5, color: C.white }}>Earnings Timeline</span>
          <span style={{ display: "flex", gap: 12, fontSize: 11, color: C.text }}>
            <span>● <span style={{ color: C.cyan }}>Public</span></span><span>● <span style={{ color: C.violet }}>Private</span></span><span>● <span style={{ color: C.pink }}>Tips</span></span>
          </span>
        </div>
        <Timeline data={sessionTimeline(e, { tips })} />
      </div>
      {signal && (
        <div data-testid="today-signal" style={{ ...inset, border: `1px solid ${C.cyan}55`, padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span aria-hidden="true">💡</span>
          <div>
            <div style={{ color: C.cyan, fontWeight: 800, fontSize: 13 }}>Strongest signal: {signal}</div>
            {leader && <div style={{ color: C.text, fontSize: 12, marginTop: 2 }}>{fmtUsd(leader.totalUSD)} of {today.days === 1 ? "today's" : "this range's"} {fmtUsd(today.totalUSD)} came from {pName(leader.platform)}.</div>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SessionsOverview({ tips, shows, paidSessions, tz, showsLoading, showsError, now: fixedNow, live, isPro = true, primaryPlatform = null, onPrimarySaved = () => {} }) {
  const historyNote = isPro ? "Full history on every platform" : primaryPlatform
    ? `Free: full history on ${pName(primaryPlatform)}, last 31 days on other platforms`
    : "Free: last 31 days on every platform until you choose a primary platform"
  const now = useNow(fixedNow, live?.session ? 5000 : 15000)
  const [range, setRange] = useState(1)
  const [scopePick, setScopePick] = useState(null)
  const [filter, setFilter] = useState("all")
  const [selectedId, setSelectedId] = useState(null)
  const [loadedAt, setLoadedAt] = useState(() => new Date())
  useEffect(() => { setLoadedAt(new Date()) }, [tips, shows, paidSessions])

  const T0 = tips || [], S0 = shows || [], P0 = paidSessions || []
  const minuteKey = Math.floor(now.getTime() / 60000)
  const history = useMemo(() => buildSessionHistory({ tips: T0, shows: S0, paidSessions: P0 }), [tips, shows, paidSessions]) // eslint-disable-line react-hooks/exhaustive-deps
  const stats = useMemo(() => withTodayDerived(dailySessionStats({ tips: T0, history, paidSessions: P0, tz, now, days: range })), [history, tz, minuteKey, range]) // eslint-disable-line react-hooks/exhaustive-deps
  const comparison = useMemo(() => vsYesterdayByNow({ tips: T0, tz, now }), [tips, tz, minuteKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const trend = useMemo(() => todayCumulative({ tips: T0, tz, now }), [tips, tz, minuteKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const snap = live?.session ? liveSessionSnapshot({ session: live.session, tips: T0, privateInterval: live.privateInterval, now }) : null

  // A running show leads the list as its own entry (canonical tips linked to it).
  const runningEntry = snap ? {
    id: `running:${snap.id}`, sourceId: snap.id, type: "live", running: true, platforms: snap.platformSplit.map((p) => p.platform),
    startTime: snap.startedAt, endTime: now.toISOString(), durationMinutes: snap.durationSeconds / 60, publicUSD: snap.publicUSD,
    privateUSD: 0, totalUSD: snap.publicUSD, tipCount: snap.tipCount, uniqueTippers: snap.uniqueTippers,
    topTipper: snap.topTipper, show: { largestTipUsd: snap.largestTipUSD, privateSeconds: 0 }, privateIntervals: [],
  } : null
  const listed = useMemo(() => filterSessionHistory(history, { type: filter }), [history, filter])
  const rows = [...(runningEntry && (filter === "all" || filter === "live") ? [runningEntry] : []), ...listed].slice(0, ROWS)
  const selected = rows.find((r) => r.id === selectedId) || rows[0] || null
  const mode = useMemo(() => sessionsMode({ tips: T0, shows: S0, paidSessions: P0, live: !!live?.session }), [tips, shows, paidSessions, live?.session]) // eslint-disable-line react-hooks/exhaustive-deps
  const scope = mode.kind === "csv" ? "overall" : mode.kind === "mixed" ? (scopePick || "today") : "today"
  const overall = useMemo(() => overallSessionStats({ tips: T0, history, paidSessions: P0 }), [history]) // eslint-disable-line react-hooks/exhaustive-deps
  const perf = useMemo(() => sessionPerformance({ history, tips: T0, overall }), [history, overall]) // eslint-disable-line react-hooks/exhaustive-deps
  const showPerf = scope === "overall" || (mode.kind !== "none" && mode.singlePlatform)
  const sourceLabel = mode.kind === "mixed" ? "LIVE + IMPORTED HISTORY" : "IMPORTED HISTORY"
  const signal = scope === "overall" ? overallSignal(overall, perf) : todaySignal(stats, pName)
  const byPlatform = Object.fromEntries(stats.platforms.map((p) => [p.platform, p]))

  return (
    <div data-testid="sessions-overview" className="sx-root" style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 24 }}>
      <style>{`
        .sx-root .sx-pulse { width: 8px; height: 8px; border-radius: 50%; background: ${C.green}; animation: sxPulse 1.6s infinite; }
        @keyframes sxPulse { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,.6); } 70% { box-shadow: 0 0 0 8px rgba(16,185,129,0); } 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }
        .sx-root .sx-flash { animation: sxFlash 1.2s ease-out; }
        @keyframes sxFlash { 0% { filter: drop-shadow(0 0 26px rgba(34,211,238,.9)); } 100% { filter: drop-shadow(0 0 18px rgba(124,92,255,.45)); } }
        .sx-root .sx-row { transition: transform .15s ease, box-shadow .2s ease, border-color .2s ease, background .2s ease; }
        .sx-root .sx-row:hover { transform: translateY(-1px); border-color: rgba(34,211,238,0.35); }
        @media (prefers-reduced-motion: reduce) { .sx-root .sx-pulse, .sx-root .sx-flash { animation: none; } .sx-root .sx-row { transition: none; } .sx-root .sx-row:hover { transform: none; } }
        @media (max-width: 1150px) { .sx-root .sx-hero { grid-template-columns: 1fr !important; } }
        @media (max-width: 1000px) { .sx-root .sx-plat, .sx-root .sx-md { grid-template-columns: 1fr !important; } }
        @media (max-width: 640px) { .sx-root .sx-cells, .sx-root .sx-dgrid { grid-template-columns: repeat(2, minmax(0,1fr)) !important; } .sx-root .sx-row { grid-template-columns: 36px 1fr auto !important; } .sx-root .sx-row > span:nth-child(n+4) { display: none; } }
      `}</style>

      {/* Row 1 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 900, color: C.white, margin: 0, letterSpacing: "-0.01em" }}>📊 Sessions</h1>
          <div style={{ fontSize: 14, color: C.text, marginTop: 2 }}>Track your shows, earnings and audience across all platforms</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          {mode.kind === "mixed" && (
            <div data-testid="scope-switch" style={{ display: "flex", gap: 4, padding: 4, borderRadius: 10, border: `1px solid ${C.line}`, background: "rgba(8,11,22,0.6)" }}>
              {[["today", "Today"], ["overall", "Overall"]].map(([k, l]) => <span key={k} data-testid={`scope-${k}`}><Pill active={scope === k} onClick={() => setScopePick(k)}>{l}</Pill></span>)}
            </div>
          )}
          {scope === "today" && <div data-testid="range-group" style={{ display: "flex", gap: 4, padding: 4, borderRadius: 10, border: `1px solid ${C.line}`, background: "rgba(8,11,22,0.6)", alignItems: "center" }}>
            {mode.kind === "mixed" && <span style={{ fontSize: 11, color: C.muted, padding: "0 6px" }}>Range</span>}
            {RANGES.map(([d, l]) => <span key={d} data-testid={`range-${d}`}><Pill active={range === d} onClick={() => setRange(d)}>{mode.kind === "mixed" && d === 1 ? "1 Day" : l}</Pill></span>)}
          </div>}
 <PrimaryPlatformControl isPro={isPro} primary={primaryPlatform} onSaved={onPrimarySaved} />
          <span data-testid="updated" style={{ fontSize: 12, color: C.text, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: 4, background: C.green }} />Updated {timeAgo(loadedAt.toISOString(), now)}
          </span>
        </div>
      </div>

      {/* Row 2 */}
      {scope === "overall"
        ? <OverallHero o={overall} sourceLabel={sourceLabel} historyNote={historyNote} tz={tz} />
        : <Hero stats={stats} range={range} comparison={comparison} trend={trend} live={snap} now={now} noData={mode.kind === "none"} />}

      {/* Row 3 */}
      {showPerf ? (
        <div data-testid="session-performance">
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: C.white }}>Session Performance</span>
            <span style={{ fontSize: 12.5, color: C.text }}>{scope === "overall" ? "Across your available history" : "Your meaningful sessions"} · platform comparison lives in the Platforms tab</span>
          </div>
          <SessionPerformanceCards perf={perf} />
        </div>
      ) : (
      <div data-testid="today-by-platform">
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: C.white }}>{range === 1 ? "Today by Platform" : `Last ${range} days by Platform`}</span>
          <span style={{ fontSize: 12.5, color: C.text }}>Compare your earnings across platforms</span>
        </div>
        <div className="sx-plat" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14 }}>
          {["bongacams", "chaturbate", "myfreecams"].filter((p) => SUPPORTED_PLATFORMS.includes(p)).map((p) => (
            <PlatformCard key={p} platform={p} p={byPlatform[p]} best={stats.bestPlatform === p} range={range} />
          ))}
        </div>
      </div>
      )}

      {/* Row 4 */}
      <div className="sx-md" style={{ display: "grid", gridTemplateColumns: "45fr 55fr", gap: 16, alignItems: "stretch" }}>
        <div data-testid="session-history" style={card({ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, background: "rgba(12,15,28,0.78)", boxShadow: "none" })}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 19, fontWeight: 900, color: C.white }}>Recent Sessions</div>
              <div style={{ fontSize: 12.5, color: C.text }}>{mode.kind === "csv" ? "Grouped from your imported tip history (60-min gap) · spans are estimated" : "Your latest shows across all platforms"}</div>
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {FILTERS.map(([k, l]) => <span key={k} data-testid={`filter-type-${k}`}><Pill active={filter === k} onClick={() => setFilter(k)}>{l}</Pill></span>)}
            </div>
          </div>
          {showsError && <div style={{ color: C.text, fontSize: 12 }}>Couldn&apos;t load your Live Mode shows. They&apos;ll appear on the next refresh.</div>}
          {showsLoading && !history.length && <div style={{ color: C.text, fontSize: 12 }}>Loading…</div>}
          {!showsLoading && !history.length && !runningEntry && <div data-testid="history-empty" style={{ color: C.text, fontSize: 13 }}>No sessions yet. Start a Live Mode show or import your tip history.</div>}
          {(history.length > 0 || runningEntry) && !rows.length && <div data-testid="history-filter-empty" style={{ color: C.text, fontSize: 13 }}>No sessions of this type yet. Short tip groups (under 30 min or a single tip) are not listed.</div>}
          {rows.map((e) => <SessionRow key={e.id} e={e} tz={tz} selected={selected?.id === e.id} onSelect={() => setSelectedId(e.id)} />)}
        </div>
        <div data-testid="session-details" style={card({ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12, background: "rgba(12,15,28,0.78)", boxShadow: "none" })}>
          <div style={{ fontSize: 19, fontWeight: 900, color: C.white }}>Session Details</div>
          <Details e={selected} tips={T0} tz={tz} today={scope === "today" ? stats : { platforms: [], bestPlatform: null }} signal={signal} />
        </div>
      </div>
    </div>
  )
}
