"use client"
import { useEffect, useMemo, useState } from "react"
import { toLocalDow } from "../../lib/analytics"

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND CENTER
//
// Replaces the Overview tab's former eight stacked sections (KPI wall first,
// insight last) with the hierarchy from the supplied reference:
//
//   DISCOVER    -> "Your next best move" hero: the conclusion, up top
//   EXPLAIN     -> "Why this is your best move": the evidence behind it
//   OPPORTUNITY -> what the gap is worth, only as far as the data supports
//   ACTION      -> one primary CTA
//   MEASURE     -> totals and fans, demoted BELOW the insight
//
// EVERY number rendered here is read from the frozen analytics layer. This
// file performs no aggregation of its own — no reduces over tips or sessions,
// no re-derived hours, rates, windows, or percentages. If a figure is not
// already on `analytics`, it is not shown. That is deliberate: the audit that
// preceded this redesign existed precisely because UI components were
// recomputing metrics locally and disagreeing with one another.
// ═══════════════════════════════════════════════════════════════════════════

// Palette is the dashboard's OWN token set (app/dashboard/page.js's `C`) plus
// the CamCash brand gradient — not a new scheme. The Command Center has to sit
// inside the same shell as every other tab, so it inherits rather than
// redefines. Cyan carries facts/primary actions, purple + pink mark Pro,
// green marks positive movement, gold marks confidence/sample.
const C = {
  bg:      "#05070f",
  card:    "#121826",
  card2:   "#161e2e",
  border:  "#1e2d45",
  border2: "#2a3f5f",
  indigo:  "#7C5CFF",
  cyan:    "#22D3EE",
  pink:    "#EC4899",
  gold:    "#F59E0B",
  blue:    "#60A5FA",
  green:   "#10B981",
  red:     "#F87171",
  white:   "#F1F5F9",
  text:    "#94A3B8",
  muted:   "#475569",
}

// Glass cards: gradient border with glow effect (like Go Live hero card)
const glassCard = {
  background: "rgba(15,20,32,0.75)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(34,211,238,0.28)",
  borderRadius: 16,
  boxShadow: "0 0 40px rgba(59,130,246,0.15), 0 0 80px rgba(236,72,153,0.08)",
  position: "relative",
  overflow: "hidden",
}

// Dark cards: dark background with cyan-pink gradient top border (like Getting Started)
const darkCard = {
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(12,16,34,0.7)",
  position: "relative",
  overflow: "hidden",
}

// The CamCash brand gradient (branding spec): cyan -> purple -> pink.
const CTA_GRADIENT  = "linear-gradient(90deg,#22D3EE 0%,#7C5CFF 48%,#EC4899 100%)"
const HERO_GRADIENT = "linear-gradient(120deg, rgba(34,211,238,0.10) 0%, rgba(124,92,255,0.12) 46%, rgba(236,72,153,0.10) 100%)"
const TOP_GRADIENT  = "linear-gradient(90deg,#22D3EE,#a855f7,#EC4899)"

const fmtUsd  = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtUsd0 = (n) => {
  const v = Number(n || 0)
  // Round to whole dollars only when that does not collapse a real value to
  // "$0" — a $0.32 lifetime fan rendering as "$0 lifetime" reads as a bug.
  return v > 0 && v < 10 ? `$${v.toFixed(2)}` : `$${Math.round(v).toLocaleString("en-US")}`
}
// Hours: 1 decimal below 10h so a sparse account never shows "0h" beside a
// per-hour rate, which reads as a contradiction.
const fmtHours = (h) => (h > 0 && h < 10 ? `${h.toFixed(1)}h` : `${Math.round(h)}h`)
const fmtHour = (h) => {
  const n = ((h % 24) + 24) % 24
  return n === 0 ? "12:00 AM" : n < 12 ? `${n}:00 AM` : n === 12 ? "12:00 PM" : `${n - 12}:00 PM`
}
// bestWindow is an hour bucket; a creator plans a stream, not a minute.
const fmtWindow = (h) => `${fmtHour(h)} – ${fmtHour(h + 2)}`

// Same order lib/analytics/localTime.js's toLocalDow() indexes into and
// lib/analytics/bestTimes.js's grid.localDay strings come from — has to
// match exactly, since bestWindowToday below filters grid.localDay by name.
const LOCAL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

// Confidence vocabulary comes from the canonical tier, never invented.
// bestTimes.js: <2 insufficient, 2–3 promising, 4–5 supported, 6+ high.
const TIER_COPY = {
  high:      "Strong pattern",
  supported: "Supported pattern",
  promising: "Pattern emerging",
}

const card = (extra = {}) => ({ ...glassCard, borderRadius: 16, ...extra })

// Dark card wrapper with gradient top border (for analytics sections like CreatorReport)
function DarkCard({ children, style = {} }) {
  return (
    <div style={{ ...darkCard, ...style }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: TOP_GRADIENT, opacity: 0.85 }} />
      {children}
    </div>
  )
}

const label = {
  fontSize: 10.5, fontWeight: 800, letterSpacing: "0.14em",
  textTransform: "uppercase", color: C.muted,
}

function BrandButton({ children, onClick, style }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: CTA_GRADIENT, border: "none", borderRadius: 10,
        padding: "11px 20px", fontSize: 14, fontWeight: 700, color: C.white,
        cursor: "pointer", whiteSpace: "nowrap",
        boxShadow: "0 4px 18px rgba(124,92,255,0.30)",
        transition: "transform 0.15s, box-shadow 0.15s",
        ...style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(124,92,255,0.45)" }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 18px rgba(124,92,255,0.30)" }}
    >{children}</button>
  )
}

function GhostButton({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: "transparent", border: `1px solid ${C.border}`, borderRadius: 9,
      padding: "9px 15px", fontSize: 13, fontWeight: 600, color: C.text, cursor: "pointer", whiteSpace: "nowrap",
    }}>{children}</button>
  )
}

// One measured fact. Never a claim without a number behind it.
function Chip({ icon, title, value, sub, accent = C.pink }) {
  return (
    <div style={card({ padding: "18px 20px", display: "flex", gap: 13, alignItems: "flex-start", minWidth: 0 })}>
      <div style={{ fontSize: 19, flexShrink: 0, marginTop: 1 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: C.muted, fontWeight: 600 }}>{title}</div>
        {/* wraps rather than truncating — at 2-up on a 390px screen these
            were clipping to "8:00 AM - 1..." and "4 high-valu..." */}
        <div style={{ fontSize: 17, fontWeight: 800, color: accent, marginTop: 5, lineHeight: 1.3 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 5, lineHeight: 1.45 }}>{sub}</div>}
      </div>
    </div>
  )
}

function Stat({ value, label: l, delta, accent = C.white }) {
  return (
    <div style={card({ padding: "18px 16px" })}>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: C.muted }}>{l}</span>
        {delta != null && (
          <span style={{ fontSize: 11, fontWeight: 700, color: delta >= 0 ? C.green : "#F87171" }}>
            {delta >= 0 ? "+" : ""}{delta}%
          </span>
        )}
      </div>
    </div>
  )
}

// Proof beside the recommendation: the recommended window's median $/hr
// against the platform's typical hour.
//
// This replaced a 24-bar hour-of-day chart. That chart could not be made
// honest on real data: scoped to the recommended day, the production CSV has
// eight Wednesday buckets, and hour 6 shows $42.09/hr from ONE session —
// exactly the "one good night" the engine's confidence tiers exist to
// discount. Drawn at true height it dwarfed the $9.52/hr recommendation
// (4 sessions), so the chart visibly argued against the headline above it.
// Restricting the chart to buckets meeting the same 4-session bar left a
// single bar, which read as broken. A 24-bar distribution implies a precision
// this data does not have; a two-value comparison states exactly what the
// recommendation rests on.
function WindowProof({ windowRate, baselineRate, sessions, tierLabel, dayLabel, hourLabel }) {
  const max = Math.max(windowRate, baselineRate, 0.01)
  const Bar = ({ v, title, sub, gradient }) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontSize: 14, color: gradient ? C.white : C.text, fontWeight: gradient ? 700 : 500, minWidth: 0 }}>{title}</span>
        <span style={{ fontSize: 22, fontWeight: 800, color: gradient ? C.cyan : C.text, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>{fmtUsd(v)}/hr</span>
      </div>
      <div style={{ height: 18, borderRadius: 9, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
        <div style={{
          width: `${Math.max((v / max) * 100, 4)}%`, height: "100%", borderRadius: 9,
          background: gradient ? CTA_GRADIENT : "rgba(148,163,184,0.35)",
          boxShadow: gradient ? "0 0 14px rgba(34,211,238,0.35)" : "none",
        }} />
      </div>
      {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 7 }}>{sub}</div>}
    </div>
  )
  return (
    <div>
      <div style={{ ...label, fontSize: 12, marginBottom: 16 }}>Why this window</div>
      <Bar v={windowRate} gradient title={`${dayLabel}s ${hourLabel}`} sub={`${sessions} qualifying session${sessions === 1 ? "" : "s"} · ${tierLabel}`} />
      <Bar v={baselineRate} title="Your typical hour" sub="median across every qualifying session" />
    </div>
  )
}

export default function CommandCenter({
  analytics,
  isPro = false,
  firstName = null,
  onPlanStream,
  onViewFans,
  onSeePerformance,
  onUpgrade,
  // Same tz resolveCreatorTimezone() already produced for this account
  // (page.js's `creatorTz`) — needed so "today" for the Best Window Today
  // card means the CREATOR's today, not the viewing browser's. Falls back
  // to the browser's own tz only if the caller doesn't pass one, same
  // fallback shape resolveCreatorTimezone() itself uses.
  timezone = (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC"),
  // Relocated from the old Overview's "Make Money Right Now" section. The
  // merge (go-live signal + nextMoves + realTimeAlerts, capped at 3) happens
  // in the dashboard where those sources already live; this component only
  // renders the prepared list. Same rule as every other value here: nothing
  // is computed locally.
  nowActions = [],
  onMessageFan,
}) {
  // ── All values READ from the frozen layer. No local aggregation. ──
  const bestWindow   = analytics?.canonicalBestTimes?.bestWindow || null
  const earlySignal  = analytics?.canonicalBestTimes?.earlySignal || null
  const grid         = analytics?.canonicalBestTimes?.grid || []
  const overlap      = analytics?.bestWindowFanOverlap || null
  const hourlyRate   = analytics?.estimatedHourlyRate ?? 0
  const totalUSD     = analytics?.totalUSD ?? 0
  const fanCount     = analytics?.uniqueFanCount ?? 0
  const sessionCount = analytics?.meaningfulSessionCount ?? 0
  const streamHours  = (analytics?.totalStreamMinutes ?? 0) / 60
  const momentum     = analytics?.momentum || null
  const missedByPlat = analytics?.missedRevenue?.cumulative_by_platform || {}
  const whales       = analytics?.whales || []
  const platforms    = analytics?.platforms || []

  // Platform with the largest measured best-window rate gap — same ranking
  // the Missed Revenue card uses.
  const topGap = useMemo(() => {
    const e = Object.entries(missedByPlat)
    if (!e.length) return null
    const [platform, m] = e.sort((a, b) => b[1].rateGapUsdPerHour - a[1].rateGapUsdPerHour)[0]
    return { platform, ...m }
  }, [missedByPlat])

  const topPlatform = useMemo(
    () => [...platforms].sort((a, b) => (b.usdPerHour || 0) - (a.usdPerHour || 0))[0] || null,
    [platforms]
  )

  // ── BEST WINDOW TODAY ────────────────────────────────────────────────
  // "If I go live TODAY, when is historically my best time?" — narrower
  // than the hero's `bestWindow` (that one ranks EVERY day+hour bucket
  // together and can recommend a day the creator isn't streaming today).
  // This filters the same canonical grid down to today's day-of-week first,
  // then applies the exact same eligibility + tie-break rule bestWindow
  // itself uses (median desc, then session count, then most recently
  // active) — same rule, narrower input, not a new ranking method.
  // Recomputes on every render (no memo dep on a stored "today"), so it
  // moves to the next day's data automatically at local midnight, per the
  // "must update automatically based on the current day" requirement.
  const todayLocalDay = LOCAL_DAY_NAMES[toLocalDow(new Date().toISOString(), timezone)]
  const bestWindowToday = useMemo(() => {
    const eligible = grid.filter(g => g.localDay === todayLocalDay && (g.tier === "supported" || g.tier === "high"))
    if (!eligible.length) return null
    return [...eligible].sort((a, b) =>
      b.medianUsdPerHour - a.medianUsdPerHour ||
      b.sessionCount - a.sessionCount ||
      new Date(b.lastActiveAt) - new Date(a.lastActiveAt)
    )[0]
  }, [grid, todayLocalDay])

  // ── DAY PATTERN (for the "CamCash Noticed" strip below) ─────────────
  // A presentational reshaping of the canonical grid — grouping its
  // (day, hour) buckets by day and taking a per-session average — not a
  // new metric. Restricted to 'supported'/'high' tier buckets, same
  // confidence bar bestWindow itself requires, so a single lucky hour on a
  // low-traffic day can't win. This is a DIFFERENT figure than bestWindow
  // (which ranks day+hour together, not day alone), so on some accounts
  // the strongest single window and the strongest single day won't match —
  // that is expected, not a bug.
  const dayPattern = useMemo(() => {
    const byDay = {}
    for (const g of grid) {
      if (g.tier !== "supported" && g.tier !== "high") continue
      if (!byDay[g.localDay]) byDay[g.localDay] = { totalUsd: 0, sessionCount: 0 }
      byDay[g.localDay].totalUsd += g.totalUsd
      byDay[g.localDay].sessionCount += g.sessionCount
    }
    const entries = Object.entries(byDay).filter(([, d]) => d.sessionCount > 0)
    if (!entries.length) return null
    const [localDay, d] = entries.sort((a, b) => (b[1].totalUsd / b[1].sessionCount) - (a[1].totalUsd / a[1].sessionCount))[0]
    return { localDay, avgPerSession: d.totalUsd / d.sessionCount, sessionCount: d.sessionCount }
  }, [grid])

  // ── CAMCASH NOTICED ───────────────────────────────────────────────
  // A small rotating set of secondary, personalized findings — distinct
  // from the hero's single headline recommendation. Every entry reads an
  // already-canonical figure (the day-pattern reshape above, the platform
  // rate already computed for the evidence chips, momentum, or the top
  // fan's lifetime total); nothing here is invented. Entries that have no
  // supporting data simply don't get added, so a sparse account may show
  // one notice or none rather than a placeholder.
  const notices = useMemo(() => {
    const list = []
    if (dayPattern) {
      list.push({
        kicker: "Day pattern",
        title: `${dayPattern.localDay} is your strongest earning day`,
        body: `Your average earnings per session on ${dayPattern.localDay}s are ${fmtUsd(dayPattern.avgPerSession)} when you stream.`,
        metricValue: fmtUsd(dayPattern.avgPerSession),
        metricLabel: `Average ${dayPattern.localDay} earnings`,
        accent: C.cyan,
      })
    }
    if (topPlatform?.platform) {
      list.push({
        kicker: "Platform pattern",
        title: `${topPlatform.platform} is your highest-return platform`,
        body: `You earn ${fmtUsd(topPlatform.usdPerHour)}/hr there across ${topPlatform.sessions} session${topPlatform.sessions === 1 ? "" : "s"}.`,
        metricValue: `${fmtUsd(topPlatform.usdPerHour)}/hr`,
        metricLabel: `${topPlatform.platform} rate`,
        accent: C.indigo,
      })
    }
    // Warns when the account's single best window (not just today's) has
    // gone quiet — reads bestWindow.lastActiveAt, the same canonical field
    // generateLossAlerts()'s 'peak_missed' alert already keys off of for the
    // exact same reason, just surfaced here too since a creator may not have
    // that alert visible in this tab.
    if (bestWindow?.lastActiveAt) {
      const daysSince = Math.floor((Date.now() - new Date(bestWindow.lastActiveAt).getTime()) / 86400000)
      if (daysSince >= 10) {
        list.push({
          kicker: "Missed window",
          title: `You haven't streamed ${bestWindow.localDay}s ${fmtWindow(bestWindow.localHour)} in a while`,
          body: `Your strongest earning window — last streamed ${daysSince} days ago.`,
          metricValue: `${daysSince}d`,
          metricLabel: "Since last streamed here",
          accent: C.gold,
        })
      }
    }
    if (momentum?.label && momentum.label !== "No data") {
      const pct = Math.round(momentum.pct)
      list.push({
        kicker: "Momentum",
        title: momentum.label,
        body: `Last 30 days: ${fmtUsd0(momentum.last30USD)}${Number.isFinite(pct) ? ` (${pct >= 0 ? "+" : ""}${pct}% vs the 30 days before)` : ""}.`,
        metricValue: fmtUsd0(momentum.last30USD),
        metricLabel: "Last 30 days",
        accent: pct >= 0 ? C.green : C.gold,
      })
    }
    // Reuses bestWindowFanOverlap — already computed for the Fans tab's
    // "who shows up in your best window" section, not re-derived here.
    if (bestWindow && overlap?.count > 0) {
      list.push({
        kicker: "Fan pattern",
        title: "Your highest-value fans show up during your best window",
        body: `${overlap.count} of your top supporters tip during ${bestWindow.localDay}s ${fmtWindow(bestWindow.localHour)} — ${fmtUsd0(overlap.totalUSD)} in combined lifetime value.`,
        metricValue: fmtUsd0(overlap.totalUSD),
        metricLabel: "From fans in this window",
        accent: C.pink,
      })
    }
    const topWhale = whales?.[0]
    if (topWhale?.username && topWhale.totalUSD > 0) {
      list.push({
        kicker: "Fan pattern",
        title: `${topWhale.username} is your top lifetime supporter`,
        body: `${topWhale.username} has contributed ${fmtUsd0(topWhale.totalUSD)} lifetime across ${topWhale.tipCount} tip${topWhale.tipCount === 1 ? "" : "s"}.`,
        metricValue: fmtUsd0(topWhale.totalUSD),
        metricLabel: "Lifetime from top fan",
        accent: C.pink,
      })
    }
    return list
  }, [dayPattern, topPlatform, momentum, whales, bestWindow, overlap])

  const [noticeIndex, setNoticeIndex] = useState(0)
  useEffect(() => {
    if (notices.length <= 1) return undefined
    const id = window.setInterval(() => setNoticeIndex((i) => (i + 1) % notices.length), 6000)
    return () => window.clearInterval(id)
  }, [notices.length])
  useEffect(() => { if (noticeIndex >= notices.length) setNoticeIndex(0) }, [noticeIndex, notices.length])
  const activeNotice = notices[noticeIndex] || null

  // Fans inside their typical return window. Uses the canonical
  // expectedNextTip string; no probability percentage is invented, and only
  // fans with >=3 tips (enough history for churnRisk to be meaningful).
  const returningSoon = useMemo(
    () => whales
      .filter(w => w.tipCount >= 3 && (w.expectedNextTip === "Overdue" || w.expectedNextTip === "Tomorrow" || /^In [1-3] days?$/.test(w.expectedNextTip || "")))
      .sort((a, b) => b.totalUSD - a.totalUSD).slice(0, 3),
    [whales]
  )

  const baseline = topGap?.overallMedianUsdPerHour ?? null
  const pctAbove = (bestWindow && baseline > 0)
    ? Math.round(((bestWindow.medianUsdPerHour - baseline) / baseline) * 100) : null
  // Same baseline as the hero's own pctAbove above — so "Best Window Today"
  // and the hero never quote two different "typical hour" numbers on the
  // same screen.
  const todayLiftPct = (bestWindowToday && baseline > 0)
    ? Math.round(((bestWindowToday.medianUsdPerHour - baseline) / baseline) * 100) : null
  // Opportunity is quoted for the WINDOW WE RECOMMEND (a 2-hour bucket, the
  // same span fmtWindow renders), not the account's average session length.
  // Quoting a 1.1-hour basis under a "go live 8-10 AM" headline understated
  // the very thing the CTA asks for.
  const WINDOW_HOURS = 2
  const oppLow  = topGap ? topGap.rateGapUsdPerHour * WINDOW_HOURS : null
  const oppHigh = topGap ? topGap.rateGapUsdPerHour * WINDOW_HOURS * 1.5 : null

  const hasWindow = !!bestWindow

  const greeting = `Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${firstName || "there"}`

  // Pro creators go straight to the Stream Planner. Free creators hit the
  // upgrade modal instead of a locked/broken tab — "stream_plan" carries its
  // own headline/subhead in page.js's UPGRADE_COPY so the pitch names the
  // exact thing they just tried to do.
  const handlePlanStreamClick = () => {
    if (isPro) onPlanStream?.()
    else onUpgrade?.("stream_plan")
  }

  // Hourly distribution for the evidence bar chart — read straight off the
  // canonical grid, summed per local hour. Presentational shaping of an
  // existing canonical array, not a new metric.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 27, fontWeight: 800, color: C.white, letterSpacing: "-0.025em" }}>👋 {greeting}</div>
          <div style={{ fontSize: 15, color: C.muted, marginTop: 6 }}>
            {hasWindow ? "Here's how to make more money today." : "Here's what your data says so far."}
          </div>
        </div>
      </div>

      {/* ── HERO: YOUR NEXT BEST MOVE ──────────────────────────────── */}
      <div style={{
        background: hasWindow ? HERO_GRADIENT : "rgba(15,20,32,0.75)",
        backdropFilter: "blur(20px)",
        border: hasWindow ? "1px solid rgba(34,211,238,0.28)" : `1px solid ${C.border}`,
        borderRadius: 22, padding: 38, position: "relative", overflow: "hidden",
      }}>
        {hasWindow && <div style={{ position: "absolute", right: -70, top: -70, width: 300, height: 300, borderRadius: "50%", background: "rgba(34,211,238,0.12)", filter: "blur(80px)", pointerEvents: "none" }} />}
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: 40, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 420px", minWidth: 0 }}>
            <div style={{ ...label, fontSize: 12, color: hasWindow ? C.cyan : C.muted, marginBottom: 14 }}>Your next best move</div>

            {hasWindow ? (
              <>
                <div style={{ fontSize: 24, fontWeight: 800, color: C.white, letterSpacing: "-0.035em", lineHeight: 1.15 }}>
                  Go live {fmtWindow(bestWindow.localHour)}
                  {bestWindow.topPlatform ? <> on {bestWindow.topPlatform}</> : null}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginTop: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.gold, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.28)", padding: "4px 10px", borderRadius: 20 }}>
                    {TIER_COPY[bestWindow.tier] || "Pattern"}
                  </span>
                  <span style={{ fontSize: 11, color: C.text }}>
                    based on <strong style={{ color: C.white }}>{bestWindow.sessionCount} sessions</strong>
                  </span>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.white, letterSpacing: "-0.02em", lineHeight: 1.25 }}>
                  {earlySignal ? "A pattern is forming" : "Need more history"}
                </div>
                <div style={{ fontSize: 12, color: C.text, marginTop: 6, lineHeight: 1.5, maxWidth: 400 }}>
                  {earlySignal
                    ? <>{earlySignal.localDay}s around {fmtWindow(earlySignal.localHour)} is strongest, {earlySignal.sessionCount} session{earlySignal.sessionCount === 1 ? "" : "s"} so far.</>
                    : <>Keep importing data for reliable recommendations.</>}
                </div>
              </>
            )}

            <div style={{ marginTop: 12 }}>
              <BrandButton onClick={handlePlanStreamClick} style={{ padding: "12px 24px", fontSize: 14, borderRadius: 12 }}>{hasWindow ? "Plan My Stream" : "Open Stream Planner"}</BrandButton>
            </div>
          </div>

          {/* RIGHT: opportunity + the chart that proves it. The reference
              puts the earnings-per-hour distribution here; leaving this half
              empty was the single largest visual defect in the first pass. */}
          {hasWindow && (
            <div style={{ flex: "1 1 340px", minWidth: 280 }}>
              {topGap && (
                <div style={{ textAlign: "right", marginBottom: 16 }}>
                  <div style={{ ...label, color: C.muted }}>Estimated opportunity</div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: C.green, letterSpacing: "-0.03em", marginTop: 6 }}>
                    +{fmtUsd0(oppLow)} – {fmtUsd0(oppHigh)}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>
                    if you stream the full 2-hour window, at the {fmtUsd(topGap.rateGapUsdPerHour)}/hr gap
                  </div>
                </div>
              )}
              {baseline != null && (
                <WindowProof
                  windowRate={bestWindow.medianUsdPerHour}
                  baselineRate={baseline}
                  sessions={bestWindow.sessionCount}
                  tierLabel={TIER_COPY[bestWindow.tier] || "Pattern"}
                  dayLabel={bestWindow.localDay}
                  hourLabel={fmtWindow(bestWindow.localHour)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── CAMCASH NOTICED ────────────────────────────────────────────
          Sits directly beneath the hero, same as the reference: a slim,
          rotating strip of secondary findings so the dashboard has a fresh
          reason to check back, without competing with the hero's single
          headline recommendation above it. */}
      {activeNotice && (
        <div style={card({ padding: "18px 22px", position: "relative", overflow: "hidden" })}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 320px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: `${activeNotice.accent}18`, border: `1px solid ${activeNotice.accent}35`,
                  fontSize: 13, color: activeNotice.accent,
                }}>✦</div>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: activeNotice.accent }}>
                  CamCash Noticed · {activeNotice.kicker}
                </span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.white, marginTop: 11, letterSpacing: "-0.015em", lineHeight: 1.3 }}>
                {activeNotice.title}
              </div>
              <div style={{ fontSize: 13, color: C.text, marginTop: 6, lineHeight: 1.55 }}>{activeNotice.body}</div>
            </div>

            {activeNotice.metricValue && (
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: C.white, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>{activeNotice.metricValue}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4, whiteSpace: "nowrap" }}>{activeNotice.metricLabel}</div>
              </div>
            )}
          </div>

          {/* Pips double as manual navigation (click jumps straight to that
              insight instead of waiting on the 6s timer); arrows step
              one at a time for anyone who'd rather not aim at a 5px pip. */}
          {notices.length > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
              <div style={{ display: "flex", gap: 5 }}>
                {notices.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setNoticeIndex(i)}
                    aria-label={`Show insight ${i + 1} of ${notices.length}`}
                    style={{
                      width: i === noticeIndex ? 18 : 5, height: 5, borderRadius: 3, border: "none", padding: 0,
                      background: i === noticeIndex ? activeNotice.accent : "rgba(255,255,255,0.14)",
                      cursor: "pointer", transition: "width 0.25s ease, background 0.25s ease",
                    }}
                  />
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setNoticeIndex((i) => (i - 1 + notices.length) % notices.length)}
                  aria-label="Previous insight"
                  style={{
                    width: 26, height: 26, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.03)", color: C.text, cursor: "pointer",
                    fontSize: 13, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >‹</button>
                <button
                  onClick={() => setNoticeIndex((i) => (i + 1) % notices.length)}
                  aria-label="Next insight"
                  style={{
                    width: 26, height: 26, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.03)", color: C.text, cursor: "pointer",
                    fontSize: 13, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >›</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── EVIDENCE CHIPS ─────────────────────────────────────────── */}
      {hasWindow && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(158px, 1fr))", gap: 11 }}>
          <Chip icon="🕐" title="Best window" value={fmtWindow(bestWindow.localHour)} sub={`${bestWindow.localDay}s · ${TIER_COPY[bestWindow.tier] || "Pattern"}`} />
          <Chip icon="👥" title={overlap?.count ? "Fans active in it" : "Fan overlap"}
                value={overlap?.count ? `${overlap.count} high-value fan${overlap.count === 1 ? "" : "s"}` : "None yet"}
                sub={overlap?.count ? `${fmtUsd0(overlap.totalUSD)} lifetime combined` : "No repeat fans in this window"}
                accent={overlap?.count ? C.indigo : C.muted} />
          {topPlatform && (
            <Chip icon="📈" title={`${topPlatform.platform} is #1`} value={`${fmtUsd(topPlatform.usdPerHour)}/hr`} sub={`${topPlatform.sessions} sessions · ${fmtHours(topPlatform.hours || 0)}`} accent={C.cyan} />
          )}
          <Chip icon="📊" title="Sample behind it" value={`${bestWindow.sessionCount} session${bestWindow.sessionCount === 1 ? "" : "s"}`} sub={TIER_COPY[bestWindow.tier] || "Pattern"} accent={C.gold} />
        </div>
      )}

      {/* ── RIGHT NOW ──────────────────────────────────────────────
          The hero says what to do next; this says what is worth doing in
          the next few minutes. Time-sensitive and capped at three, so it
          stays an action list rather than the alert wall it replaced. */}
      {nowActions.length > 0 && (
        <div style={card({ padding: 20 })}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
            <span style={{ fontSize: 17 }}>⚡</span>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.white }}>Right now</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {nowActions.map((a, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
                padding: "14px 15px", borderRadius: 12,
                background: i === 0 ? `${a.color}18` : `${a.color}0d`,
                border: `1px solid ${i === 0 ? a.color + "50" : a.color + "28"}`,
              }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 19, flexShrink: 0 }}>{a.icon}</span>
                  <div style={{ fontSize: 14, color: C.white, lineHeight: 1.55, minWidth: 0, overflowWrap: "anywhere" }}>{a.text}</div>
                </div>
                {a.cta && a.username && (
                  <button onClick={() => onMessageFan?.(a.username)}
                    aria-label={`Message ${a.username}`} title="Message fan"
                    style={{ flexShrink: 0, padding: "7px 12px", borderRadius: 9, background: "rgba(236,72,153,0.14)", border: "1px solid rgba(236,72,153,0.3)", color: C.pink, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                    Message
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart moved into the hero (above). The standalone "Why this is your
          best move" card was removed: it duplicated the same distribution in a
          second card while the hero sat half-empty. */}


      {/* ── FANS + PERFORMANCE ─────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 14, alignItems: "start" }}>
        <div style={card({ padding: 20 })}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.white }}>Who deserves your attention</div>
          </div>
          {returningSoon.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {returningSoon.map((w, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 15px", borderRadius: 12, background: C.card2, border: `1px solid ${C.border}` }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#22D3EE,#7C5CFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: C.white, flexShrink: 0 }}>
                    {w.username.slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: C.white, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.username}</div>
                    <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4, lineHeight: 1.45 }}>
                      {fmtUsd0(w.totalUSD)} lifetime · {w.tipCount} tips · usually every ~{Math.round(w.avgDaysBetweenTips)}d
                    </div>
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, padding: "6px 11px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0,
                    background: w.expectedNextTip === "Overdue" ? "rgba(236,72,153,0.14)" : "rgba(16,185,129,0.13)",
                    color: w.expectedNextTip === "Overdue" ? C.pink : C.green }}>
                    {w.expectedNextTip}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.65 }}>
              No supporters are inside their typical return window right now. This fills in as your fans build a repeat pattern — it needs at least 3 tips from someone before it will make a call.
            </div>
          )}
          <div style={{ marginTop: 14 }}><GhostButton onClick={onViewFans}>See all fans →</GhostButton></div>
        </div>

        <div style={card({ padding: 20 })}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 14 }}>Your money story</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))", gap: 10 }}>
            <Stat value={fmtUsd(totalUSD)} label="Total earnings" accent={C.white} />
            <Stat value={`${fmtUsd(hourlyRate)}`} label="Per hour" accent={C.green} />
            <Stat value={fmtHours(streamHours)} label="Total hours" accent={C.white} />
            <Stat value={sessionCount.toLocaleString()} label="Sessions" accent={C.white} />
            <Stat value={fanCount.toLocaleString()} label="Fans" accent={C.indigo} />
            {momentum && momentum.label !== "No data" && (
              <Stat value={fmtUsd0(momentum.last30USD)} label="Last 30 days" delta={Math.round(momentum.pct)} accent={C.white} />
            )}
          </div>
          <div style={{ marginTop: 14 }}><GhostButton onClick={onSeePerformance}>View full performance →</GhostButton></div>
        </div>
      </div>

      {/* ── PRO STRATEGY FOOTER ────────────────────────────────────────
          One contextual upsell, not a paywall on every section. Only
          rendered when there is a real, personalized thing being held back. */}
      {!isPro && hasWindow && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 22, flexWrap: "wrap",
          padding: "24px 26px", borderRadius: 18,
          background: "linear-gradient(115deg, rgba(124,92,255,0.10), rgba(236,72,153,0.08))",
          border: "1px solid rgba(124,92,255,0.26)",
        }}>
          <div style={{ minWidth: 280, flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.white, letterSpacing: "-0.015em" }}>
              You found the window. Pro builds the week around it.
            </div>
            <div style={{ fontSize: 14, color: C.text, marginTop: 8, lineHeight: 1.65 }}>
              You already know <strong style={{ color: C.cyan }}>{bestWindow.localDay}s {fmtWindow(bestWindow.localHour)}</strong> is where you earn most
              {topGap ? <> and that the gap there is worth <strong style={{ color: C.green }}>{fmtUsd(topGap.rateGapUsdPerHour)}/hr</strong></> : null}.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 13 }}>
              {[
                `Every ranked window for the week, not just the top one`,
                topGap ? `Which platform to run in each window — ${topGap.platform} is only your biggest gap today` : `Which platform to run in each window`,
                overlap?.count ? `Alerts when your ${overlap.count} high-value fan${overlap.count === 1 ? "" : "s"} in this window go quiet` : `Alerts when a high-value supporter goes quiet`,
                `A forecast you can hold next week's schedule against`,
              ].map((line, i) => (
                <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13.5, color: C.text, lineHeight: 1.5 }}>
                  <span style={{ color: C.indigo, fontWeight: 800, flexShrink: 0 }}>→</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>
          <BrandButton onClick={() => onUpgrade?.("command_center_strategy")} style={{ padding: "14px 26px", fontSize: 15.5, borderRadius: 12, flexShrink: 0 }}>Build My Strategy →</BrandButton>
        </div>
      )}
    </div>
  )
}
