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
  sessionTimeline, timeAgo, sessionBuckets, sessionFanDrivers, sessionVsTypical, matchPlannedStream, sessionsMode, overallSessionStats, sessionPerformance, overallSignal,
} from "../../lib/sessions/normalize"
import { fmtUsd, fmtDuration } from "./LatestShows"
import { PlatformCell, accentFor, Ico, PlatformMark } from "./PlatformsIntelligence"
import { Pill, PlatChip } from "./StreamPlanner"
import { PrimaryPlatformControl } from "./PrimaryPlatformPrompt"

// Same tokens as the Platforms page (CamCash design system): teal = money/live,
// violet = intelligence/selected, pink rare. No yellow anywhere.
const C = {
  cyan: "#23C7FF", teal: "#22E6D1", green: "#32E6A1", pink: "#FF3D9A", violet: "#A855F7", indigo: "#8B5CF6",
  white: "#F7F8FC", text: "#A8B0C3", muted: "#727D96", red: "#FF5C7C", line: "rgba(255,255,255,0.07)",
}
const eyebrow = { fontSize: 10, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted, lineHeight: 1.2 }
const inset = { background: "rgba(255,255,255,0.022)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 14 }
// One glass surface, shared with Platforms.
const GLASS_BG = "linear-gradient(145deg, rgba(16,19,38,0.74), rgba(7,9,20,0.92))"
const glass = (extra = {}) => ({
  position: "relative", borderRadius: 22, background: GLASS_BG, border: "1px solid rgba(255,255,255,0.055)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.045), 0 22px 56px rgba(0,0,0,0.30)",
  backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)", ...extra,
})
const pillStyle = (color) => ({ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", color, background: `${color}14`, boxShadow: `inset 0 0 0 1px ${color}33`, padding: "4px 11px", borderRadius: 999 })

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
  return <span data-testid={testId} style={{ color, background: `${color}14`, boxShadow: `inset 0 0 0 1px ${color}33`, fontSize: 9.5, fontWeight: 600, letterSpacing: 0.9, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{text}</span>
}

function Cell({ icon, value, label, testId, accent, sub, strong }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0, padding: strong ? "10px 12px" : "4px 2px", ...(strong ? { borderRadius: 14, background: "linear-gradient(135deg, rgba(139,92,246,0.11), rgba(255,255,255,0.015))" } : {}) }}>
      {icon && <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 15, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.04)", color: accent || C.text }}><Ico name={icon} size={15} /></span>}
      <div style={{ minWidth: 0 }}>
        <div data-testid={testId} style={{ fontSize: String(value).length >= 9 ? 15 : String(value).length >= 7 || strong ? 18 : 21, fontWeight: 700, letterSpacing: "-0.02em", color: accent || C.white, lineHeight: 1.15, ...(/^[$\d.,\s~↑↓%-]+$/.test(String(value)) ? { whiteSpace: "nowrap" } : { overflowWrap: "break-word" }) }}>{value}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 2, opacity: 0.85 }}>{sub}</div>}
      </div>
    </div>
  )
}

// Shown in place of an empty metric while the creator has little data:
// guidance, never a fake number.
function HintCell({ icon, text, testId, action }) {
  return (
    <div data-testid={testId} data-hint="1" style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0, padding: "4px 2px" }}>
      {icon && <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 15, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.03)", color: C.muted }}><Ico name={icon} size={15} /></span>}
      <div style={{ minWidth: 0, fontSize: 12.5, color: C.muted, lineHeight: 1.45, paddingTop: 5 }}>
        {text}
        {action && <div style={{ marginTop: 4 }}><button onClick={action.onClick} style={{ background: "transparent", border: "none", padding: 0, color: C.teal, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>{action.label} →</button></div>}
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
function HeroShell({ testId, left, cells }) {
  return (
    <div data-testid={testId} className="sx-hero" style={{
      position: "relative", overflow: "hidden", borderRadius: 28, padding: "30px 34px",
      border: "1px solid rgba(255,255,255,0.065)", background: "linear-gradient(145deg, rgba(16,19,38,0.92), rgba(6,8,18,0.98))",
      backdropFilter: "blur(34px)", WebkitBackdropFilter: "blur(34px)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.055), 0 34px 84px rgba(0,0,0,0.42)",
      display: "grid", gridTemplateColumns: "minmax(320px, 0.95fr) 1.6fr", gap: 36, alignItems: "center",
    }}>
      <span aria-hidden="true" style={{ position: "absolute", left: -150, top: -155, width: 430, height: 430, borderRadius: "50%", background: "rgba(35,199,255,0.12)", filter: "blur(120px)", pointerEvents: "none" }} />
      <span aria-hidden="true" style={{ position: "absolute", right: -80, top: -80, width: 390, height: 390, borderRadius: "50%", background: "rgba(139,92,246,0.12)", filter: "blur(120px)", pointerEvents: "none" }} />
      <div style={{ position: "relative", minWidth: 0 }}>{left}</div>
      <div className="sx-cells" style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "24px 16px" }}>{cells}</div>
    </div>
  )
}

function Hero({ stats, range, comparison, trend, live, now, noData = false, light = false, onStartLive }) {
  const flash = useFlash(stats.totalUSD)
  const title = range === 1 ? "Today so far" : `Last ${range} days`
  return (
    <HeroShell
      testId="today-stats"
      left={<>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={eyebrow}>{title}</span>
          {noData
            ? <span data-testid="hero-no-data" style={pillStyle(C.muted)}>NO DATA YET · import your tip history or start a Live Mode show</span>
            : live
            ? <span data-testid="hero-live" style={{ ...pillStyle(C.green), display: "inline-flex", alignItems: "center", gap: 6 }}><span className="sx-pulse" />LIVE NOW · {fmtDuration(live.durationSeconds)}</span>
            : <span style={{ ...pillStyle(C.green), display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: C.green }} />LIVE DATA</span>}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div data-testid="today-total" className={flash ? "sx-flash" : undefined} style={{ fontSize: "clamp(44px, 5vw, 60px)", fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1.02, marginTop: 14, color: C.white, fontVariantNumeric: "tabular-nums" }}>{fmtUsd(stats.totalUSD)}</div>
            <div style={{ fontSize: 14, color: C.text, marginTop: 8 }}>Total Earned (Public + Private)</div>
            {comparison && range === 1 && (
              <div data-testid="today-comparison" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13 }}>
                <span style={{ color: comparison.deltaPct >= 0 ? C.green : C.red, fontWeight: 600, background: comparison.deltaPct >= 0 ? `${C.green}1a` : "rgba(255,92,124,0.12)", padding: "3px 10px", borderRadius: 999 }}>{comparison.deltaPct >= 0 ? "↑" : "↓"} {Math.abs(comparison.deltaPct)}%</span>
                <span style={{ color: C.text }}>public tips vs. yesterday by now</span>
              </div>
            )}
          </div>
          {range === 1 && <div style={{ flex: "0 1 220px", minWidth: 0, overflow: "hidden", paddingTop: 6 }}><TrendLine values={trend} /></div>}
        </div>
      </>}
      cells={<>
        <Cell icon="dollar" value={fmtUsd(stats.publicUSD)} label="Public Earnings" testId="today-public" />
        {light && stats.privateUSD === 0 ? <HintCell icon="lock" text="No private earnings yet" testId="today-private" />
          : <Cell icon="lock" value={fmtUsd(stats.privateUSD)} label="Private Earnings" testId="today-private" accent={C.violet} />}
        <Cell icon="heart" value={stats.tipCount} label="Tips" testId="today-tips" />
        <Cell icon="users" value={stats.uniqueTippers} label="Unique Tippers" testId="today-unique" />
        {light && stats.streamedMinutes === 0 && !(stats.activitySpanMinutes > 0) ? <HintCell icon="clock" text="Stream time is tracked in Live Mode" testId="today-streamed" action={onStartLive ? { label: "Start Live Mode", onClick: onStartLive } : null} />
          : <Cell icon="clock" value={fmtMinutes(stats.streamedMinutes)} label="Streamed Time (Live)" testId="today-streamed"
            sub={stats.activitySpanMinutes > 0 ? `+ ${fmtMinutes(stats.activitySpanMinutes, true)} est. tip activity (not stream time)` : null} />}
        {light && !(stats.privateMinutes > 0) ? <HintCell icon="video" text="Private time is tracked in Live Mode" testId="today-private-time" />
          : <Cell icon="video" value={fmtMinutes(stats.privateMinutes)} label="Private Time (Live)" testId="today-private-time" />}
        {light && stats.completedSessions === 0 ? <HintCell icon="check" text="A session counts once it lasts 30+ min with 2+ tips" testId="today-completed" />
          : <Cell icon="check" value={stats.completedSessions} label="Completed Sessions" testId="today-completed" />}
        <Cell icon="trophy" strong value={stats.bestPlatform ? pName(stats.bestPlatform) : "Not enough data yet"} label="Best Platform" testId="today-best-platform" accent={stats.bestPlatform ? C.pink : C.muted}
          sub={stats.bestPlatform ? `${(stats.platforms.find((p) => p.platform === stats.bestPlatform) || {}).share || 0}% of ${range === 1 ? "today's" : "these"} earnings` : null} />
      </>}
    />
  )
}

// ── Row 3: platform cards ────────────────────────────────────────────────────
function PlatformCard({ platform, p, best, range }) {
  const color = accentFor(platform)
  const q = p || { totalUSD: 0, publicUSD: 0, privateUSD: 0, tipCount: 0, uniqueTippers: 0, share: 0 }
  return (
    <div data-testid={`today-platform-${platform}`} style={glass({
      padding: "22px 24px 20px", display: "flex", flexDirection: "column", gap: 16, minWidth: 0,
      ...(best ? { background: `radial-gradient(circle at 4% -8%, ${color}1f, transparent 52%), ${GLASS_BG}`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.045), 0 22px 56px rgba(0,0,0,0.30), 0 0 44px -16px ${color}88` } : {}),
    })}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 17, fontWeight: 600, letterSpacing: "-0.012em", color: C.white }}>
          <PlatformMark platform={platform} size={32} />
          {pName(platform)}
          {best && <span data-testid="best-platform-badge" style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: 1, color, background: `${color}14`, boxShadow: `inset 0 0 0 1px ${color}40`, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>BEST {range === 1 ? "TODAY" : "IN RANGE"}</span>}
        </span>
        <span style={{ textAlign: "right" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{q.share}%</div>
          <div style={{ fontSize: 12, color: C.muted }}>of {range === 1 ? "today's" : "range"} earnings</div>
        </span>
      </div>
      <div>
        <div style={{ fontSize: 32, fontWeight: 700, color: C.white, lineHeight: 1, letterSpacing: "-0.045em", fontVariantNumeric: "tabular-nums" }}>{fmtUsd(q.totalUSD)}</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8 }}>Total Earned</div>
        <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginTop: 14 }}>
          <div style={{ width: `${q.share}%`, height: "100%", background: `linear-gradient(90deg, ${color}88, ${color})`, boxShadow: `0 0 11px ${color}66` }} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        {[[fmtUsd(q.publicUSD), "Public"], [fmtUsd(q.privateUSD), "Private"], [q.tipCount, q.tipCount === 1 ? "Tip" : "Tips"], [q.uniqueTippers, q.uniqueTippers === 1 ? "Tipper" : "Tippers"]].map(([v, l]) => (
          <div key={l} style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.white, fontVariantNumeric: "tabular-nums" }}>{v}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{l}</div>
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
    <HeroShell
      testId="overall-stats"
      left={<>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={eyebrow}>Overall Performance</span>
          <span data-testid="overall-source" style={pillStyle(C.text)}>{sourceLabel}</span>
        </div>
        <div data-testid="overall-total" style={{ fontSize: "clamp(44px, 5vw, 60px)", fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1.02, marginTop: 14, color: C.white, fontVariantNumeric: "tabular-nums" }}>{fmtUsd(o.totalUSD)}</div>
        <div style={{ fontSize: 14, color: C.text, marginTop: 8 }}>Total Earned (Public + Private)</div>
        {o.firstAt && <div data-testid="overall-range" style={{ fontSize: 12.5, color: C.text, marginTop: 10 }}>{dateText(o.firstAt, tz)} – {dateText(o.lastAt, tz)}</div>}
        {historyNote && <div data-testid="overall-history-note" style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{historyNote}</div>}
      </>}
      cells={<>
        <Cell icon="dollar" value={fmtUsd(o.publicUSD)} label="Public Earnings" testId="overall-public" />
        {light && o.privateUSD === 0 ? <HintCell icon="lock" text="No private earnings yet" testId="overall-private" />
          : <Cell icon="lock" value={fmtUsd(o.privateUSD)} label="Private Earnings" testId="overall-private" accent={C.violet} />}
        <Cell icon="heart" value={o.tipCount} label="Tips" testId="overall-tips" />
        <Cell icon="users" value={o.uniqueTippers} label="Unique Tippers" testId="overall-unique" />
        <Cell icon="check" value={o.meaningfulSessions} label="Meaningful Sessions" sub="30+ min and 2+ tips" testId="overall-meaningful" />
        {o.medianSessionUSD == null ? <HintCell icon="bars" text="Median Session appears after your first meaningful session" testId="overall-median" />
          : <Cell icon="bars" value={fmtUsd(o.medianSessionUSD)} label="Median Session" sub={o.avgSessionUSD == null ? null : `avg ${fmtUsd(o.avgSessionUSD)}`} testId="overall-median" />}
        <Cell icon="crown" value={o.topTipper ? o.topTipper.username : "—"} label="Top Tipper" sub={o.topTipper ? `${fmtUsd(o.topTipper.usd)} · ${pName(o.topTipper.platform)}` : null} testId="overall-top-tipper" />
        <Cell icon="trophy" strong value={o.largestTip ? fmtUsd(o.largestTip.usd) : "—"} label="Largest Tip" sub={o.largestTip ? `${o.largestTip.username} · ${pName(o.largestTip.platform)}` : null} testId="overall-largest" accent={C.pink} />
      </>}
    />
  )
}

// ── Row 3 (one platform / Overall scope): Session Performance cards ─────────
function PerfCard({ title, color, testId, children }) {
  return (
    <div data-testid={testId} style={glass({ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 })}>
      <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 600, color: C.white, letterSpacing: "-0.012em" }}>
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, background: color, boxShadow: `0 0 10px ${color}` }} />{title}
      </span>
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
const Big = ({ v, l, id }) => <div><div data-testid={id} style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.04em", color: C.white, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{v}</div><div style={{ fontSize: 12.5, color: C.muted, marginTop: 8 }}>{l}</div></div>
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
  ["dollar", "Session earnings", "Every session's public and private earnings, compared with your typical session."],
  ["users", "Fan behavior", "Who tips, how often they come back, and which fans drive each session."],
  ["lock", "Private earnings", "Private, group and spy revenue kept separate from tips."],
  ["folder", "Recent sessions", "A timeline of each session with its peak period and top contributors."],
]
function Activation({ onImport, onStartLive }) {
  const btn = (primary) => ({ border: primary ? "none" : "1px solid rgba(255,255,255,0.08)", background: primary ? "linear-gradient(90deg, #22E6D1 0%, #8B5CF6 52%, #FF3D9A 100%)" : "rgba(255,255,255,0.03)", color: C.white, boxShadow: primary ? "0 0 24px rgba(139,92,246,0.22), 0 0 18px rgba(34,230,209,0.12)" : "none", fontWeight: 600, fontSize: 14, minHeight: 44, padding: "0 20px", borderRadius: 12, cursor: "pointer" })
  return (
    <div data-testid="sessions-activation" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={glass({ padding: "28px 30px" })}>
        <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.03em", color: C.white }}>No performance data yet</div>
        <div style={{ fontSize: 14, color: C.text, marginTop: 6 }}>Import your tip history or start a Live Mode show and your sessions will appear here.</div>
        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <button data-testid="activation-import" onClick={onImport} style={btn(true)}>Import CSV history</button>
          <button data-testid="activation-live" onClick={onStartLive} style={btn(false)}>Start Live Mode</button>
        </div>
      </div>
      <div className="sx-plat" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14 }}>
        {PREVIEW.map(([icon, title, text]) => (
          <div key={title} data-testid="activation-preview" style={{ ...inset, padding: "18px 20px" }}>
            <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.04)", color: C.teal }}><Ico name={icon} size={16} /></span>
            <div style={{ fontWeight: 600, color: C.white, fontSize: 15, marginTop: 12 }}>{title}</div>
            <div style={{ color: C.muted, fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>{text}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// "vs typical" marker: this session vs the creator's own comparable sessions.
function VsTypical({ vs, testId, long = false, e }) {
  if (!vs) return null
  const color = vs.outcome === "above" ? C.green : vs.outcome === "below" ? C.red : C.text
  const arrow = vs.outcome === "above" ? "▲" : vs.outcome === "below" ? "▼" : "="
  const pct = vs.outcome === "par" ? "On par" : `${vs.deltaPct > 0 ? "+" : ""}${vs.deltaPct}%`
  const scope = vs.basis === "same" && e ? `your ${pName(e.platforms[0])} ${e.type === "live" ? "Live" : e.type === "free_chat" ? "free-chat" : "imported"} sessions` : "all your meaningful sessions"
  return (
    <span data-testid={testId} data-outcome={vs.outcome} title={`Median of ${vs.sessions} of ${scope}: ${fmtUsd(vs.medianUSD)}`} style={{ display: long ? "inline" : "block", color, fontWeight: 800, fontSize: long ? 12.5 : 10.5, whiteSpace: "nowrap", lineHeight: 1.25 }}>
      {arrow} {pct}{long ? ` vs typical (median ${fmtUsd(vs.medianUSD)} of ${vs.sessions} of ${scope})` : <span style={{ display: "block", color: C.text, fontWeight: 600 }}>vs typical</span>}
    </span>
  )
}

// ── Row 4 left: sessions list ────────────────────────────────────────────────
function SessionRow({ e, tz, selected, onSelect, vs }) {
  const t = TYPE[e.type]
  const status = e.running ? { label: "LIVE NOW", color: C.green } : e.isNew ? { label: "JUST ENDED", color: C.pink } : t
  return (
    <button data-testid={`history-${e.id}`} onClick={onSelect} aria-pressed={selected} className="sx-row" style={{
      ...inset, width: "100%", textAlign: "left", cursor: "pointer", padding: "14px 16px", display: "grid",
      gridTemplateColumns: "14px minmax(0,1fr) 84px 58px 52px 12px", gap: 12, alignItems: "center", color: C.white,
      ...(selected ? { border: "1px solid rgba(139,92,246,0.42)", boxShadow: "0 0 34px -12px rgba(139,92,246,0.7), inset 0 1px 0 rgba(255,255,255,0.05)", background: "rgba(139,92,246,0.07)" } : {}),
    }}>
      <span aria-hidden="true" className={e.running ? "sx-pulse" : undefined} style={{ width: 8, height: 8, borderRadius: 4, justifySelf: "center", background: status.color, boxShadow: `0 0 10px ${status.color}` }} />
      <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", overflow: "hidden" }}>
          <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: "-0.012em", overflow: "hidden", textOverflow: "ellipsis" }}>{sessionTitle(e, tz)}</span>
          {e.isNew && <span data-testid="row-new-badge" style={{ display: "none" }}>NEW</span>}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.text, whiteSpace: "nowrap", overflow: "hidden" }}>
          <Badge text={status.label} color={status.color} testId={`type-badge-${e.type}`} />
          {e.platforms.slice(0, 1).map((p, i) => <span key={p} data-testid={`platform-badge-${p}`}><PlatChip name={pName(p)} i={i} /></span>)}
          {e.platforms.length > 1 && <span title={e.platforms.slice(1).map(pName).join(", ")} style={{ color: C.text }}>+{e.platforms.length - 1}</span>}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>· {whenText(e.startTime, tz)}</span>
        </span>
      </span>
      <span><div style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{fmtUsd(e.totalUSD)}</div>{vs ? <VsTypical vs={vs} testId={`row-vs-${e.id}`} /> : <div style={{ fontSize: 12, color: C.muted }}>Total Earned</div>}</span>
      <span><div style={{ fontWeight: 600, fontSize: 13.5 }}>{lengthText(e)}</div><div style={{ fontSize: 12, color: C.muted }}>{e.type === "live" ? "Duration" : e.type === "private" ? "Charge span" : "Est. span"}</div></span>
      <span><div style={{ fontWeight: 600, fontSize: 13.5 }}>{e.type === "private" ? e.chargeCount : e.tipCount}</div><div style={{ fontSize: 12, color: C.muted }}>{e.type === "private" ? (e.chargeCount === 1 ? "Charge" : "Charges") : (e.tipCount === 1 ? "Tip" : "Tips")}</div></span>
      <span aria-hidden="true" style={{ color: C.muted, display: "inline-flex" }}><Ico name="arrow" size={13} /></span>
    </button>
  )
}

// ── Row 4 right: details ─────────────────────────────────────────────────────
function Timeline({ data, tz }) {
  if (!data) return <div data-testid="details-timeline-empty" style={{ fontSize: 12.5, color: C.muted, padding: "18px 0" }}>Not enough time-stamped activity in this session to chart.</div>
  const max = Math.max(...data.buckets.map((b) => Math.max(b.public, b.private)), 0.01)
  const H = 70
  const fmtT = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: tz })
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

const clock = (iso, tz) => new Date(iso).toLocaleTimeString([], { timeZone: tz, hour: "numeric", minute: "2-digit" })

// Timeline tab: the selected session in time buckets.
function BucketsView({ e, tips, tz }) {
  const d = sessionBuckets(e, { tips })
  if (!d) return <div data-testid="buckets-empty" style={{ color: C.muted, fontSize: 13 }}>No time-stamped activity in this session.</div>
  const max = Math.max(...d.buckets.map((b) => b.totalUSD), 0.01)
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
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 74 }} aria-hidden="true">
        {d.buckets.map((b, i) => {
          const isPeak = d.peak && b.start === d.peak.start
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
              <div style={{ height: `${(b.privateUSD / max) * 100}%`, minHeight: b.privateUSD > 0 ? 3 : 0, background: `linear-gradient(180deg, ${C.pink}, ${C.violet})`, borderRadius: "3px 3px 0 0", opacity: b.privateEstimated ? 0.75 : 1 }} />
              <div style={{ height: `${(b.publicUSD / max) * 100}%`, minHeight: b.publicUSD > 0 ? 3 : 0, background: `linear-gradient(180deg, ${C.cyan}, ${C.indigo})`, borderRadius: b.privateUSD > 0 ? 0 : "3px 3px 0 0", boxShadow: isPeak ? `0 0 10px ${C.pink}` : "none" }} />
            </div>
          )
        })}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table data-testid="buckets-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, color: C.text }}>
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
function FanDriversView({ e, tips, paidSessions, isPro, primaryPlatform }) {
  const fans = sessionFanDrivers(e, { tips, paidSessions })
  if (!fans.length) return <div data-testid="fans-empty" style={{ color: C.muted, fontSize: 13 }}>No fan-level detail for this session{e.type === "live" ? " (private time in Live Mode is not attributed to a fan)" : ""}.</div>
  // Free sees full history only on the primary platform; elsewhere "new" may just be outside the window.
  const newLabel = (platform) => !isPro && String(platform).toLowerCase() !== String(primaryPlatform || "").toLowerCase() ? "New in your available history" : "New"
  return (
    <div data-testid="fan-drivers" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {fans.map((f, i) => (
        <div key={`${f.platform}:${f.username}`} data-testid="fan-driver" style={{ ...inset, padding: "10px 14px", display: "grid", gridTemplateColumns: "22px minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
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
        <Badge text="UNSCHEDULED" color={C.text} testId="schedule-badge" />
        <div data-testid="schedule-text" style={{ color: C.text, fontSize: 13 }}>No saved plan matched this session.</div>
      </div>
    )
  }
  const planned = `Planned ${clock(m.plan.start, tz)}–${clock(m.plan.end, tz)}`
  const color = m.status === "on_schedule" ? C.green : m.status === "late" ? C.red : C.cyan
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

function Details({ e, tips, paidSessions = [], tz, today, signal, isPro = true, primaryPlatform = null, vs = null, plans = [], onOpenPlanner = null }) {
  const [tab, setTab] = useState("overview")
  if (!e) return <div style={{ color: C.text, fontSize: 13 }}>Select a session to see its details.</div>
  const t = TYPE[e.type]
  const status = e.running ? { label: "LIVE NOW", color: C.green } : e.isNew ? { label: "JUST ENDED", color: C.pink } : t
  const leader = today.platforms.find((p) => p.platform === today.bestPlatform)
  return (
    <div data-testid="session-details-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...inset, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
          <PlatformMark platform={e.platforms[0] || ""} size={40} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 600, fontSize: 17, letterSpacing: "-0.02em", color: C.white }}>{sessionTitle(e, tz)}</span>
              <Badge text={status.label} color={status.color} />
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11.5, color: C.text, marginTop: 4, flexWrap: "wrap" }}>
              {e.platforms.map((p) => <PlatformCell key={p} platform={pName(p)} />)}
              <span>· {whenText(e.startTime, tz)}</span>
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div data-testid="details-total" style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.04em", color: C.teal, fontVariantNumeric: "tabular-nums" }}>{fmtUsd(e.totalUSD)}</div>
          <div style={{ fontSize: 12, color: C.muted }}>Total Earned</div>
        </div>
      </div>
      <div data-testid="details-tabs" style={{ display: "flex", gap: 4 }}>
        {DETAIL_TABS.map(([k, l]) => <span key={k} data-testid={`details-tab-${k}`}><Pill active={tab === k} onClick={() => setTab(k)}>{l}</Pill></span>)}
      </div>
      {tab === "timeline" && <BucketsView e={e} tips={tips} tz={tz} />}
      {tab === "schedule" && <ScheduleView e={e} plans={plans} tz={tz} onOpenPlanner={onOpenPlanner} />}
      {tab === "fans" && <FanDriversView e={e} tips={tips} paidSessions={paidSessions} isPro={isPro} primaryPlatform={primaryPlatform} />}
      {tab === "overview" && <>
      {vs ? <div style={{ ...inset, padding: "8px 12px" }}><VsTypical vs={vs} e={e} long testId="details-vs" /></div>
        : (e.type === "free_chat" || e.type === "imported" || e.type === "live") && e.isValid ? <div data-testid="details-vs-empty" style={{ fontSize: 12, color: C.muted }}>Comparison with your typical session needs 5 other meaningful sessions.</div> : null}
      <div className="sx-dgrid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "20px 12px", padding: "6px 2px" }}>
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
        <Timeline data={sessionTimeline(e, { tips })} tz={tz} />
      </div>
      {signal && (
        <div data-testid="today-signal" style={{ ...inset, border: "1px solid rgba(34,230,209,0.18)", padding: "12px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span aria-hidden="true" style={{ color: C.teal, marginTop: 1 }}><Ico name="sparkle" size={16} /></span>
          <div>
            <div style={{ color: C.teal, fontWeight: 600, fontSize: 13.5 }}>Strongest signal: {signal}</div>
            {leader && <div style={{ color: C.text, fontSize: 12, marginTop: 2 }}>{fmtUsd(leader.totalUSD)} of {today.days === 1 ? "today's" : "this range's"} {fmtUsd(today.totalUSD)} came from {pName(leader.platform)}.</div>}
          </div>
        </div>
      )}
      </>}
    </div>
  )
}

export default function SessionsOverview({ tips, shows, paidSessions, tz, showsLoading, showsError, now: fixedNow, live, isPro = true, primaryPlatform = null, onPrimarySaved = () => {}, onImport = null, onStartLive = null, plannedStreams = [], onOpenPlanner = null }) {
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
  const vsById = useMemo(() => new Map(history.map((e) => [e.id, sessionVsTypical(e, history)]).filter(([, v]) => v)), [history])
  const noData = mode.kind === "none" && !runningEntry && !showsLoading
  const light = mode.kind !== "none" && perf.meaningfulSessions < 3
  // Platform cards only for platforms the creator actually has data on.
  const cardPlatforms = ["bongacams", "chaturbate", "myfreecams"].filter((p) => mode.platforms.includes(p))
  const sourceLabel = mode.kind === "mixed" ? "LIVE + IMPORTED HISTORY" : "IMPORTED HISTORY"
  const signal = scope === "overall" ? overallSignal(overall, perf) : todaySignal(stats, pName)
  const byPlatform = Object.fromEntries(stats.platforms.map((p) => [p.platform, p]))

  return (
    <div data-testid="sessions-overview" className="sx-root" style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 24 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .sx-root .sx-pulse { width: 8px; height: 8px; border-radius: 50%; background: ${C.green}; animation: sxPulse 1.6s infinite; }
        @keyframes sxPulse { 0% { box-shadow: 0 0 0 0 rgba(50,230,161,.6); } 70% { box-shadow: 0 0 0 8px rgba(50,230,161,0); } 100% { box-shadow: 0 0 0 0 rgba(50,230,161,0); } }
        .sx-root .sx-flash { animation: sxFlash 1.2s ease-out; }
        @keyframes sxFlash { 0% { filter: drop-shadow(0 0 26px rgba(34,230,209,.85)); } 100% { filter: drop-shadow(0 0 0 rgba(34,230,209,0)); } }
        .sx-root .sx-row { transition: transform .18s ease, box-shadow .2s ease, border-color .2s ease, background .2s ease; }
        .sx-root .sx-row:hover { transform: translateY(-1px); border-color: rgba(139,92,246,0.28); background: rgba(255,255,255,0.035); }
        .sx-root .sx-row:focus-visible { outline: 2px solid ${C.pink}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .sx-root .sx-pulse, .sx-root .sx-flash { animation: none; } .sx-root .sx-row { transition: none; } .sx-root .sx-row:hover { transform: none; } }
        @media (max-width: 1150px) { .sx-root .sx-hero { grid-template-columns: 1fr !important; gap: 26px !important; } }
        @media (max-width: 1000px) { .sx-root .sx-plat, .sx-root .sx-md { grid-template-columns: 1fr !important; } }
        @media (max-width: 640px) {
          .sx-root .sx-hero { padding: 24px 20px !important; }
          .sx-root .sx-cells, .sx-root .sx-dgrid { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
          .sx-root .sx-row { grid-template-columns: 14px minmax(0,1fr) auto !important; grid-template-areas: "dot title earn" ". len cnt" !important; row-gap: 10px !important; }
          .sx-root .sx-row > :nth-child(1) { grid-area: dot; }
          .sx-root .sx-row > :nth-child(2) { grid-area: title; }
          .sx-root .sx-row > :nth-child(3) { grid-area: earn; text-align: right; }
          .sx-root .sx-row > :nth-child(4) { grid-area: len; }
          .sx-root .sx-row > :nth-child(5) { grid-area: cnt; text-align: right; }
          .sx-root .sx-row > :nth-child(6) { display: none; }
        }
      ` }} />

      {/* Row 1 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 600, color: C.white, margin: 0, letterSpacing: "-0.035em", lineHeight: 1.08 }}>Sessions</h1>
          <div style={{ fontSize: 13.5, color: C.muted, marginTop: 6 }}>Track your shows, earnings and audience across all platforms</div>
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
            <span style={{ width: 6, height: 6, borderRadius: 3, background: C.green, boxShadow: `0 0 8px ${C.green}` }} />Updated {timeAgo(loadedAt.toISOString(), now)}
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
            <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", color: C.white }}>Session Performance</span>
            <span style={{ fontSize: 12.5, color: C.text }}>{scope === "overall" ? "Across your available history" : "Your meaningful sessions"} · platform comparison lives in the Platforms tab</span>
          </div>
          <SessionPerformanceCards perf={perf} onImport={onImport} />
        </div>
      ) : (
      <div data-testid="today-by-platform">
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", color: C.white }}>{range === 1 ? "Today by Platform" : `Last ${range} days by Platform`}</span>
          <span style={{ fontSize: 13, color: C.muted }}>Compare your earnings across platforms</span>
        </div>
        <div className="sx-plat" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(cardPlatforms.length, 2)}, minmax(0,1fr))`, gap: 14 }}>
          {cardPlatforms.map((p) => (
            <PlatformCard key={p} platform={p} p={byPlatform[p]} best={stats.bestPlatform === p} range={range} />
          ))}
        </div>
      </div>
      )}

      {/* Row 4 */}
      <div className="sx-md" style={{ display: "grid", gridTemplateColumns: "45fr 55fr", gap: 16, alignItems: "stretch" }}>
        <div data-testid="session-history" style={glass({ padding: "22px 22px 20px", display: "flex", flexDirection: "column", gap: 12 })}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", color: C.white }}>Recent Sessions</div>
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
          {rows.map((e) => <SessionRow key={e.id} e={e} tz={tz} selected={selected?.id === e.id} onSelect={() => setSelectedId(e.id)} vs={vsById.get(e.id)} />)}
        </div>
        <div data-testid="session-details" style={glass({ padding: "22px 22px 20px", display: "flex", flexDirection: "column", gap: 14 })}>
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", color: C.white }}>Session Details</div>
          <Details e={selected} tips={T0} paidSessions={P0} tz={tz} today={scope === "today" ? stats : { platforms: [], bestPlatform: null }} signal={signal} isPro={isPro} primaryPlatform={primaryPlatform} vs={selected ? vsById.get(selected.id) || null : null} plans={plannedStreams} onOpenPlanner={onOpenPlanner} />
        </div>
      </div>
      </>}
    </div>
  )
}
