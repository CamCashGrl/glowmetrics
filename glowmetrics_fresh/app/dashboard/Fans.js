"use client"
import { useMemo, useState } from "react"
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { calcPotentialEarningsRecovery, computeFanTrend } from "../../lib/analytics"
import FanProfileDrawer from "./FanProfileDrawer"

// ═══════════════════════════════════════════════════════════════════════════
// FANS — Fan Intelligence
//
// Visual system/component structure is the exact template provided (see
// app/globals.css's "FANS PAGE" section for the matching CSS — global, not
// a module, because app/dashboard has no layout.js of its own to import a
// scoped stylesheet from).
//
// Every number rendered here comes from lib/analytics.js's identifyWhales()
// / dependencyRisk / fanGrowthSeries / fanEngagementTrend / calcPotential-
// EarningsRecovery. This file only selects, labels, filters, and gates by
// isPro — it does not compute anything new, and per explicit instruction:
// NO fabricated 0-100 "fan score" anywhere, not for display and not for
// sorting. Fans are ordered by real totalUSD (identifyWhales() already
// returns them spend-sorted) with a churn-priority cap layered on top (see
// applyChurnCap below) — never a synthesized composite number.
// ═══════════════════════════════════════════════════════════════════════════

const fmtMoney = (value) => {
  if (value == null || Number.isNaN(Number(value))) return "$0.00"
  return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
// ── ABSTRACT AVATAR ─────────────────────────────────────────────────────
// Decorative CamCash brand mark — NOT a stand-in for a profile photo and
// NOT username initials (those read as generic contact-card UI, not the
// brand). A tiny deterministic hash picks one of a few abstract glyphs so
// avatars aren't all visually identical, without encoding any part of the
// username as text.
function glyphIndexFor(name = "") {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return h % 3
}
function AvatarGlyph({ seed = "" }) {
  const variant = glyphIndexFor(seed)
  return (
    <svg viewBox="0 0 24 24" width="52%" height="52%" fill="none" aria-hidden="true">
      {variant === 0 && <path d="M12 2 L14.5 9.5 L22 12 L14.5 14.5 L12 22 L9.5 14.5 L2 12 L9.5 9.5 Z" fill="currentColor" opacity="0.92" />}
      {variant === 1 && <circle cx="12" cy="12" r="7" fill="currentColor" opacity="0.9" />}
      {variant === 2 && <rect x="5" y="5" width="14" height="14" rx="4" fill="currentColor" opacity="0.9" transform="rotate(45 12 12)" />}
    </svg>
  )
}

const tierClass = (tier) =>
  tier === "Whale" ? "fan-tier-whale"
  : tier === "Shark" ? "fan-tier-shark"
  : tier === "Dormant" ? "fan-tier-dormant"
  : tier === "New" ? "fan-tier-new"
  : "fan-tier-regular"
// churnRisk on a fan is an OBJECT ({level, risk}) from calcChurnRisk() in
// lib/analytics.js, not a plain string — this reads the real level off it.
const riskLevel = (fan) => fan?.churnRisk?.level || "Unknown"

// ── RISK COPY ────────────────────────────────────────────────────────────
// The Fans page is meant to help creators make more money, not scare them.
// This maps the real churnRisk.level (calcChurnRisk — already relative to
// each fan's OWN cadence, never raw days-inactive) onto calmer, opportunity-
// framed language. "Critical" + the pulsing red treatment is reserved for
// fans who are BOTH genuinely far outside their own pattern AND economically
// meaningful (Whale/Shark) — everyone else below that bar reads as an
// actionable "Re-engage" rather than an alarm.
function riskCopy(fan) {
  const level = riskLevel(fan)
  if (level === "Unknown") return { label: "Not enough data", cls: "risk-unknown", pulse: false }
  if (level === "Low") return { label: "Healthy", cls: "risk-low", pulse: false }
  if (level === "Medium") return { label: "Watch", cls: "risk-medium", pulse: false }
  if (level === "High") return { label: "Re-engage", cls: "risk-high", pulse: false }
  // Critical
  const isHighValue = fan.tier === "Whale" || fan.tier === "Shark"
  return isHighValue
    ? { label: "Critical", cls: "risk-critical", pulse: true }
    : { label: "Re-engage", cls: "risk-high", pulse: false }
}

// ── TREND BADGE ──────────────────────────────────────────────────────────
const TREND_BADGE = {
  up:           { icon: "↑", label: "Trending up",   cls: "trend-up" },
  down:         { icon: "↓", label: "Trending down", cls: "trend-down" },
  stable:       { icon: "→", label: "Stable",         cls: "trend-stable" },
  emerging:     { icon: "✦", label: "Emerging",       cls: "trend-emerging" },
  insufficient: { icon: "",  label: "Not enough data", cls: "trend-insufficient" },
}
function trendBadge(fan) {
  const t = computeFanTrend(fan)
  const meta = TREND_BADGE[t.trend] || TREND_BADGE.insufficient
  return { ...meta, trend: t.trend, changePct: t.changePct }
}

const monthLabel = (ym) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }) }
const PLATFORM_OPTIONS = ["Chaturbate", "BongaCams", "MyFreeCams", "Stripchat", "CamSoda"]
const TIER_OPTIONS = ["Whale", "Shark", "Regular", "Dormant"]
const INTEL_OPTIONS = ["Trending Up", "Trending Down", "At Risk", "Loyal", "New / Emerging"]
const PAGE_SIZE = 10

// Caps how many High/Critical-risk fans can occupy the front of a sorted
// list per platform. Nobody is removed or hidden — every real churn-risk
// fan stays in the data — this only demotes anything past the cap to the
// end, so the front of the list can't be dominated by a wall of lapsed fans.
function applyChurnCap(sorted, capPerPlatform = 1) {
  const seen = {}
  const kept = []
  const demoted = []
  for (const fan of sorted) {
    const lvl = riskLevel(fan)
    if (lvl !== "High" && lvl !== "Critical") { kept.push(fan); continue }
    const key = fan.platform || "Unknown"
    seen[key] = (seen[key] || 0) + 1
    if (seen[key] <= capPerPlatform) kept.push(fan)
    else demoted.push(fan)
  }
  return [...kept, ...demoted]
}

function IntelligenceCard({ children, className = "" }) {
  return <div className={`cc-card ${className}`}>{children}</div>
}

// ── TOP 3 FAN CARD ─────────────────────────────────────────────────────────
function TopFanCard({ fan, rank, isPro, onView, onUpgrade }) {
  if (!fan) return null
  const risk = riskLevel(fan)
  const copy = riskCopy(fan)
  const trend = trendBadge(fan)
  const isHeatingUp = trend.trend === "up"

  return (
    <IntelligenceCard className="top-fan-card">
      <div className="top-fan-header">
        <div className="fan-identity">
          <div className={`fan-avatar ${rank === 1 ? "fan-avatar-primary" : ""} ${isHeatingUp ? "fan-heating-glow" : ""}`}>
            <AvatarGlyph seed={fan.username} />
          </div>
          <div>
            <div className="fan-name-row">
              <strong>{fan.username}</strong>
              {rank === 1 && <span className="top-badge">TOP SPENDER</span>}
              {isPro && trend.trend === "up" && <span className={`trend-badge ${trend.cls}`}>{trend.icon} TRENDING UP</span>}
            </div>
            <div className="fan-tags">
              <span className={tierClass(fan.tier)}>{fan.tier || "Regular"}</span>
              <span className="platform-tag">{fan.platform || "Platform"}</span>
            </div>
          </div>
        </div>
        <div className="fan-rank">#{rank}</div>
      </div>

      <div className="fan-stat-grid">
        <div><span>LIFETIME SPEND</span><strong>{fmtMoney(fan.totalUSD)}</strong></div>
        <div><span>TOTAL TIPS</span><strong>{fan.tipCount ?? 0}</strong></div>
        <div><span>AVG. TIP</span><strong>{fmtMoney(fan.avgTipSize)}</strong></div>
        <div><span>SPEND PERCENTILE</span><strong>{fan.spendPercentile != null ? `Top ${100 - fan.spendPercentile}%` : "—"}</strong></div>
      </div>

      {isPro ? (
        <div className="fan-risk-block">
          <div className="risk-label-row">
            <span>RETENTION STATUS</span>
            <strong className={copy.cls}>{copy.label}</strong>
          </div>
          <div className="risk-track">
            <div className={`risk-fill risk-fill-${risk.toLowerCase()}`} style={{
              width: risk === "Critical" ? "94%" : risk === "High" ? "75%" : risk === "Medium" ? "48%" : risk === "Low" ? "22%" : "0%",
            }} />
          </div>
          <div className="risk-helper">
            {fan.daysSinceLastTip != null ? `Last tipped ${fan.daysSinceLastTip === 0 ? "today" : `${fan.daysSinceLastTip}d ago`}` : "Not enough history yet"}
          </div>
        </div>
      ) : (
        <div className="fan-risk-block">
          <div className="risk-label-row"><span>RETENTION STATUS</span><strong>🔒 Pro</strong></div>
        </div>
      )}

      <div className="fan-card-actions">
        {isPro ? (
          <button className="cc-gradient-button" onClick={() => onView?.(fan)}>View Full Profile</button>
        ) : (
          <button className="cc-gradient-button" onClick={() => onUpgrade?.("fan-profile")}>Unlock Fan Intelligence</button>
        )}
      </div>
    </IntelligenceCard>
  )
}

// ── CHART CARD ─────────────────────────────────────────────────────────────
function ChartCard({ title, eyebrow, description, children, badge }) {
  return (
    <IntelligenceCard className="chart-card">
      <div className="chart-header">
        <div><div className="chart-eyebrow">{eyebrow}</div><h3>{title}</h3><p>{description}</p></div>
        {badge && <span className="chart-badge">{badge}</span>}
      </div>
      <div className="chart-area">{children}</div>
    </IntelligenceCard>
  )
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "#151a32", border: "1px solid rgba(130,110,255,.22)", borderRadius: 8, padding: "7px 11px", fontSize: 11 }}>
      <div style={{ color: "#8f99b5", marginBottom: 3 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></div>)}
    </div>
  )
}

function FanGrowthChart({ series }) {
  if (!series?.length) return <div className="chart-empty">Not enough monthly history yet to chart fan growth.</div>
  const rows = series.map((s) => ({ ...s, label: monthLabel(s.month) }))
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "#67718c", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#67718c", fontSize: 10 }} axisLine={false} tickLine={false} width={26} allowDecimals={false} />
        <Tooltip content={<ChartTip />} />
        <Bar dataKey="newFans" name="New fans" stackId="f" fill="#20ddf5" />
        <Bar dataKey="returningFans" name="Returning fans" stackId="f" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

const TREND_META = { growing: { label: "Growing", color: "#17d89a" }, stable: { label: "Stable", color: "#f5a400" }, declining: { label: "Declining", color: "#ff6b73" } }

function FanEngagementChart({ trend }) {
  if (!trend) return <div className="chart-empty">Not enough monthly history yet to chart engagement.</div>
  const rows = trend.series.map((s) => ({ ...s, label: monthLabel(s.month) }))
  const meta = TREND_META[trend.trend]
  return (
    <div style={{ height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, padding: "3px 9px", borderRadius: 20, background: `${meta.color}1f`, color: meta.color, border: `1px solid ${meta.color}45` }}>
          {meta.label}{trend.changePct != null ? ` ${trend.changePct > 0 ? "+" : ""}${trend.changePct}%` : ""}
        </span>
        <span style={{ fontSize: 10, color: "#67718c" }}>vs. previous month</span>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#67718c", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#67718c", fontSize: 10 }} axisLine={false} tickLine={false} width={26} />
          <Tooltip content={<ChartTip />} />
          <Line type="monotone" dataKey="avgTipsPerFan" name="Avg tips / fan" stroke="#ec3baf" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── DEPENDENCY RISK CARD ────────────────────────────────────────────────────
function DependencyRiskCard({ dependencyRisk, topFan, isPro, onUpgrade, recovery }) {
  if (!dependencyRisk || dependencyRisk.level === "low") return null
  // Same canonical top1Pct just gets a finer CRITICAL label above 70% — no
  // new threshold logic, purely a display refinement over the real number.
  const displayLevel = dependencyRisk.level === "high"
    ? (dependencyRisk.top1Pct >= 70 ? "CRITICAL" : "HIGH")
    : dependencyRisk.level.toUpperCase()
  const loss = dependencyRisk.lossIfTopFanLeaves ?? topFan?.totalUSD ?? 0

  return (
    <div className={`dependency-card ${displayLevel === "HIGH" || displayLevel === "CRITICAL" ? "dependency-danger" : ""}`}>
      <div className="dependency-glow" />
      <div className="dependency-top">
        <div>
          <div className="dependency-eyebrow">CAMCASH WATCH</div>
          <h3>Dependency Risk</h3>
          <p>One high-value fan is responsible for a meaningful concentration of your earnings.</p>
        </div>
        <div className={`dependency-status status-${displayLevel.toLowerCase()}`}>{displayLevel}</div>
      </div>

      <div className="dependency-metrics">
        <div className="dependency-metric">
          <span>EARNINGS AT RISK</span>
          <strong>{fmtMoney(loss)}</strong>
          <small>Estimated revenue exposure if this fan stops spending.</small>
        </div>
        <div className="dependency-divider" />
        <div className="dependency-metric">
          <span>POTENTIAL EARNINGS RECOVERY</span>
          {/* Never fabricated — calcPotentialEarningsRecovery() returns null
              when this fan is tipping on schedule or has too little history,
              and null is shown honestly, not as a fake $0.00. */}
          <strong>{recovery ? fmtMoney(recovery.amount) : "—"}</strong>
          <small>
            {recovery
              ? "Estimated opportunity if engagement returns toward this fan's historical pattern."
              : "This fan is tipping on schedule right now — no decline to estimate a recovery from yet."}
          </small>
        </div>
      </div>

      <div className="dependency-fan">
        <div className="dependency-avatar">{isPro ? <AvatarGlyph seed={topFan?.username} /> : <span className="dependency-avatar-lock">🔒</span>}</div>
        <div className="dependency-fan-info">
          <span>HIGH-VALUE FAN</span>
          {isPro ? <strong>{topFan?.username || "Unknown"}</strong> : <strong className="blurred-username">{topFan?.username || "high-value-fan"}</strong>}
          <small>{isPro ? `${topFan?.platform || "Platform"} · ${fmtMoney(topFan?.totalUSD)} lifetime` : "Identity locked"}</small>
        </div>
        {!isPro && <button className="dependency-upgrade" onClick={() => onUpgrade?.("dependency-risk")}>Upgrade to Pro →</button>}
      </div>

      {!isPro && (
        <div className="dependency-lock-copy">
          🔒 Unlock the fan identity, dependency analysis, tipping patterns, and potential lost-earnings insights.
        </div>
      )}
    </div>
  )
}

// ── FAN MIX (composition) ───────────────────────────────────────────────────
// Compact insight, not another big chart — account-wide tier breakdown from
// lib/analytics.js's computeFanComposition(), which is just a % aggregation
// of each fan's own already-computed `tier` (identifyWhales). Nothing new is
// classified here. Only rendered once there's enough fans for the split to
// mean something (same 5-fan floor dependencyRisk itself uses).
function FanMixCard({ composition }) {
  if (!composition || composition.total < 5) return null
  const rows = [
    { label: "Whales", pct: composition.whalePct, cls: "fan-tier-whale" },
    { label: "Sharks", pct: composition.sharkPct, cls: "fan-tier-shark" },
    { label: "Regulars", pct: composition.regularPct, cls: "fan-tier-regular" },
    { label: "New", pct: composition.newPct, cls: "fan-tier-new" },
    { label: "Dormant", pct: composition.dormantPct, cls: "fan-tier-dormant" },
  ].filter((r) => r.pct > 0)

  return (
    <IntelligenceCard className="fan-mix-card">
      <div className="chart-eyebrow">FAN MIX</div>
      <h3>How your audience breaks down</h3>
      <div className="fan-mix-rows">
        {rows.map((r) => (
          <div className="fan-mix-row" key={r.label}>
            <span className={`fan-mix-label ${r.cls}`}>{r.label}</span>
            <div className="fan-mix-track"><div className={`fan-mix-fill ${r.cls}`} style={{ width: `${r.pct}%` }} /></div>
            <span className="fan-mix-pct">{r.pct}%</span>
          </div>
        ))}
      </div>
    </IntelligenceCard>
  )
}

// ── FAN INTELLIGENCE LIST ───────────────────────────────────────────────────
function FanIntelligenceList({
  fans, isPro, hasRecentStreamingActivity, daysSinceLastMeaningfulSession,
  platform, setPlatform, tierFilter, setTierFilter, intelFilter, setIntelFilter,
  search, setSearch, page, setPage, onView, onUpgrade,
}) {
  const ordered = useMemo(() => {
    let out = fans
    if (platform !== "All Platforms") out = out.filter((f) => f.platform === platform)
    if (tierFilter !== "All") out = out.filter((f) => f.tier === tierFilter)
    if (intelFilter !== "All") {
      out = out.filter((f) => {
        const risk = riskLevel(f)
        const trend = computeFanTrend(f).trend
        if (intelFilter === "Trending Up") return trend === "up"
        if (intelFilter === "Trending Down") return trend === "down"
        if (intelFilter === "At Risk") return risk === "High" || risk === "Critical"
        if (intelFilter === "Loyal") return risk === "Low" && (f.tipCount ?? 0) >= 5
        if (intelFilter === "New / Emerging") return trend === "emerging"
        return true
      })
    }
    if (search) { const q = search.toLowerCase(); out = out.filter((f) => String(f.username || "").toLowerCase().includes(q)) }
    // fans is already spend-sorted (identifyWhales()'s own order) — the
    // churn cap only reorders the excess High/Critical fans to the back (max
    // 1 per platform up front) so a wall of at-risk fans can never dominate
    // the list — even when the person explicitly filters to "At Risk", they
    // see the single most relevant at-risk fan per platform first.
    return applyChurnCap(out, 1)
  }, [fans, platform, tierFilter, intelFilter, search])

  // Free users get a short, unpaginated teaser (matches the Top-3-cards
  // free experience above). Pro users get real pagination over the full
  // filtered set — never an endless list rendered and hidden with CSS.
  const total = ordered.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pageStart = (safePage - 1) * PAGE_SIZE
  const pageItems = isPro ? ordered.slice(pageStart, pageStart + PAGE_SIZE) : ordered.slice(0, 6)

  const resetAnd = (setter) => (value) => { setter(value); setPage(1) }

  return (
    <IntelligenceCard className="fan-list-card">
      <div className="fan-list-header">
        <div>
          <div className="chart-eyebrow">FAN INTELLIGENCE</div>
          <h3>Your fans worth watching</h3>
          <p>A focused list of the fans most relevant to your revenue and retention.</p>
        </div>
        <div className="fan-controls">
          <select value={platform} onChange={(e) => resetAnd(setPlatform)(e.target.value)} className="cc-select">
            <option>All Platforms</option>
            {PLATFORM_OPTIONS.map((p) => <option key={p}>{p}</option>)}
          </select>
          <select value={tierFilter} onChange={(e) => resetAnd(setTierFilter)(e.target.value)} className="cc-select">
            <option value="All">All Types</option>
            {TIER_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={intelFilter} onChange={(e) => resetAnd(setIntelFilter)(e.target.value)} className="cc-select">
            <option value="All">All Intelligence</option>
            {INTEL_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            value={search}
            onChange={(e) => resetAnd(setSearch)(e.target.value)}
            placeholder="Search username..."
            className="cc-search"
          />
        </div>
      </div>

      {!hasRecentStreamingActivity && (
        <div className="activity-banner">
          <span className="activity-banner-title">
            {daysSinceLastMeaningfulSession == null
              ? "Not enough recent streaming activity to assess fan risk yet."
              : `No qualifying streams in the last ${daysSinceLastMeaningfulSession} days.`}
          </span>
          <span className="activity-banner-helper">Risk signals become more useful after you have recent qualifying sessions.</span>
        </div>
      )}

      <div className="fan-list">
        {pageItems.map((fan, index) => {
          const copy = riskCopy(fan)
          const trend = trendBadge(fan)
          return (
            <div className="fan-list-row" key={`${fan.username}-${index}`}>
              <div className={`fan-list-avatar ${trend.trend === "up" ? "fan-heating-glow" : ""}`}><AvatarGlyph seed={fan.username} /></div>
              <div className="fan-list-identity">
                <strong>{fan.username}</strong>
                <div>
                  <span className={tierClass(fan.tier)}>{fan.tier || "Regular"}</span>
                  <span className="platform-tag">{fan.platform}</span>
                </div>
              </div>
              <div className="fan-list-stat"><span>LIFETIME</span><strong>{fmtMoney(fan.totalUSD)}</strong></div>
              <div className="fan-list-stat">
                <span>TREND</span>
                <strong className={`trend-badge-inline ${trend.cls}`}>{trend.icon} {trend.label}</strong>
              </div>
              <div className="fan-list-stat">
                <span>STATUS</span>
                <strong className={copy.cls}>{isPro ? copy.label : "🔒"}</strong>
              </div>
              <div className="fan-list-action">
                {isPro ? (
                  <button className="row-view-button" onClick={() => onView?.(fan)}>View →</button>
                ) : (
                  <button className="row-lock-button" onClick={() => onUpgrade?.("fan-list")}>🔒</button>
                )}
              </div>
            </div>
          )
        })}
        {pageItems.length === 0 && <div className="empty-fans">No fans match your current filters.</div>}
      </div>

      {isPro && total > 0 && (
        <div className="fan-pagination">
          <span>Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, total)} of {total} fans</span>
          <div className="fan-pagination-buttons">
            <button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>← Previous</button>
            <span className="fan-pagination-page">Page {safePage} of {totalPages}</span>
            <button disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>Next →</button>
          </div>
        </div>
      )}

      {!isPro && (
        <div className="free-list-footer">
          <span>Showing your highest-priority fans.</span>
          <button onClick={() => onUpgrade?.("fan-intelligence")}>Upgrade to Pro to unlock full Fan Intelligence →</button>
        </div>
      )}
    </IntelligenceCard>
  )
}

// ── MAIN ────────────────────────────────────────────────────────────────────
export default function Fans({ analytics, isPro = false, onUpgrade, onMessageFan, onPlanStream }) {
  const [platform, setPlatform] = useState("All Platforms")
  const [tierFilter, setTierFilter] = useState("All")
  const [intelFilter, setIntelFilter] = useState("All")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [openFan, setOpenFan] = useState(null)

  const fans = analytics?.whales || []
  const dependencyRisk = analytics?.dependencyRisk || null
  const fanGrowthSeries = analytics?.fanGrowthSeries || []
  const fanEngagementTrend = analytics?.fanEngagementTrend || null
  const fanComposition = analytics?.fanComposition || null
  // Whether the CREATOR has streamed recently enough for retention/risk
  // signals to be meaningful (lib/analytics.js aggregateRows). Gates the
  // calm "not enough recent activity" banner instead of ever implying the
  // whole audience is churning just because the creator hasn't been live.
  const hasRecentStreamingActivity = analytics?.hasRecentStreamingActivity ?? false
  const daysSinceLastMeaningfulSession = analytics?.daysSinceLastMeaningfulSession ?? null

  // identifyWhales() already returns fans sorted by totalUSD descending.
  const topThree = fans.slice(0, 3)
  const topFan = fans[0] || null
  const recovery = topFan ? calcPotentialEarningsRecovery(topFan) : null

  if (!fans.length) {
    return (
      <div className="fans-page">
        <div className="fans-page-header">
          <div className="fans-eyebrow">CAMCASH · FAN INTELLIGENCE</div>
          <h1>Know who's driving your revenue.</h1>
          <p>No supporters imported yet. Once you import your tip history, your top fans, growth, engagement, and risk show up here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fans-page">
      <div className="fans-page-header">
        <div className="fans-eyebrow">CAMCASH · FAN INTELLIGENCE</div>
        <h1>Know who's driving your revenue.</h1>
        <p>Track your highest-value fans, spot changing engagement, and catch retention risks before they become lost revenue.</p>
      </div>

      <section className="fans-section">
        <div className="section-heading">
          <div><span>TOP FANS</span><h2>Your top 3 revenue drivers</h2></div>
          <p>Your highest-value fans based on actual tipping data.</p>
        </div>
        <div className="top-fans-grid">
          {topThree.map((fan, index) => (
            <TopFanCard key={`${fan.username}-${index}`} fan={fan} rank={index + 1} isPro={isPro} onView={setOpenFan} onUpgrade={onUpgrade} />
          ))}
        </div>
      </section>

      <section className="fans-section">
        <div className="section-heading">
          <div><span>FAN TRENDS</span><h2>What's changing?</h2></div>
          <p>Understand whether your audience is growing, returning, or drifting away.</p>
        </div>
        <div className="fans-charts-grid">
          <ChartCard eyebrow="AUDIENCE GROWTH" title="New vs. returning fans" description="How your fan base is changing over time." badge="MONTHLY">
            <FanGrowthChart series={fanGrowthSeries} />
          </ChartCard>
          <ChartCard eyebrow="ENGAGEMENT" title="Fan engagement trend" description="Average tips per fan, month over month." badge="TREND">
            <FanEngagementChart trend={fanEngagementTrend} />
          </ChartCard>
        </div>
        <FanMixCard composition={fanComposition} />
      </section>

      <section className="fans-section">
        <DependencyRiskCard dependencyRisk={dependencyRisk} topFan={topFan} isPro={isPro} onUpgrade={onUpgrade} recovery={recovery} />
      </section>

      <section className="fans-section">
        <FanIntelligenceList
          fans={fans} isPro={isPro}
          hasRecentStreamingActivity={hasRecentStreamingActivity}
          daysSinceLastMeaningfulSession={daysSinceLastMeaningfulSession}
          platform={platform} setPlatform={setPlatform}
          tierFilter={tierFilter} setTierFilter={setTierFilter}
          intelFilter={intelFilter} setIntelFilter={setIntelFilter}
          search={search} setSearch={setSearch}
          page={page} setPage={setPage}
          onView={setOpenFan} onUpgrade={onUpgrade}
        />
      </section>

      <FanProfileDrawer
        fan={openFan} isPro={isPro} dependencyRisk={dependencyRisk}
        onClose={() => setOpenFan(null)}
        onUpgrade={onUpgrade}
        onMessage={(username) => { onMessageFan?.(username); setOpenFan(null) }}
      />
    </div>
  )
}
