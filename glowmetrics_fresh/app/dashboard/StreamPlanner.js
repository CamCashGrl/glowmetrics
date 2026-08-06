"use client"
import React, { useState, useMemo, useEffect, useCallback } from "react"
import Button from "../../components/ui/Button"
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
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
const FAINT   = "#64748b"
const CYAN    = "#22d3ee"
const PURPLE  = "#a855f7"
const GOLD    = "#f59e0b"
const GREEN   = "#10b981"
const RED     = "#f87171"
const INDIGO  = "#818cf8"
const GRADIENT = "linear-gradient(135deg, #22d3ee, #a855f7)"

const PLAT_COLORS = { Chaturbate: "#22d3ee", BongaCams: "#e879f9", MyFreeCams: "#a855f7" }
const PLAT_FB     = ["#60a5fa", "#34d399", "#fb923c", "#f87171", "#fbbf24"]
const UTC_DAYS    = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
const MONTHS      = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const PREFS_KEY   = "cc_planner_prefs"

const cardS = (x = {}) => ({ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20, ...x })
const fmt$  = (v) => `$${Number(v).toFixed(2)}`
const fmtK  = (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))
const TIP_S = { background: "#0f1726", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", color: PRIMARY, fontSize: 12 }

// UTC hour → local display e.g. "9 PM"
const localHr  = (utcH) => new Date(Date.UTC(2000, 0, 1, ((utcH % 24) + 24) % 24)).toLocaleTimeString([], { hour: "numeric", hour12: true })
// UTC day index → local weekday name (2024-01-07 is a Sunday)
const localDay = (utcD) => new Date(Date.UTC(2024, 0, 7 + utcD)).toLocaleDateString("en-US", { weekday: "long" })
const todayLocalName = () => new Date().toLocaleDateString("en-US", { weekday: "long" })

// ═══════════════════════════════════════════════════════════════════════════════
// PURE DATA FUNCTIONS (no hooks)
// ═══════════════════════════════════════════════════════════════════════════════

// Group tips into sessions — tips within 4hr window = same session
function groupIntoSessions(tips) {
  if (!tips?.length) return []
  const sorted = [...tips].sort((a, b) => new Date(a.date_time) - new Date(b.date_time))
  const raw = []
  let cur = null
  sorted.forEach((t) => {
    const dt = new Date(t.date_time)
    if (!cur || dt - cur.end > 4 * 3_600_000) {
      cur = { start: dt, end: dt, tips: [t] }
      raw.push(cur)
    } else {
      cur.end = dt
      cur.tips.push(t)
    }
  })
  return raw.map((s) => {
    const durationHrs = Math.max(0.5, (s.end - s.start) / 3_600_000)
    const totalUsd    = s.tips.reduce((n, t) => n + (parseFloat(t.usd) || 0), 0)
    const totalTokens = s.tips.reduce((n, t) => n + (parseFloat(t.tokens) || 0), 0)
    const pc = {}
    s.tips.forEach((t) => { if (t.platform) pc[t.platform] = (pc[t.platform] || 0) + 1 })
    return {
      start: s.start, end: s.end, durationHrs, totalUsd, totalTokens,
      usdHr: totalUsd / durationHrs,
      utcDay: s.start.getUTCDay(), utcHour: s.start.getUTCHours(),
      platform:  Object.entries(pc).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      platforms: Object.keys(pc),
      tips: s.tips,
    }
  })
}

// Returns { [platform]: { usdPerHr, tokensPerHr, avgTip, sessionCount, bestUtcDay, bestUtcHour } }
function platformEfficiency(tips) {
  const sessions = groupIntoSessions(tips)
  const acc = {}
  sessions.forEach((s) => {
    if (!s.platform) return
    if (!acc[s.platform]) acc[s.platform] = { usd: 0, tokens: 0, hrs: 0, tipCount: 0, slots: {} }
    const a = acc[s.platform]
    a.usd += s.totalUsd; a.tokens += s.totalTokens; a.hrs += s.durationHrs; a.tipCount += s.tips.length
    const k = `${s.utcDay}-${s.utcHour}`
    if (!a.slots[k]) a.slots[k] = { utcDay: s.utcDay, utcHour: s.utcHour, sum: 0, n: 0 }
    a.slots[k].sum += s.usdHr; a.slots[k].n++
  })
  const out = {}
  Object.entries(acc).forEach(([plat, a]) => {
    const best = Object.values(a.slots).sort((x, y) => y.sum / y.n - x.sum / x.n)[0] ?? null
    out[plat] = {
      usdPerHr:     a.hrs > 0 ? a.usd / a.hrs : 0,
      tokensPerHr:  a.hrs > 0 ? a.tokens / a.hrs : 0,
      avgTip:       a.tipCount > 0 ? a.usd / a.tipCount : 0,
      sessionCount: Object.values(a.slots).reduce((n, s) => n + s.n, 0),
      bestUtcDay:   best?.utcDay ?? null,
      bestUtcHour:  best?.utcHour ?? null,
    }
  })
  return out
}

// Returns [{ utcDay, utcHour, avgUsdPerHr, totalUsd, sessionCount, confidence, topPlatform, newTipperRate }]
function bestWindows(tips) {
  const sessions = groupIntoSessions(tips)
  const firstSeen = {}
  ;[...tips].sort((a, b) => new Date(a.date_time) - new Date(b.date_time)).forEach((t) => {
    const u = t.username || "unknown"
    if (!(u in firstSeen)) firstSeen[u] = new Date(t.date_time).getTime()
  })
  const map = {}
  sessions.forEach((s) => {
    const k = `${s.utcDay}-${s.utcHour}`
    if (!map[k]) map[k] = { utcDay: s.utcDay, utcHour: s.utcHour, sessions: [], pu: {}, newTips: 0, allTips: 0 }
    const m = map[k]
    m.sessions.push(s)
    if (s.platform) m.pu[s.platform] = (m.pu[s.platform] || 0) + s.totalUsd
    s.tips.forEach((t) => {
      m.allTips++
      const u = t.username || "unknown"
      if (firstSeen[u] === new Date(t.date_time).getTime()) m.newTips++
    })
  })
  return Object.values(map).map((m) => {
    const cnt = m.sessions.length
    return {
      utcDay: m.utcDay, utcHour: m.utcHour,
      avgUsdPerHr:   m.sessions.reduce((n, s) => n + s.usdHr, 0) / cnt,
      totalUsd:      m.sessions.reduce((n, s) => n + s.totalUsd, 0),
      sessionCount:  cnt,
      confidence:    cnt >= 5 ? "high" : cnt >= 3 ? "medium" : cnt >= 2 ? "low" : "needs-testing",
      topPlatform:   Object.entries(m.pu).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      newTipperRate: m.allTips > 0 ? m.newTips / m.allTips : 0,
    }
  }).sort((a, b) => b.avgUsdPerHr - a.avgUsdPerHr)
}

// Windows with 0-1 sessions that show promise based on nearby strong windows
function untestedWindows(tips, allWindows) {
  const overallAvg = allWindows.length
    ? allWindows.reduce((n, w) => n + w.avgUsdPerHr, 0) / allWindows.length
    : 0
  const byKey = {}
  allWindows.forEach((w) => { byKey[`${w.utcDay}-${w.utcHour}`] = w })
  const strong = allWindows.filter((w) => w.sessionCount >= 3 && w.avgUsdPerHr >= overallAvg)
  const out = []
  // Under-tested (1 session) with above-average early results
  allWindows.forEach((w) => {
    if (w.sessionCount === 1 && w.avgUsdPerHr > overallAvg) {
      out.push({ ...w, reason: `One session here already beat your ${fmt$(overallAvg)}/hr average.`, testsNeeded: 2 })
    }
  })
  // Untested but adjacent (±1-2 hrs same day) to a strong window
  strong.forEach((s) => {
    for (const dh of [-2, -1, 1, 2]) {
      const h = ((s.utcHour + dh) % 24 + 24) % 24
      const k = `${s.utcDay}-${h}`
      if (!byKey[k] && !out.some((o) => o.utcDay === s.utcDay && o.utcHour === h)) {
        out.push({
          utcDay: s.utcDay, utcHour: h, sessionCount: 0, avgUsdPerHr: 0,
          confidence: "untested", topPlatform: s.topPlatform, newTipperRate: 0,
          reason: `Right next to your strong ${localHr(s.utcHour)} window (${fmt$(s.avgUsdPerHr)}/hr).`,
          testsNeeded: 3,
        })
      }
    }
  })
  return out.slice(0, 5)
}

// Whale = 500+ tokens lifetime
function detectWhales(tips) {
  const byUser = {}
  tips.forEach((t) => {
    const u = t.username || "unknown"
    if (!byUser[u]) byUser[u] = { platform: t.platform, tips: [] }
    byUser[u].tips.push(t)
  })
  return Object.entries(byUser).map(([username, u]) => {
    const totalTokens = u.tips.reduce((n, t) => n + (parseFloat(t.tokens) || 0), 0)
    const usdValue    = u.tips.reduce((n, t) => n + (parseFloat(t.usd) || 0), 0)
    const lastSeen    = new Date(Math.max(...u.tips.map((t) => new Date(t.date_time).getTime())))
    const slots = {}
    u.tips.forEach((t) => {
      const dt = new Date(t.date_time)
      const k  = `${dt.getUTCDay()}-${dt.getUTCHours()}`
      slots[k] = (slots[k] || 0) + 1
    })
    const top      = Object.entries(slots).sort((a, b) => b[1] - a[1])[0]
    const [bd, bh] = top ? top[0].split("-").map(Number) : [0, 0]
    const dates    = u.tips.map((t) => new Date(t.date_time)).sort((a, b) => a - b)
    const avgReturnDays = dates.length >= 2
      ? Math.round(dates.slice(1).reduce((s, d, i) => s + (d - dates[i]) / 86_400_000, 0) / (dates.length - 1))
      : null
    return {
      username, platform: u.platform, totalTokens, usdValue, lastSeen,
      daysSince: Math.floor((Date.now() - lastSeen.getTime()) / 86_400_000),
      bestUtcDay: bd, bestUtcHour: bh, avgReturnDays,
    }
  }).filter((w) => w.totalTokens >= 500).sort((a, b) => b.usdValue - a.usdValue)
}

// Compare avg $/hr for sessions with 1 platform vs 2 vs 3+
function multiStreamAnalysis(sessions) {
  const bins = { 1: [], 2: [], 3: [] }
  sessions.forEach((s) => bins[Math.min(3, Math.max(1, s.platforms.length))].push(s.usdHr))
  return [1, 2, 3].map((n) => ({
    platforms: n,
    label:     n === 3 ? "3+ platforms" : `${n} platform${n > 1 ? "s" : ""}`,
    avgUsdHr:  bins[n].length ? bins[n].reduce((a, b) => a + b, 0) / bins[n].length : 0,
    sessions:  bins[n].length,
  }))
}

// Last 6 months: [{ month, totalUsd, momChange }]
function monthlyTotals(tips) {
  const map = {}
  tips.forEach((t) => {
    const dt = new Date(t.date_time)
    const k  = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`
    map[k]   = (map[k] || 0) + (parseFloat(t.usd) || 0)
  })
  const sorted = Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-6)
  return sorted.map(([k, totalUsd], i) => {
    const prev = i > 0 ? sorted[i - 1][1] : null
    return {
      month:     MONTHS[parseInt(k.split("-")[1]) - 1],
      totalUsd:  parseFloat(totalUsd.toFixed(2)),
      momChange: prev && prev > 0 ? ((totalUsd - prev) / prev) * 100 : null,
    }
  })
}

// % of tips that fall within recommended windows (±1 hr tolerance)
function planMatchScore(tips, recommendedWindows) {
  if (!tips.length || !recommendedWindows.length) return 0
  const inPlan = tips.filter((t) => {
    const dt = new Date(t.date_time)
    const d = dt.getUTCDay(), h = dt.getUTCHours()
    return recommendedWindows.some((w) => w.utcDay === d && Math.abs(w.utcHour - h) <= 1)
  })
  return Math.round((inPlan.length / tips.length) * 100)
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREFERENCES
// ═══════════════════════════════════════════════════════════════════════════════
const DEFAULT_PREFS = {
  days:       { Sunday: true, Monday: true, Tuesday: true, Wednesday: true, Thursday: true, Friday: true, Saturday: true },
  blocks:     { Morning: true, Afternoon: true, Evening: true, LateNight: true },
  maxHrs:     4,
  minSession: "90min",
  mode:       "Max Earnings",
  goal:       "",
  testPlan:   [],   // "utcDay-utcHour" keys added from Hidden Peak Finder
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════════
const CONF = {
  high:            { bg: "rgba(34,211,238,0.1)", color: CYAN,   label: "High" },
  medium:          { bg: "rgba(168,85,247,0.1)", color: PURPLE, label: "Medium" },
  low:             { bg: "rgba(245,158,11,0.1)", color: GOLD,   label: "Low" },
  "needs-testing": { bg: "rgba(99,102,241,0.1)", color: INDIGO, label: "Needs Testing" },
  untested:        { bg: "rgba(99,102,241,0.1)", color: INDIGO, label: "Untested" },
}

function ConfBadge({ level }) {
  const c = CONF[level] || CONF["needs-testing"]
  return <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:5, background:c.bg, color:c.color, fontSize:11, fontWeight:600, whiteSpace:"nowrap" }}>{c.label}</span>
}

function PlatChip({ name, i = 0 }) {
  if (!name) return <span style={{ color:MUTED, fontSize:11 }}>—</span>
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

function Pill({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{ padding:"5px 13px", borderRadius:8, fontSize:12, cursor:"pointer", border:`1px solid ${active?CYAN:BORDER}`, background:active?"rgba(34,211,238,0.10)":"transparent", color:active?CYAN:FAINT, fontWeight:active?700:400, transition:"all 0.15s" }}>
      {children}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIME BLOCKS — 6 blocks × 4 UTC hours covering 24h (labels reflect local mapping)
// ═══════════════════════════════════════════════════════════════════════════════
const GRID_BLOCKS = [
  { id:"OvernightA", label:"12a–4a",  hours:[0,1,2,3]     },
  { id:"EarlyAM",    label:"4a–8a",   hours:[4,5,6,7]     },
  { id:"Morning",    label:"8a–12p",  hours:[8,9,10,11]   },
  { id:"Afternoon",  label:"12p–4p",  hours:[12,13,14,15] },
  { id:"Evening",    label:"4p–8p",   hours:[16,17,18,19] },
  { id:"PrimeTime",  label:"8p–12a",  hours:[20,21,22,23] },
]

const PLAN_MODES = ["💰 Max Earnings","📈 Growth Mode","🐋 Whale Watch","🧪 Testing Mode","🔋 Low Burnout","🚨 Emergency Goal"]
const modeName = (m) => m.replace(/^\S+\s/, "")

// Local-hour of a UTC hour (for availability block filtering)
function localHourOf(utcHour) {
  const parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false })
    .formatToParts(new Date(Date.UTC(2000, 0, 1, utcHour)))
  return parseInt(parts.find((p) => p.type === "hour")?.value ?? "0") % 24
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLAN TAB
// ═══════════════════════════════════════════════════════════════════════════════

function gridCell(windows, whaleKeys, prefs, utcDay, blockHours) {
  const wk = blockHours.some((h) => whaleKeys.has(`${utcDay}-${h}`))
  const matching = windows.filter((w) => w.utcDay === utcDay && blockHours.includes(w.utcHour))
  if (wk) return { status: "whale", avg: matching.length ? Math.max(...matching.map((m) => m.avgUsdPerHr)) : null }
  if (!matching.length) return { status: "untested", avg: null }
  const best = matching.sort((a, b) => b.avgUsdPerHr - a.avgUsdPerHr)[0]
  const all  = windows.map((w) => w.avgUsdPerHr).sort((a, b) => b - a)
  const q75  = all[Math.floor(all.length * 0.25)] ?? 0
  const med  = all[Math.floor(all.length * 0.5)]  ?? 0
  let status
  if (best.sessionCount >= 5 && best.avgUsdPerHr >= q75)       status = "peak"
  else if (best.sessionCount <= 1 && best.avgUsdPerHr >= med)  status = "promising"
  else if (best.sessionCount >= 3 && best.avgUsdPerHr < med * 0.6) status = "weak"
  else if (best.avgUsdPerHr >= med)                            status = "strong"
  else                                                          status = "average"
  return { status, avg: best.avgUsdPerHr }
}

const CELL_STYLE = {
  peak:      { bg:"rgba(34,211,238,0.20)",  bdr:"rgba(34,211,238,0.45)",  txt:CYAN   },
  strong:    { bg:"rgba(16,185,129,0.15)",  bdr:"rgba(16,185,129,0.35)",  txt:GREEN  },
  average:   { bg:"rgba(245,158,11,0.15)",  bdr:"rgba(245,158,11,0.30)",  txt:GOLD   },
  weak:      { bg:"rgba(248,113,113,0.15)", bdr:"rgba(248,113,113,0.30)", txt:RED    },
  untested:  { bg:"rgba(255,255,255,0.05)", bdr:BORDER,                   txt:MUTED  },
  promising: { bg:"rgba(96,165,250,0.15)",  bdr:"rgba(96,165,250,0.35)",  txt:"#60a5fa" },
  whale:     { bg:"rgba(168,85,247,0.15)",  bdr:"rgba(168,85,247,0.35)",  txt:PURPLE },
}

const GRID_LEGEND = [
  ["peak","Proven peak"],["strong","Strong window"],["average","Average"],
  ["weak","Proven weak"],["untested","Untested"],["promising","Under-tested promising"],["whale","Whale window"],
]

function PlanTab({ tips, windows, whales, prefs, savePrefs, isPro=true }) {
  const [showCustomize, setShow] = useState(false)
  const [whyOpen, setWhyOpen]    = useState(null)

  const hidden = useMemo(() => untestedWindows(tips, windows), [tips, windows])

  const whaleKeys = useMemo(() => {
    const m = {}
    whales.forEach((w) => { const k = `${w.bestUtcDay}-${w.bestUtcHour}`; m[k] = (m[k] || 0) + 1 })
    return new Set(Object.entries(m).filter(([, n]) => n >= 2).map(([k]) => k))
  }, [whales])

  const blockEnabled = useCallback((utcHour) => {
    const lh = localHourOf(utcHour)
    return (
      (prefs.blocks.Morning   && lh >= 6  && lh < 12) ||
      (prefs.blocks.Afternoon && lh >= 12 && lh < 18) ||
      (prefs.blocks.Evening   && lh >= 18 && lh < 23) ||
      (prefs.blocks.LateNight && (lh >= 23 || lh < 6))
    )
  }, [prefs.blocks])

  const weekPlan = useMemo(() => {
    const today = todayLocalName()
    const mode  = prefs.mode
    return Array.from({ length: 7 }, (_, utcDay) => {
      const dayName = localDay(utcDay)
      if (!prefs.days[dayName]) return { utcDay, dayName, off: true, isToday: dayName === today }
      let cands = windows.filter((w) => w.utcDay === utcDay && blockEnabled(w.utcHour))
      if (mode === "Growth Mode")        cands = [...cands].sort((a, b) => b.newTipperRate - a.newTipperRate || b.avgUsdPerHr - a.avgUsdPerHr)
      else if (mode === "Whale Watch")   cands = [...cands].sort((a, b) => (whaleKeys.has(`${b.utcDay}-${b.utcHour}`) ? 1 : 0) - (whaleKeys.has(`${a.utcDay}-${a.utcHour}`) ? 1 : 0) || b.avgUsdPerHr - a.avgUsdPerHr)
      else if (mode === "Testing Mode") {
        const t = hidden.filter((h) => h.utcDay === utcDay && blockEnabled(h.utcHour))
        if (t.length) cands = t
        else cands = [...cands].sort((a, b) => a.sessionCount - b.sessionCount || b.avgUsdPerHr - a.avgUsdPerHr)
      }
      else if (mode === "Low Burnout")   cands = [...cands].filter((w) => w.sessionCount >= 3).sort((a, b) => b.avgUsdPerHr - a.avgUsdPerHr)
      else if (mode === "Emergency Goal") cands = [...cands].sort((a, b) => b.totalUsd - a.totalUsd)
      else                                cands = [...cands].sort((a, b) => b.avgUsdPerHr - a.avgUsdPerHr)
      return { utcDay, dayName, off: false, window: cands[0] ?? null, isToday: dayName === today, isWhale: whaleKeys.has(cands[0] ? `${cands[0].utcDay}-${cands[0].utcHour}` : "") }
    })
  }, [windows, prefs, whaleKeys, hidden, blockEnabled])

  const tonight = weekPlan.find((d) => d.isToday && !d.off && d.window)

  const whaleTonight = useMemo(() => {
    const todayUTC = new Date().getUTCDay()
    const active = whales.filter((w) => w.bestUtcDay === todayUTC && w.daysSince < 14)
    return active.length ? { hour: active[0].bestUtcHour, count: active.length } : null
  }, [whales])

  const sessions       = useMemo(() => groupIntoSessions(tips), [tips])
  const avgSessionUsd  = sessions.length ? sessions.reduce((n, s) => n + s.totalUsd, 0) / sessions.length : 0

  const whyReasons = (row) => {
    const w = row.window
    const out = [`${w.sessionCount || "No"} past session${w.sessionCount !== 1 ? "s" : ""} in this window${w.sessionCount ? ` averaging ${fmt$(w.avgUsdPerHr)}/hr` : ""}.`]
    if (w.topPlatform)        out.push(`${w.topPlatform} earned the most here historically.`)
    if (row.isWhale)          out.push(`Two or more of your whales typically appear in this window.`)
    if (w.newTipperRate > 0.3) out.push(`${Math.round(w.newTipperRate * 100)}% of tips here came from first-time fans — good for growth.`)
    return out.slice(0, 3)
  }

  const addToTestPlan = (slot) => {
    const k = `${slot.utcDay}-${slot.utcHour}`
    if (!prefs.testPlan.includes(k)) savePrefs({ ...prefs, testPlan: [...prefs.testPlan, k] })
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* B — Tonight's Brief */}
      {tonight && (
        <div style={{ borderRadius:14, padding:1, background:GRADIENT }}>
          <div style={{ background:"#0d1322", borderRadius:13, padding:"18px 22px" }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:14, flexWrap:"wrap" }}>
              <div style={{ flex:1, minWidth:240 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <span style={{ fontSize:18 }}>⚡</span>
                  <span style={{ color:PRIMARY, fontWeight:800, fontSize:15 }}>
                    Tonight: {localHr(tonight.window.utcHour)}–{localHr(tonight.window.utcHour + 2)} on {tonight.window.topPlatform || "your top platform"}
                  </span>
                  <ConfBadge level={tonight.window.confidence} />
                </div>
                <div style={{ color:TEXT, fontSize:13, lineHeight:1.7 }}>
                  Expected <strong style={{ color:CYAN }}>{fmt$(tonight.window.avgUsdPerHr)}/hr</strong>
                  {" · "}Suggested first goal: <strong style={{ color:PRIMARY }}>{fmt$(Math.max(10, avgSessionUsd * 0.3))}</strong>
                  {" · "}Minimum stay-live: <strong style={{ color:PRIMARY }}>{prefs.minSession === "None" ? "no minimum" : prefs.minSession}</strong>
                </div>
                {whaleTonight && (
                  <div style={{ color:PURPLE, fontSize:12, marginTop:6 }}>
                    🐋 Whale watch: {whaleTonight.count} top fan{whaleTonight.count !== 1 ? "s" : ""} historically appear around {localHr(whaleTonight.hour)}.
                  </div>
                )}
                <div style={{ color:MUTED, fontSize:12, marginTop:6 }}>
                  Stop rule: if under {fmt$(tonight.window.avgUsdPerHr * 0.4)}/hr after 30 minutes with no repeat fans, consider switching.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* A — Availability & Mode Panel */}
      <div style={cardS()}>
        <button onClick={() => setShow((o) => !o)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", background:"none", border:"none", cursor:"pointer", padding:0 }}>
          <div style={{ color:PRIMARY, fontWeight:700, fontSize:15 }}>Customize Your Schedule</div>
          <span style={{ color:MUTED, fontSize:14 }}>{showCustomize ? "▲" : "▼"}</span>
        </button>

        {showCustomize && (
          <div style={{ display:"flex", flexDirection:"column", gap:16, marginTop:16 }}>
            <div>
              <div style={{ color:TEXT, fontSize:12, marginBottom:8 }}>Available days</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {UTC_DAYS.map((d) => (
                  <Pill key={d} active={prefs.days[d]} onClick={() => savePrefs({ ...prefs, days: { ...prefs.days, [d]: !prefs.days[d] } })}>{d.slice(0, 3)}</Pill>
                ))}
              </div>
            </div>
            <div>
              <div style={{ color:TEXT, fontSize:12, marginBottom:8 }}>Time blocks</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {[["Morning","🌅 Morning 6am–12pm"],["Afternoon","☀️ Afternoon 12pm–6pm"],["Evening","🌆 Evening 6pm–11pm"],["LateNight","🌙 Late Night 11pm–4am"]].map(([id, lbl]) => (
                  <Pill key={id} active={prefs.blocks[id]} onClick={() => savePrefs({ ...prefs, blocks: { ...prefs.blocks, [id]: !prefs.blocks[id] } })}>{lbl}</Pill>
                ))}
              </div>
            </div>
            <div>
              <div style={{ color:TEXT, fontSize:12, marginBottom:8 }}>Max hours/day: <strong style={{ color:PRIMARY }}>{prefs.maxHrs}h</strong></div>
              <input type="range" min={1} max={8} value={prefs.maxHrs} onChange={(e) => savePrefs({ ...prefs, maxHrs: +e.target.value })} style={{ width:"100%", maxWidth:320, accentColor:CYAN }} />
            </div>
            <div>
              <div style={{ color:TEXT, fontSize:12, marginBottom:8 }}>Minimum session length</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {["60min","90min","2hr","None"].map((opt) => (
                  <Pill key={opt} active={prefs.minSession === opt} onClick={() => savePrefs({ ...prefs, minSession: opt })}>{opt}</Pill>
                ))}
              </div>
            </div>
            <div>
              <div style={{ color:TEXT, fontSize:12, marginBottom:8 }}>Plan mode</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {PLAN_MODES.map((m) => (
                  <Pill key={m} active={prefs.mode === modeName(m)} onClick={() => savePrefs({ ...prefs, mode: modeName(m) })}>{m}</Pill>
                ))}
              </div>
            </div>
            <div>
              <div style={{ color:TEXT, fontSize:12, marginBottom:8 }}>Weekly income goal (optional)</div>
              <input type="text" placeholder="$500 this week" value={prefs.goal} onChange={(e) => savePrefs({ ...prefs, goal: e.target.value })} style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${BORDER}`, borderRadius:8, padding:"8px 12px", color:PRIMARY, fontSize:13, width:200 }} />
            </div>
          </div>
        )}
      </div>

      {/* C — This Week's Plan */}
      <div style={cardS()}>
        <SecHead title="This Week's Plan" sub={`Mode: ${prefs.mode} — times shown in your local timezone`} />
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          <div style={{ display:"grid", gridTemplateColumns:"95px 1fr 130px 80px 120px 60px", gap:8, padding:"0 10px", color:MUTED, fontSize:11 }}>
            <span>Day</span><span>Best Window</span><span>Platform</span><span>$/hr</span><span>Confidence</span><span/>
          </div>
          {weekPlan.map((row) => (
            <React.Fragment key={row.utcDay}>
              <div style={{ display:"grid", gridTemplateColumns:"95px 1fr 130px 80px 120px 60px", gap:8, alignItems:"center", padding:"10px", borderRadius:8, background:row.isToday ? "rgba(34,211,238,0.04)" : "rgba(255,255,255,0.02)", border:`1px solid ${row.isToday ? "rgba(34,211,238,0.18)" : BORDER}` }}>
                <span style={{ color:row.off ? MUTED : row.isToday ? CYAN : PRIMARY, fontSize:13, fontWeight:600 }}>
                  {row.dayName.slice(0, 3)}{row.isToday ? " 📍" : ""}{row.isWhale ? " 🐋" : ""}
                </span>
                {row.off ? (
                  <span style={{ color:MUTED, fontSize:12, gridColumn:"2/7" }}>Day off</span>
                ) : !isPro && !row.isToday ? (
                  <span style={{ color:MUTED, fontSize:12, gridColumn:"2/7", filter:"blur(3px)", userSelect:"none" }}>
                    {row.window ? `${localHr(row.window.utcHour)}–${localHr(row.window.utcHour + 2)} on ${row.window.topPlatform || "your top platform"} · ${fmt$(row.window.avgUsdPerHr)}/hr` : "No matching window yet"}
                  </span>
                ) : row.window ? (
                  <>
                    <span style={{ color:TEXT, fontSize:12 }}>{localHr(row.window.utcHour)}–{localHr(row.window.utcHour + 2)}</span>
                    <PlatChip name={row.window.topPlatform} />
                    <span style={{ color:PRIMARY, fontSize:13, fontWeight:600 }}>{row.window.sessionCount ? fmt$(row.window.avgUsdPerHr) : "—"}</span>
                    <ConfBadge level={row.window.confidence} />
                    <button onClick={() => setWhyOpen(whyOpen === row.utcDay ? null : row.utcDay)} style={{ background:"none", border:`1px solid ${BORDER}`, borderRadius:6, color:FAINT, fontSize:11, cursor:"pointer", padding:"3px 8px" }}>Why?</button>
                  </>
                ) : (
                  <span style={{ color:MUTED, fontSize:12, gridColumn:"2/7" }}>No matching window — adjust availability or stream this day to collect data</span>
                )}
              </div>
              {whyOpen === row.utcDay && row.window && (
                <div style={{ margin:"0 10px", padding:"10px 14px", background:"rgba(34,211,238,0.04)", border:`1px solid rgba(34,211,238,0.15)`, borderRadius:8 }}>
                  {whyReasons(row).map((r, i) => (
                    <div key={i} style={{ color:TEXT, fontSize:12, lineHeight:1.7 }}>• {r}</div>
                  ))}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
        {!isPro && (
          <div style={{ marginTop:12, textAlign:"center" }}>
            <a href="/pricing" style={{ fontSize:12, color:PURPLE, fontWeight:600, textDecoration:"none" }}>
              ✦ Upgrade to Pro to see your full 7-day plan, not just tonight
            </a>
          </div>
        )}
      </div>

      {/* D — Hidden Peak Finder + E — Opportunity Grid — Pro only. Free's
          "somewhat useful" slice is Tonight's Brief + today's row above;
          these two go deeper into full-week pattern data. */}
      {!isPro ? (
        <div style={{ ...cardS(), textAlign:"center", padding:"32px 24px" }}>
          <div style={{ fontSize:26, marginBottom:8 }}>🔒</div>
          <div style={{ color:TEXT, fontSize:14, fontWeight:700, marginBottom:6 }}>Untested Opportunities &amp; the full Opportunity Grid are Creator Pro features</div>
          <div style={{ color:MUTED, fontSize:12, marginBottom:16 }}>See every day/time block worth testing, not just tonight's window.</div>
          <Button as="a" href="/pricing" style={{ padding:"9px 22px", fontSize:13 }}>Upgrade to Pro</Button>
        </div>
      ) : hidden.length > 0 && (
        <div style={cardS()}>
          <SecHead title="Untested Opportunities" sub="Windows worth testing based on your existing patterns" />
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:10 }}>
            {hidden.map((slot) => {
              const k     = `${slot.utcDay}-${slot.utcHour}`
              const added = prefs.testPlan.includes(k)
              return (
                <div key={k} style={{ background:"rgba(99,102,241,0.05)", border:"1px solid rgba(99,102,241,0.22)", borderRadius:10, padding:14 }}>
                  <div style={{ color:INDIGO, fontWeight:700, fontSize:13, marginBottom:4 }}>
                    🧪 {localDay(slot.utcDay)} {localHr(slot.utcHour)}–{localHr(slot.utcHour + 2)}
                  </div>
                  <div style={{ color:TEXT, fontSize:12, lineHeight:1.6, marginBottom:8 }}>{slot.reason}</div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                      <PlatChip name={slot.topPlatform} />
                      <span style={{ color:MUTED, fontSize:11 }}>Test {slot.testsNeeded} more time{slot.testsNeeded !== 1 ? "s" : ""}</span>
                    </div>
                    <button onClick={() => addToTestPlan(slot)} disabled={added} style={{ padding:"5px 12px", borderRadius:7, fontSize:11, fontWeight:700, cursor:added ? "default" : "pointer", border:"none", background:added ? "rgba(16,185,129,0.15)" : GRADIENT, color:added ? GREEN : "#0a0e1a" }}>
                      {added ? "✓ Added" : "Add to plan"}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* E — Opportunity Grid — Pro only, see the combined lock card above */}
      {isPro && (
      <div style={cardS()}>
        <SecHead title="Opportunity Grid" sub="7 days × 6 time blocks — avg $/hr where data exists" />
        <div style={{ overflowX:"auto" }}>
          <div style={{ minWidth:560 }}>
            <div style={{ display:"grid", gridTemplateColumns:"64px repeat(7,1fr)", gap:3, marginBottom:4 }}>
              <div/>
              {UTC_DAYS.map((d) => <div key={d} style={{ textAlign:"center", fontSize:11, color:MUTED }}>{d.slice(0, 3)}</div>)}
            </div>
            {GRID_BLOCKS.map((blk) => (
              <div key={blk.id} style={{ display:"grid", gridTemplateColumns:"64px repeat(7,1fr)", gap:3, marginBottom:3 }}>
                <div style={{ color:MUTED, fontSize:10, display:"flex", alignItems:"center" }}>{localHr(blk.hours[0])}</div>
                {UTC_DAYS.map((_, utcDay) => {
                  const cell = gridCell(windows, whaleKeys, prefs, utcDay, blk.hours)
                  const st   = CELL_STYLE[cell.status]
                  return (
                    <div key={utcDay} title={`${UTC_DAYS[utcDay]} ${blk.label} UTC: ${cell.status}`} style={{ height:36, borderRadius:5, background:st.bg, border:`1px solid ${st.bdr}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <span style={{ color:st.txt, fontSize:10, fontWeight:600 }}>
                        {cell.avg !== null ? `$${cell.avg.toFixed(0)}` : "—"}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginTop:12 }}>
          {GRID_LEGEND.map(([s, l]) => (
            <span key={s} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:TEXT }}>
              <span style={{ width:10, height:10, borderRadius:2, background:CELL_STYLE[s].bg, border:`1px solid ${CELL_STYLE[s].bdr}`, display:"inline-block" }}/>
              {l}
            </span>
          ))}
        </div>
      </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// WHALES TAB
// ═══════════════════════════════════════════════════════════════════════════════

function WhalesTab({ tips, whales }) {
  const [sortBy, setSortBy] = useState("value")

  const sorted = useMemo(() => {
    const w = [...whales]
    if (sortBy === "lastSeen") return w.sort((a, b) => a.daysSince - b.daysSince)
    if (sortBy === "status")   return w.sort((a, b) => b.daysSince - a.daysSince)
    return w.sort((a, b) => b.usdValue - a.usdValue)
  }, [whales, sortBy])

  const whaleTonight = useMemo(() => {
    const todayUTC = new Date().getUTCDay()
    const active = whales.filter((w) => w.bestUtcDay === todayUTC && w.daysSince < 14)
    if (!active.length) return null
    const h = active[0].bestUtcHour
    return { startHr: h, count: active.length }
  }, [whales])

  // Whale visit frequency per grid cell
  const whaleGrid = useMemo(() => {
    const freq = {}
    let max = 0
    tips.forEach((t) => {
      const tok = parseFloat(t.tokens) || 0
      if (!whales.some((w) => w.username === (t.username || "unknown"))) return
      const dt = new Date(t.date_time)
      const k  = `${dt.getUTCDay()}-${Math.floor(dt.getUTCHours() / 4)}`
      freq[k] = (freq[k] || 0) + 1
      if (freq[k] > max) max = freq[k]
    })
    return { freq, max }
  }, [tips, whales])

  const totalRevenue = tips.reduce((n, t) => n + (parseFloat(t.usd) || 0), 0)
  const top3Share = totalRevenue > 0
    ? sorted.slice(0, 3).reduce((n, w) => n + w.usdValue, 0) / totalRevenue * 100
    : 0

  const overdue = whales.filter((w) => w.avgReturnDays && w.daysSince > w.avgReturnDays && w.daysSince >= 7)

  const statusOf = (w) =>
    w.daysSince < 7  ? { label:"Active",  bg:"rgba(16,185,129,0.10)",  color:GREEN } :
    w.daysSince < 14 ? { label:"At Risk", bg:"rgba(245,158,11,0.10)",  color:GOLD  } :
                       { label:"Overdue", bg:"rgba(248,113,113,0.10)", color:RED   }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {whaleTonight && (
        <div style={{ background:"rgba(168,85,247,0.08)", border:"1px solid rgba(168,85,247,0.30)", borderRadius:14, padding:"16px 22px" }}>
          <div style={{ color:PURPLE, fontWeight:700, fontSize:14, marginBottom:4 }}>🐋 Whale Watch Tonight</div>
          <div style={{ color:TEXT, fontSize:13 }}>
            Your top fans historically appear <strong style={{ color:PRIMARY }}>{localHr(whaleTonight.startHr)}–{localHr(whaleTonight.startHr + 2)}</strong>.{" "}
            Go live by <strong style={{ color:PURPLE }}>{localHr(whaleTonight.startHr - 1)}:30</strong>.
          </div>
        </div>
      )}

      {top3Share > 60 && (
        <div style={{ background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.30)", borderRadius:14, padding:"14px 22px" }}>
          <span style={{ color:GOLD, fontWeight:700, fontSize:13 }}>⚠ High whale dependency — </span>
          <span style={{ color:TEXT, fontSize:13 }}>
            {top3Share.toFixed(0)}% of your revenue came from {Math.min(3, sorted.length)} fans. Focus on growing your regular fan base.
          </span>
        </div>
      )}

      <div style={cardS()}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
          <SecHead title="Whale Roster" sub="Fans with 500+ tokens lifetime" />
          <div style={{ display:"flex", gap:4 }}>
            {[["value","Value"],["lastSeen","Last Seen"],["status","Status"]].map(([id, lbl]) => (
              <Pill key={id} active={sortBy === id} onClick={() => setSortBy(id)}>{lbl}</Pill>
            ))}
          </div>
        </div>
        {!sorted.length ? (
          <div style={{ color:MUTED, fontSize:13, textAlign:"center", padding:"24px 0" }}>No whales detected yet — keep collecting data</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {sorted.map((w, i) => {
              const badge = statusOf(w)
              const color = PLAT_COLORS[w.platform] || PLAT_FB[i % PLAT_FB.length]
              return (
                <div key={w.username} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:"rgba(255,255,255,0.02)", border:`1px solid ${BORDER}`, borderRadius:10 }}>
                  <div style={{ width:32, height:32, borderRadius:8, background:`${color}20`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>🐋</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:PRIMARY, fontWeight:600, fontSize:13 }}>{w.username}</div>
                    <div style={{ display:"flex", gap:6, marginTop:3, flexWrap:"wrap", alignItems:"center" }}>
                      <PlatChip name={w.platform} i={i} />
                      <span style={{ color:MUTED, fontSize:11 }}>
                        Appears: {localDay(w.bestUtcDay).slice(0, 3)} {localHr(w.bestUtcHour)}–{localHr(w.bestUtcHour + 2)}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ color:PRIMARY, fontSize:13, fontWeight:600 }}>{fmtK(w.totalTokens)} tokens</div>
                    <div style={{ color:MUTED, fontSize:11 }}>{fmt$(w.usdValue)} lifetime</div>
                    <span style={{ display:"inline-block", marginTop:3, padding:"2px 7px", borderRadius:4, background:badge.bg, color:badge.color, fontSize:10, fontWeight:600 }}>
                      {badge.label} · {w.daysSince}d
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={cardS()}>
        <SecHead title="When Your Biggest Fans Show Up" sub="Whale tip frequency by day and time block" />
        <div style={{ overflowX:"auto" }}>
          <div style={{ minWidth:560 }}>
            <div style={{ display:"grid", gridTemplateColumns:"64px repeat(7,1fr)", gap:3, marginBottom:4 }}>
              <div/>
              {UTC_DAYS.map((d) => <div key={d} style={{ textAlign:"center", fontSize:11, color:MUTED }}>{d.slice(0, 3)}</div>)}
            </div>
            {GRID_BLOCKS.map((blk, bi) => (
              <div key={blk.id} style={{ display:"grid", gridTemplateColumns:"64px repeat(7,1fr)", gap:3, marginBottom:3 }}>
                <div style={{ color:MUTED, fontSize:10, display:"flex", alignItems:"center" }}>{localHr(blk.hours[0])}</div>
                {UTC_DAYS.map((_, utcDay) => {
                  const n = whaleGrid.freq[`${utcDay}-${bi}`] || 0
                  const t = whaleGrid.max ? n / whaleGrid.max : 0
                  return (
                    <div key={utcDay} title={n ? `${n} whale tip${n !== 1 ? "s" : ""}` : "No whale activity"} style={{ height:28, borderRadius:5, background:n ? `rgba(168,85,247,${(0.08 + t * 0.5).toFixed(2)})` : "rgba(255,255,255,0.03)", border:`1px solid ${n ? "rgba(168,85,247,0.3)" : BORDER}` }}/>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {overdue.length > 0 && (
        <div style={cardS()}>
          <SecHead title="Overdue Fans" sub="Past their usual return window — worth a re-engagement push" />
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {overdue.map((w) => (
              <div key={w.username} style={{ padding:"10px 14px", background:"rgba(248,113,113,0.05)", border:"1px solid rgba(248,113,113,0.22)", borderRadius:8 }}>
                <div style={{ color:TEXT, fontSize:12, lineHeight:1.6 }}>
                  <strong style={{ color:PRIMARY }}>{w.username}</strong> usually returns every ~{w.avgReturnDays} days. Last seen <strong style={{ color:RED }}>{w.daysSince} days ago</strong>.
                </div>
                <div style={{ color:MUTED, fontSize:11, marginTop:3 }}>💡 Consider a comeback-style title tonight</div>
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

function ProgressTab({ tips, windows, prefs }) {
  const sessions = useMemo(() => groupIntoSessions(tips), [tips])
  const topWindows = useMemo(() => windows.filter((w) => w.sessionCount >= 2).slice(0, 10), [windows])

  const score = useMemo(() => planMatchScore(tips, topWindows), [tips, topWindows])

  const breakdown = useMemo(() => {
    const platEff   = platformEfficiency(tips)
    const bestPlat  = Object.entries(platEff).sort((a, b) => b[1].usdPerHr - a[1].usdPerHr)[0]?.[0]
    const platPct   = bestPlat && tips.length
      ? Math.round(tips.filter((t) => t.platform === bestPlat).length / tips.length * 100)
      : 0
    const testedPct = prefs.testPlan.length
      ? Math.round(prefs.testPlan.filter((k) => {
          const [d, h] = k.split("-").map(Number)
          return sessions.some((s) => s.utcDay === d && Math.abs(s.utcHour - h) <= 1)
        }).length / prefs.testPlan.length * 100)
      : 0
    return { windowPct: score, platPct, testedPct }
  }, [tips, sessions, score, prefs.testPlan])

  const isOnPlan = useCallback((s) => topWindows.some((w) => w.utcDay === s.utcDay && Math.abs(w.utcHour - s.utcHour) <= 1), [topWindows])

  const onPlanSessions  = useMemo(() => sessions.filter(isOnPlan), [sessions, isOnPlan])
  const offPlanSessions = useMemo(() => sessions.filter((s) => !isOnPlan(s)), [sessions, isOnPlan])
  const avgOn  = onPlanSessions.length  ? onPlanSessions.reduce((n, s) => n + s.usdHr, 0)  / onPlanSessions.length  : 0
  const avgOff = offPlanSessions.length ? offPlanSessions.reduce((n, s) => n + s.usdHr, 0) / offPlanSessions.length : 0
  const lift   = avgOff > 0 ? ((avgOn - avgOff) / avgOff) * 100 : null

  const dataSpanWeeks = useMemo(() => {
    if (sessions.length < 2) return 0
    return (sessions[sessions.length - 1].start - sessions[0].start) / (7 * 86_400_000)
  }, [sessions])

  const liftChart = useMemo(() => {
    const weeks = {}
    sessions.forEach((s) => {
      const d   = s.start
      const dow = d.getUTCDay()
      const mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - (dow === 0 ? 6 : dow - 1)))
      const k   = mon.toISOString().slice(0, 10)
      if (!weeks[k]) weeks[k] = { on: [], off: [], ts: mon.getTime() }
      weeks[k][isOnPlan(s) ? "on" : "off"].push(s.usdHr)
    })
    return Object.entries(weeks).sort(([, a], [, b]) => a.ts - b.ts).slice(-8).map(([k, v]) => {
      const [, m, d] = k.split("-")
      return {
        week:   `${MONTHS[parseInt(m) - 1]} ${parseInt(d)}`,
        onPlan:  v.on.length  ? parseFloat((v.on.reduce((a, b) => a + b, 0)  / v.on.length).toFixed(2))  : null,
        offPlan: v.off.length ? parseFloat((v.off.reduce((a, b) => a + b, 0) / v.off.length).toFixed(2)) : null,
      }
    })
  }, [sessions, isOnPlan])

  const missed = useMemo(() => {
    const out = []
    const weekAgo = Date.now() - 7 * 86_400_000
    const recentSessions = sessions.filter((s) => s.start.getTime() > weekAgo)
    const top = topWindows[0]
    if (top) {
      const hits = recentSessions.filter((s) => s.utcDay === top.utcDay && Math.abs(s.utcHour - top.utcHour) <= 1).length
      if (hits === 0) {
        out.push(`You missed your top ${top.topPlatform || ""} window (${localDay(top.utcDay)} ${localHr(top.utcHour)}) this week.`)
      }
    }
    const offRecent = recentSessions.filter((s) => !isOnPlan(s))
    if (offRecent.length) {
      const hrs = offRecent.reduce((n, s) => n + s.durationHrs, 0)
      const avg = offRecent.reduce((n, s) => n + s.totalUsd, 0) / hrs
      out.push(`You went live outside recommended windows for ${hrs.toFixed(1)} hours this week at ${fmt$(avg)}/hr avg.`)
    }
    return out
  }, [sessions, topWindows, isOnPlan])

  const scoreClr = score >= 70 ? GREEN : score >= 40 ? GOLD : RED

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      <div style={cardS()}>
        <SecHead title="Plan Follow-Through Score" sub="How closely your actual streaming matches your recommended plan" />
        <div style={{ display:"flex", alignItems:"center", gap:24, flexWrap:"wrap" }}>
          <div style={{ textAlign:"center", minWidth:90 }}>
            <div style={{ fontSize:52, fontWeight:800, color:scoreClr, lineHeight:1 }}>{score}</div>
            <div style={{ color:MUTED, fontSize:12 }}>/ 100</div>
          </div>
          <div style={{ flex:1, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:10, minWidth:240 }}>
            {[
              [`${breakdown.windowPct}%`, "Streamed recommended windows"],
              [`${breakdown.platPct}%`,   "Used recommended platforms"],
              [`${breakdown.testedPct}%`, "Tested hidden windows"],
            ].map(([v, l]) => (
              <div key={l} style={{ background:"rgba(255,255,255,0.02)", border:`1px solid ${BORDER}`, borderRadius:10, padding:"12px", textAlign:"center" }}>
                <div style={{ color:CYAN, fontSize:18, fontWeight:700 }}>{v}</div>
                <div style={{ color:MUTED, fontSize:11, marginTop:2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={cardS()}>
        <SecHead title="Earnings Lift" sub="On-plan vs off-plan $/hr over the last 8 weeks" />
        {dataSpanWeeks < 4 ? (
          <div style={{ color:MUTED, fontSize:13, textAlign:"center", padding:"30px 0" }}>
            Stream 4+ weeks to unlock earnings lift tracking
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={liftChart}>
                <CartesianGrid stroke={BORDER} vertical={false} />
                <XAxis dataKey="week" tick={{ fill:TEXT, fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:TEXT, fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={TIP_S} formatter={(v, k) => [`$${Number(v).toFixed(2)}/hr`, k === "onPlan" ? "On-plan" : "Off-plan"]} />
                <Legend wrapperStyle={{ fontSize:12 }} formatter={(v) => <span style={{ color:v === "onPlan" ? CYAN : MUTED }}>{v === "onPlan" ? "On-plan sessions" : "Off-plan sessions"}</span>} />
                <Line type="monotone" dataKey="onPlan"  stroke={CYAN}  strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="offPlan" stroke={MUTED} strokeWidth={2} dot={false} strokeDasharray="4 2" connectNulls />
              </LineChart>
            </ResponsiveContainer>
            {lift !== null && (
              <div style={{ marginTop:10, padding:"8px 14px", display:"inline-block", borderRadius:8, background:lift >= 0 ? "rgba(16,185,129,0.10)" : "rgba(248,113,113,0.10)", border:`1px solid ${lift >= 0 ? "rgba(16,185,129,0.25)" : "rgba(248,113,113,0.25)"}`, color:lift >= 0 ? GREEN : RED, fontSize:13, fontWeight:700 }}>
                You earn {Math.abs(lift).toFixed(0)}% {lift >= 0 ? "more" : "less"} per hour when following your plan
              </div>
            )}
          </>
        )}
      </div>

      {missed.length > 0 && (
        <div style={cardS()}>
          <SecHead title="Missed Opportunities" sub="This week's gaps between plan and reality" />
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {missed.map((m, i) => (
              <div key={i} style={{ padding:"10px 14px", background:"rgba(245,158,11,0.05)", border:"1px solid rgba(245,158,11,0.22)", borderRadius:8, color:TEXT, fontSize:12, lineHeight:1.6 }}>
                ⚠ {m}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// INNER CONTENT — all hooks live here so root can early-return
// ═══════════════════════════════════════════════════════════════════════════════

const TABS = [{ id:"plan", label:"Plan" }, { id:"whales", label:"Whales" }, { id:"progress", label:"Progress" }]

// Whales/Progress stay Pro-only — free's "somewhat useful" slice on this
// tool is Tonight's Brief + today's row in the Plan tab (see PlanTab).
function LockedPlannerTab({ title, body }) {
  return (
    <div style={{ ...cardS(), textAlign:"center", padding:"48px 32px" }}>
      <div style={{ fontSize:32, marginBottom:12 }}>🔒</div>
      <div style={{ color:PRIMARY, fontSize:16, fontWeight:700, marginBottom:8 }}>{title} is a Creator Pro feature</div>
      <div style={{ color:TEXT, fontSize:13, lineHeight:1.6, marginBottom:20 }}>{body}</div>
      <Button as="a" href="/pricing" style={{ padding:"10px 24px", fontSize:14 }}>Upgrade to Pro</Button>
    </div>
  )
}

function StreamPlannerContent({ tips, isPro=true }) {
  const [tab, setTab]   = useState("plan")
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY)
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) })
    } catch {}
  }, [])

  const savePrefs = useCallback((next) => {
    setPrefs(next)
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)) } catch {}
  }, [])

  const windows = useMemo(() => bestWindows(tips),  [tips])
  const whales  = useMemo(() => detectWhales(tips), [tips])

  return (
    <div style={{ background:BG, minHeight:"100%", padding:24 }}>
      <div style={{ marginBottom:18 }}>
        <div style={{ color:PRIMARY, fontSize:20, fontWeight:800, letterSpacing:-0.5 }}>Stream Planner</div>
        <div style={{ color:MUTED, fontSize:13, marginTop:2 }}>What should I do next? Personalized from your earnings history.</div>
      </div>

      <div style={{ display:"flex", borderBottom:`1px solid ${BORDER}`, marginBottom:24 }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:"10px 20px", background:"none", border:"none", cursor:"pointer", fontSize:14, color:tab === t.id ? PRIMARY : FAINT, fontWeight:tab === t.id ? 700 : 400, borderBottom:tab === t.id ? `2px solid ${CYAN}` : "2px solid transparent", marginBottom:-1, transition:"all 0.15s" }}>
            {!isPro && t.id !== "plan" ? `🔒 ${t.label}` : t.label}
          </button>
        ))}
      </div>

      {tab === "plan"     && <PlanTab tips={tips} windows={windows} whales={whales} prefs={prefs} savePrefs={savePrefs} isPro={isPro} />}
      {tab === "whales"   && (isPro ? <WhalesTab tips={tips} whales={whales} /> : <LockedPlannerTab title="Whale Windows" body="See exactly when your top fans historically show up, so you can be live when they are." />)}
      {tab === "progress" && (isPro ? <ProgressTab tips={tips} windows={windows} prefs={prefs} /> : <LockedPlannerTab title="Plan Progress" body="Track how closely you're sticking to your recommended schedule over time." />)}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export default function StreamPlanner({ tips = [], isPro = false }) {
  if (tips.length < 20) {
    return (
      <div style={{ background:BG, minHeight:"100%", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
        <div style={{ ...cardS(), textAlign:"center", padding:"48px 32px", maxWidth:440 }}>
          <div style={{ fontSize:32, marginBottom:12 }}>📊</div>
          <div style={{ color:PRIMARY, fontSize:16, fontWeight:600, marginBottom:8 }}>Not enough data yet</div>
          <div style={{ color:TEXT, fontSize:13, lineHeight:1.6 }}>
            Upload more streaming data to unlock your plan. We need at least 20 tips to build accurate recommendations.
          </div>
        </div>
      </div>
    )
  }

  return <StreamPlannerContent tips={tips} isPro={isPro} />
}
