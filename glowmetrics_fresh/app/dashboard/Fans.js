"use client"
import { useMemo, useState } from "react"
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { calcFanScore } from "../../lib/analytics"
import FanProfileDrawer from "./FanProfileDrawer"

// ═══════════════════════════════════════════════════════════════════════════
// FANS — Fan Intelligence
//
// "Which fans matter most right now, what are they doing, and where might
// I be gaining or losing money?" Section order (top of file to bottom of
// render) matches the product hierarchy this was built against:
//   1. Top 3 Fan Profile Cards        — "my most valuable relationships"
//   2. Fan Growth + Engagement charts — "is my fan base growing/engaged"
//   3. Fan Composition                — "what makes up my audience"
//   4. Dependency Risk conversion     — "am I overly dependent on one fan"
//   5. Fan Intelligence List          — "who should I pay attention to"
//
// Like CommandCenter.js and the original Fans.js, this component computes
// as little as possible itself. Every number comes from lib/analytics.js's
// identifyWhales()/dependencyRisk/fanComposition/fanGrowthSeries/
// fanEngagementTrend — this file only selects, labels, sorts, paginates,
// and gates by isPro. calcFanScore is the one exception: it's an explicit
// re-weighting for SORTING/BADGING only (see its doc comment in
// lib/analytics.js), never presented as a canonical dollar/percentage.
//
// SIMPLIFICATION NOTE (documented, not hidden): there is no per-fan
// "trending" signal anywhere in the data model — identifyWhales() has no
// time-series per fan, only lifetime aggregates. A "🔥 Trending" badge
// would have to be fabricated, so it is intentionally NOT one of the
// status badges below. Every badge here is derived from a real canonical
// field (tier, churnRisk, tipCount).
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  bg: "#05070f", card: "#121826", card2: "#161e2e", border: "#1e2d45",
  indigo: "#7C5CFF", cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B",
  green: "#10B981", red: "#F87171", orange: "#FB923C",
  white: "#F1F5F9", text: "#94A3B8", muted: "#475569",
}
const glassCard = { background: "rgba(15,20,32,0.75)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }
const CTA_GRADIENT = "linear-gradient(90deg,#22D3EE 0%,#7C5CFF 48%,#EC4899 100%)"
// Same soft glow language as CommandCenter.js's "Your next best move" hero
// (HERO_GRADIENT + the blurred radial blob behind it) — reused here, not
// reinvented, for the one badge closest to a real "this fan is heating up"
// signal: Shark tier (the rung directly below Whale). This is a visual
// emphasis on an already-real classification, not a new "trending" metric —
// there is still no per-fan time series to back an actual trend claim.
const GLOW_GRADIENT = "linear-gradient(120deg, rgba(34,211,238,0.10) 0%, rgba(124,92,255,0.12) 46%, rgba(236,72,153,0.10) 100%)"
function GlowBlob() {
  return <div style={{ position: "absolute", right: -50, top: -50, width: 200, height: 200, borderRadius: "50%", background: "rgba(124,92,255,0.14)", filter: "blur(60px)", pointerEvents: "none" }} />
}
const card = (extra = {}) => ({ ...glassCard, borderRadius: 16, padding: 22, ...extra })
const sectionLabel = { fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text }

const fmtUsd = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtUsd0 = (n) => `$${Math.round(Number(n || 0)).toLocaleString("en-US")}`
const fmtDays = (d) => (d == null ? "—" : d === 0 ? "today" : d === 1 ? "1 day ago" : d < 30 ? `${d} days ago` : d < 365 ? `${Math.round(d / 30)} mo ago` : `${(d / 365).toFixed(1)} yr ago`)
const monthLabel = (ym) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }) }

const PLATFORMS = ["Chaturbate", "BongaCams", "MyFreeCams", "Stripchat", "CamSoda"]

function BrandButton({ children, onClick, style }) {
  return (
    <button onClick={onClick} style={{
      background: CTA_GRADIENT, border: "none", borderRadius: 12, padding: "13px 24px",
      fontSize: 14.5, fontWeight: 800, color: "#06101A", cursor: "pointer",
      boxShadow: "0 0 20px rgba(34,211,238,0.22), 0 0 30px rgba(236,72,153,0.16)", ...style,
    }}>{children}</button>
  )
}

// ── STATUS BADGES ─────────────────────────────────────────────────────────
// First matching rule wins — one badge per fan, all from canonical fields
// (identifyWhales()'s tier/churnRisk/tipCount). No rule here claims a trend
// that isn't backed by a real computed field.
const STATUS_RULES = [
  { test: (f) => f.churnRisk?.level === "Critical", badge: { emoji: "🔴", label: "Churning", color: C.red } },
  { test: (f) => f.churnRisk?.level === "High", badge: { emoji: "🟡", label: "At Risk", color: C.gold } },
  { test: (f) => f.tier === "Whale" && f.churnRisk?.level === "Low", badge: { emoji: "🟢", label: "Loyal Fan", color: C.green } },
  { test: (f) => f.tier === "Shark", badge: { emoji: "🟣", label: "Potential Whale", color: C.indigo } },
  { test: (f) => f.tipCount >= 10, badge: { emoji: "🔵", label: "Frequent Tipper", color: C.cyan } },
  { test: (f) => f.churnRisk?.level === "Low", badge: { emoji: "🟢", label: "Active Fan", color: C.green } },
]
function statusBadgeFor(fan) {
  for (const rule of STATUS_RULES) if (rule.test(fan)) return rule.badge
  return { emoji: "⚪", label: "New", color: C.muted }
}

// Display-only severity relabel over the exact same canonical top1Pct the
// rest of the app already shows — no new threshold logic, just a finer
// four-way label (LOW/MODERATE/HIGH/CRITICAL) for this card's badge.
function riskDisplayLevel(dependencyRisk) {
  if (!dependencyRisk) return null
  if (dependencyRisk.level === "high") return dependencyRisk.top1Pct >= 70 ? "CRITICAL" : "HIGH"
  if (dependencyRisk.level === "medium") return "MODERATE"
  return "LOW"
}
const RISK_COLOR = { LOW: C.green, MODERATE: C.gold, HIGH: C.orange, CRITICAL: C.red }

function PlatformBadge({ platform }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, color: C.text, whiteSpace: "nowrap" }}>
      {platform || "Unknown"}
    </span>
  )
}

function LockedField({ label }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 11.5, color: C.muted }}>
      <span>🔒 {label}</span>
      <span>Pro</span>
    </div>
  )
}

// ── TOP 3 FAN CARD ─────────────────────────────────────────────────────────
function TopFanCard({ rank, fan, isPro, dependencyRisk, onOpen, onUpgrade }) {
  const badge = statusBadgeFor(fan)
  const isTopFan = dependencyRisk?.topFanUsername === fan.username
  const isHeatingUp = badge.label === "Potential Whale"
  return (
    <div onClick={() => onOpen(fan)} style={{
      ...card({ padding: 18, cursor: "pointer" }),
      position: "relative", overflow: "hidden",
      ...(isHeatingUp ? { background: GLOW_GRADIENT, border: "1px solid rgba(124,92,255,0.28)" } : {}),
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      {isHeatingUp && <GlowBlob />}
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.muted }}>#{rank}</div>
        <div style={{
          width: 38, height: 38, borderRadius: "50%", background: `linear-gradient(135deg,${badge.color},${C.indigo})`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: C.white, flexShrink: 0,
        }}>{fan.username.slice(0, 1).toUpperCase()}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: C.white, overflowWrap: "anywhere" }}>{fan.username}</div>
          <PlatformBadge platform={fan.platform} />
        </div>
      </div>

      <span style={{ alignSelf: "flex-start", fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: `${badge.color}1f`, color: badge.color, border: `1px solid ${badge.color}3d` }}>
        {badge.emoji} {badge.label}
      </span>

      <div style={{ display: "flex", gap: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.green }}>{fmtUsd0(fan.totalUSD)}</div>
          <div style={{ fontSize: 10.5, color: C.muted }}>Total tipped</div>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.white }}>{fan.tipCount}</div>
          <div style={{ fontSize: 10.5, color: C.muted }}>Tips</div>
        </div>
      </div>

      {isPro ? (
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ fontSize: 11.5, color: C.text }}>Fan score: <strong style={{ color: C.cyan }}>{calcFanScore(fan)}</strong></div>
          <div style={{ fontSize: 11.5, color: C.text }}>{fan.tipCount >= 3 ? `Tips every ~${Math.round(fan.avgDaysBetweenTips)}d, ~${fmtUsd0(fan.avgTipSize)} avg` : "Not enough history for a pattern yet"}</div>
          <div style={{ fontSize: 11.5, color: C.text }}>Last active {fmtDays(fan.daysSinceLastTip)}</div>
          {isTopFan && dependencyRisk && (
            <div style={{ fontSize: 11.5, color: RISK_COLOR[riskDisplayLevel(dependencyRisk)] }}>
              Dependency risk: {dependencyRisk.top1Pct}% of your earnings
            </div>
          )}
        </div>
      ) : (
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
          <LockedField label="Tipping pattern" />
          <LockedField label="Dependency risk" />
          <LockedField label="Engagement trend" />
          <button onClick={(e) => { e.stopPropagation(); onUpgrade?.("fans_top3_locked") }} style={{
            marginTop: 8, width: "100%", padding: "8px 12px", borderRadius: 9, border: 0, cursor: "pointer",
            color: C.white, fontWeight: 700, fontSize: 11.5, background: CTA_GRADIENT,
          }}>Unlock Fan Intelligence →</button>
        </div>
      )}
    </div>
  )
}

// ── CHARTS ──────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "#1e2840", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 11.5 }}>
      <div style={{ color: C.text, marginBottom: 3 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || C.text }}>{p.name}: <strong>{p.value}</strong></div>
      ))}
    </div>
  )
}

function FanGrowthChart({ series }) {
  if (!series?.length) {
    return <div style={{ fontSize: 12.5, color: C.muted, padding: "30px 0", textAlign: "center" }}>Not enough monthly history yet to chart fan growth.</div>
  }
  const rows = series.map((s) => ({ ...s, label: monthLabel(s.month) }))
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={rows} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 10.5 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: C.muted, fontSize: 10.5 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="newFans" name="New fans" stackId="f" fill={C.cyan} radius={[0, 0, 0, 0]} />
        <Bar dataKey="returningFans" name="Returning fans" stackId="f" fill={C.indigo} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

const TREND_META = {
  growing: { label: "Growing", color: C.green },
  stable: { label: "Stable", color: C.gold },
  declining: { label: "Declining", color: C.red },
}

function FanEngagementChart({ trend }) {
  if (!trend) {
    return <div style={{ fontSize: 12.5, color: C.muted, padding: "30px 0", textAlign: "center" }}>Not enough monthly history yet to chart engagement.</div>
  }
  const rows = trend.series.map((s) => ({ ...s, label: monthLabel(s.month) }))
  const meta = TREND_META[trend.trend]
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: `${meta.color}1f`, color: meta.color, border: `1px solid ${meta.color}3d` }}>
          {meta.label}{trend.changePct != null ? ` ${trend.changePct > 0 ? "+" : ""}${trend.changePct}%` : ""}
        </span>
        <span style={{ fontSize: 11, color: C.muted }}>vs. previous month</span>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 10.5 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: C.muted, fontSize: 10.5 }} axisLine={false} tickLine={false} width={28} />
          <Tooltip content={<ChartTooltip />} />
          <Line type="monotone" dataKey="avgTipsPerFan" name="Avg tips / fan" stroke={C.pink} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── FAN COMPOSITION (small card, its own optional platform filter) ───────
function computeCompositionFor(whales, platform) {
  const pool = platform === "all" ? whales : whales.filter((w) => w.platform === platform)
  if (!pool.length) return null
  const counts = { Whale: 0, Shark: 0, Regular: 0, Dormant: 0 }
  pool.forEach((f) => { counts[f.tier] = (counts[f.tier] || 0) + 1 })
  const pct = (n) => Math.round((n / pool.length) * 100)
  return { total: pool.length, whalePct: pct(counts.Whale), sharkPct: pct(counts.Shark), regularPct: pct(counts.Regular), dormantPct: pct(counts.Dormant) }
}

function FanComposition({ whales, presentPlatforms }) {
  const [platform, setPlatform] = useState("all")
  const comp = useMemo(() => computeCompositionFor(whales, platform), [whales, platform])
  if (!comp) return null
  const rows = [
    { label: "Whales", pct: comp.whalePct, color: C.gold },
    { label: "Potential whales", pct: comp.sharkPct, color: C.indigo },
    { label: "Regular tippers", pct: comp.regularPct, color: C.cyan },
    { label: "Dormant", pct: comp.dormantPct, color: C.muted },
  ]
  return (
    <div style={card({ padding: 18 })}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={sectionLabel}>Fan composition</div>
        {presentPlatforms.length > 1 && (
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={{
            background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.white, fontSize: 11.5, padding: "5px 8px",
          }}>
            <option value="all">All Platforms</option>
            {presentPlatforms.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.filter((r) => r.pct > 0).map((r) => (
          <div key={r.label}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: C.text, marginBottom: 3 }}>
              <span>{r.label}</span><span style={{ fontWeight: 700, color: C.white }}>{r.pct}%</span>
            </div>
            <div style={{ height: 5, borderRadius: 4, background: "rgba(255,255,255,0.06)" }}>
              <div style={{ width: `${r.pct}%`, height: "100%", borderRadius: 4, background: r.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── DEPENDENCY RISK CARD ──────────────────────────────────────────────────
function DependencyRiskCard({ dependencyRisk, isPro, onUpgrade, onOpenFan, whales }) {
  if (!dependencyRisk || dependencyRisk.level === "low") return null
  const displayLevel = riskDisplayLevel(dependencyRisk)
  const color = RISK_COLOR[displayLevel]
  const topFan = whales.find((w) => w.username === dependencyRisk.topFanUsername)

  return (
    <div style={card({
      padding: 22,
      border: `1px solid ${color}45`,
      boxShadow: `0 0 30px ${color}22`,
      animation: displayLevel === "CRITICAL" ? "depRiskPulse 2.4s ease-in-out infinite" : "none",
    })}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        <div style={sectionLabel}>Potential Dependency Risk</div>
        <span style={{ fontSize: 11, fontWeight: 800, padding: "4px 11px", borderRadius: 20, background: `${color}1f`, color, border: `1px solid ${color}45` }}>{displayLevel}</span>
      </div>

      <div style={{ fontSize: 12.5, color: C.text, marginBottom: 6 }}>Top Spender Detected</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 16, filter: isPro ? "none" : "blur(6px)", userSelect: isPro ? "auto" : "none" }}>
        {dependencyRisk.topFanUsername}
        {isPro && dependencyRisk.topFanPlatform && <span style={{ marginLeft: 8 }}><PlatformBadge platform={dependencyRisk.topFanPlatform} /></span>}
      </div>

      <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color }}>{fmtUsd0(dependencyRisk.lossIfTopFanLeaves)}</div>
          <div style={{ fontSize: 11, color: C.muted }}>Earnings At Risk</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.white }}>{dependencyRisk.top1Pct}%</div>
          <div style={{ fontSize: 11, color: C.muted }}>Of your earnings</div>
        </div>
        {dependencyRisk.potentialRecovery && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.cyan }}>{fmtUsd0(dependencyRisk.potentialRecovery.amount)}</div>
            <div style={{ fontSize: 11, color: C.muted }}>Potential Earnings Recovery</div>
          </div>
        )}
      </div>

      {dependencyRisk.potentialRecovery ? (
        <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.5, marginBottom: 16 }}>
          Estimated opportunity if engagement returns toward this fan's historical pattern — not a guarantee.
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.5, marginBottom: 16 }}>
          This fan is currently tipping on their normal schedule, so there's no decline to estimate a recovery from yet.
        </div>
      )}

      {isPro ? (
        topFan && (
          <button onClick={() => onOpenFan(topFan)} style={{
            padding: "10px 18px", borderRadius: 10, border: 0, cursor: "pointer", color: "#06101A",
            fontWeight: 800, fontSize: 13, background: CTA_GRADIENT,
          }}>View full profile →</button>
        )
      ) : (
        <button onClick={() => onUpgrade?.("fans_dependency_risk")} style={{
          padding: "11px 20px", borderRadius: 10, border: 0, cursor: "pointer", color: "#06101A",
          fontWeight: 800, fontSize: 13.5, background: CTA_GRADIENT,
        }}>🔒 Upgrade to Pro to uncover this fan</button>
      )}

      <style jsx>{`
        @keyframes depRiskPulse {
          0%, 100% { box-shadow: 0 0 30px ${color}22; }
          50% { box-shadow: 0 0 44px ${color}3a; }
        }
      `}</style>
    </div>
  )
}

// ── FAN INTELLIGENCE LIST ─────────────────────────────────────────────────
const PAGE_SIZE = 12

function FanListRow({ fan, onOpen }) {
  const badge = statusBadgeFor(fan)
  const isHeatingUp = badge.label === "Potential Whale"
  return (
    <div onClick={() => onOpen(fan)} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 10, cursor: "pointer",
      background: isHeatingUp ? GLOW_GRADIENT : "rgba(255,255,255,0.03)",
      border: `1px solid ${isHeatingUp ? "rgba(124,92,255,0.28)" : C.border}`,
      boxShadow: isHeatingUp ? "0 0 16px rgba(124,92,255,0.14)" : "none",
    }}>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: C.white, flex: "1 1 140px", minWidth: 0, overflowWrap: "anywhere" }}>{fan.username}</span>
      <span style={{ flexShrink: 0 }}><PlatformBadge platform={fan.platform} /></span>
      <span style={{
        fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0,
        background: `${badge.color}1f`, color: badge.color, border: `1px solid ${badge.color}3d`,
      }}>{badge.emoji} {badge.label}</span>
      <span style={{ fontSize: 12.5, color: C.green, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>{fmtUsd0(fan.totalUSD)}</span>
      <span style={{ fontSize: 11.5, color: C.cyan, whiteSpace: "nowrap", flexShrink: 0 }}>{calcFanScore(fan)}</span>
    </div>
  )
}

function FanIntelligenceList({ whales, isPro, freeFanLimit, presentPlatforms, onOpenFan }) {
  const [platform, setPlatform] = useState("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)

  // Default order: fan score descending. This alone keeps churning/dormant
  // fans from flooding the top of the list (their score is already pulled
  // down by recency decay) without a separate hand-built "cap" rule.
  const filtered = useMemo(() => {
    let out = whales
    if (platform !== "all") out = out.filter((f) => f.platform === platform)
    if (search.trim()) { const q = search.trim().toLowerCase(); out = out.filter((f) => f.username.toLowerCase().includes(q)) }
    return [...out].sort((a, b) => calcFanScore(b) - calcFanScore(a))
  }, [whales, platform, search])

  const gated = isPro ? filtered : filtered.slice(0, Math.max(freeFanLimit * 4, 12))
  const totalPages = Math.max(1, Math.ceil(gated.length / PAGE_SIZE))
  const pageRows = gated.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  const hiddenByPlan = !isPro && filtered.length > gated.length

  return (
    <div style={card()}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div style={sectionLabel}>Fan Intelligence</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search username..."
            style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.white, fontSize: 12, padding: "7px 10px", minWidth: 150 }}
          />
          <select value={platform} onChange={(e) => { setPlatform(e.target.value); setPage(0) }} style={{
            background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.white, fontSize: 12, padding: "7px 10px",
          }}>
            <option value="all">All Platforms</option>
            {presentPlatforms.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {pageRows.length === 0 ? (
        <div style={{ fontSize: 13, color: C.muted, padding: "20px 0" }}>No fans match that search or filter.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pageRows.map((f) => <FanListRow key={f.username} fan={f} onOpen={onOpenFan} />)}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 11.5, color: C.muted }}>Page {page + 1} of {totalPages} · {gated.length} fans</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} style={{
            padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: page === 0 ? C.muted : C.white, cursor: page === 0 ? "default" : "pointer", fontSize: 12,
          }}>← Prev</button>
          <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} style={{
            padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: page >= totalPages - 1 ? C.muted : C.white, cursor: page >= totalPages - 1 ? "default" : "pointer", fontSize: 12,
          }}>Next →</button>
        </div>
      </div>

      {hiddenByPlan && (
        <div style={{ marginTop: 14, fontSize: 12, color: C.muted }}>
          Showing {gated.length} of {filtered.length} matching fans on Free. <strong style={{ color: C.cyan }}>Upgrade to Pro</strong> to see your full fan list, search, and filters unlocked.
        </div>
      )}
    </div>
  )
}

// ── MAIN ────────────────────────────────────────────────────────────────
export default function Fans({
  analytics,
  isPro = false,
  freeFanLimit = 3,
  onMessageFan,
  onUpgrade,
  onPlanStream,
}) {
  const whales = analytics?.whales || []
  const dependencyRisk = analytics?.dependencyRisk || null
  const fanComposition = analytics?.fanComposition || null
  const fanGrowthSeries = analytics?.fanGrowthSeries || []
  const fanEngagementTrend = analytics?.fanEngagementTrend || null
  const [openFan, setOpenFan] = useState(null)

  const hasAnyFans = whales.length > 0
  const top3 = useMemo(() => [...whales].sort((a, b) => b.totalUSD - a.totalUSD).slice(0, 3), [whales])
  const presentPlatforms = useMemo(() => [...new Set(whales.map((w) => w.platform).filter(Boolean))].sort(), [whales])

  const handleOpenFan = (fan) => setOpenFan(fan)

  if (!hasAnyFans) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.white, letterSpacing: "-0.02em" }}>Fans</div>
          <div style={{ fontSize: 13.5, color: C.muted, marginTop: 5 }}>Who deserves your attention, and what to do about it.</div>
        </div>
        <div style={card()}>
          <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6 }}>
            No supporters imported yet. Once you import your tip history, your fan intelligence — top supporters, growth, engagement, and risk — shows up here.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: C.white, letterSpacing: "-0.02em" }}>Fans</div>
        <div style={{ fontSize: 13.5, color: C.muted, marginTop: 5 }}>Who deserves your attention, and what to do about it.</div>
      </div>

      {/* ── 1. TOP 3 FAN PROFILE CARDS ──────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
        {top3.map((fan, i) => (
          <TopFanCard key={fan.username} rank={i + 1} fan={fan} isPro={isPro} dependencyRisk={dependencyRisk} onOpen={handleOpenFan} onUpgrade={onUpgrade} />
        ))}
      </div>

      {/* ── 2. FAN GROWTH + FAN ENGAGEMENT ──────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        <div style={card({ padding: 18 })}>
          <div style={{ ...sectionLabel, marginBottom: 10 }}>Fan Growth</div>
          <FanGrowthChart series={fanGrowthSeries} />
        </div>
        <div style={card({ padding: 18 })}>
          <div style={{ ...sectionLabel, marginBottom: 10 }}>Fan Engagement Trend</div>
          <FanEngagementChart trend={fanEngagementTrend} />
        </div>
      </div>

      {/* ── SMALL SUPPORTING INSIGHT — FAN COMPOSITION ──────────────── */}
      <FanComposition whales={whales} presentPlatforms={presentPlatforms} />

      {/* ── 3. DEPENDENCY RISK ───────────────────────────────────────── */}
      <DependencyRiskCard dependencyRisk={dependencyRisk} isPro={isPro} onUpgrade={onUpgrade} onOpenFan={handleOpenFan} whales={whales} />

      {/* ── 4. FAN INTELLIGENCE LIST ─────────────────────────────────── */}
      <FanIntelligenceList whales={whales} isPro={isPro} freeFanLimit={freeFanLimit} presentPlatforms={presentPlatforms} onOpenFan={handleOpenFan} />

      {/* ── DRAWER ───────────────────────────────────────────────────── */}
      <FanProfileDrawer
        fan={openFan}
        isPro={isPro}
        dependencyRisk={dependencyRisk}
        onClose={() => setOpenFan(null)}
        onUpgrade={onUpgrade}
        onMessage={(username) => { onMessageFan?.(username); setOpenFan(null) }}
      />
    </div>
  )
}
