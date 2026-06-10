"use client"
import React, { useState, useMemo, useEffect, useCallback } from "react"
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, Cell,
} from "recharts"

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════════
const BG      = "#0a0e1a"
const CARD    = "rgba(255,255,255,0.03)"
const BORDER  = "rgba(255,255,255,0.08)"
const PRIMARY = "#f1f5f9"
const TEXT    = "#94a3b8"
const MUTED   = "#475569"
const CYAN    = "#22d3ee"
const PURPLE  = "#a855f7"
const GOLD    = "#f59e0b"
const GREEN   = "#10b981"
const RED     = "#f87171"
const INDIGO  = "#818cf8"

const PLAT_COLORS = { Chaturbate: "#22d3ee", BongaCams: "#e879f9", MyFreeCams: "#a855f7" }
const PLAT_FB     = ["#60a5fa", "#34d399", "#fb923c", "#f87171", "#fbbf24"]
const UTC_DAYS    = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
const MONTHS      = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const PREFS_KEY   = "cc_planner_prefs"

const cardS  = (x = {}) => ({ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "20px 24px", ...x })
const fmt$   = (v) => `$${Number(v).toFixed(2)}`
const fmtK   = (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))
const TIP_S  = { background: "#0f1726", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", color: PRIMARY, fontSize: 12 }

// UTC hour → local display string e.g. "9 PM"
const localHr  = (utcH) => new Date(Date.UTC(2000, 0, 1, utcH)).toLocaleTimeString([], { hour: "numeric", hour12: true })
// UTC day index → local weekday name
const localDay = (utcD) => new Date(Date.UTC(2024, 0, 7 + utcD)).toLocaleDateString("en-US", { weekday: "long" })
// Current local weekday name (no getDay())
const todayLocalName = () => new Date().toLocaleDateString("en-US", { weekday: "long" })

// ═══════════════════════════════════════════════════════════════════════════════
// PURE DATA FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function groupIntoSessions(tips) {
  if (!tips.length) return []
  const sorted = [...tips].sort((a, b) => new Date(a.date_time) - new Date(b.date_time))
  const out = []
  let cur = null
  sorted.forEach((t) => {
    const dt = new Date(t.date_time)
    if (!cur || dt - cur.end > 4 * 3_600_000) {
      cur = { start: dt, end: dt, tips: [t] }
      out.push(cur)
    } else {
      cur.end = dt
      cur.tips.push(t)
    }
  })
  return out.map((s) => {
    const dur      = Math.max(0.5, (s.end - s.start) / 3_600_000)
    const totalUSD = s.tips.reduce((n, t) => n + (parseFloat(t.usd) || 0), 0)
    const totalTok = s.tips.reduce((n, t) => n + (parseFloat(t.tokens) || 0), 0)
    const pc = {}
    s.tips.forEach((t) => { if (t.platform) pc[t.platform] = (pc[t.platform] || 0) + 1 })
    const platform  = Object.entries(pc).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    const platforms = Object.keys(pc)
    return {
      start: s.start, end: s.end, durationHrs: dur,
      totalUSD, totalTok,
      usdHr:    totalUSD / dur,
      utcDay:   s.start.getUTCDay(),
      utcHour:  s.start.getUTCHours(),
      platform, platforms, tips: s.tips,
    }
  })
}

function platformEfficiency(tips) {
  const sessions = groupIntoSessions(tips)
  const data = {}
  sessions.forEach((s) => {
    if (!s.platform) return
    if (!data[s.platform]) data[s.platform] = { sessions: [], usd: 0, hrs: 0, tipCount: 0 }
    const d = data[s.platform]
    d.sessions.push(s); d.usd += s.totalUSD; d.hrs += s.durationHrs; d.tipCount += s.tips.length
  })
  const cutoff = Date.now() - 30 * 86_400_000
  return Object.entries(data).map(([plat, d], i, arr) => {
    const usdPerHr  = d.hrs > 0 ? d.usd / d.hrs : 0
    const avgTip    = d.tipCount > 0 ? d.usd / d.tipCount : 0
    const tipsPerHr = d.hrs > 0 ? d.tipCount / d.hrs : 0
    const recent    = d.sessions.filter((s) => s.start.getTime() > cutoff)
    const rAvg      = recent.length ? recent.reduce((n, s) => n + s.usdHr, 0) / recent.length : usdPerHr
    const trend     = rAvg > usdPerHr * 1.05 ? "up" : rAvg < usdPerHr * 0.95 ? "down" : "flat"
    const slotMap   = {}
    d.sessions.forEach((s) => {
      const k = `${s.utcDay}-${s.utcHour}`
      if (!slotMap[k]) slotMap[k] = { utcDay: s.utcDay, utcHour: s.utcHour, n: 0, sum: 0 }
      slotMap[k].sum += s.usdHr; slotMap[k].n++
    })
    const bestSlot = Object.values(slotMap).sort((a, b) => b.sum / b.n - a.sum / a.n)[0] ?? null
    return { platform: plat, usdPerHr, avgTip, tipsPerHr, sessions: d.sessions.length, trend, bestSlot }
  }).sort((a, b) => b.usdPerHr - a.usdPerHr)
}

function bestWindows(tips) {
  const sessions = groupIntoSessions(tips)
  const map = {}
  sessions.forEach((s) => {
    const k = `${s.utcDay}-${s.utcHour}`
    if (!map[k]) map[k] = { utcDay: s.utcDay, utcHour: s.utcHour, sessions: [], pu: {}, ph: {} }
    map[k].sessions.push(s)
    if (s.platform) {
      map[k].pu[s.platform] = (map[k].pu[s.platform] || 0) + s.totalUSD
      map[k].ph[s.platform] = (map[k].ph[s.platform] || 0) + s.durationHrs
    }
  })
  const overallAvg = sessions.length ? sessions.reduce((n, s) => n + s.usdHr, 0) / sessions.length : 0
  return Object.values(map).map((sl) => {
    const avg  = sl.sessions.reduce((n, s) => n + s.usdHr, 0) / sl.sessions.length
    const cnt  = sl.sessions.length
    const conf = cnt >= 5 ? "high" : cnt >= 3 ? "medium" : cnt >= 2 ? "low" : "needs-testing"
    const plats = Object.entries(sl.pu).sort((a, b) => b[1] - a[1])
    const best  = plats[0]?.[0] ?? null
    const sec   = plats[1]?.[0] ?? null
    const bestAvgHr = best && sl.ph[best] ? sl.pu[best] / sl.ph[best] : null
    return {
      utcDay: sl.utcDay, utcHour: sl.utcHour,
      avgUsdPerHr: avg, sessionCount: cnt, confidence: conf,
      bestPlatform: best, secondaryPlatform: sec, bestPlatAvgHr: bestAvgHr,
      aboveAvg: avg > overallAvg,
    }
  }).filter((w) => w.sessionCount >= 1).sort((a, b) => b.avgUsdPerHr - a.avgUsdPerHr)
}

function untestedWindows(tips) {
  const sessions = groupIntoSessions(tips)
  const counts = {}
  sessions.forEach((s) => { const k = `${s.utcDay}-${s.utcHour}`; counts[k] = (counts[k] || 0) + 1 })
  const result = []
  const priority = [19, 20, 21, 22, 18, 17, 23, 16]
  for (let day = 0; day < 7; day++) {
    for (const h of priority) {
      const k   = `${day}-${h}`
      const cnt = counts[k] || 0
      if (cnt <= 1 && result.length < 5) result.push({ utcDay: day, utcHour: h, sessionCount: cnt })
    }
  }
  return result
}

function fatigueCurve(tips) {
  const sessions = groupIntoSessions(tips).filter((s) => s.durationHrs >= 1)
  const buckets  = {}
  sessions.forEach((s) => {
    const sorted = [...s.tips].sort((a, b) => new Date(a.date_time) - new Date(b.date_time))
    sorted.forEach((t) => {
      const minsIn = (new Date(t.date_time) - s.start) / 60_000
      const hr     = Math.min(5, Math.max(1, Math.ceil(minsIn / 60)))
      if (!buckets[hr]) buckets[hr] = { sum: 0 }
      buckets[hr].sum += parseFloat(t.usd) || 0
    })
  })
  const total = sessions.length || 1
  return [1, 2, 3, 4, 5].map((h) => ({
    sessionHour: h,
    label:       h === 5 ? "5+ hrs" : `Hr ${h}`,
    avgUsd:      buckets[h] ? parseFloat((buckets[h].sum / total).toFixed(2)) : 0,
  }))
}

function detectWhales(tips) {
  const byUser = {}
  tips.forEach((t) => {
    const u = t.username || "unknown"
    if (!byUser[u]) byUser[u] = { platform: t.platform, tips: [] }
    byUser[u].tips.push(t)
  })
  return Object.entries(byUser).map(([username, u]) => {
    const totalTokens = u.tips.reduce((n, t) => n + (parseFloat(t.tokens) || 0), 0)
    const totalUSD    = u.tips.reduce((n, t) => n + (parseFloat(t.usd) || 0), 0)
    const lastSeen    = new Date(Math.max(...u.tips.map((t) => new Date(t.date_time).getTime())))
    const daysSince   = Math.floor((Date.now() - lastSeen.getTime()) / 86_400_000)
    const slotMap     = {}
    u.tips.forEach((t) => {
      const dt = new Date(t.date_time)
      const k  = `${dt.getUTCDay()}-${dt.getUTCHours()}`
      slotMap[k] = (slotMap[k] || 0) + 1
    })
    const topSlot  = Object.entries(slotMap).sort((a, b) => b[1] - a[1])[0]
    const [bd, bh] = topSlot ? topSlot[0].split("-").map(Number) : [0, 0]
    const dates    = u.tips.map((t) => new Date(t.date_time)).sort((a, b) => a - b)
    const avgReturnDays = dates.length >= 2
      ? Math.round(dates.slice(1).reduce((s, d, i) => s + (d - dates[i]) / 86_400_000, 0) / (dates.length - 1))
      : null
    return { username, platform: u.platform, totalTokens, totalUSD, lastSeen, daysSince, bestDay: bd, bestHour: bh, avgReturnDays }
  }).filter((u) => u.totalTokens >= 500).sort((a, b) => b.totalTokens - a.totalTokens)
}

function multiStreamAnalysis(tips) {
  const sessions = groupIntoSessions(tips)
  const bins = { 1: [], 2: [], 3: [] }
  sessions.forEach((s) => { const n = Math.min(3, Math.max(1, s.platforms.length)); bins[n].push(s.usdHr) })
  return [1, 2, 3].map((n) => ({
    platforms: n,
    label:     n === 3 ? "3+ Platforms" : n === 2 ? "2 Platforms" : "1 Platform",
    avgUsdHr:  bins[n].length ? bins[n].reduce((a, b) => a + b, 0) / bins[n].length : 0,
    sessions:  bins[n].length,
  }))
}

function monthlyGrowth(tips) {
  const map = {}
  tips.forEach((t) => {
    const dt = new Date(t.date_time)
    const k  = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`
    map[k]   = (map[k] || 0) + (parseFloat(t.usd) || 0)
  })
  const sorted = Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-6)
  return sorted.map(([k, usd], i) => {
    const [, m]  = k.split("-")
    const prev   = i > 0 ? sorted[i - 1][1] : null
    const pct    = prev && prev > 0 ? ((usd - prev) / prev) * 100 : null
    return { month: MONTHS[parseInt(m) - 1], usd: parseFloat(usd.toFixed(2)), pctChange: pct }
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT PREFERENCES
// ═══════════════════════════════════════════════════════════════════════════════
const DEFAULT_PREFS = {
  days:       { Sunday: true, Monday: true, Tuesday: true, Wednesday: true, Thursday: true, Friday: true, Saturday: true },
  blocks:     { Morning: true, Afternoon: true, Evening: true, LateNight: true },
  maxHrs:     4,
  minSession: "90min",
  mode:       "Max Earnings",
  goalUSD:    "",
}

// ═══════════════════════════════════════════════════════════════════════════════
// SMALL UI PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════════
const CONF = {
  high:           { bg: "rgba(34,211,238,0.1)",  color: CYAN,   label: "High" },
  medium:         { bg: "rgba(168,85,247,0.1)",  color: PURPLE, label: "Medium" },
  low:            { bg: "rgba(245,158,11,0.1)",  color: GOLD,   label: "Low" },
  "needs-testing":{ bg: "rgba(99,102,241,0.1)",  color: INDIGO, label: "Needs Testing" },
}

function ConfBadge({ level }) {
  const c = CONF[level] || CONF["needs-testing"]
  return <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:5, background:c.bg, color:c.color, fontSize:11, fontWeight:600 }}>{c.label}</span>
}

function PlatChip({ name, i = 0 }) {
  if (!name) return null
  const color = PLAT_COLORS[name] || PLAT_FB[i % PLAT_FB.length]
  return <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:5, background:`${color}18`, border:`1px solid ${color}40`, color, fontSize:11, fontWeight:500 }}>{name}</span>
}

function SecHead({ title, sub }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ color: PRIMARY, fontWeight: 700, fontSize: 15 }}>{title}</div>
      {sub && <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function WhyTip({ content }) {
  const [open, setOpen] = useState(false)
  return (
    <span style={{ position: "relative", display: "inline-block", marginLeft: 4 }}>
      <button onClick={() => setOpen((o) => !o)} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: "50%", width: 16, height: 16, cursor: "pointer", color: MUTED, fontSize: 10, lineHeight: "14px", padding: 0 }}>?</button>
      {open && (
        <div style={{ position: "absolute", top: 22, right: 0, zIndex: 20, background: "#0f1726", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", width: 220, color: TEXT, fontSize: 12, lineHeight: 1.5 }}>
          {content}
        </div>
      )}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB BAR
// ═══════════════════════════════════════════════════════════════════════════════
const TABS = [{ id:"plan", label:"Plan" }, { id:"analytics", label:"Analytics" }, { id:"whales", label:"Whales" }, { id:"progress", label:"Progress" }]

function TabBar({ active, onChange }) {
  return (
    <div style={{ display:"flex", borderBottom:`1px solid ${BORDER}`, marginBottom:24 }}>
      {TABS.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{ padding:"10px 20px", background:"none", border:"none", cursor:"pointer", color:active===t.id?CYAN:TEXT, fontWeight:active===t.id?700:400, fontSize:14, borderBottom:active===t.id?`2px solid ${CYAN}`:"2px solid transparent", marginBottom:-1, transition:"all 0.15s" }}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLAN TAB
// ═══════════════════════════════════════════════════════════════════════════════

// 6 time blocks for the opportunity grid (UTC hour ranges, converted to local for display)
const GRID_BLOCKS = [
  { id:"LateNight",   label:"Late Night", hours:[0,1,2,3]   },
  { id:"EarlyMorning",label:"Early AM",   hours:[4,5,6,7]   },
  { id:"Morning",     label:"Morning",    hours:[8,9,10,11]  },
  { id:"Afternoon",   label:"Afternoon",  hours:[12,13,14,15]},
  { id:"Evening",     label:"Evening",    hours:[16,17,18,19]},
  { id:"PrimeTime",   label:"Prime Time", hours:[20,21,22,23]},
]

const PLAN_MODES = [
  { id:"Max Earnings",   icon:"💰" },
  { id:"Growth Mode",    icon:"📈" },
  { id:"Whale Watch",    icon:"🐋" },
  { id:"Testing Mode",   icon:"🧪" },
  { id:"Low Burnout",    icon:"🔋" },
  { id:"Emergency Goal", icon:"🚨" },
]

// Resolve a cell's status for the opportunity map
function cellStatus(windows, whaleKeys, utcDay, blockHours) {
  const wk = `${utcDay}-${blockHours[0]}`
  if (whaleKeys.has(`${utcDay}-${blockHours[1]}`) || whaleKeys.has(`${utcDay}-${blockHours[2]}`)) return "whale"
  const matching = windows.filter((w) => w.utcDay === utcDay && blockHours.includes(w.utcHour))
  if (!matching.length) return "untested"
  const best = matching.sort((a, b) => b.avgUsdPerHr - a.avgUsdPerHr)[0]
  if (best.sessionCount >= 5 && best.aboveAvg) return "winner"
  if (best.sessionCount <= 2 && best.aboveAvg) return "promising"
  if (best.sessionCount >= 3 && !best.aboveAvg) return "weak"
  return "mixed"
}

const CELL_C = {
  winner:   { bg:"rgba(16,185,129,0.20)",  bdr:"rgba(16,185,129,0.40)" },
  promising:{ bg:"rgba(96,165,250,0.15)",  bdr:"rgba(96,165,250,0.35)" },
  untested: { bg:"rgba(255,255,255,0.03)", bdr:BORDER },
  mixed:    { bg:"rgba(245,158,11,0.10)",  bdr:"rgba(245,158,11,0.30)" },
  weak:     { bg:"rgba(248,113,113,0.10)", bdr:"rgba(248,113,113,0.30)" },
  whale:    { bg:"rgba(168,85,247,0.15)",  bdr:"rgba(168,85,247,0.35)" },
}

function PlanTab({ windows, untestedSlots, whales }) {
  const [prefs, setPrefs]           = useState(DEFAULT_PREFS)
  const [showCustomize, setShow]    = useState(false)

  // Load from localStorage after mount (SSR-safe)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY)
      if (raw) setPrefs((p) => ({ ...DEFAULT_PREFS, ...JSON.parse(raw) }))
    } catch {}
  }, [])

  const savePrefs = useCallback((next) => {
    setPrefs(next)
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)) } catch {}
  }, [])

  // Keys where 2+ whales commonly appear
  const whaleKeys = useMemo(() => {
    const map = {}
    whales.forEach((w) => { const k = `${w.bestDay}-${w.bestHour}`; map[k] = (map[k] || 0) + 1 })
    return new Set(Object.entries(map).filter(([, n]) => n >= 2).map(([k]) => k))
  }, [whales])

  // Local-hour helper for availability block filtering
  const localHourOf = (utcHour) => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, hour: "numeric", hour12: false }).formatToParts(new Date(Date.UTC(2000, 0, 1, utcHour)))
    return parseInt(parts.find((p) => p.type === "hour")?.value ?? "0") % 24
  }

  const blockEnabled = useCallback((utcHour) => {
    const lh = localHourOf(utcHour)
    return (
      (prefs.blocks.Morning    && lh >= 6  && lh < 12) ||
      (prefs.blocks.Afternoon  && lh >= 12 && lh < 18) ||
      (prefs.blocks.Evening    && lh >= 18 && lh < 23) ||
      (prefs.blocks.LateNight  && (lh >= 23 || lh < 6))
    )
  }, [prefs.blocks])

  // 7-day plan
  const weekPlan = useMemo(() => {
    const today = todayLocalName()
    return UTC_DAYS.map((_, utcDay) => {
      const dayName = localDay(utcDay)
      if (!prefs.days[dayName]) return { utcDay, dayName, off: true }

      let dayWins = windows.filter((w) => w.utcDay === utcDay && blockEnabled(w.utcHour))

      if (prefs.mode === "Whale Watch") {
        dayWins = dayWins.sort((a, b) => {
          const aW = whaleKeys.has(`${a.utcDay}-${a.utcHour}`) ? 1 : 0
          const bW = whaleKeys.has(`${b.utcDay}-${b.utcHour}`) ? 1 : 0
          return bW - aW || b.avgUsdPerHr - a.avgUsdPerHr
        })
      } else if (prefs.mode === "Testing Mode") {
        const test = untestedSlots.filter((u) => u.utcDay === utcDay)
        if (test.length) dayWins = test.map((u) => ({ ...u, avgUsdPerHr: 0, confidence: "needs-testing", bestPlatform: null, secondaryPlatform: null }))
        else dayWins = dayWins.sort((a, b) => b.avgUsdPerHr - a.avgUsdPerHr)
      } else if (prefs.mode === "Low Burnout") {
        dayWins = dayWins.filter((w) => w.sessionCount >= 3).sort((a, b) => b.avgUsdPerHr - a.avgUsdPerHr)
      } else {
        dayWins = dayWins.sort((a, b) => b.avgUsdPerHr - a.avgUsdPerHr)
      }

      const best = dayWins[0] ?? null
      const isWhaleDay = whaleKeys.size && [...whaleKeys].some((k) => k.startsWith(`${utcDay}-`))
      return { utcDay, dayName, off: false, window: best, isToday: dayName === today, isWhaleDay }
    })
  }, [windows, prefs, whaleKeys, untestedSlots, blockEnabled])

  // Tonight's slot
  const tonight = weekPlan.find((d) => d.isToday && d.window)

  const whaleWatchWindow = useMemo(() => {
    const todayUTC = new Date().getUTCDay()
    const active   = whales.filter((w) => w.bestDay === todayUTC && w.daysSince < 14)
    if (!active.length) return null
    return { hour: active[0].bestHour, platform: active[0].platform, count: active.length }
  }, [whales])

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* Tonight's Brief */}
      {tonight && (
        <div style={{ background:"rgba(34,211,238,0.06)", border:"1px solid rgba(34,211,238,0.28)", borderRadius:14, padding:"18px 24px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ width:44,height:44,borderRadius:10,background:"rgba(34,211,238,0.14)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>⚡</div>
            <div style={{ flex:1 }}>
              <div style={{ color:CYAN, fontWeight:700, fontSize:14, marginBottom:4 }}>Tonight's Recommendation</div>
              <div style={{ color:TEXT, fontSize:13, lineHeight:1.6 }}>
                Go live at <strong style={{color:PRIMARY}}>{localHr(tonight.window.utcHour)}</strong> on{" "}
                <span style={{color:PLAT_COLORS[tonight.window.bestPlatform]||CYAN}}>{tonight.window.bestPlatform || "your top platform"}</span>.{" "}
                Est. <strong style={{color:PRIMARY}}>{fmt$(tonight.window.avgUsdPerHr * 2)}</strong> for 2 hrs.{" "}
                {tonight.isWhaleDay && <span style={{color:PURPLE}}>🐋 Whale watch active tonight.</span>}
              </div>
              <div style={{ color:MUTED, fontSize:12, marginTop:4 }}>
                Stop/switch rule: if under {fmt$(tonight.window.avgUsdPerHr * 0.4)}/hr after 30 min with no repeat fans, switch platforms or wrap up.
              </div>
              {whaleWatchWindow && (
                <div style={{ color:PURPLE, fontSize:12, marginTop:4 }}>
                  🐋 Whale window: <strong>{localHr(whaleWatchWindow.hour)}</strong> on {whaleWatchWindow.platform} — {whaleWatchWindow.count} whales active this time of night.
                </div>
              )}
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <div style={{ color:CYAN, fontSize:22, fontWeight:700 }}>{fmt$(tonight.window.avgUsdPerHr)}</div>
              <div style={{ color:MUTED, fontSize:11 }}>/hr avg</div>
              <div style={{ color:MUTED, fontSize:11, marginTop:2 }}>Min {prefs.minSession} recommended</div>
            </div>
          </div>
        </div>
      )}

      {/* Customize Schedule */}
      <div style={cardS()}>
        <button onClick={() => setShow((o) => !o)} style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:0 }}>
          <SecHead title="Customize Your Schedule" sub="Set availability, session preferences, and planning mode" />
          <span style={{ color:MUTED, fontSize:18, marginTop:2 }}>{showCustomize ? "▲" : "▼"}</span>
        </button>

        {showCustomize && (
          <div style={{ display:"flex", flexDirection:"column", gap:16, marginTop:4 }}>

            <div>
              <div style={{color:TEXT,fontSize:12,marginBottom:8}}>Available Days</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {UTC_DAYS.map((d) => (
                  <button key={d} onClick={() => savePrefs({...prefs,days:{...prefs.days,[d]:!prefs.days[d]}})} style={{ padding:"4px 12px",borderRadius:6,border:`1px solid ${prefs.days[d]?CYAN:BORDER}`,background:prefs.days[d]?"rgba(34,211,238,0.10)":"transparent",color:prefs.days[d]?CYAN:MUTED,fontSize:12,cursor:"pointer" }}>{d.slice(0,3)}</button>
                ))}
              </div>
            </div>

            <div>
              <div style={{color:TEXT,fontSize:12,marginBottom:8}}>Time Blocks</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {[["Morning","6am–12pm"],["Afternoon","12pm–6pm"],["Evening","6pm–11pm"],["LateNight","11pm–4am"]].map(([id,lbl]) => (
                  <button key={id} onClick={() => savePrefs({...prefs,blocks:{...prefs.blocks,[id]:!prefs.blocks[id]}})} style={{ padding:"4px 12px",borderRadius:6,border:`1px solid ${prefs.blocks[id]?CYAN:BORDER}`,background:prefs.blocks[id]?"rgba(34,211,238,0.10)":"transparent",color:prefs.blocks[id]?CYAN:MUTED,fontSize:12,cursor:"pointer" }}>{lbl}</button>
                ))}
              </div>
            </div>

            <div>
              <div style={{color:TEXT,fontSize:12,marginBottom:8}}>Max Hours/Day: <strong style={{color:PRIMARY}}>{prefs.maxHrs}h</strong></div>
              <input type="range" min={1} max={8} value={prefs.maxHrs} onChange={(e) => savePrefs({...prefs,maxHrs:+e.target.value})} style={{width:"100%",accentColor:CYAN}} />
            </div>

            <div>
              <div style={{color:TEXT,fontSize:12,marginBottom:8}}>Minimum Session Length</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {["60min","90min","2hr","No minimum"].map((opt) => (
                  <button key={opt} onClick={() => savePrefs({...prefs,minSession:opt})} style={{ padding:"4px 12px",borderRadius:6,fontSize:12,cursor:"pointer",border:`1px solid ${prefs.minSession===opt?CYAN:BORDER}`,background:prefs.minSession===opt?"rgba(34,211,238,0.10)":"transparent",color:prefs.minSession===opt?CYAN:MUTED }}>{opt}</button>
                ))}
              </div>
            </div>

            <div>
              <div style={{color:TEXT,fontSize:12,marginBottom:8}}>Planning Mode</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {PLAN_MODES.map((m) => (
                  <button key={m.id} onClick={() => savePrefs({...prefs,mode:m.id})} style={{ padding:"6px 14px",borderRadius:8,fontSize:12,cursor:"pointer",border:`1px solid ${prefs.mode===m.id?CYAN:BORDER}`,background:prefs.mode===m.id?"rgba(34,211,238,0.12)":"transparent",color:prefs.mode===m.id?CYAN:MUTED,fontWeight:prefs.mode===m.id?700:400 }}>{m.icon} {m.id}</button>
                ))}
              </div>
            </div>

            <div>
              <div style={{color:TEXT,fontSize:12,marginBottom:8}}>Weekly Income Goal (optional)</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:MUTED,fontSize:13}}>$</span>
                <input type="number" placeholder="e.g. 500" value={prefs.goalUSD} onChange={(e) => savePrefs({...prefs,goalUSD:e.target.value})} style={{ background:"rgba(255,255,255,0.05)",border:`1px solid ${BORDER}`,borderRadius:8,padding:"8px 12px",color:PRIMARY,fontSize:13,width:120 }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* This Week's Plan */}
      <div style={cardS()}>
        <SecHead title="This Week's Plan" sub={`Mode: ${prefs.mode}`} />
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          <div style={{ display:"grid", gridTemplateColumns:"110px 1fr 1fr 90px 130px 20px", gap:8, padding:"0 10px", color:MUTED, fontSize:11, marginBottom:4 }}>
            <span>Day</span><span>Best Window</span><span>Platform Stack</span><span>$/hr</span><span>Confidence</span><span/>
          </div>
          {weekPlan.map((row) => (
            <div key={row.utcDay} style={{ display:"grid", gridTemplateColumns:"110px 1fr 1fr 90px 130px 20px", gap:8, alignItems:"center", padding:"10px", borderRadius:8, background:row.isToday?"rgba(34,211,238,0.04)":"rgba(255,255,255,0.02)", border:`1px solid ${row.isToday?"rgba(34,211,238,0.18)":BORDER}` }}>
              <span style={{ color:row.off?MUTED:row.isToday?CYAN:PRIMARY, fontSize:13, fontWeight:600 }}>
                {row.dayName.slice(0,3)}{row.isToday?" 📍":""}{row.isWhaleDay&&!row.off?" 🐋":""}
              </span>
              {row.off ? (
                <span style={{color:MUTED,fontSize:12,gridColumn:"2/7"}}>Day off</span>
              ) : row.window ? (
                <>
                  <span style={{color:TEXT,fontSize:12}}>{localHr(row.window.utcHour)}–{localHr((row.window.utcHour+2)%24)}</span>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    <PlatChip name={row.window.bestPlatform} />
                    {row.window.secondaryPlatform && <PlatChip name={row.window.secondaryPlatform} i={1} />}
                  </div>
                  <span style={{color:PRIMARY,fontSize:13,fontWeight:600}}>{fmt$(row.window.avgUsdPerHr)}</span>
                  <ConfBadge level={row.window.confidence} />
                  <WhyTip content={`${row.window.sessionCount} session${row.window.sessionCount!==1?"s":""} on ${row.dayName}. ${row.window.aboveAvg?"Above your overall average.":"Near your average."} ${row.isWhaleDay?"Whale activity detected for this day.":""} Mode: ${prefs.mode}.`} />
                </>
              ) : (
                <span style={{color:MUTED,fontSize:12,gridColumn:"2/7"}}>No sessions on this day yet</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Untested Opportunity Map */}
      <div style={cardS()}>
        <SecHead title="Opportunity Map" sub="7 days × 6 time blocks — color shows performance level" />

        <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:14 }}>
          {[["winner","🟢 Proven winner"],["promising","🔵 Under-tested"],["untested","⚪ Untested"],["mixed","🟡 Mixed results"],["weak","🔴 Proven weak"],["whale","🟣 Whale window"]].map(([s,l]) => (
            <span key={s} style={{ display:"flex",alignItems:"center",gap:5,fontSize:11,color:TEXT }}>
              <span style={{width:10,height:10,borderRadius:2,background:CELL_C[s].bg,border:`1px solid ${CELL_C[s].bdr}`,display:"inline-block"}}/>
              {l}
            </span>
          ))}
        </div>

        <div style={{ overflowX:"auto" }}>
          <div style={{ minWidth:500 }}>
            <div style={{ display:"grid", gridTemplateColumns:"78px repeat(7,1fr)", gap:3, marginBottom:4 }}>
              <div/>
              {UTC_DAYS.map((d) => <div key={d} style={{textAlign:"center",fontSize:11,color:MUTED}}>{d.slice(0,3)}</div>)}
            </div>
            {GRID_BLOCKS.map((blk) => (
              <div key={blk.id} style={{ display:"grid", gridTemplateColumns:"78px repeat(7,1fr)", gap:3, marginBottom:3 }}>
                <div style={{color:MUTED,fontSize:10,display:"flex",alignItems:"center"}}>{blk.label}</div>
                {UTC_DAYS.map((_, utcDay) => {
                  const st = cellStatus(windows, whaleKeys, utcDay, blk.hours)
                  const c  = CELL_C[st]
                  return <div key={utcDay} title={`${UTC_DAYS[utcDay]} ${blk.label}: ${st}`} style={{ height:30, borderRadius:4, background:c.bg, border:`1px solid ${c.bdr}` }} />
                })}
              </div>
            ))}
          </div>
        </div>

        {untestedSlots.slice(0, 3).map((slot, i) => (
          <div key={i} style={{ marginTop:i===0?16:6, padding:"8px 12px", background:"rgba(99,102,241,0.06)", border:"1px solid rgba(99,102,241,0.22)", borderRadius:8 }}>
            <span style={{color:INDIGO,fontSize:12,fontWeight:600}}>🧪 Test This: </span>
            <span style={{color:TEXT,fontSize:12}}>{localDay(slot.utcDay)} at {localHr(slot.utcHour)} has only {slot.sessionCount} session recorded. Worth testing to expand your pattern data.</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function AnalyticsTab({ tips }) {
  const platData    = useMemo(() => platformEfficiency(tips), [tips])
  const fatigueData = useMemo(() => fatigueCurve(tips),       [tips])
  const multiData   = useMemo(() => multiStreamAnalysis(tips), [tips])
  const monthData   = useMemo(() => monthlyGrowth(tips),       [tips])

  const stopHour = useMemo(() => {
    for (let i = 1; i < fatigueData.length; i++) {
      if (fatigueData[i].avgUsd < fatigueData[i - 1].avgUsd * 0.6) return fatigueData[i].sessionHour
    }
    return null
  }, [fatigueData])

  const bestMulti = multiData.reduce((best, m) => (m.sessions > 2 && m.avgUsdHr > best.avgUsdHr ? m : best), multiData[0] || { avgUsdHr: 0, label: "1 Platform" })

  const platRole = (i) => {
    if (i === 0) return "Primary Earner"
    if (i === 1) return "Growth Platform"
    return "Backup"
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* Platform efficiency cards */}
      <div style={cardS()}>
        <SecHead title="Platform Efficiency" sub="Revenue per hour by platform — last 30-day trend shown" />
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))", gap:12 }}>
          {platData.map((p, i) => {
            const color     = PLAT_COLORS[p.platform] || PLAT_FB[i % PLAT_FB.length]
            const trendIcon = p.trend === "up" ? "▲" : p.trend === "down" ? "▼" : "—"
            const trendClr  = p.trend === "up" ? GREEN : p.trend === "down" ? RED : MUTED
            return (
              <div key={p.platform} style={{ background:"rgba(255,255,255,0.02)",border:`1px solid ${BORDER}`,borderRadius:12,padding:"16px" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                  <PlatChip name={p.platform} i={i} />
                  <span style={{color:trendClr,fontSize:12,fontWeight:600}}>{trendIcon} 30d</span>
                </div>
                <div style={{ color:PRIMARY, fontSize:28, fontWeight:700, lineHeight:1 }}>{fmt$(p.usdPerHr)}</div>
                <div style={{ color:MUTED, fontSize:11, marginBottom:10 }}>/hr avg</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                  {[["Avg tip",fmt$(p.avgTip)],["Sessions",p.sessions],["Best time",p.bestSlot?localHr(p.bestSlot.utcHour):"—"],["Best day",p.bestSlot?localDay(p.bestSlot.utcDay).slice(0,3):"—"]].map(([l,v]) => (
                    <div key={l}><div style={{color:MUTED,fontSize:10}}>{l}</div><div style={{color:TEXT,fontSize:12}}>{v}</div></div>
                  ))}
                </div>
                <div style={{ marginTop:10,padding:"3px 8px",borderRadius:5,background:`${color}18`,border:`1px solid ${color}30`,color,fontSize:11,fontWeight:600,display:"inline-block" }}>
                  {platRole(i)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Fatigue curve */}
      <div style={cardS()}>
        <SecHead title="Session Fatigue Curve" sub="Average USD earned at each hour-mark within your sessions" />
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={fatigueData}>
            <CartesianGrid stroke={BORDER} vertical={false} />
            <XAxis dataKey="label" tick={{fill:TEXT,fontSize:12}} axisLine={false} tickLine={false} />
            <YAxis tick={{fill:TEXT,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v.toFixed(0)}`} />
            <Tooltip contentStyle={TIP_S} formatter={(v) => [`$${Number(v).toFixed(2)}`, "Avg USD"]} />
            {stopHour !== null && (
              <ReferenceLine x={`Hr ${stopHour}`} stroke={RED} strokeDasharray="4 2" label={{ value:"Stop point", fill:RED, fontSize:11, position:"insideTopRight" }} />
            )}
            <Line type="monotone" dataKey="avgUsd" stroke={CYAN} strokeWidth={2} dot={{ fill:CYAN, r:4 }} activeDot={{ r:5 }} />
          </LineChart>
        </ResponsiveContainer>
        {stopHour !== null && (
          <div style={{ marginTop:10,padding:"8px 12px",background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:8,color:RED,fontSize:12 }}>
            Revenue typically drops after hour {stopHour}. Consider wrapping up or switching platforms at this point.
          </div>
        )}
      </div>

      {/* Multistream analysis */}
      <div style={cardS()}>
        <SecHead title="Multistream Analysis" sub="Does running more platforms simultaneously help?" />
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={multiData} barCategoryGap="35%">
            <CartesianGrid stroke={BORDER} vertical={false} />
            <XAxis dataKey="label" tick={{fill:TEXT,fontSize:12}} axisLine={false} tickLine={false} />
            <YAxis tick={{fill:TEXT,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v.toFixed(0)}`} />
            <Tooltip contentStyle={TIP_S} formatter={(v) => [`$${Number(v).toFixed(2)}/hr`, "Avg $/hr"]} />
            <Bar dataKey="avgUsdHr" radius={[4,4,0,0]} maxBarSize={70}>
              {multiData.map((m, i) => (
                <Cell key={i} fill={m.label === bestMulti.label && m.sessions > 2 ? CYAN : "rgba(34,211,238,0.35)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ marginTop:10, color:TEXT, fontSize:13 }}>
          Your best setup: <strong style={{color:CYAN}}>{bestMulti.label}</strong>
          {bestMulti.sessions > 2 ? ` — ${fmt$(bestMulti.avgUsdHr)}/hr avg across ${bestMulti.sessions} sessions.` : " — more sessions needed for a reliable comparison."}
        </div>
      </div>

      {/* Monthly growth */}
      <div style={cardS()}>
        <SecHead title="Monthly Earnings" sub="Last 6 months with month-over-month change" />
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={monthData} barCategoryGap="25%">
            <CartesianGrid stroke={BORDER} vertical={false} />
            <XAxis dataKey="month" tick={{fill:TEXT,fontSize:12}} axisLine={false} tickLine={false} />
            <YAxis tick={{fill:TEXT,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
            <Tooltip contentStyle={TIP_S} formatter={(v) => [fmt$(v), "USD"]} />
            <Bar dataKey="usd" radius={[4,4,0,0]} maxBarSize={50}>
              {monthData.map((_, i) => <Cell key={i} fill={i === monthData.length - 1 ? CYAN : "rgba(34,211,238,0.38)"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
          {monthData.map((m) => m.pctChange !== null && (
            <span key={m.month} style={{ padding:"2px 8px",borderRadius:5,fontSize:11,fontWeight:600,background:m.pctChange>=0?"rgba(16,185,129,0.10)":"rgba(248,113,113,0.10)",color:m.pctChange>=0?GREEN:RED }}>
              {m.month} {m.pctChange>=0?"▲":"▼"}{Math.abs(m.pctChange).toFixed(1)}%
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// WHALES TAB
// ═══════════════════════════════════════════════════════════════════════════════

function WhalesTab({ tips }) {
  const whales = useMemo(() => detectWhales(tips), [tips])

  const whaleTonightWindow = useMemo(() => {
    const todayUTCDay = new Date().getUTCDay()
    const active      = whales.filter((w) => w.bestDay === todayUTCDay && w.daysSince < 14)
    if (!active.length) return null
    return { hour: active[0].bestHour, platform: active[0].platform, count: active.length }
  }, [whales])

  const statusOf = (w) => {
    if (w.daysSince < 7)  return { label:"Active",  bg:"rgba(16,185,129,0.10)",  color:GREEN }
    if (w.daysSince < 14) return { label:"At Risk",  bg:"rgba(245,158,11,0.10)",  color:GOLD  }
    return                         { label:"Overdue", bg:"rgba(248,113,113,0.10)", color:RED   }
  }

  const active  = whales.filter((w) => w.daysSince < 7)
  const atRisk  = whales.filter((w) => w.daysSince >= 7 && w.daysSince < 14)
  const overdue = whales.filter((w) => w.daysSince >= 14)

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {whaleTonightWindow && (
        <div style={{ background:"rgba(168,85,247,0.08)", border:"1px solid rgba(168,85,247,0.30)", borderRadius:14, padding:"16px 24px" }}>
          <div style={{color:PURPLE,fontWeight:700,fontSize:14,marginBottom:4}}>🐋 Whale Watch Tonight</div>
          <div style={{color:TEXT,fontSize:13}}>
            <strong style={{color:PRIMARY}}>{whaleTonightWindow.count}</strong> whale{whaleTonightWindow.count!==1?"s":""} historically appear around{" "}
            <strong style={{color:PRIMARY}}>{localHr(whaleTonightWindow.hour)}</strong> on{" "}
            <span style={{color:PLAT_COLORS[whaleTonightWindow.platform]||PURPLE}}>{whaleTonightWindow.platform}</span>.
          </div>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        {[[active.length,"Active Whales",GREEN],[atRisk.length,"At Risk",GOLD],[overdue.length,"Overdue",RED]].map(([v,l,c]) => (
          <div key={l} style={{background:"rgba(255,255,255,0.02)",border:`1px solid ${BORDER}`,borderRadius:12,padding:"14px",textAlign:"center"}}>
            <div style={{color:c,fontSize:28,fontWeight:700}}>{v}</div>
            <div style={{color:MUTED,fontSize:12}}>{l}</div>
          </div>
        ))}
      </div>

      <div style={cardS()}>
        <SecHead title="Whale Roster" sub="Fans with 500+ tokens lifetime" />
        {!whales.length ? (
          <div style={{color:MUTED,fontSize:13,textAlign:"center",padding:"24px 0"}}>No whales detected yet — keep collecting data</div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {whales.map((w, i) => {
              const badge = statusOf(w)
              const color = PLAT_COLORS[w.platform] || PLAT_FB[i % PLAT_FB.length]
              return (
                <div key={w.username} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"rgba(255,255,255,0.02)",border:`1px solid ${BORDER}`,borderRadius:10}}>
                  <div style={{width:32,height:32,borderRadius:8,background:`${color}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>🐋</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:PRIMARY,fontWeight:600,fontSize:13}}>{w.username}</div>
                    <div style={{display:"flex",gap:6,marginTop:3,flexWrap:"wrap",alignItems:"center"}}>
                      <PlatChip name={w.platform} i={i} />
                      <span style={{color:MUTED,fontSize:11}}>Best: {localDay(w.bestDay).slice(0,3)} {localHr(w.bestHour)}</span>
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{color:PRIMARY,fontSize:13,fontWeight:600}}>{fmtK(w.totalTokens)} tkns</div>
                    <div style={{color:MUTED,fontSize:11}}>{fmt$(w.totalUSD)} lifetime</div>
                    <span style={{display:"inline-block",marginTop:3,padding:"2px 7px",borderRadius:4,background:badge.bg,color:badge.color,fontSize:10,fontWeight:600}}>{badge.label} · {w.daysSince}d</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {overdue.length > 0 && (
        <div style={cardS()}>
          <SecHead title="Reactivation Alerts" sub="These fans are past their average return window" />
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {overdue.map((w) => (
              <div key={w.username} style={{padding:"10px 14px",background:"rgba(248,113,113,0.05)",border:"1px solid rgba(248,113,113,0.22)",borderRadius:8}}>
                <span style={{color:RED,fontWeight:600,fontSize:12}}>⚠ </span>
                <span style={{color:TEXT,fontSize:12}}>
                  <strong style={{color:PRIMARY}}>{w.username}</strong>
                  {w.avgReturnDays ? ` usually returns every ~${w.avgReturnDays} days.` : ""}{" "}
                  It's been <strong style={{color:RED}}>{w.daysSince} days</strong> since their last tip.
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function ProgressTab({ tips, windows }) {
  const { planSessions, offSessions, followPct } = useMemo(() => {
    const sessions = groupIntoSessions(tips)
    const plan = sessions.filter((s) => windows.some((w) => w.utcDay === s.utcDay && Math.abs(w.utcHour - s.utcHour) <= 1))
    const off  = sessions.filter((s) => !plan.includes(s))
    return { planSessions: plan, offSessions: off, followPct: sessions.length ? Math.round(plan.length / sessions.length * 100) : 0 }
  }, [tips, windows])

  const avgPlan   = planSessions.length ? planSessions.reduce((n, s) => n + s.usdHr, 0) / planSessions.length : 0
  const avgOff    = offSessions.length  ? offSessions.reduce((n, s) => n + s.usdHr, 0)  / offSessions.length  : 0
  const lift      = avgOff > 0 ? ((avgPlan - avgOff) / avgOff) * 100 : null
  const scoreClr  = followPct >= 70 ? GREEN : followPct >= 40 ? GOLD : RED

  const liftChart = useMemo(() => {
    const sessions = groupIntoSessions(tips)
    const weeks    = {}
    sessions.forEach((s) => {
      const d   = s.start
      const dow = d.getUTCDay()
      const mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - (dow === 0 ? 6 : dow - 1)))
      const k   = mon.toISOString().slice(0, 10)
      if (!weeks[k]) weeks[k] = { plan: [], off: [], ts: mon.getTime() }
      const onPlan = windows.some((w) => w.utcDay === s.utcDay && Math.abs(w.utcHour - s.utcHour) <= 1)
      weeks[k][onPlan ? "plan" : "off"].push(s.usdHr)
    })
    return Object.entries(weeks).sort(([, a], [, b]) => a.ts - b.ts).slice(-8).map(([k, v]) => {
      const [, m, d] = k.split("-")
      return {
        week:       `${MONTHS[parseInt(m) - 1]} ${parseInt(d)}`,
        planAvg:    v.plan.length ? parseFloat((v.plan.reduce((a, b) => a + b, 0) / v.plan.length).toFixed(2)) : null,
        offPlanAvg: v.off.length  ? parseFloat((v.off.reduce((a, b) => a + b, 0)  / v.off.length).toFixed(2))  : null,
      }
    })
  }, [tips, windows])

  const incomeDelta = useMemo(() => {
    const sessions = groupIntoSessions(tips).sort((a, b) => a.start - b.start)
    if (sessions.length < 4) return null
    const cutoff = sessions[0].start.getTime() + 28 * 86_400_000
    const early  = sessions.filter((s) => s.start.getTime() < cutoff)
    const recent = sessions.filter((s) => s.start.getTime() >= cutoff)
    if (!early.length || !recent.length) return null
    const earlyAvg  = early.reduce((n, s) => n + s.usdHr, 0)  / early.length
    const recentAvg = recent.reduce((n, s) => n + s.usdHr, 0) / recent.length
    return earlyAvg > 0 ? ((recentAvg - earlyAvg) / earlyAvg) * 100 : null
  }, [tips])

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      <div style={cardS()}>
        <SecHead title="Plan Follow-Through Score" sub="% of your sessions that fall within recommended windows" />
        <div style={{ display:"flex", alignItems:"center", gap:24, flexWrap:"wrap" }}>
          <div style={{ textAlign:"center", minWidth:80 }}>
            <div style={{ fontSize:52, fontWeight:800, color:scoreClr, lineHeight:1 }}>{followPct}</div>
            <div style={{ color:MUTED, fontSize:12 }}>/ 100</div>
          </div>
          <div style={{ flex:1, display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
            {[[planSessions.length,"On-Plan",GREEN],[offSessions.length,"Off-Plan",RED],[fmt$(avgPlan),"Plan $/hr",CYAN]].map(([v,l,c]) => (
              <div key={l} style={{background:"rgba(255,255,255,0.02)",border:`1px solid ${BORDER}`,borderRadius:10,padding:"12px",textAlign:"center"}}>
                <div style={{color:c,fontSize:18,fontWeight:700}}>{v}</div>
                <div style={{color:MUTED,fontSize:11,marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={cardS()}>
        <SecHead
          title="Earnings Lift"
          sub={lift !== null ? `You earn ${Math.abs(lift).toFixed(1)}% ${lift >= 0 ? "more" : "less"} when following your plan` : "Stream more sessions to see your lift data"}
        />
        {lift !== null && (
          <div style={{ marginBottom:12, display:"inline-flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:8, background:lift>=0?"rgba(16,185,129,0.10)":"rgba(248,113,113,0.10)", border:`1px solid ${lift>=0?"rgba(16,185,129,0.25)":"rgba(248,113,113,0.25)"}`, color:lift>=0?GREEN:RED, fontSize:13, fontWeight:700 }}>
            {lift >= 0 ? "▲" : "▼"} {Math.abs(lift).toFixed(1)}% {lift >= 0 ? "higher" : "lower"} $/hr on-plan
          </div>
        )}
        <ResponsiveContainer width="100%" height={210}>
          <LineChart data={liftChart}>
            <CartesianGrid stroke={BORDER} vertical={false} />
            <XAxis dataKey="week" tick={{fill:TEXT,fontSize:11}} axisLine={false} tickLine={false} />
            <YAxis tick={{fill:TEXT,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
            <Tooltip contentStyle={TIP_S} formatter={(v, k) => [`$${Number(v).toFixed(2)}/hr`, k==="planAvg"?"On-Plan":"Off-Plan"]} />
            <Legend wrapperStyle={{fontSize:12}} formatter={(v) => <span style={{color:v==="planAvg"?CYAN:MUTED}}>{v==="planAvg"?"On-Plan Sessions":"Off-Plan Sessions"}</span>} />
            <Line type="monotone" dataKey="planAvg"    stroke={CYAN}  strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="offPlanAvg" stroke={MUTED} strokeWidth={2} dot={false} strokeDasharray="4 2" connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ ...cardS(), opacity:0.75 }}>
        <SecHead title="Coaching Impact" sub="Full compliance tracking requires live session data" />
        <div style={{ textAlign:"center", padding:"20px 0", color:MUTED, fontSize:13 }}>
          Start following your plan to unlock coaching impact tracking.
          <div style={{ marginTop:8, display:"inline-block", padding:"4px 12px", background:"rgba(99,102,241,0.10)", border:"1px solid rgba(99,102,241,0.25)", borderRadius:6, color:INDIGO, fontSize:11 }}>Coming Soon</div>
        </div>
      </div>

      {incomeDelta !== null && (
        <div style={cardS()}>
          <SecHead title="Income Proof" sub="Your earnings growth since you started using CamCash" />
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ fontSize:36 }}>{incomeDelta >= 0 ? "📈" : "📉"}</div>
            <div>
              <div style={{ color:PRIMARY, fontSize:16, fontWeight:700 }}>
                Your avg $/hr has{" "}
                <span style={{ color:incomeDelta>=0?GREEN:RED }}>
                  {incomeDelta >= 0 ? "increased" : "decreased"} by {Math.abs(incomeDelta).toFixed(1)}%
                </span>
              </div>
              <div style={{ color:MUTED, fontSize:13, marginTop:4 }}>Compared to your first month of recorded data.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// INNER CONTENT (all hooks here so root can early-return cleanly)
// ═══════════════════════════════════════════════════════════════════════════════

function StreamPlannerContent({ tips }) {
  const [tab, setTab] = useState("plan")

  const windows       = useMemo(() => bestWindows(tips),      [tips])
  const untestedSlots = useMemo(() => untestedWindows(tips),  [tips])
  const whales        = useMemo(() => detectWhales(tips),     [tips])

  return (
    <div style={{ background:BG, minHeight:"100%", padding:24 }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ color:PRIMARY, fontSize:20, fontWeight:800, letterSpacing:-0.5 }}>Stream Planner</div>
        <div style={{ color:MUTED, fontSize:13, marginTop:2 }}>Personalized schedule based on your earnings history</div>
      </div>
      <TabBar active={tab} onChange={setTab} />
      {tab === "plan"      && <PlanTab      windows={windows} untestedSlots={untestedSlots} whales={whales} />}
      {tab === "analytics" && <AnalyticsTab tips={tips} />}
      {tab === "whales"    && <WhalesTab    tips={tips} />}
      {tab === "progress"  && <ProgressTab  tips={tips} windows={windows} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export default function StreamPlanner({ tips = [], isPro = false }) {
  if (!isPro) {
    return (
      <div style={{ background:BG, minHeight:"100%", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
        <div style={{ textAlign:"center", padding:"60px 24px" }}>
          <div style={{ fontSize:"40px", marginBottom:"16px" }}>🔒</div>
          <h2 style={{ color:"#f1f5f9", marginBottom:"8px", fontWeight:800, fontSize:22, margin:"0 0 8px" }}>Stream Planner is a Pro Feature</h2>
          <p style={{ color:"#64748b", marginBottom:"24px", lineHeight:1.6, fontSize:14, maxWidth:340, margin:"8px auto 24px" }}>
            Get your personalized streaming schedule, whale watch windows, earnings lift tracking, and more.
          </p>
          <a href="/pricing" style={{ display:"inline-block", background:"linear-gradient(135deg, #22d3ee, #a855f7)", color:"#0a0e1a", fontWeight:"800", padding:"12px 32px", borderRadius:"12px", textDecoration:"none", fontSize:"14px" }}>
            Upgrade to Pro — $9.99/mo →
          </a>
        </div>
      </div>
    )
  }

  if (tips.length < 20) {
    return (
      <div style={{ background:BG, minHeight:"100%", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
        <div style={{ ...cardS(), textAlign:"center", padding:"48px 32px", maxWidth:440 }}>
          <div style={{ fontSize:32, marginBottom:12 }}>📊</div>
          <div style={{ color:PRIMARY, fontSize:16, fontWeight:600, marginBottom:8 }}>Not enough data yet</div>
          <div style={{ color:TEXT, fontSize:13, lineHeight:1.6 }}>
            Upload more streaming data to unlock your personalized plan. We need at least 20 tips to build accurate recommendations.
          </div>
        </div>
      </div>
    )
  }

  return <StreamPlannerContent tips={tips} />
}
