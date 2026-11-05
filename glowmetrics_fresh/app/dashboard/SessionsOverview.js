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
  timeAgo, sessionBuckets, sessionFanDrivers, sessionVsTypical, sessionCompletenessMap, matchPlannedStream, sessionsMode, overallSessionStats, sessionPerformance, overallSignal, fanKey,
} from "../../lib/sessions/normalize"
import { fmtUsd, fmtDuration } from "./LatestShows"
import { card, HERO_GRADIENT } from "./CommandCenter"
import { PlatformCell } from "./PlatformsIntelligence"
import { Pill, PlatChip } from "./StreamPlanner"
import { PrimaryPlatformControl } from "./PrimaryPlatformPrompt"
import { BucketChart, BucketPanel, PlatformTile } from "./SessionsBuckets"

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
const SR_ONLY = { position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }
const typeWord = (e) => e.type === "live" ? "Live" : e.type === "free_chat" ? "Free Chat" : e.type === "private" ? (() => { const t = String(e.sessionType || "Private"); return t.charAt(0).toUpperCase() + t.slice(1) })() : "Imported"
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
  return <span data-testid={testId} style={{ border: `1px solid ${color}`, color, background: `${color}1a`, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>{text}</span>
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

// Shown in place of an empty metric while the creator has little data:
// guidance, never a fake number.
function HintCell({ icon, text, testId, action }) {
  return (
    <div data-testid={testId} data-hint="1" style={{ ...inset, padding: "12px 14px", display: "flex", gap: 12, alignItems: "center", minWidth: 0, borderStyle: "dashed" }}>
      {icon && <span aria-hidden="true" style={{ fontSize: 18, width: 26, textAlign: "center", flexShrink: 0, opacity: 0.6 }}>{icon}</span>}
      <div style={{ minWidth: 0, fontSize: 12.5, color: C.text, lineHeight: 1.35 }}>
        {text}
        {action && <div style={{ marginTop: 4 }}><button onClick={action.onClick} style={{ background: "transparent", border: "none", padding: 0, color: C.cyan, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>{action.label} →</button></div>}
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
function Hero({ stats, range, comparison, trend, live, now, noData = false, light = false, onStartLive }) {
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
        {light && stats.privateUSD === 0 ? <HintCell icon="🔒" text="No private earnings yet" testId="today-private" />
          : <Cell icon="🔒" value={fmtUsd(stats.privateUSD)} label="Private Earnings" testId="today-private" accent="#c4b5fd" />}
        <Cell icon="💗" value={stats.tipCount} label="Tips" testId="today-tips" />
        <Cell icon="🧑‍🤝‍🧑" value={stats.uniqueTippers} label="Unique Tippers" testId="today-unique" />
        {light && stats.streamedMinutes === 0 && !(stats.activitySpanMinutes > 0) ? <HintCell icon="⏱" text="Stream time is tracked in Live Mode" testId="today-streamed" action={onStartLive ? { label: "Start Live Mode", onClick: onStartLive } : null} />
          : <Cell icon="⏱" value={fmtMinutes(stats.streamedMinutes)} label="Streamed Time (Live)" testId="today-streamed"
            sub={stats.activitySpanMinutes > 0 ? `+ ${fmtMinutes(stats.activitySpanMinutes, true)} est. tip activity (not stream time)` : null} />}
        {light && !(stats.privateMinutes > 0) ? <HintCell icon="🎥" text="Private time is tracked in Live Mode" testId="today-private-time" />
          : <Cell icon="🎥" value={fmtMinutes(stats.privateMinutes)} label="Private Time (Live)" testId="today-private-time" />}
        {light && stats.completedSessions === 0 ? <HintCell icon="✅" text="A session counts once it lasts 30+ min with 2+ tips" testId="today-completed" />
          : <Cell icon="✅" value={stats.completedSessions} label="Completed Sessions" testId="today-completed" />}
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
function OverallHero({ o, sourceLabel, historyNote, tz, light = false }) {
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
        {light && o.privateUSD === 0 ? <HintCell icon="🔒" text="No private earnings yet" testId="overall-private" />
          : <Cell icon="🔒" value={fmtUsd(o.privateUSD)} label="Private Earnings" testId="overall-private" accent="#c4b5fd" />}
        <Cell icon="💗" value={o.tipCount} label="Tips" testId="overall-tips" />
        <Cell icon="🧑‍🤝‍🧑" value={o.uniqueTippers} label="Unique Tippers" testId="overall-unique" />
        <Cell icon="✅" value={o.meaningfulSessions} label="Meaningful Sessions" sub="30+ min and 2+ tips" testId="overall-meaningful" />
        {o.medianSessionUSD == null ? <HintCell icon="📊" text="Median Session appears after your first meaningful session" testId="overall-median" />
          : <Cell icon="📊" value={fmtUsd(o.medianSessionUSD)} label="Median Session" sub={o.avgSessionUSD == null ? null : `avg ${fmtUsd(o.avgSessionUSD)}`} testId="overall-median" />}
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
function NotEnough({ need, have, onImport, insight }) {
  const left = need ? Math.max(0, need - have) : 0
  return (
    <div style={{ color: C.muted, fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
      <span data-testid="progress-text">{need ? `${left} more session${left === 1 ? "" : "s"} needed for ${insight}` : "Not enough data yet"}</span>
      {need ? <>
        <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}><div style={{ width: `${Math.min(100, Math.round((have / need) * 100))}%`, height: "100%", background: C.cyan }} /></div>
        <span style={{ fontSize: 12 }}>{have} of {need} meaningful sessions so far</span>
      </> : null}
      {onImport && <button onClick={onImport} style={{ alignSelf: "flex-start", background: "transparent", border: "none", padding: 0, color: C.cyan, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Import more history →</button>}
    </div>
  )
}
const Big = ({ v, l, id }) => <div><div data-testid={id} style={{ fontSize: 28, fontWeight: 900, color: C.white, lineHeight: 1 }}>{v}</div><div style={{ fontSize: 12.5, color: C.text, marginTop: 4 }}>{l}</div></div>
function SessionPerformanceCards({ perf, onImport }) {
  const { typical, momentum, audience } = perf
  const have = perf.meaningfulSessions
  return (
    <div className="sx-plat" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14 }}>
      <PerfCard title="Typical Session" color={C.cyan} testId="perf-typical">
        {typical ? <>
          <Big v={fmtUsd(typical.medianUSD)} l="Median earnings per meaningful session" id="perf-typical-median" />
          <div style={{ fontSize: 12.5, color: C.text }}><T id="perf-typical-tips">{typical.medianTips}</T> tips in a typical session · from <T id="perf-typical-count">{typical.sessions}</T> sessions{typical.early ? " · Early signal" : ""}</div>
        </> : <NotEnough need={3} have={have} onImport={onImport} insight="Typical Session" />}
      </PerfCard>
      <PerfCard title="Recent Momentum" color={C.indigo} testId="perf-momentum">
        {momentum ? <>
          <Big v={momentum.deltaPct == null ? "—" : `${momentum.deltaPct >= 0 ? "↑" : "↓"} ${Math.abs(momentum.deltaPct)}%`} l={`Last ${momentum.window} sessions vs the ${momentum.window} before`} id="perf-momentum-delta" />
          <div style={{ fontSize: 12.5, color: C.text }}>avg <T id="perf-momentum-recent">{fmtUsd(momentum.recentAvgUSD)}</T> vs <T id="perf-momentum-prior">{fmtUsd(momentum.priorAvgUSD)}</T> per session</div>
        </> : <NotEnough need={6} have={have} onImport={onImport} insight="Recent Momentum" />}
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

// ── No data yet: activation instead of a grid of zeros ───────────────────────
const PREVIEW = [
  ["💰", "Session earnings", "Every session's public and private earnings, compared with your typical session."],
  ["🧑‍🤝‍🧑", "Fan behavior", "Who tips, how often they come back, and which fans drive each session."],
  ["🔒", "Private earnings", "Private, group and spy revenue kept separate from tips."],
  ["🗂", "Recent sessions", "A timeline of each session with its peak period and top contributors."],
]
function Activation({ onImport, onStartLive }) {
  const btn = (primary) => ({ border: primary ? "none" : `1px solid ${C.line}`, background: primary ? `linear-gradient(135deg, ${C.cyan}, #38D5E8)` : "rgba(255,255,255,0.04)", color: primary ? "#0b0e1a" : C.white, boxShadow: primary ? `0 0 18px ${C.cyan}55` : "none", fontWeight: 800, fontSize: 14, padding: "10px 18px", borderRadius: 10, cursor: "pointer" })
  return (
    <div data-testid="sessions-activation" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={card({ padding: "22px 24px", border: "1px solid rgba(124,92,255,0.45)", background: `radial-gradient(120% 140% at 0% 0%, rgba(34,211,238,0.16) 0%, transparent 45%), rgba(10,13,26,0.86)` })}>
        <div style={{ fontSize: 24, fontWeight: 900, color: C.white }}>No performance data yet</div>
        <div style={{ fontSize: 14, color: C.text, marginTop: 4 }}>Import your tip history or start a Live Mode show and your sessions will appear here.</div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button data-testid="activation-import" onClick={onImport} style={btn(true)}>Import CSV history</button>
          <button data-testid="activation-live" onClick={onStartLive} style={btn(false)}>Start Live Mode</button>
        </div>
      </div>
      <div className="sx-plat" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14 }}>
        {PREVIEW.map(([icon, title, text]) => (
          <div key={title} data-testid="activation-preview" style={{ ...inset, padding: "16px 18px", borderStyle: "dashed" }}>
            <div style={{ fontSize: 20 }} aria-hidden="true">{icon}</div>
            <div style={{ fontWeight: 900, color: C.white, fontSize: 15, marginTop: 6 }}>{title}</div>
            <div style={{ color: C.text, fontSize: 12.5, marginTop: 4, lineHeight: 1.4 }}>{text}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// "vs typical" marker: this session vs the creator's own comparable sessions.
function VsTypical({ vs, testId, long = false, e }) {
  if (!vs) return null
  const color = vs.outcome === "above" ? C.green : vs.outcome === "below" ? "#F87171" : C.text
  const arrow = vs.outcome === "above" ? "▲" : vs.outcome === "below" ? "▼" : "="
  const pct = vs.outcome === "par" ? "On par" : `${vs.deltaPct > 0 ? "+" : ""}${vs.deltaPct}%`
  const scope = e ? `your ${pName(e.platforms[0])} ${e.type === "live" ? "Live" : e.type === "free_chat" ? "free-chat" : "imported"} sessions` : "your comparable sessions"
  if (!long) {
    return (
      <span data-testid={testId} data-outcome={vs.outcome} title={`vs typical: median ${fmtUsd(vs.medianUSD)} of ${vs.sessions} of ${scope}`} style={{ display: "inline-block", color, fontWeight: 800, fontSize: 11, whiteSpace: "nowrap", lineHeight: 1.2, padding: "2px 8px", borderRadius: 8, border: `1px solid ${color}88`, background: `${color}14`, fontVariantNumeric: "tabular-nums" }}>
        {arrow} {pct}<span style={SR_ONLY}>vs typical</span>
      </span>
    )
  }
  return (
    <span data-testid={testId} data-outcome={vs.outcome} title={`Median of ${vs.sessions} of ${scope}: ${fmtUsd(vs.medianUSD)}`} style={{ display: "inline", color, fontWeight: 800, fontSize: 12.5, lineHeight: 1.35 }}>
      {arrow} {pct} vs typical (median {fmtUsd(vs.medianUSD)} of {vs.sessions} of {scope})
    </span>
  )
}

// ── Row 4 left: sessions list ────────────────────────────────────────────────
// Compact, platform-first row: platform tile + name, local date/time · type,
// earnings + comparison chip. Count column hidden on phones.
function SessionRow({ e, tz, selected, onSelect, vs }) {
  const t = TYPE[e.type]
  const status = e.running ? { label: "LIVE NOW", color: C.green } : e.isNew ? { label: "JUST ENDED", color: C.pink } : null
  const p0 = e.platforms[0]
  return (
    <button data-testid={`history-${e.id}`} onClick={onSelect} aria-pressed={selected} className="sx-row" style={{
      width: "100%", textAlign: "left", cursor: "pointer", padding: "10px 12px", display: "grid",
      gridTemplateColumns: "40px minmax(0,1fr) 44px auto", gap: 10, alignItems: "center", color: C.white,
      borderRadius: 14, background: "rgba(13,17,38,0.72)", border: `1px solid ${C.line}`, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
      ...(selected ? { border: `1px solid ${C.pink}`, boxShadow: `0 0 0 1px ${C.indigo}44, 0 0 22px ${C.pink}40, inset 0 0 18px ${C.pink}14`, background: "rgba(30,18,52,0.78)" } : {}),
    }}>
      <PlatformTile platform={p0} size={38} />
      <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", overflow: "hidden" }}>
          <span data-testid={`platform-badge-${p0}`} style={{ fontWeight: 800, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis" }}>{pName(p0)}</span>
          {e.platforms.length > 1 && <span title={e.platforms.slice(1).map(pName).join(", ")} style={{ color: C.text, fontSize: 11.5 }}>+{e.platforms.length - 1}</span>}
          {status && <Badge text={status.label} color={status.color} />}
          {e.isNew && <span data-testid="row-new-badge" style={{ display: "none" }}>NEW</span>}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: C.text, whiteSpace: "nowrap", overflow: "hidden" }}>
          <span className="sx-when-long" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{whenText(e.startTime, tz)}</span>
          <span className="sx-when-short" style={{ display: "none" }}>{new Date(e.startTime).toLocaleString([], { timeZone: tz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
          <span aria-hidden="true">·</span>
          <span data-testid={`type-badge-${e.type}`} data-label={t.label} style={{ color: e.type === "imported" ? C.muted : C.text, ...(e.type === "imported" ? { border: `1px solid ${C.line}`, borderRadius: 6, padding: "0 6px", fontSize: 10.5 } : {}) }}>{typeWord(e)}</span>
        </span>
      </span>
      <span className="sx-row-count" style={{ textAlign: "right" }}><div style={{ fontWeight: 800, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{e.type === "private" ? e.chargeCount : e.tipCount}</div><div style={{ fontSize: 10.5, color: C.text }}>{e.type === "private" ? (e.chargeCount === 1 ? "Charge" : "Charges") : (e.tipCount === 1 ? "Tip" : "Tips")}</div></span>
      <span style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        <span style={{ fontWeight: 900, fontSize: 15, fontVariantNumeric: "tabular-nums" }}>{fmtUsd(e.totalUSD)}</span>
        {vs ? <VsTypical vs={vs} testId={`row-vs-${e.id}`} /> : lengthText(e) !== "—" ? <span style={{ fontSize: 10.5, color: C.muted }}>{lengthText(e)}</span> : null}
      </span>
    </button>
  )
}

// ── Row 4 right: details ─────────────────────────────────────────────────────
const clock = (iso, tz) => new Date(iso).toLocaleTimeString([], { timeZone: tz, hour: "numeric", minute: "2-digit" })

// Interactive chart + selected-bucket contributors (shared by Overview and the
// Timeline tab). Selection / mode / highlight state lives in Details so both
// views and the Fans tab stay in sync for the selected session.
function BucketExplorer({ e, d, tz, ui, testId }) {
  const sel = Math.min(ui.bucket ?? defaultBucket(d), d.buckets.length - 1)
  return (
    <div className="sx-bx" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 250px", gap: 12, alignItems: "start" }}>
      <div style={{ background: "rgba(13,17,38,0.72)", border: `1px solid ${C.line}`, borderRadius: 16, padding: "12px 14px", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)", minWidth: 0 }}>
        <BucketChart d={d} tz={tz} type={e.type} selected={sel} onSelect={ui.setBucket} mode={ui.mode} onMode={ui.setMode} highlightKey={ui.highlight} testId={testId} />
      </div>
      <BucketPanel d={d} index={sel} onIndex={(i) => ui.setBucket(Math.max(0, Math.min(d.buckets.length - 1, i)))} tz={tz} type={e.type} highlightKey={ui.highlight} onHighlight={ui.setHighlight} />
    </div>
  )
}
// Default selection: the highest-earning bucket (the engine's own peak when it
// has one), else the first bucket.
function defaultBucket(d) {
  if (d.peak) { const i = d.buckets.findIndex((b) => b.start === d.peak.start); if (i >= 0) return i }
  return 0
}

// Timeline tab: span details, peak callout, the explorer and the full table.
function BucketsView({ e, tips, tz, ui }) {
  const d = sessionBuckets(e, { tips })
  if (!d) return <div data-testid="buckets-empty" style={{ color: C.muted, fontSize: 13 }}>No time-stamped activity in this session.</div>
  const spanText = d.exact ? fmtDuration(d.spanMinutes * 60) : fmtMinutes(d.spanMinutes, true)
  const anyEstimated = d.buckets.some((b) => b.privateEstimated && b.privateUSD > 0)
  return (
    <div data-testid="buckets" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 12.5, color: C.text }}>
        <span><T id="buckets-span-label">{d.label}</T>: <span style={{ color: C.white, fontWeight: 800 }}><T id="buckets-span">{spanText}</T></span> · {clock(d.start, tz)}–{clock(d.end, tz)}</span>
        <span>{d.single ? "Too short to split into time buckets" : `${d.bucketMinutes}-minute buckets`}</span>
      </div>
      {d.peak && d.peak.sharePct != null && (
        <div data-testid="buckets-peak" style={{ ...inset, border: `1px solid ${C.pink}66`, padding: "8px 12px", fontSize: 13, color: C.white }}>
          <span style={{ color: C.pink, fontWeight: 800 }}>Peak period:</span> {clock(d.peak.start, tz)}–{clock(d.peak.end, tz)} generated <strong>{d.peak.sharePct}%</strong> of this session&apos;s earnings ({fmtUsd(d.peak.totalUSD)}).
        </div>
      )}
      <BucketExplorer e={e} d={d} tz={tz} ui={ui} testId="bucket-chart-timeline" />
      <div style={{ overflowX: "auto" }}>
        <table data-testid="buckets-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, color: C.text, fontVariantNumeric: "tabular-nums" }}>
          <thead><tr style={{ textAlign: "left", color: C.muted }}>
            <th style={{ padding: "4px 6px" }}>Time</th><th style={{ padding: "4px 6px", textAlign: "right" }}>Public</th><th style={{ padding: "4px 6px", textAlign: "right" }}>Private</th>
            <th style={{ padding: "4px 6px", textAlign: "right" }}>{e.type === "private" ? "Charges" : "Tips"}</th><th style={{ padding: "4px 6px", textAlign: "right" }}>Fans</th><th style={{ padding: "4px 6px" }}>Top fan</th>
          </tr></thead>
          <tbody>
            {d.buckets.map((b, i) => (
              <tr key={i} data-testid="bucket-row" style={{ borderTop: `1px solid ${C.line}`, color: d.peak && b.start === d.peak.start ? C.white : C.text }}>
                <td style={{ padding: "5px 6px", whiteSpace: "nowrap" }}>{clock(b.start, tz)}–{clock(b.end, tz)}</td>
                <td style={{ padding: "5px 6px", textAlign: "right" }}>{fmtUsd(b.publicUSD)}</td>
                <td style={{ padding: "5px 6px", textAlign: "right" }}>{b.privateUSD > 0 ? `${b.privateEstimated ? "~" : ""}${fmtUsd(b.privateUSD)}` : "—"}</td>
                <td style={{ padding: "5px 6px", textAlign: "right" }}>{b.count}</td>
                <td style={{ padding: "5px 6px", textAlign: "right" }}>{b.uniqueFans}</td>
                <td style={{ padding: "5px 6px" }}>{b.topFan ? `${b.topFan.username} ${fmtUsd(b.topFan.usd)}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {anyEstimated && <div style={{ fontSize: 11.5, color: C.muted }}>~ Live private earnings are estimated and spread across the minutes each private interval covered.</div>}
      {!d.exact && <div style={{ fontSize: 11.5, color: C.muted }}>Imported history shows when earnings happened, not proof of continuous streaming.</div>}
    </div>
  )
}

// Fans tab: who drove the selected session.
function FanDriversView({ e, tips, paidSessions, isPro, primaryPlatform, onShowFan = null }) {
  const fans = sessionFanDrivers(e, { tips, paidSessions })
  if (!fans.length) return <div data-testid="fans-empty" style={{ color: C.muted, fontSize: 13 }}>No fan-level detail for this session{e.type === "live" ? " (private time in Live Mode is not attributed to a fan)" : ""}.</div>
  // Free sees full history only on the primary platform; elsewhere "new" may just be outside the window.
  const newLabel = (platform) => !isPro && String(platform).toLowerCase() !== String(primaryPlatform || "").toLowerCase() ? "New in your available history" : "New"
  return (
    <div data-testid="fan-drivers" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {fans.map((f, i) => (
        <div key={`${f.platform}:${f.username}`} data-testid="fan-driver" role={onShowFan ? "button" : undefined} tabIndex={onShowFan ? 0 : undefined}
          title={onShowFan ? "Show this fan's buckets on the timeline" : undefined}
          onClick={onShowFan ? () => onShowFan(fanKey(f.platform, f.username)) : undefined}
          onKeyDown={onShowFan ? (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onShowFan(fanKey(f.platform, f.username)) } } : undefined}
          style={{ padding: "10px 14px", display: "grid", gridTemplateColumns: "22px minmax(0,1fr) auto", gap: 10, alignItems: "center", borderRadius: 14, background: "rgba(13,17,38,0.72)", border: `1px solid ${C.line}`, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)", cursor: onShowFan ? "pointer" : "default" }}>
          <span style={{ color: C.muted, fontWeight: 800 }}>{i + 1}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 900, color: C.white }}>{f.username}</span>
              <PlatformCell platform={pName(f.platform)} />
              <Badge text={f.returning ? "RETURNING" : newLabel(f.platform).toUpperCase()} color={f.returning ? C.green : C.cyan} testId={`fan-status-${f.returning ? "returning" : "new"}`} />
            </div>
            <div style={{ fontSize: 12, color: C.text, marginTop: 3 }}>{f.count} {e.type === "private" ? (f.count === 1 ? "charge" : "charges") : (f.count === 1 ? "tip" : "tips")}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 900, color: C.white }}>{fmtUsd(f.usd)}</div>
            {f.sharePct != null && <div style={{ fontSize: 11.5, color: C.text }}>{f.sharePct}% of session</div>}
            {f.sharePct != null && <div aria-hidden="true" style={{ marginTop: 4, width: 96, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", marginLeft: "auto" }}><div style={{ width: `${Math.min(100, f.sharePct)}%`, height: "100%", borderRadius: 2, background: `linear-gradient(90deg, ${C.cyan}, ${C.pink})` }} /></div>}
          </div>
        </div>
      ))}
      {e.type === "live" && e.privateUSD > 0 && <div style={{ fontSize: 11.5, color: C.muted }}>Live private earnings ({fmtUsd(e.privateUSD)}) are not attributed to individual fans, so shares can add up to less than 100%.</div>}
    </div>
  )
}

// Schedule tab: the selected session vs the creator's saved dated plans.
const mins = (n) => `${Math.abs(n)} min`
function ScheduleView({ e, plans, tz, onOpenPlanner }) {
  const m = matchPlannedStream(e, plans)
  if (!m || m.status === "no_plans") {
    return (
      <div data-testid="schedule" data-status="no_plans" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Badge text="NO SAVED PLAN" color={C.muted} testId="schedule-badge" />
        <div style={{ color: C.text, fontSize: 13 }}>Save planned streams in Stream Planner to see whether your sessions start on schedule.</div>
        {onOpenPlanner && <button onClick={onOpenPlanner} style={{ alignSelf: "flex-start", background: "transparent", border: "none", padding: 0, color: C.cyan, fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>Plan a stream →</button>}
      </div>
    )
  }
  if (m.status === "unscheduled") {
    return (
      <div data-testid="schedule" data-status="unscheduled" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Badge text="UNSCHEDULED" color={C.gold} testId="schedule-badge" />
        <div data-testid="schedule-text" style={{ color: C.text, fontSize: 13 }}>No saved plan matched this session.</div>
      </div>
    )
  }
  const planned = `Planned ${clock(m.plan.start, tz)}–${clock(m.plan.end, tz)}`
  const color = m.status === "on_schedule" ? C.green : m.status === "late" ? "#F87171" : C.cyan
  if (m.exact) {
    const badge = m.status === "on_schedule" ? "ON SCHEDULE ✓" : m.status === "late" ? "STARTED LATE" : "STARTED EARLY"
    const diff = m.startDiffMin === 0 ? "on time" : `${mins(m.startDiffMin)} ${m.startDiffMin > 0 ? "late" : "early"}`
    return (
      <div data-testid="schedule" data-status={m.status} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Badge text={badge} color={color} testId="schedule-badge" />
        <div data-testid="schedule-text" style={{ color: C.white, fontSize: 13.5 }}>{planned} · Started {clock(e.startTime, tz)} ({diff})</div>
        {m.endDiffMin != null && <div style={{ color: C.text, fontSize: 12.5 }}>Ended {m.endDiffMin === 0 ? "on time" : `${mins(m.endDiffMin)} ${m.endDiffMin > 0 ? "late" : "early"}`} · covered <T id="schedule-overlap">{m.overlapPct}%</T> of the planned window</div>}
      </div>
    )
  }
  // Imported / free-chat: only when earning activity began, never "went live".
  const badge = m.status === "on_schedule" ? "ACTIVITY ON TIME" : m.status === "late" ? "ACTIVITY AFTER PLANNED START" : "ACTIVITY BEFORE PLANNED START"
  const lead = m.insideWindow ? "Activity began inside your planned window" : "Activity began outside your planned window"
  const diff = m.startDiffMin === 0 ? "at your planned start" : `${mins(m.startDiffMin)} ${m.startDiffMin > 0 ? "after" : "before"} your planned start`
  return (
    <div data-testid="schedule" data-status={m.status} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Badge text={badge} color={color} testId="schedule-badge" />
      <div data-testid="schedule-text" style={{ color: C.white, fontSize: 13.5 }}>{lead}, {diff}.</div>
      <div style={{ color: C.text, fontSize: 12.5 }}>{planned} · first earning activity {clock(e.startTime, tz)}</div>
      <div style={{ color: C.muted, fontSize: 11.5 }}>Imported history shows when earnings began, not when you went live.</div>
    </div>
  )
}

const DETAIL_TABS = [["overview", "Overview"], ["timeline", "Timeline"], ["fans", "Fans"], ["schedule", "Schedule"]]

// Planner status chip for the header (matchPlannedStream, unchanged).
function PlannerChip({ e, plans }) {
  const m = matchPlannedStream(e, plans)
  if (!m) return null
  const map = {
    no_plans: ["No saved plan", C.muted], unscheduled: ["Not in Planner", C.gold],
    on_schedule: ["In Planner · on schedule", C.green], early: ["In Planner · early", C.cyan], late: ["In Planner · late", "#F87171"],
  }
  const [label, color] = map[m.status] || ["In Planner", C.cyan]
  return (
    <span data-testid="details-planner-chip" data-status={m.status} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color, padding: "4px 10px", borderRadius: 10, border: `1px solid ${color}66`, background: `${color}12`, whiteSpace: "nowrap" }}>
      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
      {label}
    </span>
  )
}

const Stat = ({ value, label, testId, accent }) => (
  <div style={{ minWidth: 0, padding: "2px 12px", borderLeft: `1px solid ${C.line}` }}>
    <div data-testid={testId} style={{ fontSize: String(value).length > 7 ? 16 : 20, fontWeight: 900, color: accent || C.white, lineHeight: 1.15, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>{value}</div>
    <div style={{ fontSize: 11.5, color: C.text, marginTop: 3 }}>{label}</div>
  </div>
)

function Details({ e, tips, paidSessions = [], tz, today, signal, isPro = true, primaryPlatform = null, vs = null, plans = [], onOpenPlanner = null, completeness = null }) {
  const [tab, setTab] = useState("overview")
  const [bucket, setBucket] = useState(null)
  const [mode, setMode] = useState("usd")
  const [highlight, setHighlight] = useState(null)
  // A different session starts with a clean chart.
  useEffect(() => { setBucket(null); setHighlight(null) }, [e?.id])
  const buckets = useMemo(() => (e ? sessionBuckets(e, { tips }) : null), [e, tips])
  if (!e) return <div style={{ color: C.text, fontSize: 13 }}>Select a session to see its details.</div>
  const status = e.running ? { label: "LIVE NOW", color: C.green } : e.isNew ? { label: "JUST ENDED", color: C.pink } : null
  const leader = today.platforms.find((p) => p.platform === today.bestPlatform)
  const ui = { bucket, setBucket, mode, setMode, highlight, setHighlight }
  const showFan = (k) => { setHighlight(k); setBucket(null); setTab("overview") }
  const outcomeWord = vs ? (vs.outcome === "above" ? `Outperformed by ${vs.deltaPct}%` : vs.outcome === "below" ? `Underperformed by ${Math.abs(vs.deltaPct)}%` : "On par with your typical session") : null
  const outcomeColor = vs ? (vs.outcome === "above" ? C.green : vs.outcome === "below" ? "#F87171" : C.text) : C.text
  return (
    <div data-testid="session-details-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
          <PlatformTile platform={e.platforms[0]} size={42} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 900, fontSize: 18, color: C.white, letterSpacing: "-0.01em" }}>{e.platforms.map(pName).join(" + ")}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: C.text, padding: "3px 9px", borderRadius: 9, border: `1px solid ${C.line}`, background: "rgba(255,255,255,0.03)" }}>{sessionTitle(e, tz)}</span>
              {status && <Badge text={status.label} color={status.color} />}
            </div>
            <div style={{ fontSize: 12, color: C.text, marginTop: 4 }}>{whenText(e.startTime, tz)}</div>
          </div>
        </div>
        <PlannerChip e={e} plans={plans} />
      </div>
      <div data-testid="details-tabs" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {DETAIL_TABS.map(([k, l]) => <span key={k} data-testid={`details-tab-${k}`}><Pill active={tab === k} onClick={() => setTab(k)}>{l}</Pill></span>)}
      </div>
      {tab === "timeline" && <BucketsView e={e} tips={tips} tz={tz} ui={ui} />}
      {tab === "schedule" && <ScheduleView e={e} plans={plans} tz={tz} onOpenPlanner={onOpenPlanner} />}
      {tab === "fans" && <FanDriversView e={e} tips={tips} paidSessions={paidSessions} isPro={isPro} primaryPlatform={primaryPlatform} onShowFan={buckets ? showFan : null} />}
      {tab === "overview" && <>
        <div data-testid="details-summary" style={{ borderRadius: 18, padding: "14px 16px", background: "linear-gradient(120deg, rgba(34,211,238,0.08) 0%, rgba(124,92,255,0.10) 46%, rgba(236,72,153,0.08) 100%), rgba(13,17,38,0.72)", border: `1px solid ${C.line}`, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)", display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,2fr)", gap: 14, alignItems: "center" }} className="sx-summary">
          <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
            {vs && <span aria-hidden="true" style={{ width: 42, height: 42, borderRadius: 21, flexShrink: 0, display: "grid", placeItems: "center", border: `1px solid ${outcomeColor}88`, background: `${outcomeColor}14`, color: outcomeColor, fontSize: 18, fontWeight: 900 }}>{vs.outcome === "above" ? "↗" : vs.outcome === "below" ? "↘" : "="}</span>}
            <div style={{ minWidth: 0 }}>
              {vs ? <>
                <div data-testid="details-outcome" style={{ fontSize: 19, fontWeight: 900, color: C.white, letterSpacing: "-0.01em" }}>{outcomeWord}</div>
                <div style={{ fontSize: 12.5, color: C.text, marginTop: 3 }}>{fmtUsd(e.totalUSD)} vs. your usual {fmtUsd(vs.medianUSD)} per session</div>
                <div style={{ marginTop: 4 }}><VsTypical vs={vs} e={e} long testId="details-vs" /></div>
                {vs.perHour && <div data-testid="details-vs-hourly" data-outcome={vs.perHour.outcome} style={{ fontSize: 12, color: C.text, marginTop: 4 }}>
                  {fmtUsd(vs.perHour.usdPerHour)}/hr over the recorded show vs a typical {fmtUsd(vs.perHour.medianUSDPerHour)}/hr ({vs.perHour.deltaPct > 0 ? "+" : ""}{vs.perHour.deltaPct}%, median of {vs.perHour.sessions} of your {pName(e.platforms[0])} Live shows)
                </div>}
              </>
              : completeness?.status === "partial_verified" ? <div data-testid="details-vs-partial" style={{ fontSize: 12.5, color: C.text }}>{completeness.reason === "hidden_live_tips" ? "Some of this show's tips are outside your Free history window" : "This session started before your Free history window"}, so it is not compared with your typical sessions.</div>
              : completeness?.status === "unknown" ? <div data-testid="details-vs-unknown" style={{ fontSize: 12.5, color: C.text }}>This session&apos;s completeness can&apos;t be confirmed with the history available, so it is not compared with your typical sessions.</div>
              : (e.type === "free_chat" || e.type === "imported" || e.type === "live") && e.isValid ? <div data-testid="details-vs-empty" style={{ fontSize: 12.5, color: C.text }}>Comparison with your typical session needs 5 other comparable sessions on the same platform and type.</div>
              : <div style={{ fontSize: 12.5, color: C.text }}>No comparison for this session type.</div>}
            </div>
          </div>
          <div className="sx-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 0 }}>
            <Stat value={fmtUsd(e.totalUSD)} label="Earned" testId="details-total" accent={C.green} />
            <Stat value={e.type === "private" ? `${e.chargeCount} ${e.chargeCount === 1 ? "charge" : "charges"}` : e.tipCount} label={e.type === "private" ? "Billing" : (e.tipCount === 1 ? "Tip" : "Tips")} testId="details-tips" />
            <Stat value={e.uniqueTippers} label={e.uniqueTippers === 1 ? "Unique Tipper" : "Unique Tippers"} testId="details-unique" />
            <Stat value={lengthText(e)} label={e.type === "private" ? "Charge span" : e.type === "live" ? "Duration" : "Est. span (first→last tip)"} testId="details-duration" />
          </div>
        </div>
        <div className="sx-dgrid" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 8 }}>
          <Cell value={fmtUsd(e.publicUSD)} label="Public" testId="details-public" />
          <Cell value={fmtUsd(e.privateUSD)} label="Private" testId="details-private" accent={C.pink} />
          <Cell value={e.type === "live" ? fmtUsd(e.show?.largestTipUsd) : e.type === "private" ? "—" : fmtUsd(Math.max(0, ...(e.session?.tips || []).map((x) => Number(x.usd) || 0)))} label="Largest Tip" testId="details-largest" />
          <Cell value={e.topTipper ? e.topTipper.username : e.fan || "—"} label={e.type === "private" ? "Fan" : "Top Tipper"} testId="details-top" />
          <Cell value={e.type === "live" ? fmtDuration(e.show?.privateSeconds || 0) : "—"} label="Private Time" testId="details-private-time" />
        </div>
        {buckets
          ? <div data-testid="details-timeline"><BucketExplorer e={e} d={buckets} tz={tz} ui={ui} testId="bucket-chart" /></div>
          : <div data-testid="details-timeline-empty" style={{ fontSize: 12.5, color: C.muted, padding: "18px 0" }}>No time-stamped activity in this session to chart.</div>}
        {signal && (
          <div data-testid="today-signal" style={{ ...inset, border: `1px solid ${C.cyan}55`, padding: "10px 14px" }}>
            <div style={{ color: C.cyan, fontWeight: 800, fontSize: 13 }}>Strongest signal: {signal}</div>
            {leader && <div style={{ color: C.text, fontSize: 12, marginTop: 2 }}>{fmtUsd(leader.totalUSD)} of {today.days === 1 ? "today's" : "this range's"} {fmtUsd(today.totalUSD)} came from {pName(leader.platform)}.</div>}
          </div>
        )}
      </>}
    </div>
  )
}

export default function SessionsOverview({ tips, shows, paidSessions, tz, showsLoading, showsError, now: fixedNow, live, isPro = true, primaryPlatform = null, onPrimarySaved = () => {}, onImport = null, onStartLive = null, plannedStreams = [], onOpenPlanner = null, allTips = null, allPaidSessions = null, windowStarts = null, tipsLoadComplete = true }) {
  const historyNote = isPro ? "Full history on every platform" : primaryPlatform
    ? `Free: full history on ${pName(primaryPlatform)}, last 31 days on other platforms`
    : "Free: last 31 days on every platform until you choose a primary platform"
  const now = useNow(fixedNow, live?.session ? 5000 : 15000)
  const [range, setRange] = useState(1)
  const [scopePick, setScopePick] = useState(null)
  const [filter, setFilter] = useState("all")
  const [selectedId, setSelectedId] = useState(null)
  const [showAll, setShowAll] = useState(false)
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
  // "View all" only widens the visible slice of the already plan-gated list.
  const allRows = [...(runningEntry && (filter === "all" || filter === "live") ? [runningEntry] : []), ...listed]
  const rows = showAll ? allRows : allRows.slice(0, ROWS)
  const selected = rows.find((r) => r.id === selectedId) || rows[0] || null
  const mode = useMemo(() => sessionsMode({ tips: T0, shows: S0, paidSessions: P0, live: !!live?.session }), [tips, shows, paidSessions, live?.session]) // eslint-disable-line react-hooks/exhaustive-deps
  const scope = mode.kind === "csv" ? "overall" : mode.kind === "mixed" ? (scopePick || "today") : "today"
  const overall = useMemo(() => overallSessionStats({ tips: T0, history, paidSessions: P0 }), [history]) // eslint-disable-line react-hooks/exhaustive-deps
  const perf = useMemo(() => sessionPerformance({ history, tips: T0, overall }), [history, overall]) // eslint-disable-line react-hooks/exhaustive-deps
  const showPerf = scope === "overall" || (mode.kind !== "none" && mode.singlePlatform)
  // Free-window completeness uses the full (unwindowed) rows only to decide
  // whether a visible session is complete; they are never rendered. If a Free
  // caller does not supply them, every session is 'unknown' (no verdicts).
  // NOTE: tipsLoadComplete defaults to true and the dashboard does not pass the
  // real load status yet (issue #747), so an incomplete load is NOT detected.
  const completeness = useMemo(() => sessionCompletenessMap(history, {
    allTips: allTips || [], visibleTips: T0, allPaidSessions: allPaidSessions || [],
    windowStarts: isPro ? null : (windowStarts || {}), isPro, loadComplete: tipsLoadComplete,
  }), [history, allTips, tips, allPaidSessions, windowStarts, isPro, tipsLoadComplete])
  const vsById = useMemo(() => new Map(history.map((e) => [e.id, sessionVsTypical(e, history, { completeness })]).filter(([, v]) => v)), [history, completeness])
  const noData = mode.kind === "none" && !runningEntry && !showsLoading
  const light = mode.kind !== "none" && perf.meaningfulSessions < 3
  // Platform cards only for platforms the creator actually has data on.
  const cardPlatforms = ["bongacams", "chaturbate", "myfreecams"].filter((p) => mode.platforms.includes(p))
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
        .sx-root .sx-bar:focus-visible { outline: 2px solid ${C.cyan}; outline-offset: 2px; border-radius: 8px; }
        .sx-root .sx-row:focus-visible { outline: 2px solid ${C.cyan}; outline-offset: 2px; }
        @media (max-width: 1280px) { .sx-root .sx-bx { grid-template-columns: 1fr !important; } }
        @media (max-width: 1150px) { .sx-root .sx-summary { grid-template-columns: 1fr !important; } }
        @media (max-width: 640px) {
          .sx-root .sx-cells, .sx-root .sx-dgrid { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
          .sx-root .sx-stats { grid-template-columns: repeat(2, minmax(0,1fr)) !important; row-gap: 10px !important; }
          .sx-root .sx-row { grid-template-columns: 36px minmax(0,1fr) auto !important; }
          .sx-root .sx-row .sx-row-count { display: none; }
          .sx-root .sx-row .sx-when-long { display: none; }
          .sx-root .sx-row .sx-when-short { display: inline !important; }
        }
      `}</style>

      {/* Row 1 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 900, color: C.white, margin: 0, letterSpacing: "-0.03em", display: "flex", alignItems: "center", gap: 12 }}>
            <svg aria-hidden="true" width="34" height="28" viewBox="0 0 34 28" fill="none"><defs><linearGradient id="sxPulseIcon" x1="0" x2="1"><stop offset="0" stopColor={C.pink} /><stop offset="1" stopColor={C.violet} /></linearGradient></defs><path d="M1 15h7l3-8 5 17 4-12 2 3h11" stroke="url(#sxPulseIcon)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 6px ${C.pink}88)` }} /></svg>
            Sessions
          </h1>
          <div style={{ fontSize: 14, color: C.text, marginTop: 4 }}>Review your shows, see what drove earnings, and plan smarter streams.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          {mode.kind === "mixed" && (
            <div data-testid="scope-switch" style={{ display: "flex", gap: 4, padding: 4, borderRadius: 10, border: `1px solid ${C.line}`, background: "rgba(8,11,22,0.6)" }}>
              {[["today", "Today"], ["overall", "Overall"]].map(([k, l]) => <span key={k} data-testid={`scope-${k}`}><Pill active={scope === k} onClick={() => setScopePick(k)}>{l}</Pill></span>)}
            </div>
          )}
          {scope === "today" && !noData && <div data-testid="range-group" style={{ display: "flex", gap: 4, padding: 4, borderRadius: 10, border: `1px solid ${C.line}`, background: "rgba(8,11,22,0.6)", alignItems: "center" }}>
            {mode.kind === "mixed" && <span style={{ fontSize: 11, color: C.muted, padding: "0 6px" }}>Range</span>}
            {RANGES.map(([d, l]) => <span key={d} data-testid={`range-${d}`}><Pill active={range === d} onClick={() => setRange(d)}>{mode.kind === "mixed" && d === 1 ? "1 Day" : l}</Pill></span>)}
          </div>}
 <PrimaryPlatformControl isPro={isPro} primary={primaryPlatform} onSaved={onPrimarySaved} />
          <span data-testid="updated" style={{ fontSize: 12, color: C.text, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: 4, background: C.green }} />Updated {timeAgo(loadedAt.toISOString(), now)}
          </span>
        </div>
      </div>

      {noData ? <Activation onImport={onImport} onStartLive={onStartLive} /> : <>
      {/* Row 2 */}
      {scope === "overall"
        ? <OverallHero o={overall} sourceLabel={sourceLabel} historyNote={historyNote} tz={tz} light={light} />
        : <Hero stats={stats} range={range} comparison={comparison} trend={trend} live={snap} now={now} light={light} onStartLive={onStartLive} />}

      {/* Row 3 */}
      {showPerf ? (
        <div data-testid="session-performance">
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: C.white }}>Session Performance</span>
            <span style={{ fontSize: 12.5, color: C.text }}>{scope === "overall" ? "Across your available history" : "Your meaningful sessions"} · platform comparison lives in the Platforms tab</span>
          </div>
          <SessionPerformanceCards perf={perf} onImport={onImport} />
        </div>
      ) : (
      <div data-testid="today-by-platform">
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: C.white }}>{range === 1 ? "Today by Platform" : `Last ${range} days by Platform`}</span>
          <span style={{ fontSize: 12.5, color: C.text }}>Compare your earnings across platforms</span>
        </div>
        <div className="sx-plat" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(cardPlatforms.length, 2)}, minmax(0,1fr))`, gap: 14 }}>
          {cardPlatforms.map((p) => (
            <PlatformCard key={p} platform={p} p={byPlatform[p]} best={stats.bestPlatform === p} range={range} />
          ))}
        </div>
      </div>
      )}

      {/* Row 4 */}
      <div className="sx-md" style={{ display: "grid", gridTemplateColumns: "minmax(0,38fr) minmax(0,62fr)", gap: 16, alignItems: "start" }}>
        <div data-testid="session-history" style={card({ padding: "18px 18px", display: "flex", flexDirection: "column", gap: 10, background: "rgba(12,15,28,0.80)", borderRadius: 20, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" })}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.white, letterSpacing: "-0.02em" }}>Recent Sessions</div>
              <div style={{ fontSize: 12.5, color: C.text }}>{mode.kind === "csv" ? "Grouped from your imported tip history (60-min gap) · spans are estimated" : showAll ? "All your sessions in this view" : `Your latest ${ROWS} sessions`}</div>
            </div>
            {allRows.length > ROWS && (
              <button data-testid="history-view-all" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)} style={{ flexShrink: 0, background: "transparent", border: "none", padding: "2px 0", color: C.pink, fontWeight: 800, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
                {showAll ? "Show fewer" : `View All (${allRows.length})`} <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {FILTERS.map(([k, l]) => <span key={k} data-testid={`filter-type-${k}`}><Pill active={filter === k} onClick={() => setFilter(k)}>{l}</Pill></span>)}
          </div>
          {showsError && <div style={{ color: C.text, fontSize: 12 }}>Couldn&apos;t load your Live Mode shows. They&apos;ll appear on the next refresh.</div>}
          {showsLoading && !history.length && <div style={{ color: C.text, fontSize: 12 }}>Loading…</div>}
          {!showsLoading && !history.length && !runningEntry && <div data-testid="history-empty" style={{ color: C.text, fontSize: 13 }}>No sessions yet. Start a Live Mode show or import your tip history.</div>}
          {(history.length > 0 || runningEntry) && !rows.length && <div data-testid="history-filter-empty" style={{ color: C.text, fontSize: 13 }}>No sessions of this type yet. Short tip groups (under 30 min or a single tip) are not listed.</div>}
          {rows.map((e) => <SessionRow key={e.id} e={e} tz={tz} selected={selected?.id === e.id} onSelect={() => setSelectedId(e.id)} vs={vsById.get(e.id)} />)}
        </div>
        <div data-testid="session-details" style={card({ padding: "18px 18px", display: "flex", flexDirection: "column", gap: 12, background: "rgba(12,15,28,0.80)", borderRadius: 20, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)", minWidth: 0 })}>
          <div style={SR_ONLY}>Session Details</div>
          <Details e={selected} tips={T0} paidSessions={P0} tz={tz} today={scope === "today" ? stats : { platforms: [], bestPlatform: null }} signal={signal} isPro={isPro} primaryPlatform={primaryPlatform} vs={selected ? vsById.get(selected.id) || null : null} completeness={selected ? completeness.get(selected.id) || null : null} plans={plannedStreams} onOpenPlanner={onOpenPlanner} />
        </div>
      </div>
      </>}
    </div>
  )
}
