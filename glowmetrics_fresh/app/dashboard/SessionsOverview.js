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
  timeAgo, sessionBuckets, sessionFanDrivers, sessionVsTypical, sessionCompletenessMap, matchPlannedStream, sessionsMode, overallSessionStats, sessionPerformance, overallSignal, fanKey, liveVerifiedHourly,
} from "../../lib/sessions/normalize"
import { fmtUsd, fmtDuration } from "./LatestShows"
import { card, HERO_GRADIENT } from "./CommandCenter"
import { PlatformCell } from "./PlatformsIntelligence"
import { Pill, PlatChip } from "./StreamPlanner"
import { PrimaryPlatformControl } from "./PrimaryPlatformPrompt"
import { BucketChart, BucketPanel, PlatformTile } from "./SessionsBuckets"
import SessionsPulse, { pickPulse } from "./SessionsPulse"
import L from "./SessionsLuxury.module.css"
import { summarizeWindowExclusion } from "../../lib/analytics"

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
// Zero-data state: what Sessions will show, and the actions that exist today.
const PREVIEW = [
  ["What happened", "Each session's earnings, length and source (Live Mode or imported history)."],
  ["What drove it", "The fans and moments that produced the money, with public and private kept apart."],
  ["Private earnings", "Private, group and spy revenue kept separate from tips."],
  ["How it compares", "Verified comparisons with your own similar sessions once there is enough history."],
]
function Activation({ onImport, onStartLive }) {
  return (
    <section data-testid="sessions-activation" className={cx(L.glassFeature, L.emptyState)} aria-label="Get started with Sessions">
      <div className={L.eyebrow}>Sessions</div>
      <h2 className={L.emptyTitle}>No performance data yet</h2>
      <p className={L.emptyBody}>Import your tip history or start a Live Mode show and your sessions will appear here.</p>
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
        <button data-testid="activation-import" onClick={onImport} className={L.primaryAction}>Import CSV history</button>
        <button data-testid="activation-live" onClick={onStartLive} className={L.secondaryAction}>Start Live Mode</button>
      </div>
      <div className={L.driverGrid} style={{ width: "100%", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        {PREVIEW.map(([title, text]) => (
          <div key={title} data-testid="activation-preview" className={L.driverTile}>
            <div className={L.microLabel}>{title}</div>
            <div className={L.driverNote} style={{ fontSize: 12 }}>{text}</div>
          </div>
        ))}
      </div>
    </section>
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
  const status = e.running ? "LIVE NOW" : e.isNew ? "JUST ENDED" : null
  const p0 = e.platforms[0]
  const n = e.type === "private" ? e.chargeCount : e.tipCount
  return (
    <button data-testid={`history-${e.id}`} onClick={onSelect} aria-pressed={selected} className={cx(L.sessionRow, selected && L.sessionRowActive)}>
      <PlatformTile platform={p0} />
      <span className={L.sessionMain}>
        <span className={L.sessionName}>
          <span data-testid={`platform-badge-${p0}`}>{pName(p0)}</span>
          {e.platforms.length > 1 && <span className={L.muted} title={e.platforms.slice(1).map(pName).join(", ")}> +{e.platforms.length - 1}</span>}
          {status && <span className={L.statusBadge}>{status}</span>}
          {e.isNew && <span data-testid="row-new-badge" hidden>NEW</span>}
        </span>
        <span className={L.sessionMeta}>
          {whenText(e.startTime, tz)} · <span data-testid={`type-badge-${e.type}`} data-label={t.label}>{typeWord(e)}</span>
          <span className={L.srOnly}>{n}{e.type === "private" ? (n === 1 ? "Charge" : "Charges") : (n === 1 ? "Tip" : "Tips")}</span>
        </span>
      </span>
      <span className={L.sessionAmount}>
        {fmtUsd(e.totalUSD)}
        {vs && <span className={cx(L.sessionDelta, vs.outcome === "above" ? L.deltaPositive : vs.outcome === "below" ? L.deltaNegative : L.deltaNeutral)}><VsTypical vs={vs} testId={`row-vs-${e.id}`} /></span>}
      </span>
    </button>
  )
}

// ── Selected-session workspace ───────────────────────────────────────────────
const clock = (iso, tz) => new Date(iso).toLocaleTimeString([], { timeZone: tz, hour: "numeric", minute: "2-digit" })
const cx = (...a) => a.filter(Boolean).join(" ")

// Default selection: the engine's peak bucket when it has one, else the first.
function defaultBucket(d) {
  if (d.peak) { const i = d.buckets.findIndex((b) => b.start === d.peak.start); if (i >= 0) return i }
  return 0
}

// Secondary exploration: interval chart + selected interval detail.
function ActivityExplorer({ e, d, tz, ui, testId }) {
  const sel = Math.min(ui.bucket ?? defaultBucket(d), d.buckets.length - 1)
  return (
    <div className={L.chartAndBucket}>
      <div className={cx(L.glassPanel, L.chartCard)}>
        <BucketChart d={d} tz={tz} type={e.type} selected={sel} onSelect={ui.setBucket} mode={ui.mode} onMode={ui.setMode} highlightKey={ui.highlight} testId={testId} />
      </div>
      <div className={cx(L.glassPanel, L.bucketCard)}>
        <BucketPanel d={d} index={sel} onIndex={(i) => ui.setBucket(Math.max(0, Math.min(d.buckets.length - 1, i)))} tz={tz} type={e.type} highlightKey={ui.highlight} onHighlight={ui.setHighlight} />
      </div>
    </div>
  )
}

// "More" → interval table (the engine's buckets, every row).
function BucketsView({ e, d, tz }) {
  if (!d) return <div data-testid="buckets-empty" className={L.quietNote}>No time-stamped activity in this session.</div>
  const spanText = d.exact ? fmtDuration(d.spanMinutes * 60) : fmtMinutes(d.spanMinutes, true)
  const anyEstimated = d.buckets.some((b) => b.privateEstimated && b.privateUSD > 0)
  return (
    <div data-testid="buckets" style={{ display: "grid", gap: 10 }}>
      <div className={L.sectionHint} style={{ marginTop: 0 }}>
        <T id="buckets-span-label">{d.label}</T>: <strong style={{ color: "#f7f4ff" }}><T id="buckets-span">{spanText}</T></strong> · {clock(d.start, tz)}–{clock(d.end, tz)} · {d.single ? "too short to split" : `${d.bucketMinutes}-minute intervals`}
      </div>
      {d.peak && d.peak.sharePct != null && (
        <div data-testid="buckets-peak" className={L.quietNote}>
          Peak interval {clock(d.peak.start, tz)}–{clock(d.peak.end, tz)} produced <strong>{d.peak.sharePct}%</strong> of this session&apos;s earnings ({fmtUsd(d.peak.totalUSD)}).
        </div>
      )}
      <div className={L.tableWrap}>
        <table data-testid="buckets-table" className={L.table}>
          <thead><tr><th>Time</th><th style={{ textAlign: "right" }}>Public</th><th style={{ textAlign: "right" }}>Private</th><th style={{ textAlign: "right" }}>{e.type === "private" ? "Charges" : "Tips"}</th><th style={{ textAlign: "right" }}>Fans</th><th>Top fan</th></tr></thead>
          <tbody>
            {d.buckets.map((b, i) => (
              <tr key={i} data-testid="bucket-row">
                <td style={{ whiteSpace: "nowrap" }}>{clock(b.start, tz)}–{clock(b.end, tz)}</td>
                <td style={{ textAlign: "right" }}>{fmtUsd(b.publicUSD)}</td>
                <td style={{ textAlign: "right" }}>{b.privateUSD > 0 ? `${b.privateEstimated ? "~" : ""}${fmtUsd(b.privateUSD)}` : "—"}</td>
                <td style={{ textAlign: "right" }}>{b.count}</td>
                <td style={{ textAlign: "right" }}>{b.uniqueFans}</td>
                <td>{b.topFan ? `${b.topFan.username} ${fmtUsd(b.topFan.usd)}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {anyEstimated && <div className={L.contributorMeta}>~ Live private earnings are estimated from the private rate and spread over the minutes each private period covered.</div>}
      {!d.exact && <div className={L.contributorMeta}>Imported history shows when transactions were recorded, not proof of continuous streaming.</div>}
    </div>
  )
}

// Contributors: who drove the session (sessionFanDrivers), top 5 then all.
function FanDriversView({ e, fans, isPro, primaryPlatform, onShowFan = null, highlight = null }) {
  const [all, setAll] = useState(false)
  // Free sees full history only on the primary platform; elsewhere "new" may just be outside the window.
  const newLabel = (platform) => !isPro && String(platform).toLowerCase() !== String(primaryPlatform || "").toLowerCase() ? "New in your available history" : "New"
  const liveUnattributed = e.type === "live" && e.privateUSD > 0
  if (!fans.length) {
    return <div data-testid="fans-empty" className={L.quietNote}>No individual contributor detail for this session{e.type === "live" ? " (Live Mode private time is not attributed to a fan)" : ""}.</div>
  }
  const shown = all ? fans : fans.slice(0, 5)
  return (
    <div data-testid="fan-drivers" className={L.contributorList} style={{ marginTop: 0 }}>
      {shown.map((f, i) => {
        const k = fanKey(f.platform, f.username)
        const on = highlight === k
        return (
          <div key={k} data-testid="fan-driver" role={onShowFan ? "button" : undefined} tabIndex={onShowFan ? 0 : undefined} aria-pressed={onShowFan ? on : undefined}
            title={onShowFan ? "Highlight this fan's intervals in the activity chart" : undefined}
            onClick={onShowFan ? () => onShowFan(on ? null : k) : undefined}
            onKeyDown={onShowFan ? (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onShowFan(on ? null : k) } } : undefined}
            className={cx(L.contributorRow, on && L.contributorActive)} style={{ cursor: onShowFan ? "pointer" : "default" }}>
            <span className={L.contributorRank}>{i + 1}</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
                <span data-testid="fan-driver-name" className={L.contributorName} style={{ fontSize: 12 }}>{f.username}</span>
                <span className={L.chip} data-testid={`fan-status-${f.returning ? "returning" : "new"}`}>{f.returning ? "RETURNING" : newLabel(f.platform).toUpperCase()}</span>
              </span>
              <span className={L.contributorMeta} style={{ display: "block" }}>{f.count} {e.type === "private" ? (f.count === 1 ? "charge" : "charges") : (f.count === 1 ? "tip" : "tips")} · {pName(f.platform)}</span>
            </span>
            <span style={{ textAlign: "right" }}>
              <span className={L.contributorAmount} style={{ display: "block" }}>{fmtUsd(f.usd)}</span>
              {f.sharePct != null && <span className={L.contributorMeta} style={{ display: "block" }}>{f.sharePct}% of session</span>}
              {f.sharePct != null && <span aria-hidden="true" className={L.shareTrack} style={{ display: "block" }}><span className={L.shareFill} style={{ display: "block", width: `${Math.min(100, f.sharePct)}%` }} /></span>}
            </span>
          </div>
        )
      })}
      {liveUnattributed && <div className={cx(L.contributorRow, L.unattributed)}><span className={L.contributorName} style={{ fontWeight: 600 }}>Private (no tipper detail) · estimated</span><span className={L.contributorAmount}>{fmtUsd(e.privateUSD)}</span></div>}
      {fans.length > 5 && <button data-testid="fans-show-all" className={L.linkButton} style={{ justifySelf: "start" }} onClick={() => setAll((v) => !v)}>{all ? "Show top 5" : `Show all ${fans.length} contributors`}</button>}
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

// Planner status (matchPlannedStream, unchanged). Hidden when there are no saved plans.
function PlannerChip({ e, plans }) {
  const m = matchPlannedStream(e, plans)
  if (!m || m.status === "no_plans") return null
  const map = {
    unscheduled: "Not in Planner", on_schedule: "In Planner · on schedule", early: "In Planner · started early", late: "In Planner · started late",
  }
  return <span data-testid="details-planner-chip" data-status={m.status} className={L.chip}>{map[m.status] || "In Planner"}</span>
}

const SOURCE = { live: "Live Mode", free_chat: "Free chat", imported: "Imported", private: "Private charges" }

// One compact metric inside the performance card. `missing` = value not
// recorded (rendered as text, never as $0.00).
function Metric({ label, value, testId, detail, missing = false }) {
  return (
    <div className={L.metric}>
      <div className={L.microLabel}>{label}</div>
      <div data-testid={testId} className={missing ? cx(L.metricValue, L.missing) : L.metricValue}>{value}</div>
      {detail && <div className={L.metricDetail}>{detail}</div>}
    </div>
  )
}

function Disclosure({ id, title, open, onToggle, children }) {
  return (
    <div className={L.glassPanel}>
      <button data-testid={`details-more-${id}`} aria-expanded={open} onClick={onToggle} className={L.disclosureButton}>
        <span>{title}</span><span aria-hidden="true" className={L.muted}>{open ? "–" : "+"}</span>
      </button>
      <div className={L.disclosureBody} hidden={!open}>{children}</div>
    </div>
  )
}

function Details({ e, tips, paidSessions = [], tz, isPro = true, primaryPlatform = null, vs = null, plans = [], onOpenPlanner = null, completeness = null, loadComplete = true }) {
  const [bucket, setBucket] = useState(null)
  const [mode, setMode] = useState("usd")
  const [highlight, setHighlight] = useState(null)
  const [more, setMore] = useState({ intervals: false, schedule: false })
  // A different session starts clean: no stale interval, highlight or open panels.
  useEffect(() => { setBucket(null); setHighlight(null) }, [e?.id])
  const buckets = useMemo(() => (e ? sessionBuckets(e, { tips }) : null), [e, tips])
  const fans = useMemo(() => (e ? sessionFanDrivers(e, { tips, paidSessions }) : []), [e, tips, paidSessions])
  if (!e) return <div className={L.quietNote}>Select a session to see its details.</div>
  const ui = { bucket, setBucket, mode, setMode, highlight, setHighlight }
  const showFan = (k) => { setHighlight(k); setBucket(null) }
  const status = e.running ? "LIVE NOW" : e.isNew ? "JUST ENDED" : null
  const hourly = e.type === "live" && !e.running ? liveVerifiedHourly(e) : null
  const top = fans[0] || null
  const peak = buckets?.peak && buckets.peak.sharePct != null ? buckets.peak : null
  const isLive = e.type === "live"
  const mixedMoney = e.publicUSD > 0 && e.privateUSD > 0 // composition only adds information when both exist
  const showContributors = fans.length > 1 || (fans.length === 1 && isLive && e.privateUSD > 0)

  // ── comparison (sessionVsTypical) or a subtle eligibility note ──
  const comparison = vs ? (
    <>
      <p data-testid="details-outcome" className={L.outcome} style={{ color: vs.outcome === "above" ? "#10B981" : vs.outcome === "below" ? "#F87171" : "#e6e1f1" }}>
        {vs.outcome === "above" ? `Outperformed by ${vs.deltaPct}%` : vs.outcome === "below" ? `Underperformed by ${Math.abs(vs.deltaPct)}%` : "On par with your typical session"}
      </p>
      <p className={L.comparisonLine}>{fmtUsd(e.totalUSD)} vs. your usual {fmtUsd(vs.medianUSD)} per session<span className={L.sampleChip}>{vs.sessions} comparable</span></p>
      <p className={L.earningsDescriptor}><VsTypical vs={vs} e={e} long testId="details-vs" /></p>
      {vs.perHour && <p data-testid="details-vs-hourly" data-outcome={vs.perHour.outcome} className={L.earningsDescriptor}>
        {fmtUsd(vs.perHour.usdPerHour)}/hr over the recorded show vs a typical {fmtUsd(vs.perHour.medianUSDPerHour)}/hr ({vs.perHour.deltaPct > 0 ? "+" : ""}{vs.perHour.deltaPct}%, median of {vs.perHour.sessions} of your {pName(e.platforms[0])} Live shows)
      </p>}
    </>
  ) : !loadComplete || completeness?.status === "unknown" ? <p data-testid="details-vs-unknown" className={L.comparisonNote} style={{ marginTop: 10 }}>This session&apos;s completeness can&apos;t be confirmed with the history available, so it isn&apos;t compared with your typical sessions.</p>
    : completeness?.status === "partial_verified" ? <p data-testid="details-vs-partial" className={L.comparisonNote} style={{ marginTop: 10 }}>{completeness.reason === "hidden_live_tips" ? "Some of this show's tips are outside your Free history window" : "This session started before your Free history window"}, so it isn&apos;t compared with your typical sessions.</p>
    : (e.type === "free_chat" || e.type === "imported" || e.type === "live") && e.isValid ? <p data-testid="details-vs-empty" className={L.comparisonNote} style={{ marginTop: 10 }}>Comparisons start after 5 comparable {pName(e.platforms[0])} sessions of this type.</p>
    : null

  // ── what drove it: one lead, at most two supporting facts ──
  const lead = top
    ? <><span data-testid="details-top">{top.username}</span>{top.sharePct != null ? <> drove <span className={L.money}>{top.sharePct}%</span> of this session</> : <> was the top contributor</>}</>
    : peak ? <>{clock(peak.start, tz)}–{clock(peak.end, tz)} produced {peak.sharePct}% of the earnings</>
    : <>No individual contributor detail was recorded</>
  const leadNote = top
    ? `${fmtUsd(top.usd)} from ${top.count} ${e.type === "private" ? (top.count === 1 ? "charge" : "charges") : (top.count === 1 ? "tip" : "tips")} on ${pName(top.platform)} · ${top.returning ? "returning fan" : (!isPro && String(top.platform).toLowerCase() !== String(primaryPlatform || "").toLowerCase() ? "new in your available history" : "first time in your history")}`
    : isLive && e.privateUSD > 0 ? "Live Mode private earnings aren't attributed to a fan." : null

  return (
    <div data-testid="session-details-body" className={L.detail}>
      <div className={L.identityRow}>
        <div className={L.identityMain}>
          <PlatformTile platform={e.platforms[0]} size={34} />
          <span className={L.identityName}>{e.platforms.map(pName).join(" + ")}</span>
          <span className={L.chip}>{SOURCE[e.type] || "Session"}</span>
          {status && <span className={L.chip} style={{ color: "#fc91c5" }}>{status}</span>}
          <span className={L.identityDate}>{whenText(e.startTime, tz)} · {sessionTitle(e, tz)}</span>
        </div>
        <PlannerChip e={e} plans={plans} />
      </div>

      <section data-testid="details-summary" className={cx(L.glassPanel, L.performance)} aria-label="Session performance">
        <div className={L.earningsHero}>
          <div className={L.microLabel}>Session earnings</div>
          <div data-testid="details-total" className={L.earningsAmount}>{fmtUsd(e.totalUSD)}</div>
          {comparison}
        </div>
        <div className={L.metricGrid}>
          <Metric label={e.type === "live" ? "Duration" : e.type === "private" ? "Charge span" : "Activity span"} testId="details-duration"
            value={e.type === "private" && e.chargeSpanMinutes == null ? "Unknown" : lengthText(e)} missing={e.type === "private" && e.chargeSpanMinutes == null}
            detail={e.type === "live" ? "Recorded by Live Mode" : e.type === "private" ? "First to last charge" : "Est. span (first→last tip), not time online"} />
          {hourly != null
            ? <Metric label="Verified $/hr" testId="details-hourly" value={`${fmtUsd(hourly)}/hr`} detail="Persisted by Live Mode" />
            : <Metric label={e.type === "private" ? "Billing" : "Tips"} testId="details-tips" value={e.type === "private" ? `${e.chargeCount} ${e.chargeCount === 1 ? "charge" : "charges"}` : e.tipCount} />}
          <Metric label={e.uniqueTippers === 1 ? "Unique tipper" : "Unique tippers"} testId="details-unique" value={e.uniqueTippers} />
          <Metric label="Public" testId="details-public" value={fmtUsd(e.publicUSD)} />
          <Metric label="Private" testId="details-private" value={fmtUsd(e.privateUSD)} detail={isLive && e.privateUSD > 0 ? "Estimated from private rate" : null} />
          {hourly != null && <Metric label={e.type === "private" ? "Billing" : "Tips"} testId="details-tips" value={e.tipCount} />}
          {isLive && <Metric label="Private time" testId="details-private-time" value={fmtDuration(e.show?.privateSeconds || 0)} />}
          {isLive && (e.show?.largestTipUsd != null
            ? <Metric label="Largest tip" testId="details-largest" value={fmtUsd(e.show.largestTipUsd)} />
            : <Metric label="Largest tip" testId="details-largest" value="Not recorded" missing />)}
        </div>
      </section>

      <section className={cx(L.glassPanel, L.drivers)} aria-label="What drove this session">
        <div className={L.eyebrow}>What drove this session</div>
        <p className={L.driverLead}>{lead}</p>
        {leadNote && <p className={L.driverExplanation}>{leadNote}</p>}
        {(mixedMoney || peak) && <div className={L.driverGrid}>
          {mixedMoney && <div className={L.driverTile}>
            <div className={L.microLabel}>Public vs private</div>
            <div className={L.driverValue}>{fmtUsd(e.publicUSD)} <span className={L.muted} style={{ fontSize: 12, fontWeight: 600 }}>public</span> · {fmtUsd(e.privateUSD)} <span className={L.muted} style={{ fontSize: 12, fontWeight: 600 }}>private</span></div>
            <div className={L.driverNote}>{isLive ? `Private estimated from the private rate over ${fmtDuration(e.show?.privateSeconds || 0)}; no fan attribution.` : "Private charges are recorded per fan."}</div>
          </div>}
          {peak && <div className={L.driverTile}>
            <div className={L.microLabel}>Strongest interval</div>
            <div className={L.driverValue}>{clock(peak.start, tz)}–{clock(peak.end, tz)}</div>
            <div className={L.driverNote}>{peak.sharePct}% of earnings ({fmtUsd(peak.totalUSD)}){buckets && !buckets.exact ? " · recorded transactions" : ""}.</div>
          </div>}
        </div>}
      </section>

      {showContributors && <section className={cx(L.glassPanel, L.section)} aria-label="Contributors">
        <div className={L.cardHeading} style={{ marginBottom: 10 }}>
          <div><h3 className={L.sectionTitle}>Contributors</h3><p className={L.sectionHint}>{buckets ? "Select a fan to see their intervals below." : "Ranked by earnings in this session."}</p></div>
        </div>
        <FanDriversView e={e} fans={fans} isPro={isPro} primaryPlatform={primaryPlatform} onShowFan={buckets && buckets.buckets.length > 1 ? showFan : null} highlight={highlight} />
      </section>}

      {buckets && buckets.buckets.length > 1
        ? <div data-testid="details-timeline"><ActivityExplorer e={e} d={buckets} tz={tz} ui={ui} testId="bucket-chart" /></div>
        : buckets
        ? <div data-testid="details-timeline" className={L.quietNote}>All recorded activity fell within one interval ({clock(buckets.start, tz)}–{clock(buckets.end, tz)}), so there is no timeline to compare.</div>
        : <div data-testid="details-timeline-empty" className={L.quietNote}>No time-stamped activity in this session to chart.</div>}

      <Disclosure id="intervals" title="Interval table" open={more.intervals} onToggle={() => setMore((m) => ({ ...m, intervals: !m.intervals }))}>
        <BucketsView e={e} d={buckets} tz={tz} />
      </Disclosure>
      <Disclosure id="schedule" title="Schedule vs Stream Planner" open={more.schedule} onToggle={() => setMore((m) => ({ ...m, schedule: !m.schedule }))}>
        <ScheduleView e={e} plans={plans} tz={tz} onOpenPlanner={onOpenPlanner} />
      </Disclosure>
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
  const [visible, setVisible] = useState(ROWS)
  const [platformPick, setPlatformPick] = useState("all")
  const [overviewOpen, setOverviewOpen] = useState(false)
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
  const platformFilter = platformPick
  const listed = useMemo(() => filterSessionHistory(history, { type: filter, platform: platformFilter }), [history, filter, platformFilter])
  // Paging only widens the visible slice of the already plan-gated list (20 at a time; no full-history DOM).
  const runningShown = runningEntry && (filter === "all" || filter === "live") && (platformFilter === "all" || runningEntry.platforms.includes(platformFilter))
  const allRows = [...(runningShown ? [runningEntry] : []), ...listed]
  const rows = allRows.slice(0, visible)
  const selected = allRows.find((r) => r.id === selectedId) || allRows[0] || null
  const rowsShown = selected && !rows.some((r) => r.id === selected.id) ? [...rows, selected] : rows

  const mode = useMemo(() => sessionsMode({ tips: T0, shows: S0, paidSessions: P0, live: !!live?.session }), [tips, shows, paidSessions, live?.session]) // eslint-disable-line react-hooks/exhaustive-deps
  const scope = mode.kind === "csv" ? "overall" : mode.kind === "mixed" ? (scopePick || "today") : "today"
  const overall = useMemo(() => overallSessionStats({ tips: T0, history, paidSessions: P0 }), [history]) // eslint-disable-line react-hooks/exhaustive-deps
  const perf = useMemo(() => sessionPerformance({ history, tips: T0, overall }), [history, overall]) // eslint-disable-line react-hooks/exhaustive-deps
  const showPerf = scope === "overall" || (mode.kind !== "none" && mode.singlePlatform)
  // Free-window completeness uses the full (unwindowed) rows only to decide
  // whether a visible session is complete; they are never rendered. If a Free
  // caller does not supply them, every session is 'unknown' (no verdicts).
  // page.js passes the real load status (dataComplete) as tipsLoadComplete.
  const completeness = useMemo(() => sessionCompletenessMap(history, {
    allTips: allTips || [], visibleTips: T0, allPaidSessions: allPaidSessions || [],
    windowStarts: isPro ? null : (windowStarts || {}), isPro, loadComplete: tipsLoadComplete,
  }), [history, allTips, tips, allPaidSessions, windowStarts, isPro, tipsLoadComplete])
  const vsById = useMemo(() => new Map(history.map((e) => [e.id, sessionVsTypical(e, history, { completeness })]).filter(([, v]) => v)), [history, completeness])
  // Session Pulse: one observation by the approved priority (selection only).
  const pulse = useMemo(() => pickPulse({ running: runningEntry, history: filterSessionHistory(history, {}), vsById }), [history, vsById, runningEntry?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const pulseFan = useMemo(() => (pulse && pulse.e && !pulse.e.running ? sessionFanDrivers(pulse.e, { tips: T0, paidSessions: P0 })[0] || null : null), [pulse, tips, paidSessions]) // eslint-disable-line react-hooks/exhaustive-deps
  const pulseHourly = pulse && pulse.kind === "new_show" ? liveVerifiedHourly(pulse.e) : null
  // Free only: history really held back on secondary platforms (existing helper).
  const exclusion = useMemo(() => (!isPro && allTips ? summarizeWindowExclusion(allTips, T0) : null), [isPro, allTips, tips]) // eslint-disable-line react-hooks/exhaustive-deps
  const heldBack = exclusion && exclusion.excludedCount > 0 ? Object.keys(exclusion.byPlatform || {}).map(pName) : []
  const openSession = (id) => { setFilter("all"); setPlatformPick("all"); setSelectedId(id) }
  const noData = mode.kind === "none" && !runningEntry && !showsLoading
  const light = mode.kind !== "none" && perf.meaningfulSessions < 3
  // Platform cards only for platforms the creator actually has data on.
  const cardPlatforms = ["bongacams", "chaturbate", "myfreecams"].filter((p) => mode.platforms.includes(p))
  const sourceLabel = mode.kind === "mixed" ? "LIVE + IMPORTED HISTORY" : "IMPORTED HISTORY"
  const signal = scope === "overall" ? overallSignal(overall, perf) : todaySignal(stats, pName)
  const byPlatform = Object.fromEntries(stats.platforms.map((p) => [p.platform, p]))

  return (
    <div data-testid="sessions-overview" className={cx("sx-root", L.page)}>
      <div className={L.ambient} aria-hidden="true" />
      <style>{`
        @media (max-width: 1024px) { .sx-root .sx-hero { grid-template-columns: 1fr !important; } .sx-root .sx-plat { grid-template-columns: 1fr !important; } }
        @media (max-width: 640px) { .sx-root .sx-cells { grid-template-columns: repeat(2, minmax(0,1fr)) !important; } }
        .sx-root .sx-pulse { width: 8px; height: 8px; border-radius: 50%; background: ${C.green}; animation: sxPulse 1.6s infinite; }
        @keyframes sxPulse { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,.6); } 70% { box-shadow: 0 0 0 8px rgba(16,185,129,0); } 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }
        .sx-root .sx-flash { animation: sxFlash 1.2s ease-out; }
        @keyframes sxFlash { 0% { filter: drop-shadow(0 0 26px rgba(34,211,238,.9)); } 100% { filter: drop-shadow(0 0 18px rgba(124,92,255,.45)); } }
        @media (prefers-reduced-motion: reduce) { .sx-root .sx-pulse, .sx-root .sx-flash { animation: none; } }
      `}</style>

      <header className={L.header}>
        <div className={L.headerCopy}>
          <h1 className={L.pageTitle}>Sessions</h1>
          <p className={L.pageSubtitle}>What happened in each show, what drove the money, and what to take into the next one.</p>
        </div>
        <div className={L.headerActions}>
          <PrimaryPlatformControl isPro={isPro} primary={primaryPlatform} onSaved={onPrimarySaved} />
          <span data-testid="updated" className={L.sectionHint} style={{ margin: 0, whiteSpace: "nowrap" }}><span className={L.statusDot} />Updated {timeAgo(loadedAt.toISOString(), now)}</span>
        </div>
      </header>

      {!tipsLoadComplete && <div data-testid="sessions-load-note" className={L.warning} style={{ marginBottom: 14 }}>Some of your history didn&apos;t finish loading. Sessions shows what loaded, and comparisons are paused until it does.</div>}

      {noData ? <Activation onImport={onImport} onStartLive={onStartLive} /> : <>
        <SessionsPulse pick={pulse} tz={tz} topFan={pulseFan} hourly={pulseHourly} onOpen={openSession} onImport={onImport} />

        <div className={L.workspace}>
          <aside className={L.leftRail}>
            <div data-testid="session-history" className={cx(L.glassPanel, L.railCard)}>
              <div className={L.cardHeading}>
                <div>
                  <h2 className={L.sectionTitle}>Sessions</h2>
                  <p className={L.sectionHint}>{mode.kind === "csv" ? "Reconstructed from imported transactions (60-min gap)" : mode.kind === "mixed" ? "Live Mode shows and imported history" : "Your Live Mode shows"}</p>
                </div>
                {allRows.length > ROWS && (
                  <button data-testid="history-view-all" aria-expanded={visible >= allRows.length} onClick={() => setVisible((v) => (v >= allRows.length ? ROWS : v + 20))} className={L.linkButton}>
                    {visible >= allRows.length ? "Show fewer" : `Show more (${allRows.length - Math.min(visible, allRows.length)})`}
                  </button>
                )}
              </div>
              {mode.platforms.length > 1 && (
                <div className={cx(L.segmented, L.filterScroll)} role="group" aria-label="Platform">
                  {[["all", "All platforms"], ...mode.platforms.map((p) => [p, pName(p)])].map(([k, l]) => (
                    <button key={k} data-testid={`filter-platform-${k}`} aria-pressed={platformPick === k} onClick={() => { setPlatformPick(k); setVisible(ROWS) }} className={cx(L.segment, platformPick === k && L.segmentActive)}>{l}</button>
                  ))}
                </div>
              )}
              <div className={cx(L.segmented, L.filterScroll)} role="group" aria-label="Session type">
                {FILTERS.map(([k, l]) => <span key={k} data-testid={`filter-type-${k}`}><button aria-pressed={filter === k} onClick={() => { setFilter(k); setVisible(ROWS) }} className={cx(L.segment, filter === k && L.segmentActive)}>{l}</button></span>)}
              </div>
              {showsError && <p className={L.quietNote}>Couldn&apos;t load your Live Mode shows. They&apos;ll appear on the next refresh.</p>}
              {showsLoading && !history.length && <div className={L.skeleton} style={{ height: 60 }} aria-label="Loading sessions" />}
              {!showsLoading && !history.length && !runningEntry && <p data-testid="history-empty" className={L.quietNote}>No sessions yet. Start a Live Mode show or import your tip history.</p>}
              {(history.length > 0 || runningEntry) && !allRows.length && <p data-testid="history-filter-empty" className={L.quietNote}>No sessions match this filter. Short tip groups (under 30 min or a single tip) are not listed.</p>}
              <div className={L.sessionList}>
                {rowsShown.map((e) => <SessionRow key={e.id} e={e} tz={tz} selected={selected?.id === e.id} onSelect={() => setSelectedId(e.id)} vs={vsById.get(e.id)} />)}
              </div>
            </div>
            {!isPro && heldBack.length > 0 && (
              <div data-testid="sessions-free-note" className={cx(L.glassPanel, L.upgrade)}>
                <p className={L.upgradeTitle}>Older {heldBack.join(", ")} history is Pro</p>
                <p className={L.upgradeText} style={{ marginBottom: 0 }}>{historyNote}. Everything shown here is complete for what you can see.</p>
              </div>
            )}
          </aside>
          <div data-testid="session-details">
            <span className={L.srOnly}>Session Details</span>
            <Details e={selected} tips={T0} paidSessions={P0} tz={tz} isPro={isPro} primaryPlatform={primaryPlatform} vs={selected ? vsById.get(selected.id) || null : null} completeness={selected ? completeness.get(selected.id) || null : null} plans={plannedStreams} onOpenPlanner={onOpenPlanner} loadComplete={tipsLoadComplete} />
          </div>
        </div>

        <div className={cx(L.glassPanel, L.overviewWrap)}>
          <button data-testid="period-overview-toggle" aria-expanded={overviewOpen} onClick={() => setOverviewOpen((v) => !v)} className={L.disclosureButton}>
            <span>{scope === "overall" ? "Overall performance" : "Period overview"} <span className={L.muted} style={{ fontWeight: 500 }}>· totals across sessions</span></span>
            <span aria-hidden="true" className={L.muted}>{overviewOpen ? "–" : "+"}</span>
          </button>
          <div className={L.disclosureBody} hidden={!overviewOpen} style={{ display: overviewOpen ? "flex" : undefined, flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {mode.kind === "mixed" && (
                <div data-testid="scope-switch" style={{ display: "flex", gap: 4, padding: 4, borderRadius: 10, border: `1px solid ${C.line}`, background: "rgba(8,11,22,0.6)" }}>
                  {[["today", "Today"], ["overall", "Overall"]].map(([k, l]) => <span key={k} data-testid={`scope-${k}`}><Pill active={scope === k} onClick={() => setScopePick(k)}>{l}</Pill></span>)}
                </div>
              )}
              {scope === "today" && <div data-testid="range-group" style={{ display: "flex", gap: 4, padding: 4, borderRadius: 10, border: `1px solid ${C.line}`, background: "rgba(8,11,22,0.6)", alignItems: "center" }}>
                {mode.kind === "mixed" && <span style={{ fontSize: 11, color: C.muted, padding: "0 6px" }}>Range</span>}
                {RANGES.map(([d, l]) => <span key={d} data-testid={`range-${d}`}><Pill active={range === d} onClick={() => setRange(d)}>{mode.kind === "mixed" && d === 1 ? "1 Day" : l}</Pill></span>)}
              </div>}
            </div>
            {scope === "overall"
              ? <OverallHero o={overall} sourceLabel={sourceLabel} historyNote={historyNote} tz={tz} light={light} />
              : <Hero stats={stats} range={range} comparison={comparison} trend={trend} live={snap} now={now} light={light} onStartLive={onStartLive} />}
            {showPerf ? (
              <div data-testid="session-performance">
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                  <span className={L.sectionTitle}>Session Performance</span>
                  <span className={L.sectionHint} style={{ margin: 0 }}>{scope === "overall" ? "Across your available history" : "Your meaningful sessions"} · platform comparison lives in the Platforms tab</span>
                </div>
                <SessionPerformanceCards perf={perf} onImport={onImport} />
              </div>
            ) : (
              <div data-testid="today-by-platform">
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                  <span className={L.sectionTitle}>{range === 1 ? "Today by Platform" : `Last ${range} days by Platform`}</span>
                  <span className={L.sectionHint} style={{ margin: 0 }}>Compare your earnings across platforms</span>
                </div>
                <div className="sx-plat" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(cardPlatforms.length, 2)}, minmax(0,1fr))`, gap: 14 }}>
                  {cardPlatforms.map((p) => <PlatformCard key={p} platform={p} p={byPlatform[p]} best={stats.bestPlatform === p} range={range} />)}
                </div>
              </div>
            )}
            {signal && (
              <div data-testid="today-signal" className={L.quietNote}>
                <strong style={{ color: C.cyan }}>Strongest signal: {signal}</strong>
                {scope === "today" && stats.platforms.find((x) => x.platform === stats.bestPlatform) && <span> · {fmtUsd(stats.platforms.find((x) => x.platform === stats.bestPlatform).totalUSD)} of {stats.days === 1 ? "today's" : "this range's"} {fmtUsd(stats.totalUSD)} came from {pName(stats.bestPlatform)}.</span>}
              </div>
            )}
          </div>
        </div>
      </>}
    </div>
  )
}
