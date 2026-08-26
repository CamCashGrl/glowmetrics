"use client"
import React, { useState, useMemo, useEffect, useCallback } from "react"
import ConfidenceBadge from "./ConfidenceBadge"
import { fromConfidenceTier, badgeFor } from "../../lib/intelligence/states"
import Button from "../../components/ui/Button"
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts"
// Canonical session detection — see the comment above toWeekPlanSession()
// for the full migration note. Do not reintroduce a local session grouping
// function in this file.
import { detectMeaningfulSessions } from "../../lib/analytics/sessions"
import { WHALE_LIFETIME_TOKEN_THRESHOLD } from "../../lib/constants"
import { toLocalDow, toLocalHour, toLocalDateStr } from "../../lib/analytics/localTime"

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

// Pure label formatters — NOT timezone conversions. The utcDay/utcHour
// field names below are kept for minimal blast radius across this file's
// many call sites, but as of the local-time bucketing fix (toWeekPlanSession
// below), the values they hold are already the creator's real local day/hour
// (via toLocalDow/toLocalHour with the canonical creator timezone — see
// lib/timezone.js's resolveCreatorTimezone(), same contract every other
// canonical calculation in this app uses). Previously these functions did a
// SECOND, WRONG conversion here: bucketing happened by literal UTC day/hour,
// then this file re-derived a "local" label using the BROWSER's own runtime
// timezone (via Date.UTC + toLocaleDateString/toLocaleTimeString) instead of
// the creator's saved profile timezone — two different bugs stacked (raw UTC
// bucketing, then a browser-timezone-not-creator-timezone relabel), each of
// which could put tips in the wrong day/hour cell independently, most
// visibly for creators near a UTC day boundary. Since the values are correct
// local day/hour now, formatting them needs no Date/timezone math at all.
const localHr  = (h) => { const n = ((h % 24) + 24) % 24; return n === 0 ? '12 AM' : n < 12 ? `${n} AM` : n === 12 ? '12 PM' : `${n - 12} PM` }
const localDay = (d) => ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][((d % 7) + 7) % 7]
const todayLocalName = (tz) => ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][toLocalDow(new Date().toISOString(), tz)]

// ═══════════════════════════════════════════════════════════════════════════════
// PURE DATA FUNCTIONS (no hooks)
// ═══════════════════════════════════════════════════════════════════════════════

// Session detection is canonical — detectMeaningfulSessions() (imported
// below, from lib/analytics/sessions.js), NOT a second implementation here.
// This fixes the confirmed, approved-as-a-real-conflict discrepancy this
// file previously had: a 4-hour gap with no platform boundary, vs.
// detectSessions()'s 3-hour gap where any platform change starts a new
// session (see canonical-analytics-rules.md's Session Reconciliation). A
// creator who tips-hops between two platforms within 4 hours now correctly
// counts as two sessions here, matching every other surface in the app.
//
// toWeekPlanSession() adapts detectSessions()'s canonical field names
// (startTime/totalUSD/usdPerHour/durationHours) to the {start, end,
// durationHrs, totalUsd, usdHr, utcDay, utcHour} shape this file's existing
// platformEfficiency()/windowsFromCanonical()/rendering code already expects.
//
// utcDay/utcHour field NAMES are kept (renaming every call site in this
// 1000+ line file was more blast radius than the fix needed), but as of the
// best-time reconciliation pass, the VALUES are the creator's real local
// day/hour — toLocalDow()/toLocalHour() with the canonical creator timezone
// (lib/timezone.js's resolveCreatorTimezone(), the same contract every other
// canonical calculation in this app uses), not literal UTC. Previously this
// bucketed by literal UTC day/hour and left it to the display layer
// (localDay()/localHr() above) to relabel — except those functions did the
// relabeling using the BROWSER's own runtime timezone, not the creator's
// saved profile timezone, so a session near a UTC day boundary could land
// in the wrong day/hour cell for reasons having nothing to do with which
// timezone the creator actually streams in. detectWhales() below is fixed
// the same way in the same pass, so its bestUtcDay/bestUtcHour stay
// consistent with this grid's cells for whale-window cross-referencing.
function toWeekPlanSession(s, tz) {
  return {
    start: new Date(s.startTime), end: new Date(s.endTime),
    durationHrs: s.durationHours, totalUsd: s.totalUSD, totalTokens: s.totalTokens,
    usdHr: s.usdPerHour ?? 0,
    utcDay: toLocalDow(s.startTime, tz), utcHour: toLocalHour(s.startTime, tz),
    platform: s.platform, platforms: [s.platform],
    tips: s.tips,
  }
}

// platformEfficiency() REMOVED. It bucketed sessions by day/hour to produce a
// per-platform bestUtcDay/bestUtcHour using the MEAN of session rates — a
// THIRD best-time calculation in this file, on a statistic no other surface
// uses. Nothing ever read those two fields; its only consumer wanted
// "which platform earns most per hour", which analytics.platforms already
// carries canonically (usdPerHour, built once from meaningfulSessions), along
// with a per-platform best window computed by the same
// computeCanonicalBestTimes() the account-wide grid uses.
// Windows come from the CANONICAL grid (lib/analytics/bestTimes.js), not a
// second calculation here.
//
// WHY THIS REPLACED bestWindows(tips, tz)
// That function was an independent answer to "when is my best time", and it
// disagreed with the canonical one in two ways that could put a different
// window at the top of this page than the Command Center recommends:
//
//   - it averaged session rates (MEAN), while canonical uses the MEDIAN, so
//     one exceptional night could carry a window here that the rest of the
//     app does not rank;
//   - its confidence thresholds were different (>=5 high, >=3 medium,
//     >=2 low), so a 3-session bucket read "Medium" here while the canonical
//     tiers call the same bucket 'promising' — explicitly not enough to be
//     labelled a best time anywhere else.
//
// This maps the canonical grid into the row shape the planner UI already
// renders. `avgUsdPerHr` keeps its property name (the grid, the sort, the
// prefs and the whole render path key off it) but now carries the canonical
// MEDIAN — every label that shows it says "median $/hr", so the number and
// its description agree.
const CANON_DAY_INDEX = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
}

// The SAME tier gate canonical bestWindow applies. Everything below
// 'supported' can be shown as something to TEST, never as a recommendation.
//
// This gate is why swapping mean->median was not sufficient on its own. On the
// real regression CSV the highest-median bucket is Wednesday 06:00 at
// $42.09/hr from ONE session (tier 'insufficient') — the exact single-night
// outlier the Command Center's own chart was rebuilt to stop showing. Without
// this filter the planner would head its weekly schedule with that window
// while the Command Center recommends Wednesday 08:00 ($9.52/hr, 4 sessions,
// 'supported'): two surfaces, two different answers to "when should I work".
const RECOMMENDABLE_TIERS = new Set(['supported', 'high'])
export function isRecommendableWindow(w) { return RECOMMENDABLE_TIERS.has(w?.confidence) }

function windowsFromCanonical(canonicalBestTimes) {
  const grid = canonicalBestTimes?.grid || []
  return grid
    .map((g) => ({
      utcDay: CANON_DAY_INDEX[g.localDay],
      utcHour: g.localHour,
      avgUsdPerHr: g.medianUsdPerHour,
      totalUsd: g.totalUsd,
      sessionCount: g.sessionCount,
      confidence: g.tier,
      topPlatform: g.topPlatform,
      newTipperRate: g.newTipperRate ?? 0,
    }))
    .filter((w) => w.utcDay != null)
    .sort((a, b) => b.avgUsdPerHr - a.avgUsdPerHr)
}
// Windows with 0-1 sessions that show promise based on nearby strong windows
function untestedWindows(tips, allWindows) {
  // Mean of the per-window MEDIANS — a rough centre of the grid used only to
  // decide which low-sample windows are worth TESTING. It is never presented
  // as the creator's hourly rate (analytics.estimatedHourlyRate owns that),
  // and never used to rank a recommendation.
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
      out.push({ ...w, reason: `One session here already beat your ${fmt$(overallAvg)}/hr typical window.`, testsNeeded: 2 })
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
          reason: `Right next to your strong ${localHr(s.utcHour)} window (median ${fmt$(s.avgUsdPerHr)}/hr).`,
          testsNeeded: 3,
        })
      }
    }
  })
  return out.slice(0, 5)
}

// Whale = 500+ tokens lifetime. This is a StreamPlanner-local whale
// detection (500+ tokens lifetime, no tier breakdown), distinct from
// lib/analytics.js's identifyWhales() (percentile-ranked Whale/Shark/
// Regular/Dormant tiers) — a genuinely different purpose: this file only
// needs "who counts as worth cross-referencing against the schedule grid,"
// not the full fan-intelligence tiering the Fans tab shows. Flagged for the
// record, not consolidated in this pass — see the repo-wide analytics
// consistency audit's whale-metrics finding.
function detectWhales(tips, tz) {
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
      // Local day/hour (see toWeekPlanSession's comment) — previously
      // getUTCDay()/getUTCHours(), which could disagree with the grid these
      // whale windows get cross-referenced against (whaleKeys below).
      const k = `${toLocalDow(t.date_time, tz)}-${toLocalHour(t.date_time, tz)}`
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
  }).filter((w) => w.totalTokens >= WHALE_LIFETIME_TOKEN_THRESHOLD).sort((a, b) => b.usdValue - a.usdValue)
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

// monthlyTotals() removed — it was defined here but never called by any
// consumer in this file. It duplicated lib/analytics.js's monthlyData
// (which is already creator-local-month bucketed and carries growthPct +
// gapMonths); reviving it would have meant a second monthly aggregation.

// % of tips that fall within recommended windows (±1 hr tolerance).
// recommendedWindows come from windowsFromCanonical() and carry LOCAL day/hour (see
// toWeekPlanSession's comment) — this must bucket tips the same way, or
// every tip would compare against the wrong window near a UTC day boundary.
function planMatchScore(tips, recommendedWindows, tz) {
  if (!tips.length || !recommendedWindows.length) return 0
  const inPlan = tips.filter((t) => {
    const d = toLocalDow(t.date_time, tz), h = toLocalHour(t.date_time, tz)
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
// The CANONICAL confidence tiers (lib/analytics/bestTimes.js), with the same
// wording the Command Center and Performance use. The planner previously had
// its own high/medium/low vocabulary on its own thresholds, so one bucket
// could be "Medium" here and "Early signal" there.
// 2C-2: the local four-label vocabulary is retired. A row's `confidence` is a
// canonical bucket tier (lib/analytics/bestTimes.js), and fromConfidenceTier()
// is the canonical mapper onto the intelligence ladder — so the word this badge
// prints is now the SAME word the Creator Report, the Command Center and
// Performance print for the same strength of evidence.
//
// "untested" is the one value that is not a confidence tier at all: it means
// the creator has never streamed that window, so there is no evidence to grade.
// It keeps a plain neutral chip rather than being forced onto the ladder.
function ConfBadge({ level }) {
  // A row's `confidence` is a canonical bucket tier, so fromConfidenceTier()
  // is the mapper. Anything it cannot place — "untested" (never streamed),
  // "insufficient" (streamed too few times), or an unrecognised value —
  // degrades to this neutral chip. It never falls through to nothing, and it
  // can never degrade upward into a confident word.
  const state = level && level !== "untested" ? fromConfidenceTier(level) : null
  const badge = state ? badgeFor(state) : null
  if (!badge) {
    return <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:5, background:"rgba(99,102,241,0.1)", color:INDIGO, fontSize:11, fontWeight:600, whiteSpace:"nowrap" }}>{level === "untested" ? "Untested" : "Not enough data"}</span>
  }
  return <ConfidenceBadge state={state} showEmoji={false} />
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
  // "Proven peak" uses the SAME tier gate as the schedule itself, rather than
  // a third sample-size threshold of its own — a cell can only be called
  // proven if the window behind it is one the planner would actually
  // recommend. (This was `sessionCount >= 5`, which straddled the canonical
  // 'supported' (4-5) and 'high' (6+) tiers.)
  if (isRecommendableWindow(best) && best.avgUsdPerHr >= q75)  status = "peak"
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

function PlanTab({ tips, windows, whales, prefs, savePrefs, isPro=true, timezone='UTC' }) {
  const [showCustomize, setShow] = useState(false)
  const [whyOpen, setWhyOpen]    = useState(null)

  const hidden = useMemo(() => untestedWindows(tips, windows), [tips, windows])
  // Only tier-qualified windows may be RECOMMENDED. The full `windows` grid is
  // still used for the heatmap and the test finder, where a low-sample bucket
  // is legitimately interesting — it just can't head the schedule.
  const recommendable = useMemo(() => windows.filter(isRecommendableWindow), [windows])

  const whaleKeys = useMemo(() => {
    const m = {}
    whales.forEach((w) => { const k = `${w.bestUtcDay}-${w.bestUtcHour}`; m[k] = (m[k] || 0) + 1 })
    return new Set(Object.entries(m).filter(([, n]) => n >= 2).map(([k]) => k))
  }, [whales])

  // windows[].utcHour is already the creator's real local hour (see
  // toWeekPlanSession's comment) — no further conversion needed here.
  // Previously this ran the hour through a SECOND conversion (localHourOf,
  // now removed), which double-converted an already-local value.
  const blockEnabled = useCallback((hour) => {
    const lh = ((hour % 24) + 24) % 24
    return (
      (prefs.blocks.Morning   && lh >= 6  && lh < 12) ||
      (prefs.blocks.Afternoon && lh >= 12 && lh < 18) ||
      (prefs.blocks.Evening   && lh >= 18 && lh < 23) ||
      (prefs.blocks.LateNight && (lh >= 23 || lh < 6))
    )
  }, [prefs.blocks])

  const weekPlan = useMemo(() => {
    const today = todayLocalName(timezone)
    const mode  = prefs.mode
    return Array.from({ length: 7 }, (_, utcDay) => {
      const dayName = localDay(utcDay)
      if (!prefs.days[dayName]) return { utcDay, dayName, off: true, isToday: dayName === today }
      let cands = recommendable.filter((w) => w.utcDay === utcDay && blockEnabled(w.utcHour))
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
  }, [recommendable, prefs, whaleKeys, hidden, blockEnabled, timezone])

  const tonight = weekPlan.find((d) => d.isToday && !d.off && d.window)

  const whaleTonight = useMemo(() => {
    // Local day-of-week (see toWeekPlanSession's comment) — previously
    // getUTCDay(), which wouldn't reliably match whales[].bestUtcDay (now
    // also local) near a UTC day boundary.
    const todayUTC = toLocalDow(new Date().toISOString(), timezone)
    const active = whales.filter((w) => w.bestUtcDay === todayUTC && w.daysSince < 14)
    return active.length ? { hour: active[0].bestUtcHour, count: active.length } : null
  }, [whales, timezone])

  const sessions       = useMemo(() => detectMeaningfulSessions(tips).map((s) => toWeekPlanSession(s, timezone)), [tips, timezone])
  const avgSessionUsd  = sessions.length ? sessions.reduce((n, s) => n + s.totalUsd, 0) / sessions.length : 0

  const whyReasons = (row) => {
    const w = row.window
    const out = [`${w.sessionCount || "No"} past session${w.sessionCount !== 1 ? "s" : ""} in this window${w.sessionCount ? ` at a median ${fmt$(w.avgUsdPerHr)}/hr` : ""}.`]
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
                  Median <strong style={{ color:CYAN }}>{fmt$(tonight.window.avgUsdPerHr)}/hr</strong> in this window
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
          <div className="planner-week-head" style={{ display:"grid", gridTemplateColumns:"95px 1fr 130px 80px 120px 60px", gap:8, padding:"0 10px", color:MUTED, fontSize:11 }}>
            <span>Day</span><span>Best Window</span><span>Platform</span><span>Median $/hr</span><span>Confidence</span><span/>
          </div>
          {weekPlan.map((row) => (
            <React.Fragment key={row.utcDay}>
              <div className="planner-week-row" style={{ display:"grid", gridTemplateColumns:"95px 1fr 130px 80px 120px 60px", gap:8, alignItems:"center", padding:"10px", borderRadius:8, background:row.isToday ? "rgba(34,211,238,0.04)" : "rgba(255,255,255,0.02)", border:`1px solid ${row.isToday ? "rgba(34,211,238,0.18)" : BORDER}` }}>
                <span style={{ color:row.off ? MUTED : row.isToday ? CYAN : PRIMARY, fontSize:13, fontWeight:600 }}>
                  {row.dayName.slice(0, 3)}{row.isToday ? " 📍" : ""}{row.isWhale ? " 🐋" : ""}
                </span>
                {row.off ? (
                  <span style={{ color:MUTED, fontSize:12, gridColumn:"2/7" }}>Day off</span>
                ) : !isPro && !row.isToday ? (
                  // Was a blurred copy of the real recommendation (hour,
                  // platform, $/hr). Blurring tells the creator nothing except
                  // that something is being kept from them. This states
                  // truthfully whether their history produced a window for
                  // this day — a real, checkable signal — while the hour,
                  // platform and rate stay Pro.
                  <span style={{ color:MUTED, fontSize:12, gridColumn:"2/7" }}>
                    {row.window
                      ? `🔒 CamCash found a window for ${row.dayName} — hour, platform and $/hr with Pro`
                      : "No matching window yet"}
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
        <SecHead title="Opportunity Grid" sub="7 days × 6 time blocks — median $/hr where data exists, in your local time" />
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
                    <div key={utcDay} title={`${UTC_DAYS[utcDay]} ${blk.label} (your local time): ${cell.status}`} style={{ height:36, borderRadius:5, background:st.bg, border:`1px solid ${st.bdr}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
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

function WhalesTab({ tips, whales, timezone='UTC' }) {
  const [sortBy, setSortBy] = useState("value")

  const sorted = useMemo(() => {
    const w = [...whales]
    if (sortBy === "lastSeen") return w.sort((a, b) => a.daysSince - b.daysSince)
    if (sortBy === "status")   return w.sort((a, b) => b.daysSince - a.daysSince)
    return w.sort((a, b) => b.usdValue - a.usdValue)
  }, [whales, sortBy])

  const whaleTonight = useMemo(() => {
    const todayUTC = toLocalDow(new Date().toISOString(), timezone)
    const active = whales.filter((w) => w.bestUtcDay === todayUTC && w.daysSince < 14)
    if (!active.length) return null
    const h = active[0].bestUtcHour
    return { startHr: h, count: active.length }
  }, [whales, timezone])

  // Whale visit frequency per grid cell
  const whaleGrid = useMemo(() => {
    const freq = {}
    let max = 0
    tips.forEach((t) => {
      const tok = parseFloat(t.tokens) || 0
      if (!whales.some((w) => w.username === (t.username || "unknown"))) return
      const k = `${toLocalDow(t.date_time, timezone)}-${Math.floor(toLocalHour(t.date_time, timezone) / 4)}`
      freq[k] = (freq[k] || 0) + 1
      if (freq[k] > max) max = freq[k]
    })
    return { freq, max }
  }, [tips, whales, timezone])

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

function ProgressTab({ tips, windows, prefs, timezone='UTC', analytics=null }) {
  const sessions = useMemo(() => detectMeaningfulSessions(tips).map((s) => toWeekPlanSession(s, timezone)), [tips, timezone])
  // Same tier gate as the plan itself — adherence is measured against what the
  // planner actually recommends, not against every bucket in the grid.
  const topWindows = useMemo(() => windows.filter(isRecommendableWindow).slice(0, 10), [windows])

  const score = useMemo(() => planMatchScore(tips, topWindows, timezone), [tips, topWindows, timezone])

  const breakdown = useMemo(() => {
    // Canonical per-platform $/hr (lib/analytics.js's platforms[]), not a
    // local recomputation.
    const bestPlat = [...(analytics?.platforms || [])]
      .sort((a, b) => (b.usdPerHour || 0) - (a.usdPerHour || 0))[0]?.platform
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
  }, [tips, sessions, score, prefs.testPlan, analytics?.platforms])

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
    // Week buckets run Monday–Sunday in the CREATOR's resolved timezone.
    //
    // This previously derived the week from UTC calendar fields
    // (getUTCDay/getUTCFullYear/getUTCMonth/getUTCDate), so a session late on
    // a local Sunday — which is already Monday in UTC — was pushed into the
    // FOLLOWING week's bucket, and a session early on a local Monday west of
    // UTC fell back into the previous one. Same defect class as the day/hour
    // bucketing fixed elsewhere in this file, just at week granularity.
    //
    // toLocalDateStr gives the session's local calendar date directly; the
    // Monday anchor is then computed with plain arithmetic on that date, so
    // no second timezone conversion is introduced and DST transitions (which
    // shift wall-clock time but never change which local date it is) can't
    // move a session across a week boundary.
    const weeks = {}
    sessions.forEach((s) => {
      const localYmd = toLocalDateStr(s.start.toISOString(), timezone) // YYYY-MM-DD
      const dow = toLocalDow(s.start.toISOString(), timezone)          // 0 = Sunday
      const [y, m, d] = localYmd.split("-").map(Number)
      // Anchor to Monday of this local week (Sunday belongs to the week that
      // began 6 days earlier, matching the Mon–Sun convention above).
      const mon = new Date(Date.UTC(y, m - 1, d - (dow === 0 ? 6 : dow - 1)))
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
  }, [sessions, isOnPlan, timezone])

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

function StreamPlannerContent({ tips, isPro=true, timezone='UTC', analytics=null }) {
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

  const windows = useMemo(() => windowsFromCanonical(analytics?.canonicalBestTimes), [analytics?.canonicalBestTimes])
  const whales  = useMemo(() => detectWhales(tips, timezone), [tips, timezone])

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

      {tab === "plan"     && <PlanTab tips={tips} windows={windows} whales={whales} prefs={prefs} savePrefs={savePrefs} isPro={isPro} timezone={timezone} />}
      {tab === "whales"   && (isPro ? <WhalesTab tips={tips} whales={whales} timezone={timezone} /> : <LockedPlannerTab title="Whale Windows" body="See exactly when your top fans historically show up, so you can be live when they are." />)}
      {tab === "progress" && (isPro ? <ProgressTab tips={tips} windows={windows} prefs={prefs} timezone={timezone} analytics={analytics} /> : <LockedPlannerTab title="Plan Progress" body="Track how closely you're sticking to your recommended schedule over time." />)}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export default function StreamPlanner({ tips = [], isPro = false, timezone = 'UTC', analytics = null }) {
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

  return <StreamPlannerContent tips={tips} isPro={isPro} timezone={timezone} analytics={analytics} />
}
