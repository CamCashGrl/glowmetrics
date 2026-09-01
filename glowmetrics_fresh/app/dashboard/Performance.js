"use client"
import { useMemo } from "react"

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM PERFORMANCE  (the "Platforms" tab)
//
// Answers ONE question: "how is each platform doing?" — the account-wide
// "how am I doing overall?" question belongs to the Overview/Command Center,
// which is why the generic earnings/$-per-hour trend charts and the overall
// KPI strip no longer live here. The page leads with the per-platform cards
// rather than a chart, so "which site actually makes me the most money" is
// readable in about two seconds.
//
// Every value is read from the frozen analytics layer (lib/analytics.js's
// aggregateRows()). This file performs NO aggregation of its own — no reduces
// over raw tips or sessions, no re-derived rates, windows, or percentages.
// Revenue share is the only arithmetic done here, and it is a presentational
// ratio of already-canonical platforms[].totalUSD values against their own
// sum, not a second revenue calculation.
//
// Two things this component deliberately does NOT do:
//   - Recompute "best time." The per-platform window is read from
//     platforms[].bestLocalDay/bestLocalHour/bestWindowConfidence, which the
//     engine computes with the same canonical best-times logic, and it is
//     never shown without its confidence tier.
//   - Hardcode a ranking. Comparison-table highlights and the insight cards
//     are derived from the current numbers, so they stay true when the data
//     changes.
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  bg: "#05070f", card: "#121826", card2: "#161e2e", border: "#1e2d45",
  indigo: "#7C5CFF", cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B",
  green: "#10B981", red: "#F87171", white: "#F1F5F9", text: "#94A3B8", muted: "#475569",
}
const glassCard = {
  background: "rgba(15,20,32,0.75)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)",
}
const CTA_GRADIENT = "linear-gradient(90deg,#22D3EE 0%,#7C5CFF 48%,#EC4899 100%)"
const card = (extra = {}) => ({ ...glassCard, borderRadius: 16, padding: 22, ...extra })
// C.text, not C.muted — at 12px uppercase on the glass card, #475569 rendered
// too dim to read comfortably. These are the section headings; they carry the
// page's structure.
const sectionLabel = { fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text }
const microLabel = { fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(241,245,249,0.38)" }

const fmtUsd = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtUsd0 = (n) => `$${Math.round(Number(n || 0)).toLocaleString("en-US")}`
// Hours + minutes, for the one place a card gives streaming time its own line.
const fmtHoursLong = (h) => {
  const total = Math.round((Number(h) || 0) * 60)
  if (total <= 0) return "—"
  const hrs = Math.floor(total / 60), mins = total % 60
  return hrs === 0 ? `${mins}m` : mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`
}
const fmtHour = (h) => { const H = ((h % 24) + 24) % 24; return H === 0 ? "12 AM" : H < 12 ? `${H} AM` : H === 12 ? "12 PM" : `${H - 12} PM` }
const fmtWindow = (h) => `${fmtHour(h)} – ${fmtHour(h + 2)}`

const DAY_ABBR = { Sunday: "Sun", Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri", Saturday: "Sat" }
const DAY_ORDER = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

const TIER_COPY = { high: "Strong pattern", supported: "Supported pattern", promising: "Early signal" }

// One restrained accent per platform — a dark glass card with white primary
// type and muted metadata, lifted by a single colour and a very subtle glow.
// Unknown/undetected platforms fall through to the neutral slate accent
// rather than being given a brand identity they don't have.
const PLATFORM_STYLES = {
  chaturbate: { short: "CB",  accent: "#22D3EE" },
  bongacams:  { short: "BC",  accent: "#EC4899" },
  myfreecams: { short: "MFC", accent: "#7C5CFF" },
  camsoda:    { short: "CS",  accent: "#D946EF" },
  stripchat:  { short: "SC",  accent: "#FB923C" },
  streamate:  { short: "SM",  accent: "#38BDF8" },
  flirt4free: { short: "F4F", accent: "#F472B6" },
  cam4:       { short: "C4",  accent: "#34D399" },
  livejasmin: { short: "LJ",  accent: "#FBBF24" },
}
const NEUTRAL_STYLE = { short: "—", accent: "#94A3B8" }
const styleFor = (name) => {
  const key = String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "")
  if (PLATFORM_STYLES[key]) return PLATFORM_STYLES[key]
  // Derive an abbreviation from the name itself rather than inventing a brand
  // accent for a platform we don't have colours for.
  const words = String(name || "").trim().split(/\s+/).filter(Boolean)
  const short = words.length > 1
    ? words.map(w => w[0]).join("").slice(0, 3).toUpperCase()
    : String(name || "?").slice(0, 2).toUpperCase()
  return { ...NEUTRAL_STYLE, short }
}
const rgba = (hex, a) => {
  const h = hex.replace("#", "")
  const n = parseInt(h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

function BrandButton({ children, onClick, style }) {
  return (
    <button onClick={onClick} style={{
      background: CTA_GRADIENT, border: "none", borderRadius: 12, padding: "13px 24px",
      fontSize: 14.5, fontWeight: 800, color: "#06101A", cursor: "pointer",
      boxShadow: "0 0 20px rgba(34,211,238,0.22), 0 0 30px rgba(236,72,153,0.16)", ...style,
    }}>{children}</button>
  )
}

function Metric({ label, value, accent }) {
  return (
    <div>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: accent || "rgba(241,245,249,0.88)" }}>{value}</div>
      <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>{label}</div>
    </div>
  )
}

// ── PLATFORM CARD ─────────────────────────────────────────────────────────
// Primary (revenue, $/hour, streaming time) → secondary (tips, fans, average
// tip, sessions) → insight (revenue share, best window). Reads canonical
// fields only; `share` is passed in already computed by the parent so the
// ratio exists in exactly one place on this page.
function PlatformCard({ p, share, onViewBreakdown }) {
  const s = styleFor(p.platform)
  return (
    <div style={{
      position: "relative", overflow: "hidden", borderRadius: 16,
      ...glassCard, border: `1px solid ${rgba(s.accent, 0.2)}`,
      padding: 20, transition: "border-color .2s ease, transform .2s ease",
    }}>
      {/* very subtle platform glow — restraint over a nightclub */}
      <div style={{
        position: "absolute", top: -90, left: -90, width: 200, height: 200, borderRadius: "50%",
        background: `radial-gradient(circle, ${rgba(s.accent, 0.16)}, transparent 65%)`,
        filter: "blur(28px)", pointerEvents: "none",
      }} />

      <div style={{ position: "relative" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 11, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: `1px solid ${rgba(s.accent, 0.32)}`, background: rgba(s.accent, 0.1),
            fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", color: s.accent,
          }}>{s.short}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: C.white }}>{p.platform}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Platform performance</div>
          </div>
        </div>

        {/* primary — total revenue */}
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: C.white, letterSpacing: "-0.02em" }}>{fmtUsd(p.totalUSD)}</div>
          <div style={{ ...microLabel, marginTop: 5 }}>Total earned</div>
          {/* Explicit scope: platform totals are meaningful-session-scoped (the
              same population usdPerHour is built from), so they can sum to less
              than the account-wide total, which counts every tip. */}
          <div style={{ fontSize: 10.5, color: C.muted, marginTop: 4 }}>in qualifying sessions</div>
        </div>

        {/* primary rates */}
        <div style={{
          marginTop: 18, paddingTop: 14, paddingBottom: 14,
          borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14,
        }}>
          <Metric label="Hourly average" value={p.hours > 0 ? `${fmtUsd(p.usdPerHour)}/hr` : "—"} accent={C.cyan} />
          <Metric label="Streaming time" value={fmtHoursLong(p.hours)} />
        </div>

        {/* secondary */}
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Metric label="Tips" value={Number(p.tips || 0).toLocaleString()} />
          <Metric label="Fans" value={p.uniqueFans != null ? Number(p.uniqueFans).toLocaleString() : "—"} />
          <Metric label="Average tip" value={p.tips > 0 ? fmtUsd(p.avgTipSize) : "—"} />
          <Metric label="Sessions" value={Number(p.sessions || 0).toLocaleString()} />
        </div>

        {/* revenue share */}
        {share != null && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={microLabel}>Revenue share</span>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: C.white }}>{share.toFixed(1)}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div style={{ width: `${Math.max(share, 1.5)}%`, height: "100%", borderRadius: 4, background: CTA_GRADIENT }} />
            </div>
          </div>
        )}

        {/* best window — never shown without its confidence tier */}
        {p.bestLocalDay != null && p.bestLocalHour != null && (
          <div style={{
            marginTop: 18, padding: "11px 14px", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.025)",
          }}>
            <div style={{ ...microLabel, fontSize: 9.5 }}>Best streaming window</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "rgba(241,245,249,0.85)", marginTop: 5 }}>
              {p.bestLocalDay}s · {fmtWindow(p.bestLocalHour)}
            </div>
            <div style={{ fontSize: 10.5, color: C.gold, marginTop: 4 }}>
              {TIER_COPY[p.bestWindowConfidence] || p.bestWindowConfidence} · local time
            </div>
          </div>
        )}

        {onViewBreakdown && (
          <button
            onClick={() => onViewBreakdown(p.platform)}
            style={{
              marginTop: 16, width: "100%", borderRadius: 12, cursor: "pointer",
              border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.035)",
              padding: "11px 0", fontSize: 12.5, fontWeight: 700, color: "rgba(241,245,249,0.65)",
            }}
          >View in Money Map →</button>
        )}
      </div>
    </div>
  )
}

export default function Performance({
  analytics,
  isPro = false,
  onUpgrade,
  onViewPlatform,  // optional — navigates to the Money Map breakdown; the CTA is hidden when absent
  earningsTrend = null, // pre-rendered <DashboardGrowthCharts/> element — see app/dashboard/page.js. It needs raw tips/sessions for its daily/weekly/hourly-of-day modes, which this analytics-only component never receives. Rendered LAST, inside the account-wide block: it answers "how am I doing overall", so it must not be the first thing on a per-platform page.
}) {
  // ── PLATFORMS — canonical, ranked by their own revenue ────────────────
  const platforms = useMemo(
    () => [...(analytics?.platforms || [])].sort((a, b) => b.totalUSD - a.totalUSD),
    [analytics?.platforms]
  )

  // Revenue share: a presentational ratio of canonical totals against their
  // own sum. Deliberately NOT analytics.totalUSD as the denominator — that
  // figure counts tips outside any qualifying session, so shares would not
  // add to 100% and each card would understate itself.
  const platformTotal = useMemo(() => platforms.reduce((s, p) => s + (p.totalUSD || 0), 0), [platforms])
  const shareOf = (p) => (platformTotal > 0 ? (p.totalUSD / platformTotal) * 100 : null)

  const platformEfficiencyGap = useMemo(() => {
    if (platforms.length < 2) return null
    const sorted = [...platforms].sort((a, b) => b.usdPerHour - a.usdPerHour)
    const top = sorted[0], bottom = sorted[sorted.length - 1]
    if (!(top.usdPerHour > 0 && bottom.usdPerHour > 0)) return null
    return { top, bottom, multiple: top.usdPerHour / bottom.usdPerHour }
  }, [platforms])

  // ── WHAT DROVE THE CHANGE — per-platform month-over-month attribution ──
  const delta = analytics?.latestPlatformDelta || null
  const canAttribute = !!delta && delta.platforms.length >= 2 && Math.abs(delta.totalDeltaUSD) >= 1

  // ── ACCOUNT-WIDE CONTEXT ──────────────────────────────────────────────
  // Two evidence blocks that were relocated OUT of the old Overview and have
  // no other home in the product today: the canonical day-of-week evidence
  // and the revenue-dependency figure. They are account-wide, not
  // per-platform, so they sit last and clearly labelled as such rather than
  // being deleted along with the generic trend charts — if Overview ever
  // takes them back, this is the block to move.
  const bestWindow = analytics?.canonicalBestTimes?.bestWindow || null
  const grid = analytics?.canonicalBestTimes?.grid || []
  const evidencedGrid = useMemo(() => grid.filter(g => g.tier !== "insufficient"), [grid])
  // Presentational grouping of the already-canonical grid — sums totalUsd and
  // sessionCount (real counts/totals, not a recomputed rate) into one row per
  // day, purely so the reader can see WHERE the evidence sits. Never re-ranks
  // a "best day" against canonicalBestTimes.bestWindow.
  const byDay = useMemo(() => {
    const map = {}
    evidencedGrid.forEach(g => {
      if (!map[g.localDay]) map[g.localDay] = { day: g.localDay, totalUsd: 0, sessionCount: 0 }
      map[g.localDay].totalUsd += g.totalUsd
      map[g.localDay].sessionCount += g.sessionCount
    })
    return DAY_ORDER.filter(d => map[d]).map(d => map[d])
  }, [evidencedGrid])
  const maxDayUsd = Math.max(...byDay.map(d => d.totalUsd), 1)
  const dep = analytics?.dependencyRisk || null

  // ── MISSED REVENUE — ranked by the measured rate gap, same canonical
  // module the old Overview card read (lib/analytics/missedRevenue.js).
  // Rate gap only; no cumulative dollar total is produced or shown here —
  // that figure was removed account-wide during the analytics freeze as
  // unsupportable.
  const missedByPlatform = useMemo(
    () => Object.entries(analytics?.missedRevenue?.cumulative_by_platform || {})
      .map(([platform, m]) => ({ platform, ...m }))
      .sort((a, b) => b.rateGapUsdPerHour - a.rateGapUsdPerHour),
    [analytics?.missedRevenue]
  )

  // ── COMPARISON TABLE ──────────────────────────────────────────────────
  // Rows declare how to read and render each canonical field; the leader of
  // each row is computed from the current values, never declared by hand, so
  // the highlighting stays correct as the data changes. Rows whose figure
  // isn't measurable for a platform render "—" and can't win.
  const comparisonRows = useMemo(() => ([
    { label: "Revenue",        get: p => p.totalUSD,   fmt: p => fmtUsd(p.totalUSD),  eligible: p => p.totalUSD > 0 },
    { label: "$/hour",         get: p => p.usdPerHour, fmt: p => (p.hours > 0 ? `${fmtUsd(p.usdPerHour)}/hr` : "—"), eligible: p => p.hours > 0 && p.usdPerHour > 0 },
    { label: "Streaming time", get: p => p.hours,      fmt: p => fmtHoursLong(p.hours), eligible: p => p.hours > 0, noLeader: true },
    { label: "Tips",           get: p => p.tips,       fmt: p => Number(p.tips || 0).toLocaleString(), eligible: p => p.tips > 0, noLeader: true },
    { label: "Average tip",    get: p => p.avgTipSize, fmt: p => (p.tips > 0 ? fmtUsd(p.avgTipSize) : "—"), eligible: p => p.tips > 0 },
    { label: "Fans",           get: p => p.uniqueFans, fmt: p => (p.uniqueFans != null ? Number(p.uniqueFans).toLocaleString() : "—"), eligible: p => p.uniqueFans > 0, noLeader: true },
    { label: "Sessions",       get: p => p.sessions,   fmt: p => Number(p.sessions || 0).toLocaleString(), eligible: p => p.sessions > 0, noLeader: true },
  ]), [])

  // ── INSIGHTS — generated from the actual numbers, not written by hand ──
  // Each one is gated on the figure underneath it being measurable, and a
  // claim is only made where more than one platform exists to compare.
  const insights = useMemo(() => {
    if (platforms.length < 2) return []
    const out = []
    const byRevenue = [...platforms].filter(p => p.totalUSD > 0).sort((a, b) => b.totalUSD - a.totalUSD)
    const byHourly  = [...platforms].filter(p => p.hours > 0 && p.usdPerHour > 0).sort((a, b) => b.usdPerHour - a.usdPerHour)
    const byAvgTip  = [...platforms].filter(p => p.tips > 0 && p.avgTipSize > 0).sort((a, b) => b.avgTipSize - a.avgTipSize)
    const byFans    = [...platforms].filter(p => p.uniqueFans > 0).sort((a, b) => b.uniqueFans - a.uniqueFans)

    if (byRevenue.length) {
      const top = byRevenue[0]
      const share = shareOf(top)
      out.push({
        platform: top.platform,
        title: "Highest revenue",
        body: `${fmtUsd(top.totalUSD)} in qualifying sessions${share != null ? ` — ${share.toFixed(1)}% of everything you earned across your platforms` : ""}.`,
      })
    }
    if (byHourly.length) {
      const top = byHourly[0]
      out.push({
        platform: top.platform,
        title: "Highest hourly earnings",
        body: platformEfficiencyGap && platformEfficiencyGap.top.platform === top.platform && platformEfficiencyGap.multiple >= 1.3
          ? `${fmtUsd(top.usdPerHour)}/hr — ${platformEfficiencyGap.multiple.toFixed(1)}x what you earn per hour on ${platformEfficiencyGap.bottom.platform}.`
          : `You're averaging ${fmtUsd(top.usdPerHour)}/hr here across ${top.sessions} qualifying session${top.sessions === 1 ? "" : "s"}.`,
      })
    }
    if (byAvgTip.length && byAvgTip[0].platform !== byHourly[0]?.platform) {
      const top = byAvgTip[0]
      out.push({
        platform: top.platform,
        title: "Highest average tip",
        body: `Your average tip is ${fmtUsd(top.avgTipSize)} here, across ${Number(top.tips).toLocaleString()} tips.`,
      })
    }
    if (byFans.length && byFans[0].platform !== byRevenue[0]?.platform) {
      const top = byFans[0]
      out.push({
        platform: top.platform,
        title: "Largest audience",
        body: `${Number(top.uniqueFans).toLocaleString()} different supporters tipped you here — more than on any other platform.`,
      })
    }
    return out.slice(0, 4)
  }, [platforms, platformEfficiencyGap, platformTotal])

  const hasPlatforms = platforms.length > 0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div>
        <div style={{ ...microLabel, letterSpacing: "0.2em", color: rgba(C.cyan, 0.7) }}>Analytics</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: C.white, letterSpacing: "-0.02em", marginTop: 6 }}>Platform Performance</div>
        <div style={{ fontSize: 13.5, color: C.muted, marginTop: 5, maxWidth: 560 }}>See exactly where your money, time, and fans are coming from.</div>
      </div>

      {!hasPlatforms ? (
        <div style={card()}>
          <div style={{ ...sectionLabel, marginBottom: 10 }}>Your platforms</div>
          <div style={{ fontSize: 13.5, color: C.muted }}>Import your tip history to see how each of your platforms is performing.</div>
        </div>
      ) : (
        <>
          {/* ── 1. YOUR PLATFORMS — the first and most important section ── */}
          <section>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 14 }}>
              <div>
                <div style={sectionLabel}>Your platforms</div>
                <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6 }}>Individual performance across every platform you&apos;ve imported.</div>
              </div>
              <div style={{ fontSize: 11.5, color: C.muted, whiteSpace: "nowrap" }}>
                {platforms.length} platform{platforms.length === 1 ? "" : "s"}
              </div>
            </div>

            {platformEfficiencyGap && platformEfficiencyGap.multiple >= 1.3 && (
              <div style={{ fontSize: 13, color: C.text, marginBottom: 14, padding: "11px 15px", borderRadius: 12, background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.18)", lineHeight: 1.5 }}>
                <strong style={{ color: C.cyan }}>{platformEfficiencyGap.top.platform}</strong> earns <strong style={{ color: C.cyan }}>{platformEfficiencyGap.multiple.toFixed(1)}x</strong> more per hour than <strong>{platformEfficiencyGap.bottom.platform}</strong> — {fmtUsd(platformEfficiencyGap.top.usdPerHour)}/hr vs {fmtUsd(platformEfficiencyGap.bottom.usdPerHour)}/hr.
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: platforms.length > 1 ? "repeat(auto-fit, minmax(300px, 1fr))" : "1fr", gap: 16 }}>
              {platforms.map(p => (
                <PlatformCard key={p.platform} p={p} share={shareOf(p)} onViewBreakdown={onViewPlatform} />
              ))}
            </div>
          </section>

          {/* ── 2. REVENUE DISTRIBUTION ─────────────────────────────── */}
          {platforms.length > 1 && (
            <div style={card()}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <div style={sectionLabel}>Revenue distribution</div>
                  <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6 }}>How your earnings split across platforms.</div>
                </div>
                <div style={{ fontSize: 12.5, color: C.text, whiteSpace: "nowrap" }}>{fmtUsd(platformTotal)} total</div>
              </div>
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                {platforms.map(p => {
                  const share = shareOf(p) ?? 0
                  return (
                    <div key={p.platform}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                        <span style={{ fontSize: 12.5, color: "rgba(241,245,249,0.7)" }}>{p.platform}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: C.white }}>{share.toFixed(1)}% · {fmtUsd0(p.totalUSD)}</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                        <div style={{ width: `${Math.max(share, 1.5)}%`, height: "100%", borderRadius: 4, background: CTA_GRADIENT }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── 3. PLATFORM COMPARISON ──────────────────────────────── */}
          {platforms.length > 1 && (
            <div style={card()}>
              <div style={sectionLabel}>Platform comparison</div>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, marginBottom: 16 }}>
                Every figure measured over the same qualifying sessions. Highlights are calculated from these numbers, not fixed rankings.
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "0 12px 12px 0", fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Metric</th>
                      {platforms.map(p => {
                        const s = styleFor(p.platform)
                        return (
                          <th key={p.platform} title={p.platform} style={{ textAlign: "right", padding: "0 0 12px 12px", fontSize: 12, fontWeight: 800, color: s.accent, whiteSpace: "nowrap" }}>
                            {s.short}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map(row => {
                      const eligible = platforms.filter(row.eligible)
                      const leader = !row.noLeader && eligible.length > 1
                        ? [...eligible].sort((a, b) => row.get(b) - row.get(a))[0]
                        : null
                      return (
                        <tr key={row.label}>
                          <td style={{ padding: "10px 12px 10px 0", fontSize: 12.5, color: C.text, borderTop: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{row.label}</td>
                          {platforms.map(p => {
                            const isLeader = leader && leader.platform === p.platform
                            return (
                              <td key={p.platform} style={{
                                padding: "10px 0 10px 12px", textAlign: "right", fontSize: 12.5, whiteSpace: "nowrap",
                                borderTop: `1px solid ${C.border}`,
                                fontWeight: isLeader ? 800 : 500,
                                color: isLeader ? C.green : "rgba(241,245,249,0.8)",
                              }}>{row.fmt(p)}</td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 12 }}>
                Green marks the leading platform on rates and totals where more than one platform is measurable. Hours, tips, fans and sessions are volume, not performance, so they aren&apos;t ranked.
              </div>
            </div>
          )}

          {/* ── 4. WHAT DROVE THE CHANGE — per-platform attribution ───
                 Always rendered, never silently dropped: a section that
                 vanishes reads as a bug, and the two reasons it can be
                 empty (a single-platform account vs. not enough history)
                 are different facts the reader deserves to be told apart. */}
          <div style={card()}>
            <div style={sectionLabel}>What drove the change</div>
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, marginBottom: 14 }}>
              Month-over-month movement, split by platform.
            </div>
            {!canAttribute ? (
              <div style={{ fontSize: 13.5, color: C.muted }}>
                {delta && delta.platforms.length < 2
                  ? "Single-platform account — your month-over-month change isn't split across platforms."
                  : "Not enough history to attribute this change."}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {delta.platforms.map((p, i) => (
                  <div key={p.platform} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", borderRadius: 10, background: i === 0 ? "rgba(34,211,238,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${i === 0 ? "rgba(34,211,238,0.22)" : C.border}` }}>
                    <div style={{ fontSize: 13.5, color: C.white, fontWeight: i === 0 ? 700 : 500 }}>
                      {i === 0 && (p.deltaUSD >= 0 ? "🔼 " : "🔽 ")}{p.platform}
                      {i === 0 && <span style={{ color: C.muted, fontWeight: 400 }}> contributed the largest share of the {p.deltaUSD >= 0 ? "increase" : "decrease"}</span>}
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: p.deltaUSD >= 0 ? C.green : C.red, whiteSpace: "nowrap" }}>
                      {p.deltaUSD >= 0 ? "+" : ""}{fmtUsd(p.deltaUSD)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 5. WHERE YOU'RE LEAVING MONEY — per-platform rate gap ── */}
          {missedByPlatform.length > 0 && (
            <div style={card()}>
              <div style={sectionLabel}>Where you&apos;re leaving money on the table</div>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, marginBottom: 14 }}>
                Measured rate gap between each platform&apos;s best window and a typical hour on it.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {missedByPlatform.map(m => (
                  <div key={m.platform} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(251,146,60,0.06)", border: "1px solid rgba(251,146,60,0.2)" }}>
                    <div style={{ fontSize: 12.5, color: C.white, minWidth: 0 }}>
                      {m.platform} — {m.bestLocalDay}s {fmtHour(m.bestLocalHour)} earns <strong style={{ color: C.green }}>{fmtUsd(m.bestWindowMedianUsdPerHour)}/hr</strong> vs <strong>{fmtUsd(m.overallMedianUsdPerHour)}/hr</strong> typical
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: C.gold, whiteSpace: "nowrap" }}>+{fmtUsd(m.rateGapUsdPerHour)}/hr gap</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 6. WHAT YOUR DATA SAYS ──────────────────────────────── */}
          {insights.length > 0 && (
            <div style={card()}>
              <div style={sectionLabel}>What your data says</div>
              <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                {insights.map((ins, i) => {
                  const s = styleFor(ins.platform)
                  return (
                    <div key={i} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: `1px solid ${rgba(s.accent, 0.18)}` }}>
                      <div style={{ fontSize: 11.5, fontWeight: 800, color: s.accent, letterSpacing: "0.04em" }}>{ins.platform}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: C.white, marginTop: 6 }}>{ins.title}</div>
                      <div style={{ fontSize: 12.5, color: C.text, marginTop: 5, lineHeight: 1.55 }}>{ins.body}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {/* ── 7. ACCOUNT-WIDE CONTEXT — explicitly not per-platform ─ */}
          {(byDay.length > 1 || (dep && dep.level !== "low") || earningsTrend) && (
            <div style={card()}>
              <div style={sectionLabel}>Account-wide context</div>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6 }}>
                Across every platform combined — not a per-platform figure.
              </div>

              {byDay.length > 1 && (
                <div style={{ marginTop: 20 }}>
                  {/* EXPLICIT UNIT + EXPLICIT RECONCILIATION. These bars are
                      TOTAL $ earned per day; the canonical best window is
                      ranked by MEDIAN $/hour. Those answer different
                      questions, so the longest bar is often NOT the best
                      window — a reader seeing them side by side without this
                      sentence would reasonably read the chart as contradicting
                      the headline. Stating the difference is the honest fix;
                      making the chart agree by re-ranking it would mean
                      inventing a second best-time calculation, which
                      canonical-analytics-rules.md forbids. */}
                  <div style={{ fontSize: 11.5, color: C.text, marginBottom: 4 }}>Total earned by day of week</div>
                  <div style={{ fontSize: 11.5, color: C.text, marginBottom: 12, lineHeight: 1.55, maxWidth: 620, opacity: 0.85 }}>
                    Total dollars, not hourly rate — so your biggest bar isn&apos;t always your best window. Your best window is the one with the highest median <strong style={{ color: C.white }}>$/hour</strong>, which is what actually repeats. Days with too few sessions to trust are left out.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {byDay.map(d => (
                      <div key={d.day} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 38, fontSize: 11.5, color: C.text, flexShrink: 0 }}>{DAY_ABBR[d.day]}</div>
                        <div style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                          <div style={{ width: `${Math.max((d.totalUsd / maxDayUsd) * 100, 3)}%`, height: "100%", borderRadius: 4, background: d.day === bestWindow?.localDay ? CTA_GRADIENT : "rgba(148,163,184,0.35)" }} />
                        </div>
                        <div style={{ width: 60, fontSize: 11.5, color: C.muted, textAlign: "right", flexShrink: 0 }}>{fmtUsd0(d.totalUsd)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {earningsTrend && (
                <div style={{ marginTop: 22 }}>
                  <div style={{ fontSize: 11.5, color: C.text, marginBottom: 10 }}>Earnings trend, all platforms combined</div>
                  {earningsTrend}
                </div>
              )}

              {dep && dep.level !== "low" && (
                <div style={{ marginTop: 20, padding: "13px 16px", borderRadius: 10, background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: C.white, lineHeight: 1.45 }}>
                    {dep.top1Pct}% of your revenue comes from a single fan
                  </div>
                  <div style={{ fontSize: 12.5, color: C.text, marginTop: 5, lineHeight: 1.55 }}>
                    If they stopped tipping you&apos;d lose {fmtUsd0(dep.lossIfTopFanLeaves)} — worth building a second and third relationship to the same size.
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── PRO STRATEGY ───────────────────────────────────────────── */}
      {!isPro && hasPlatforms && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap",
          padding: "20px 24px", borderRadius: 16,
          background: "linear-gradient(115deg, rgba(124,92,255,0.10), rgba(236,72,153,0.08))",
          border: "1px solid rgba(124,92,255,0.26)",
        }}>
          <div style={{ minWidth: 260, flex: 1 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: C.white }}>Want to turn this into a schedule?</div>
            <div style={{ fontSize: 12.5, color: C.text, marginTop: 6, lineHeight: 1.6 }}>
              Pro connects your platform performance, best windows, high-value fan timing, and a forecast into one personalized weekly plan — not just more exact numbers.
            </div>
          </div>
          <BrandButton onClick={() => onUpgrade?.("performance_strategy")}>Build My Strategy →</BrandButton>
        </div>
      )}
    </div>
  )
}
