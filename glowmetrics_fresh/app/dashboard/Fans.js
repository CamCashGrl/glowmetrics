"use client"
import { useEffect, useMemo, useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"

// ═══════════════════════════════════════════════════════════════════════════
// FANS
//
// Answers "who should I pay attention to?" — an action queue, not a CRM table.
// The old tab led with a filterable grid of every supporter; a creator opening
// it had to do the prioritising themselves. This leads with PRIORITY FANS:
// each row states WHY it is on the list and WHAT to do, both derived from
// canonical per-fan fields (lib/analytics.js's identifyWhales()).
//
// Like CommandCenter.js and Performance.js, this component COMPUTES NOTHING
// NEW. It reads canonical fan fields from analytics.whales (identifyWhales())
// and reshapes/filters/sorts that already-canonical array for presentation —
// grouping by platform, grouping firstTipDate by month for the growth chart,
// counting tiers for the composition chart. It does not re-derive rates,
// windows, or any per-fan figure identifyWhales() didn't already compute.
//
// ── FEATURED FANS + FAN CRM (this section) ──────────────────────────────
// Up to 3 featured cards — one per platform on multi-platform accounts,
// otherwise the top 3 overall by lifetime value — always show full Pro
// insight fields (tipping pattern, churn risk, typical hours), on BOTH
// plans. Everyone else lives in the searchable list below. Free creators
// can still search or select any other fan; they get the same real basic
// facts (platform, last seen, first seen, lifetime spend) plus a blurred,
// locked Pro-insight panel — not a vague generic pitch. The list itself is
// pre-filtered to fans actually worth surfacing (loyal, big-tipping, or
// private-buying supporters), per the same "worth acting on" spirit as the
// Priority Fans section below it.
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  bg: "#05070f", card: "#121826", card2: "#161e2e", border: "#1e2d45",
  indigo: "#7C5CFF", cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B",
  green: "#10B981", red: "#F87171", orange: "#FB923C",
  white: "#F1F5F9", text: "#94A3B8", muted: "#475569",
}
const glassCard = {
  background: "rgba(15,20,32,0.75)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)",
}
const CTA_GRADIENT = "linear-gradient(90deg,#22D3EE 0%,#7C5CFF 48%,#EC4899 100%)"
const card = (extra = {}) => ({ ...glassCard, borderRadius: 16, padding: 22, ...extra })
const sectionLabel = { fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text }

const TIER_COLORS = { Whale: C.gold, Shark: "#60A5FA", Regular: C.cyan, Dormant: C.orange }

const fmtUsd = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtUsd0 = (n) => `$${Math.round(Number(n || 0)).toLocaleString("en-US")}`
const fmtHour = (h) => { const H = ((h % 24) + 24) % 24; return H === 0 ? "12 AM" : H < 12 ? `${H} AM` : H === 12 ? "12 PM" : `${H - 12} PM` }
const fmtDays = (d) => (d == null || !Number.isFinite(d) ? "—" : d === 0 ? "today" : d === 1 ? "1 day ago" : d < 30 ? `${d} days ago` : d < 365 ? `${Math.round(d / 30)} mo ago` : `${(d / 365).toFixed(1)} yr ago`)
const daysAgoFromDate = (iso) => {
  if (!iso) return null
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return Number.isFinite(d) ? d : null
}
const fmtMonth = (ym) => { const [y, m] = ym.split("-"); return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" }) }

function BrandButton({ children, onClick, style }) {
  return (
    <button onClick={onClick} style={{
      background: CTA_GRADIENT, border: "none", borderRadius: 12, padding: "13px 24px",
      fontSize: 14.5, fontWeight: 800, color: "#06101A", cursor: "pointer",
      boxShadow: "0 0 20px rgba(34,211,238,0.22), 0 0 30px rgba(236,72,153,0.16)", ...style,
    }}>{children}</button>
  )
}

function MiniStat({ label, value, accent = C.white }) {
  return (
    <div style={{ padding: "8px 10px", borderRadius: 9, background: C.card2, border: `1px solid ${C.border}`, minWidth: 0 }}>
      <div style={{ fontSize: 10, color: C.muted }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: accent, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
    </div>
  )
}

// The exact five lines that make up a fan's "Pro insights" — used both on
// the always-unlocked featured cards and (unlocked or blurred) inside the
// searchable list's detail panel, so the two surfaces can't drift apart.
function ProInsightLines({ fan }) {
  const churnColor = fan.churnRisk?.level === "High" || fan.churnRisk?.level === "Critical"
    ? C.red : fan.churnRisk?.level === "Medium" ? C.gold : fan.churnRisk?.level === "Low" ? C.green : C.muted
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>
      <div>💳 Avg tip <strong style={{ color: C.white }}>{fmtUsd0(fan.avgTipSize)}</strong> · biggest <strong style={{ color: C.white }}>{fmtUsd0(fan.biggestTip)}</strong></div>
      <div>🕐 Usually online <strong style={{ color: C.white }}>{fan.typicalOnlineHours || "Unknown"}</strong>{fan.tipCount >= 3 && <> · tips every ~<strong style={{ color: C.white }}>{Math.round(fan.avgDaysBetweenTips)}d</strong></>}</div>
      <div>⚠️ Churn risk: <strong style={{ color: churnColor }}>{fan.churnRisk?.risk || "Insufficient data"}</strong></div>
      {fan.hasPrivates && <div>🔒 {fan.privateCount} private{fan.privateCount === 1 ? "" : "s"} · {fmtUsd0(fan.privateSpent)} spent</div>}
    </div>
  )
}

function FeaturedFanCard({ fan, onMessage }) {
  const tierColor = TIER_COLORS[fan.tier] || C.cyan
  const firstSeenDays = daysAgoFromDate(fan.firstTipDate)
  return (
    <div style={card({ padding: 18 })}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
          background: `linear-gradient(135deg,${tierColor},${C.indigo})`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, color: C.white,
        }}>{fan.username.slice(0, 1).toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: C.white, overflowWrap: "anywhere" }}>{fan.username}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: `${tierColor}1f`, color: tierColor, border: `1px solid ${tierColor}40` }}>{fan.tier}</span>
          </div>
          {fan.platform && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{fan.platform}</div>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 14 }}>
        <MiniStat label="Lifetime" value={fmtUsd0(fan.totalUSD)} accent={C.green} />
        <MiniStat label="Tips" value={fan.tipCount} />
        <MiniStat label="Last seen" value={fmtDays(fan.daysSinceLastTip)} />
        <MiniStat label="First seen" value={fmtDays(firstSeenDays)} />
      </div>

      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 9 }}>Pro insights</div>
        <ProInsightLines fan={fan} />
      </div>

      <button onClick={() => onMessage?.(fan.username)} style={{
        marginTop: 14, width: "100%", padding: "9px", borderRadius: 9, cursor: "pointer",
        background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, color: C.white, fontSize: 12, fontWeight: 700,
      }}>Message →</button>
    </div>
  )
}

function FanListRow({ fan, onSelect, selected }) {
  return (
    <button onClick={() => onSelect(fan.username)} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 10, cursor: "pointer",
      width: "100%", textAlign: "left", font: "inherit",
      background: selected ? "rgba(34,211,238,0.08)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${selected ? "rgba(34,211,238,0.4)" : C.border}`,
    }}>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: C.white, flex: "1 1 130px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fan.username}</span>
      {fan.platform && <span style={{ fontSize: 11, color: C.muted, flexShrink: 0, whiteSpace: "nowrap" }}>{fan.platform}</span>}
      <span style={{ fontSize: 11, color: C.muted, flexShrink: 0, whiteSpace: "nowrap" }}>seen {fmtDays(fan.daysSinceLastTip)}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: C.green, flexShrink: 0, whiteSpace: "nowrap" }}>{fmtUsd0(fan.totalUSD)}</span>
    </button>
  )
}

function FanDetailPanel({ fan, unlocked, onUpgrade, onClose, onMessage }) {
  const tierColor = TIER_COLORS[fan.tier] || C.cyan
  const firstSeenDays = daysAgoFromDate(fan.firstTipDate)
  return (
    <div style={{ ...card({ padding: 18 }), position: "relative", marginBottom: 14 }}>
      <button onClick={onClose} aria-label="Close" style={{
        position: "absolute", top: 12, right: 12, background: "transparent", border: "none",
        color: C.muted, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 4,
      }}>✕</button>

      <div style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: 24 }}>
        <div style={{
          width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
          background: `linear-gradient(135deg,${tierColor},${C.pink})`,
          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: C.white, fontSize: 16,
        }}>{fan.username.slice(0, 1).toUpperCase()}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.white, overflowWrap: "anywhere" }}>{fan.username}</div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{fan.platform || "Unknown platform"} · {fan.tier}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8, marginTop: 14 }}>
        <MiniStat label="Lifetime" value={fmtUsd0(fan.totalUSD)} accent={C.green} />
        <MiniStat label="Tips" value={fan.tipCount} />
        <MiniStat label="Last seen" value={fmtDays(fan.daysSinceLastTip)} />
        <MiniStat label="First seen" value={fmtDays(firstSeenDays)} />
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 9 }}>Pro insights</div>

        {unlocked ? (
          <ProInsightLines fan={fan} />
        ) : (
          <div style={{ position: "relative", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ filter: "blur(6px)", userSelect: "none", pointerEvents: "none" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>
                <div>💳 Avg tip $XX.XX · biggest $XXX.XX</div>
                <div>🕐 Usually online X PM – X PM · tips every ~Xd</div>
                <div>⚠️ Churn risk: XXXXXXXXX</div>
              </div>
            </div>
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 9,
              background: "linear-gradient(180deg, rgba(11,15,26,0.25), rgba(11,15,26,0.9))",
            }}>
              <div style={{ fontSize: 11.5, color: C.text, fontWeight: 700 }}>🔒 Pro insight — locked</div>
              <BrandButton onClick={() => onUpgrade?.("fans_detail_locked")} style={{ padding: "8px 16px", fontSize: 12 }}>Upgrade to Pro →</BrandButton>
            </div>
          </div>
        )}
      </div>

      <button onClick={() => onMessage?.(fan.username)} style={{
        marginTop: 16, padding: "9px 16px", borderRadius: 9, cursor: "pointer",
        background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, color: C.white, fontSize: 12, fontWeight: 700,
      }}>Message →</button>
    </div>
  )
}

// ── PRIORITY RULES ────────────────────────────────────────────────────────
// Each rule reads canonical fields only and supplies the row's REASON and
// ACTION. Order here IS the priority order; the first matching rule wins, so
// a fan appears exactly once. `rank` breaks ties within a rule by lifetime
// value, so the most valuable fan in a band surfaces first.
//
// Every rule requires tipCount >= 3 before making a timing claim —
// avgDaysBetweenTips from one or two tips is not an interval, and
// calcChurnRisk() itself returns 'Unknown' below 3 tips for the same reason.
const PRIORITY_RULES = [
  {
    id: "best_window",
    label: "In your best window",
    color: C.cyan,
    test: (f, ctx) => f.tipCount >= 3 && ctx.bestWindowUsernames.has(f.username.toLowerCase()),
    reason: (f, ctx) => `Has tipped during ${ctx.bestWindow.localDay}s ${fmtHour(ctx.bestWindow.localHour)} — your strongest earning window`,
    action: "Message before you go live",
  },
  {
    id: "overdue_high_value",
    label: "Overdue",
    color: C.pink,
    test: (f) => f.tipCount >= 3 && f.expectedNextTip === "Overdue",
    reason: (f) => `Usually tips every ~${Math.round(f.avgDaysBetweenTips)}d — last seen ${fmtDays(f.daysSinceLastTip)}`,
    action: "Send a re-engage message",
  },
  {
    id: "returning_soon",
    label: "Returning soon",
    color: C.green,
    test: (f) => f.tipCount >= 3 && (f.expectedNextTip === "Tomorrow" || /^In ~?[1-7] days?$/.test(f.expectedNextTip || "")),
    reason: (f) => `Approaching their usual return window — tips every ~${Math.round(f.avgDaysBetweenTips)}d`,
    action: "Be live when they show up",
  },
  {
    id: "cooling_off",
    label: "Cooling off",
    color: C.orange,
    test: (f) => f.tipCount >= 3 && (f.churnRisk?.level === "High" || f.churnRisk?.level === "Medium"),
    reason: (f) => `High lifetime value, going quiet — ${f.churnRisk.risk.toLowerCase()} at ${fmtDays(f.daysSinceLastTip)}`,
    action: "Check in before they lapse",
  },
  {
    id: "frequent",
    label: "Frequent supporter",
    color: C.indigo,
    test: (f) => f.tipCount >= 10,
    reason: (f) => `${f.tipCount} tips lifetime — one of your most consistent supporters`,
    action: "Keep them warm",
  },
]

function FanRow({ fan, rule, ctx, onMessage }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap", padding: "16px 16px", borderRadius: 12,
      background: C.card2,
      border: `1px solid ${rule.color}33`,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: "50%", background: `linear-gradient(135deg,${rule.color},${C.indigo})`,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800,
        color: C.white, flexShrink: 0,
      }}>{fan.username.slice(0, 1).toUpperCase()}</div>

      <div style={{ flex: "1 1 210px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 5 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.white, overflowWrap: "anywhere" }}>{fan.username}</span>
          <span style={{
            fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap",
            background: `${rule.color}1f`, color: rule.color, border: `1px solid ${rule.color}3d`,
          }}>{rule.label}</span>
        </div>

        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginBottom: 8, overflowWrap: "anywhere" }}>
          {rule.reason(fan, ctx)}
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: C.muted }}>
          <span><strong style={{ color: C.white }}>{fmtUsd0(fan.totalUSD)}</strong> lifetime</span>
          <span><strong style={{ color: C.white }}>{fan.tipCount}</strong> tips</span>
          {fan.tipCount >= 3 && <span>every ~<strong style={{ color: C.white }}>{Math.round(fan.avgDaysBetweenTips)}d</strong></span>}
          {fan.peakLocalHour != null && <span>usually around <strong style={{ color: C.white }}>{fmtHour(fan.peakLocalHour)}</strong></span>}
          <span>last seen <strong style={{ color: C.white }}>{fmtDays(fan.daysSinceLastTip)}</strong></span>
        </div>
      </div>

      <button
        onClick={() => onMessage?.(fan.username)}
        style={{
          flexShrink: 0, padding: "9px 14px", borderRadius: 10, cursor: "pointer",
          background: `${rule.color}1a`, border: `1px solid ${rule.color}40`,
          color: rule.color, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
        }}>{rule.action}</button>
    </div>
  )
}

export default function Fans({
  analytics,
  isPro = false,
  freeFanLimit = 3,
  onMessageFan,
  onUpgrade,
  onPlanStream,
}) {
  const whales = analytics?.whales || []
  const bestWindow = analytics?.canonicalBestTimes?.bestWindow || null
  const overlap = analytics?.bestWindowFanOverlap || null
  const fanCount = analytics?.uniqueFanCount ?? 0
  const dependencyRisk = analytics?.dependencyRisk || null

  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState("all")
  const [selectedFan, setSelectedFan] = useState(null)

  const ctx = useMemo(() => ({
    bestWindow,
    bestWindowUsernames: new Set(overlap?.usernames || []),
  }), [bestWindow, overlap])

  // ── FEATURED FANS ────────────────────────────────────────────────────
  const platformsPresent = useMemo(
    () => Array.from(new Set(whales.map(w => w.platform).filter(Boolean))),
    [whales]
  )

  const featuredFans = useMemo(() => {
    if (platformsPresent.length > 1) {
      return platformsPresent
        .map(p => [...whales].filter(w => w.platform === p).sort((a, b) => b.totalUSD - a.totalUSD)[0])
        .filter(Boolean)
        .sort((a, b) => b.totalUSD - a.totalUSD)
        .slice(0, 3)
    }
    return [...whales].sort((a, b) => b.totalUSD - a.totalUSD).slice(0, 3)
  }, [whales, platformsPresent])

  const featuredUsernames = useMemo(
    () => new Set(featuredFans.map(f => f.username.toLowerCase())),
    [featuredFans]
  )

  // ── FAN CRM LIST ─────────────────────────────────────────────────────
  const qualified = useMemo(
    () => whales.filter(f =>
      !featuredUsernames.has(f.username.toLowerCase()) &&
      (f.tipCount >= 3 || f.totalUSD >= 50 || (f.privateCount || 0) > 1)
    ),
    [whales, featuredUsernames]
  )

  const filterChips = useMemo(() => {
    const base = [
      { id: "all", label: "All" },
      { id: "whales", label: "Whales" },
      { id: "topSpenders", label: "Top spenders" },
      { id: "recent", label: "Recent activity" },
    ]
    if (platformsPresent.length > 1) {
      platformsPresent.forEach(p => base.push({ id: `platform:${p}`, label: p }))
    }
    return base
  }, [platformsPresent])

  const filteredList = useMemo(() => {
    let list = qualified
    if (activeFilter === "whales") list = list.filter(f => f.tier === "Whale")
    else if (activeFilter.startsWith("platform:")) {
      const p = activeFilter.slice("platform:".length)
      list = list.filter(f => f.platform === p)
    }
    if (activeFilter === "recent") return [...list].sort((a, b) => a.daysSinceLastTip - b.daysSinceLastTip)
    return [...list].sort((a, b) => b.totalUSD - a.totalUSD)
  }, [qualified, activeFilter])

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return null
    return whales
      .filter(f => !featuredUsernames.has(f.username.toLowerCase()) && f.username.toLowerCase().includes(q))
      .sort((a, b) => b.totalUSD - a.totalUSD)
  }, [searchQuery, whales, featuredUsernames])

  // Full match set, unbounded — a high-volume account can clear thousands
  // of qualifying fans. Rendering all of them at once (as an earlier version
  // of this list did) mounts that many styled row buttons synchronously and
  // is what actually freezes/crashes the tab on large accounts. PAGE_SIZE +
  // "Show more" below keeps the DOM small regardless of match count, and
  // resets to one page whenever the search or filter changes.
  const fullList = searchResults ?? filteredList
  const PAGE_SIZE = 50
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [searchQuery, activeFilter])
  const listToShow = fullList.slice(0, visibleCount)
  const hasMore = fullList.length > listToShow.length

  const selectedFanObj = useMemo(
    () => (selectedFan ? whales.find(f => f.username === selectedFan) || null : null),
    [selectedFan, whales]
  )
  const handleSelectFan = (username) => setSelectedFan(cur => (cur === username ? null : username))

  const fanGrowthData = useMemo(() => {
    const byMonth = {}
    whales.forEach(f => {
      if (!f.firstTipDate) return
      const d = new Date(f.firstTipDate)
      if (isNaN(d)) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      byMonth[key] = (byMonth[key] || 0) + 1
    })
    return Object.entries(byMonth)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-6)
      .map(([k, v]) => ({ month: fmtMonth(k), newFans: v }))
  }, [whales])

  const qualityMix = useMemo(() => {
    const total = whales.length || 1
    const whaleCt = whales.filter(f => f.tier === "Whale").length
    const loyalCt = whales.filter(f => f.tipCount >= 3).length
    const atRiskCt = whales.filter(f => f.churnRisk?.level === "High" || f.churnRisk?.level === "Critical").length
    return [
      { name: "Whales", pct: Math.round((whaleCt / total) * 100), count: whaleCt, color: C.gold },
      { name: "Loyal (3+ tips)", pct: Math.round((loyalCt / total) * 100), count: loyalCt, color: C.cyan },
      { name: "At risk of churn", pct: Math.round((atRiskCt / total) * 100), count: atRiskCt, color: C.red },
    ]
  }, [whales])

  const platformDist = useMemo(() => {
    if (platformsPresent.length <= 1) return []
    const counts = {}
    whales.forEach(f => { const p = f.platform || "Unknown"; counts[p] = (counts[p] || 0) + 1 })
    const total = whales.length || 1
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([platform, c]) => ({ platform, pct: Math.round((c / total) * 100) }))
  }, [whales, platformsPresent])

  const coldWhale = useMemo(() => {
    if (isPro) return null
    const candidates = whales.filter(f =>
      f.tipCount >= 3 && f.totalUSD > 0 &&
      (f.churnRisk?.level === "High" || f.churnRisk?.level === "Critical")
    )
    if (!candidates.length) return null
    return [...candidates].sort((a, b) => b.totalUSD - a.totalUSD)[0]
  }, [whales, isPro])

  const prioritised = useMemo(() => {
    const out = []
    const claimed = new Set()
    for (const rule of PRIORITY_RULES) {
      const matches = whales
        .filter(f => !claimed.has(f.username.toLowerCase()) && rule.test(f, ctx))
        .sort((a, b) => b.totalUSD - a.totalUSD)
      for (const f of matches) {
        claimed.add(f.username.toLowerCase())
        out.push({ fan: f, rule })
      }
    }
    return out
  }, [whales, ctx])

  const visible = isPro ? prioritised : prioritised.slice(0, freeFanLimit)
  const hidden = isPro ? [] : prioritised.slice(freeFanLimit)

  const hiddenSummary = useMemo(() => {
    if (isPro || hidden.length === 0) return null
    const fans = hidden.map(h => h.fan)
    return {
      count: fans.length,
      lifetimeUSD: fans.reduce((s, f) => s + (f.totalUSD || 0), 0),
      overdue: fans.filter(f => f.expectedNextTip === "Overdue").length,
      inBestWindow: fans.filter(f => ctx.bestWindowUsernames.has(f.username.toLowerCase())).length,
    }
  }, [isPro, hidden, ctx])

  const hasAnyFans = whales.length > 0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <style>{`
        @keyframes fansColdWhalePulse {
          0%   { box-shadow: 0 0 0 0 rgba(248,113,113,0.42); }
          50%  { box-shadow: 0 0 0 9px rgba(248,113,113,0); }
          100% { box-shadow: 0 0 0 0 rgba(248,113,113,0); }
        }
      `}</style>

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: C.white, letterSpacing: "-0.02em" }}>Fans</div>
        <div style={{ fontSize: 13.5, color: C.muted, marginTop: 5 }}>Who deserves your attention, and what to do about it.</div>
      </div>

      {/* ── SNAPSHOT ───────────────────────────────────────────────── */}
      <div style={{ ...card({ padding: "16px 20px" }), display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.white }}>{fanCount.toLocaleString()}</div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>Total supporters</div>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.cyan }}>{prioritised.length.toLocaleString()}</div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>Worth acting on now</div>
        </div>
        {overlap?.count > 0 && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.indigo }}>{overlap.count}</div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>In your best window</div>
          </div>
        )}
        {dependencyRisk && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: dependencyRisk.level === "high" ? C.red : C.gold }}>{dependencyRisk.top1Pct}%</div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>From your top fan</div>
          </div>
        )}
      </div>

      {/* ── FEATURED FANS ─────────────────────────────────────────── */}
      <div>
        <div style={{ ...sectionLabel, marginBottom: 12 }}>
          Top fans{platformsPresent.length > 1 ? " by platform" : ""}
        </div>
        {featuredFans.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {featuredFans.map(f => <FeaturedFanCard key={f.username} fan={f} onMessage={onMessageFan} />)}
          </div>
        ) : (
          <div style={card()}>
            <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6 }}>
              No supporters imported yet. Once you import your tip history, your top fans and their full profiles show up here.
            </div>
          </div>
        )}
      </div>

      {/* ── FAN CHARTS ─────────────────────────────────────────────── */}
      {hasAnyFans && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 14 }}>
          <div style={card({ padding: 18 })}>
            <div style={{ ...sectionLabel, marginBottom: 3 }}>Fan growth</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
              New supporters by month{platformsPresent.length > 1 ? ` · across ${platformsPresent.length} platforms` : ""}
            </div>
            {fanGrowthData.length > 0 ? (
              <div style={{ height: 130 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fanGrowthData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "#121826", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: C.white }}
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    />
                    <Bar dataKey="newFans" name="New fans" radius={[4, 4, 0, 0]} fill={C.cyan} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: C.muted, padding: "20px 0" }}>Not enough history yet to chart fan growth.</div>
            )}
          </div>

          <div style={card({ padding: 18 })}>
            <div style={{ ...sectionLabel, marginBottom: 3 }}>Fan quality mix</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>Share of your {fanCount.toLocaleString()} supporters</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {qualityMix.map(m => (
                <div key={m.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: C.text }}>{m.name}</span>
                    <span style={{ color: C.white, fontWeight: 700 }}>{m.pct}% <span style={{ color: C.muted, fontWeight: 500 }}>({m.count})</span></span>
                  </div>
                  <div style={{ height: 8, borderRadius: 5, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                    <div style={{ width: `${Math.max(m.pct, m.count > 0 ? 3 : 0)}%`, height: "100%", borderRadius: 5, background: m.color }} />
                  </div>
                </div>
              ))}
            </div>
            {platformDist.length > 1 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                {platformDist.map(p => (
                  <span key={p.platform} style={{ fontSize: 10.5, padding: "4px 9px", borderRadius: 20, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, color: C.text }}>
                    {p.platform} {p.pct}%
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── COLD WHALE ALERT (free plan only) ───────────────────────── */}
      {coldWhale && (
        <div style={{
          ...card({ padding: "14px 16px" }),
          borderColor: "rgba(248,113,113,0.4)",
          animation: "fansColdWhalePulse 2.6s ease-in-out infinite",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
              background: "rgba(248,113,113,0.14)", border: "1px solid rgba(248,113,113,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
            }}>🔥</div>
            <div style={{ flex: "1 1 180px", minWidth: 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.red }}>Top spender gone cold</div>
              <div style={{ fontSize: 13.5, color: C.text, marginTop: 3, filter: "blur(5px)", userSelect: "none", fontWeight: 700 }}>{coldWhale.username}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 10.5, color: C.muted }}>Generated</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>{fmtUsd0(coldWhale.totalUSD)}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 10.5, color: C.muted }}>Last seen</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.red }}>{fmtDays(coldWhale.daysSinceLastTip)}</div>
            </div>
            <BrandButton onClick={() => onUpgrade?.("fans_cold_whale")} style={{ padding: "9px 14px", fontSize: 12, flexShrink: 0 }}>Unlock →</BrandButton>
          </div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
            Reconnecting could be worth an estimated <strong style={{ color: C.red }}>{fmtUsd0(coldWhale.lifetimeValue?.monthly)}</strong>/mo, based on their own tipping history — upgrade to see exactly who this is.
          </div>
        </div>
      )}

      {/* ── FIND A FAN ───────────────────────────────────────────────
          Searchable/filterable Fan CRM. Excludes the fans already shown as
          featured cards above (so nobody appears twice), and — outside an
          active search — is pre-filtered to loyal/big-tipping/private-
          buying supporters only, per the same "worth surfacing" bar the
          rest of this tab uses. */}
      <div style={card()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={sectionLabel}>Find a fan</div>
          <div style={{ fontSize: 11.5, color: C.muted }}>
            {fullList.length > 0
              ? `${listToShow.length.toLocaleString()} of ${fullList.length.toLocaleString()} shown`
              : "0 shown"}
          </div>
        </div>

        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by username…"
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 10, marginBottom: 12,
            background: C.card2, border: `1px solid ${C.border}`, color: C.white, fontSize: 13.5, outline: "none",
          }}
        />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {filterChips.map(chip => (
            <button
              key={chip.id}
              onClick={() => setActiveFilter(chip.id)}
              style={{
                padding: "7px 13px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer",
                background: activeFilter === chip.id ? "rgba(34,211,238,0.14)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${activeFilter === chip.id ? "rgba(34,211,238,0.4)" : C.border}`,
                color: activeFilter === chip.id ? C.cyan : C.text,
              }}
            >{chip.label}</button>
          ))}
        </div>

        {selectedFanObj && (
          <FanDetailPanel
            fan={selectedFanObj}
            unlocked={isPro || featuredUsernames.has(selectedFanObj.username.toLowerCase())}
            onUpgrade={onUpgrade}
            onClose={() => setSelectedFan(null)}
            onMessage={onMessageFan}
          />
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {listToShow.length === 0 ? (
            <div style={{ fontSize: 13, color: C.muted, padding: "10px 2px", lineHeight: 1.55 }}>
              {searchQuery
                ? "No fans match that search."
                : "No qualifying fans yet — loyal supporters, big tippers, and repeat private buyers will show up here."}
            </div>
          ) : (
            listToShow.map(f => (
              <FanListRow key={f.username} fan={f} onSelect={handleSelectFan} selected={selectedFan === f.username} />
            ))
          )}
        </div>

        {hasMore && (
          <button
            onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
            style={{
              width: "100%", marginTop: 12, padding: "10px", borderRadius: 10, cursor: "pointer",
              background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, color: C.text, fontSize: 12.5, fontWeight: 700,
            }}
          >
            Show {Math.min(PAGE_SIZE, fullList.length - listToShow.length)} more ({(fullList.length - listToShow.length).toLocaleString()} remaining) →
          </button>
        )}
      </div>

      {/* ── PRIORITY FANS ──────────────────────────────────────────── */}
      <div style={card()}>
        <div style={{ ...sectionLabel, marginBottom: 14 }}>Priority fans</div>

        {!hasAnyFans ? (
          <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6 }}>
            No supporters imported yet. Once you import your tip history, the fans worth messaging show up here first.
          </div>
        ) : visible.length === 0 ? (
          <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6 }}>
            None of your supporters have enough history yet for a timing call — it takes at least 3 tips from someone before their return pattern means anything. Search for anyone specific above.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {visible.map(({ fan, rule }) => (
              <FanRow key={fan.username} fan={fan} rule={rule} ctx={ctx} onMessage={onMessageFan} />
            ))}
          </div>
        )}

        {hiddenSummary && (
          <div style={{
            marginTop: 16, padding: "16px 18px", borderRadius: 12,
            background: "linear-gradient(115deg, rgba(124,92,255,0.10), rgba(236,72,153,0.08))",
            border: "1px solid rgba(124,92,255,0.26)",
          }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: C.white, marginBottom: 6 }}>
              {hiddenSummary.count} more {hiddenSummary.count === 1 ? "fan is" : "fans are"} worth acting on
            </div>
            <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.6, marginBottom: 14 }}>
              They&apos;re worth <strong style={{ color: C.cyan }}>{fmtUsd0(hiddenSummary.lifetimeUSD)}</strong> in lifetime tips
              {hiddenSummary.overdue > 0 && <>, and <strong style={{ color: C.pink }}>{hiddenSummary.overdue}</strong> {hiddenSummary.overdue === 1 ? "is" : "are"} already past their usual return window</>}
              {hiddenSummary.inBestWindow > 0 && <>, with <strong style={{ color: C.cyan }}>{hiddenSummary.inBestWindow}</strong> who {hiddenSummary.inBestWindow === 1 ? "tips" : "tip"} during your best hours</>}.
            </div>
            <BrandButton onClick={() => onUpgrade?.("fans_priority_locked")} style={{ padding: "11px 20px", fontSize: 13.5 }}>
              Find My Highest-Value Fans →
            </BrandButton>
          </div>
        )}
      </div>

      {/* ── BEST-WINDOW OVERLAP ────────────────────────────────────── */}
      {bestWindow && overlap?.count > 0 && (
        <div style={card()}>
          <div style={{ ...sectionLabel, marginBottom: 12 }}>Who shows up in your best window</div>
          <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.6, marginBottom: 14 }}>
            <strong style={{ color: C.white }}>{overlap.count}</strong> of your highest-value supporters tip during{" "}
            <strong style={{ color: C.cyan }}>{bestWindow.localDay}s {fmtHour(bestWindow.localHour)}</strong> — {fmtUsd0(overlap.totalUSD)} in combined lifetime value.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {(overlap.fans || []).map(f => (
              <span key={f.username} style={{
                fontSize: 12, padding: "6px 12px", borderRadius: 20,
                background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.25)", color: C.cyan,
                overflowWrap: "anywhere",
              }}>{f.username} · {fmtUsd0(f.totalUSD)}</span>
            ))}
          </div>
          <button onClick={onPlanStream} style={{
            padding: "10px 16px", borderRadius: 10, cursor: "pointer",
            background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
            color: C.white, fontSize: 12.5, fontWeight: 700,
          }}>Plan a stream in this window →</button>
        </div>
      )}

      {/* ── DEPENDENCY RISK ────────────────────────────────────────── */}
      {dependencyRisk && dependencyRisk.level !== "low" && (
        <div style={card({ border: `1px solid ${dependencyRisk.level === "high" ? "rgba(248,113,113,0.3)" : "rgba(245,158,11,0.3)"}` })}>
          <div style={{ ...sectionLabel, marginBottom: 12 }}>Concentration risk</div>
          <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.6, marginBottom: 14 }}>{dependencyRisk.message}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { label: "Top fan", value: `${dependencyRisk.top1Pct}%` },
              { label: "Top 3", value: `${dependencyRisk.top3Pct}%` },
              { label: "Top 5", value: `${dependencyRisk.top5Pct}%` },
              { label: "If #1 leaves", value: fmtUsd0(dependencyRisk.lossIfTopFanLeaves) },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10.5, color: C.muted }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.white, marginTop: 2 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
