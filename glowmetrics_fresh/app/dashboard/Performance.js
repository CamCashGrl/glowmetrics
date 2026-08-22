"use client"
import { useMemo } from "react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts"
import { UnlockButton } from './components/LockedModule'

// ═══════════════════════════════════════════════════════════════════════════
// PERFORMANCE
//
// Answers "what happened?" — the evidence/diagnosis layer beneath the Command
// Center's "what should I do next?". Every value here is read from the frozen
// analytics layer (lib/analytics.js's aggregateRows()). This file performs no
// aggregation of its own — no reduces over raw tips or sessions, no re-derived
// rates, windows, or percentages. Where a chart needs to group an
// ALREADY-CANONICAL array for presentation (e.g. summing canonicalBestTimes'
// per-bucket totals into a day-level bar), that is reshaping an existing
// canonical result, not computing a new one — the same distinction
// CommandCenter.js's own contract draws.
//
// Two things this component deliberately does NOT do:
//   - Recompute "best time." Section 8 reads analytics.canonicalBestTimes
//     exclusively, filtered to the SAME confidence tiers the engine itself
//     uses to decide what counts as evidence (never 'insufficient').
//   - Claim a causal story the data can't support. Section 2/3's findings
//     are gated on the actual sign of the canonical month-over-month
//     figures — if the data doesn't support a sentence, the sentence isn't
//     shown, not replaced with a vaguer one.
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  bg: "#05070f", card: "#121826", card2: "#161e2e", border: "#1e2d45",
  indigo: "#7C5CFF", cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B",
  green: "#10B981", red: "#F87171", white: "#F1F5F9", text: "#94A3B8", muted: "#475569",
}
const glassCard = {
  background: "rgba(15,20,32,0.75)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)",
}
// The local BrandButton is gone: this file was defining a THIRD button style
// in the app. The conversion system has one signature CTA
// (components/ui/Button.js, surfaced as UnlockButton), and this page now uses
// it like every other upgrade surface. The gradient itself stays, renamed for
// what it actually still does here — fill comparison bars, not buttons.
const BAR_GRADIENT = "linear-gradient(90deg,#22D3EE 0%,#7C5CFF 48%,#EC4899 100%)"
const card = (extra = {}) => ({ ...glassCard, borderRadius: 16, padding: 22, ...extra })
// C.text, not C.muted — at 12px uppercase on the glass card, #475569 rendered
// too dim to read comfortably in the first rendered pass. These are the
// section headings; they carry the page's structure.
const sectionLabel = { fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text }

const fmtUsd = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtUsd0 = (n) => `$${Math.round(Number(n || 0)).toLocaleString("en-US")}`
const fmtHours = (h) => (h > 0 && h < 10 ? `${h.toFixed(1)}h` : `${Math.round(h || 0)}h`)
const fmtHour = (h) => { const H = ((h % 24) + 24) % 24; return H === 0 ? "12 AM" : H < 12 ? `${H} AM` : H === 12 ? "12 PM" : `${H - 12} PM` }
const fmtWindow = (h) => `${fmtHour(h)} – ${fmtHour(h + 2)}`
const fmtMonth = (ym) => { const [y, m] = ym.split("-"); return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" }) }
const DAY_ABBR = { Sunday: "Sun", Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri", Saturday: "Sat" }
const DAY_ORDER = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

const TIER_COPY = { high: "Strong pattern", supported: "Supported pattern", promising: "Early signal" }


function SnapshotStat({ value, label, accent = C.white }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: accent, letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>{label}</div>
    </div>
  )
}

// Two-value comparison bar — same visual language as Command Center's
// WindowProof, reused rather than re-invented, because it already solves the
// exact problem Section 8 has: a 24-bar/7-day chart can be dwarfed by one
// high-outlier bucket, arguing against the very window it's supposed to
// support. A bounded comparison states only what the data can carry.
function CompareBars({ title, a, b }) {
  const max = Math.max(a.value, b.value, 0.01)
  return (
    <div>
      {title && <div style={{ ...sectionLabel, marginBottom: 14 }}>{title}</div>}
      {[a, b].map((row, i) => (
        <div key={i} style={{ marginBottom: i === 0 ? 16 : 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: i === 0 ? C.white : C.text, fontWeight: i === 0 ? 700 : 500 }}>{row.label}</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: i === 0 ? C.cyan : C.text }}>{row.display}</span>
          </div>
          <div style={{ height: 12, borderRadius: 6, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
            <div style={{ width: `${Math.max((row.value / max) * 100, 3)}%`, height: "100%", borderRadius: 6, background: i === 0 ? BAR_GRADIENT : "rgba(148,163,184,0.35)" }} />
          </div>
          {row.sub && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>{row.sub}</div>}
        </div>
      ))}
    </div>
  )
}

const ChartTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "#1e2840", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 13px", fontSize: 12 }}>
      <div style={{ color: C.muted, marginBottom: 3 }}>{label}</div>
      <div style={{ color: C.cyan, fontWeight: 700 }}>{unit === "usd" ? fmtUsd(payload[0].value) : `${fmtUsd(payload[0].value)}/hr`}</div>
    </div>
  )
}

// $/hour trend — the one chart this file draws itself, because no existing
// component has an hourly-rate series. Reads analytics.monthlyData.usdPerHour
// directly (added to the frozen layer alongside this redesign, same weighted
// numerator/denominator as the account-wide estimatedHourlyRate — see
// lib/analytics.js). Months with no rate-eligible sessions (usdPerHour: null)
// are dropped rather than charted as zero, which would read as a real crash
// in earnings rather than an absence of data.
function HourlyRateTrend({ monthlyData }) {
  const points = useMemo(
    () => (monthlyData || [])
      .filter(m => m.usdPerHour != null)
      .slice(-12)
      .map(m => ({ month: m.month, label: fmtMonth(m.month), usdPerHour: m.usdPerHour })),
    [monthlyData]
  )
  if (points.length < 2) {
    return <div style={{ fontSize: 13, color: C.muted, padding: "20px 0" }}>Not enough month-over-month history yet to chart your hourly rate.</div>
  }
  const avg = points.reduce((s, p) => s + p.usdPerHour, 0) / points.length
  return (
    <div>
      <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10 }}>$ per streamed hour, by month — dashed line is the average across the months shown</div>
      <div style={{ width: "100%", height: 180 }}>
        <ResponsiveContainer>
          <LineChart data={points} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} />
            <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `$${v}`} />
            <ReferenceLine y={avg} stroke={C.muted} strokeDasharray="4 4" />
            <Tooltip content={<ChartTooltip unit="rate" />} />
            <Line type="monotone" dataKey="usdPerHour" stroke={C.cyan} strokeWidth={2.5} dot={{ r: 3, fill: C.cyan }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLE-PLATFORM PERFORMANCE
//
// The one-platform answer to "how am I doing?", replacing a comparison of one
// thing. Named for the creator's ACTUAL platform, read from the data — never
// hard-coded, so it says "Your BongaCams performance" for a BongaCams creator.
//
// Progressive by data volume, because a premium product should not render the
// same layout for 1 session and 200:
//
//   sessions < MIN_TREND_SESSIONS  KPI row + an honest "still learning" note.
//                                  No chart, no momentum, no recommendation —
//                                  there is nothing yet that would be true.
//   sessions >= MIN_TREND_SESSIONS KPI row + momentum + opportunity, each
//                                  independently gated on its own evidence.
//
// Computes nothing. Every value is passed in from the frozen analytics layer
// exactly as the multi-platform branch reads it, and nothing here is gated by
// plan — this section adds no paywall.
// ═══════════════════════════════════════════════════════════════════════════

// The canonical bar for "we can say something about your trend". Matches the
// threshold the session-distribution split already uses, so the page does not
// invent a second idea of what "enough sessions" means.
const MIN_TREND_SESSIONS = 3

function SinglePlatformPerformance({ p, sp, delta, curMonth }) {
  const learning = (p.sessions || 0) < MIN_TREND_SESSIONS

  // Momentum needs a real month-over-month comparison. curMonth.prevMonth is
  // the engine's own "was there a previous active month" signal.
  const momentum = !learning && curMonth?.prevMonth != null && curMonth?.growthPct != null
    ? { pct: curMonth.growthPct, up: curMonth.growthPct >= 0 }
    : null

  // The platform's own measured delta, when the engine produced one for it.
  const platDelta = delta?.platforms?.find(x => x.platform === p.platform)?.deltaUSD

  // An earning window is only named once the canonical tier says it is backed
  // by repeat sessions. "low" confidence is not a recommendation.
  const window = !learning && p.bestLocalDay != null && p.bestLocalHour != null
    && p.bestWindowConfidence && p.bestWindowConfidence !== "low"
    ? { day: p.bestLocalDay, hour: p.bestLocalHour }
    : null

  return (
    <div style={card()}>
      <div style={{ ...sectionLabel, marginBottom: 4 }}>Your {p.platform} performance</div>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 16 }}>
        Everything below is measured on {p.platform}, the platform you stream on.
      </div>

      {/* KPI row — the creator's real numbers, at the top, unconditionally.
          These exist from the very first import, so there is no state in which
          this page has nothing to say. */}
      <div className="perf-solo-kpis">
        {[
          { v: fmtUsd(p.totalUSD), l: "earned in qualifying sessions", c: C.green },
          { v: `${fmtUsd(p.usdPerHour)}/hr`, l: "your hourly rate", c: C.cyan },
          { v: String(p.sessions ?? 0), l: (p.sessions === 1 ? "session" : "sessions"), c: C.white },
          { v: fmtHours(p.hours), l: "streamed", c: C.white },
        ].map(k => (
          <div key={k.l} className="perf-solo-kpi">
            <div className="perf-solo-kpi-v" style={{ color: k.c }}>{k.v}</div>
            <div className="perf-solo-kpi-l" style={{ color: C.muted }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* B — LOW DATA. A compact, honest note instead of a stretched chart or
          a recommendation the history cannot support. It states the real
          threshold rather than saying "no data". */}
      {learning ? (
        <div className="perf-solo-learning">
          <div style={{ fontSize: 13.5, fontWeight: 800, color: C.white, marginBottom: 5 }}>
            We&apos;re still learning your pattern
          </div>
          <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.6 }}>
            {p.sessions === 0
              ? `Once you have ${MIN_TREND_SESSIONS} qualifying sessions on ${p.platform}, this section starts showing your trend and your strongest earning window.`
              : `${p.sessions} qualifying session${p.sessions === 1 ? "" : "s"} so far. At ${MIN_TREND_SESSIONS} we can start showing your trend and your strongest earning window — the numbers above are already real and counted.`}
          </div>
        </div>
      ) : (
        <div className="perf-solo-rows">
          {/* MOMENTUM — the DOLLAR movement on this platform. Deliberately not
              the percentage: "What changed" two sections up already states
              "Earnings increased 12% vs your last active month", and repeating
              it here is exactly the restating-the-same-fact duplication the
              redesign stripped out of Overview. This adds the figure that
              section does not carry. Rendered only when a real prior month and
              a measurable delta both exist. */}
          {momentum && platDelta != null && Math.abs(platDelta) >= 1 && (
            <div className="perf-solo-row">
              <div className="perf-solo-row-k" style={{ color: C.muted }}>Momentum</div>
              <div className="perf-solo-row-v" style={{ color: C.white }}>
                <strong style={{ color: momentum.up ? C.green : C.red }}>
                  {platDelta >= 0 ? "+" : "−"}{fmtUsd(Math.abs(platDelta))}
                </strong> on {p.platform} since your last active month
              </div>
            </div>
          )}

          {/* EFFICIENCY — one line, not a second copy of the Session
              performance section directly above. That section already draws
              the full strong-vs-weak comparison; repeating it here would be
              exactly the duplication the redesign removed elsewhere. */}
          {sp?.avgMeaningfulSessionUSD != null && (
            <div className="perf-solo-row">
              <div className="perf-solo-row-k" style={{ color: C.muted }}>Efficiency</div>
              <div className="perf-solo-row-v" style={{ color: C.white }}>
                <strong style={{ color: C.cyan }}>{fmtUsd(sp.avgMeaningfulSessionUSD)}</strong> per session
                {sp.avgMeaningfulSessionMinutes != null && <> over about <strong>{sp.avgMeaningfulSessionMinutes}m</strong></>}
              </div>
            </div>
          )}

          {/* OPPORTUNITY — a named window only when the canonical confidence
              tier backs it. Never a guess from a single good night. */}
          {window && (
            <div className="perf-solo-row">
              <div className="perf-solo-row-k" style={{ color: C.muted }}>Opportunity</div>
              <div className="perf-solo-row-v" style={{ color: C.white }}>
                Your strongest window is <strong style={{ color: C.gold }}>{window.day}s {fmtHour(window.hour)}</strong>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Performance({
  analytics,
  isPro = false,
  onUpgrade,
  earningsTrend = null, // pre-rendered <DashboardGrowthCharts/> element — see app/dashboard/page.js. It needs raw tips/sessions for its daily/weekly/hourly-of-day modes, which this analytics-only component never receives.
}) {
  // ── SNAPSHOT ─────────────────────────────────────────────────────────
  const totalUSD = analytics?.totalUSD ?? 0
  const hourlyRate = analytics?.estimatedHourlyRate ?? 0
  const sessionCount = analytics?.meaningfulSessionCount ?? 0
  const streamHours = (analytics?.totalStreamMinutes ?? 0) / 60
  const fanCount = analytics?.uniqueFanCount ?? 0

  // ── WHAT CHANGED ─────────────────────────────────────────────────────
  const monthlyData = analytics?.monthlyData || []
  const curMonth = monthlyData.length ? monthlyData[monthlyData.length - 1] : null
  const hasChange = !!curMonth && curMonth.prevMonth != null

  const changeSupport = useMemo(() => {
    if (!hasChange) return null
    const { growthPct, hoursGrowthPct, usdPerHourGrowthPct } = curMonth
    if (growthPct == null) return null
    if (growthPct > 0 && hoursGrowthPct != null && hoursGrowthPct <= 0 && usdPerHourGrowthPct != null && usdPerHourGrowthPct > 0) {
      return "Most of the improvement came from stronger session efficiency rather than more hours."
    }
    if (growthPct > 0 && hoursGrowthPct != null && hoursGrowthPct > 0) {
      return "The increase tracked with more hours streamed, not a change in your hourly rate."
    }
    if (growthPct < 0 && usdPerHourGrowthPct != null && usdPerHourGrowthPct < 0) {
      return "The decline was driven by a lower rate per hour, not fewer hours streamed."
    }
    if (growthPct < 0 && hoursGrowthPct != null && hoursGrowthPct < 0 && usdPerHourGrowthPct != null && usdPerHourGrowthPct >= 0) {
      return "The decline tracked with fewer hours streamed — your rate per hour held up."
    }
    return null
  }, [hasChange, curMonth])

  // ── WHAT DROVE THE CHANGE ────────────────────────────────────────────
  const delta = analytics?.latestPlatformDelta || null
  const canAttribute = !!delta && delta.platforms.length >= 2 && Math.abs(delta.totalDeltaUSD) >= 1

  // ── SESSION PERFORMANCE ──────────────────────────────────────────────
  const sp = analytics?.sessionPerformance || null
  const lowSignalCount = analytics?.lowSignalSessionCount ?? 0

  // ── PLATFORM PERFORMANCE ─────────────────────────────────────────────
  const platforms = useMemo(() => [...(analytics?.platforms || [])].sort((a, b) => b.totalUSD - a.totalUSD), [analytics?.platforms])
  const platformEfficiencyGap = useMemo(() => {
    if (platforms.length < 2) return null
    const sorted = [...platforms].sort((a, b) => b.usdPerHour - a.usdPerHour)
    const top = sorted[0], bottom = sorted[sorted.length - 1]
    if (!(top.usdPerHour > 0 && bottom.usdPerHour > 0)) return null
    return { top, bottom, multiple: top.usdPerHour / bottom.usdPerHour }
  }, [platforms])

  // ── MISSED REVENUE — ranked by the measured rate gap, same canonical
  // module the old Overview card read (lib/analytics/missedRevenue.js).
  // Rate gap only; no cumulative dollar total is produced or shown here —
  // that figure was removed account-wide during the analytics freeze as
  // unsupportable (rate gap x off-window hours implied every off-window
  // hour could move to a slot that only recurs ~1h/week).
  const missedByPlatform = useMemo(
    () => Object.entries(analytics?.missedRevenue?.cumulative_by_platform || {})
      .map(([platform, m]) => ({ platform, ...m }))
      .sort((a, b) => b.rateGapUsdPerHour - a.rateGapUsdPerHour),
    [analytics?.missedRevenue]
  )

  // ── DAY / TIME ANALYSIS ──────────────────────────────────────────────
  const bestWindow = analytics?.canonicalBestTimes?.bestWindow || null
  const earlySignal = analytics?.canonicalBestTimes?.earlySignal || null
  const grid = analytics?.canonicalBestTimes?.grid || []
  const evidencedGrid = useMemo(() => grid.filter(g => g.tier !== "insufficient"), [grid])
  // Presentational grouping of the already-canonical grid — sums totalUsd
  // and sessionCount (real counts/totals, not a recomputed rate) into one
  // row per day, purely so the reader can see WHERE the evidence sits.
  // Never re-ranks a "best day" against canonicalBestTimes.bestWindow.
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

  // ── KEY FINDINGS ──────────────────────────────────────────────────────
  const findings = useMemo(() => {
    const out = []
    if (sp?.distribution) {
      const { aboveMedian, belowOrAtMedian } = sp.distribution
      if (aboveMedian.avgUsdPerHour > 0 && belowOrAtMedian.avgUsdPerHour > 0) {
        const ratio = Math.round((aboveMedian.avgUsdPerHour / belowOrAtMedian.avgUsdPerHour) * 10) / 10
        if (ratio >= 1.5) {
          out.push({
            what: `Your strongest ${aboveMedian.count} sessions earn ${ratio}x more per hour than your weaker ${belowOrAtMedian.count}`,
            why: `$${aboveMedian.avgUsdPerHour}/hr vs $${belowOrAtMedian.avgUsdPerHour}/hr — what's different about the strong ones is worth repeating.`,
          })
        }
      }
    }
    if (platformEfficiencyGap && platformEfficiencyGap.multiple >= 1.5) {
      const { top, bottom, multiple } = platformEfficiencyGap
      out.push({
        what: `${top.platform} earns ${multiple.toFixed(1)}x more per hour than ${bottom.platform}`,
        why: `${fmtUsd(top.usdPerHour)}/hr vs ${fmtUsd(bottom.usdPerHour)}/hr — shifting time toward ${top.platform} compounds.`,
      })
    }
    const overlap = analytics?.bestWindowFanOverlap
    if (bestWindow && overlap?.count > 0) {
      out.push({
        what: `${overlap.count} of your highest-value supporters overlap with your strongest window`,
        why: `${fmtUsd0(overlap.totalUSD)} in combined lifetime value shows up specifically in ${bestWindow.localDay}s ${fmtWindow(bestWindow.localHour)}.`,
      })
    }
    const dep = analytics?.dependencyRisk
    if (dep && dep.level !== "low") {
      out.push({
        what: `${dep.top1Pct}% of your revenue comes from a single fan`,
        why: `If they stop tipping, you'd lose ${fmtUsd0(dep.lossIfTopFanLeaves)} — worth building a second and third relationship to the same size.`,
      })
    }
    if (bestWindow && bestWindow.tier === "high") {
      out.push({
        what: `${bestWindow.localDay}s ${fmtWindow(bestWindow.localHour)} is a strong, repeatable pattern`,
        why: `${bestWindow.sessionCount} qualifying sessions back it — this is your most reliable window, not a lucky night.`,
      })
    }
    return out.slice(0, 5)
  }, [sp, platformEfficiencyGap, analytics, bestWindow])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: C.white, letterSpacing: "-0.02em" }}>Performance</div>
        <div style={{ fontSize: 13.5, color: C.muted, marginTop: 5 }}>What happened, and what's behind it.</div>
      </div>

      {/* ── 1. SNAPSHOT — compact, not the visual focus ───────────────── */}
      <div style={{ ...card({ padding: "16px 20px" }), display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 16 }}>
        <SnapshotStat value={fmtUsd(totalUSD)} label="Total earnings" />
        <SnapshotStat value={`${fmtUsd(hourlyRate)}/hr`} label="Per hour" accent={C.cyan} />
        <SnapshotStat value={sessionCount.toLocaleString()} label="Sessions" />
        <SnapshotStat value={fmtHours(streamHours)} label="Hours" />
        <SnapshotStat value={fanCount.toLocaleString()} label="Fans" accent={C.indigo} />
      </div>

      {/* ── 2. WHAT CHANGED ────────────────────────────────────────── */}
      <div style={card()}>
        <div style={{ ...sectionLabel, marginBottom: 12 }}>What changed</div>
        {!hasChange ? (
          <div style={{ fontSize: 14, color: C.text }}>Not enough month-over-month history yet — this fills in after your second active month.</div>
        ) : (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.white, lineHeight: 1.5 }}>
              Earnings {curMonth.growthPct >= 0 ? "increased" : "decreased"}{" "}
              <span style={{ color: curMonth.growthPct >= 0 ? C.green : C.red }}>{Math.abs(curMonth.growthPct)}%</span>{" "}
              vs your last active month{fmtMonth(curMonth.prevMonth) ? <> (<span style={{ color: C.text }}>{fmtMonth(curMonth.prevMonth)} → {fmtMonth(curMonth.month)}</span>)</> : null}.
            </div>
            {curMonth.gapMonths > 0 && (
              <div style={{ fontSize: 12.5, color: C.gold, marginTop: 8, lineHeight: 1.55 }}>
                ⚠️ There {curMonth.gapMonths === 1 ? "was" : "were"} {curMonth.gapMonths} inactive month{curMonth.gapMonths === 1 ? "" : "s"} between these two — this compares your two most recent ACTIVE months, not consecutive calendar months.
              </div>
            )}
            {changeSupport && <div style={{ fontSize: 13.5, color: C.text, marginTop: 10, lineHeight: 1.6 }}>{changeSupport}</div>}
          </>
        )}
      </div>

      {/* ── 3. WHAT DROVE THE CHANGE ───────────────────────────────── */}
      <div style={card()}>
        <div style={{ ...sectionLabel, marginBottom: 12 }}>What drove the change</div>
        {!canAttribute ? (
          <div style={{ fontSize: 14, color: C.muted }}>
            {delta && delta.platforms.length < 2
              ? "Single-platform account — the change above isn't split across platforms."
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

      {/* ── 4. EARNINGS TREND — DashboardGrowthCharts, rendered by page.js
             (needs raw tips/sessions this component never receives) ──── */}
      {earningsTrend && (
        <div style={card({ padding: 20 })}>
          <div style={{ ...sectionLabel, marginBottom: 14 }}>Earnings trend</div>
          {earningsTrend}
        </div>
      )}

      {/* ── 5. $/HOUR TREND ────────────────────────────────────────── */}
      <div style={card({ padding: 20 })}>
        <div style={{ ...sectionLabel, marginBottom: 6 }}>$/hour trend</div>
        <HourlyRateTrend monthlyData={monthlyData} />
      </div>

      {/* ── 6. SESSION PERFORMANCE ─────────────────────────────────── */}
      <div style={card()}>
        <div style={{ ...sectionLabel, marginBottom: 14 }}>Session performance</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 20 }}>
          <SnapshotStat value={sessionCount.toLocaleString()} label="Meaningful sessions" />
          <SnapshotStat value={lowSignalCount.toLocaleString()} label="Low-signal sessions" accent={C.muted} />
          <SnapshotStat value={fmtUsd(sp?.avgMeaningfulSessionUSD)} label="Avg session earnings" accent={C.cyan} />
          <SnapshotStat value={sp?.avgMeaningfulSessionMinutes != null ? `${sp.avgMeaningfulSessionMinutes}m` : "—"} label="Avg session length" />
        </div>
        {sp?.distribution ? (
          <CompareBars
            title="Which kinds of streams actually make you money"
            a={{ label: `Your ${sp.distribution.aboveMedian.count} strongest sessions`, value: sp.distribution.aboveMedian.avgUsdPerHour, display: `${fmtUsd(sp.distribution.aboveMedian.avgUsdPerHour)}/hr`, sub: "above your own median rate" }}
            b={{ label: `Your ${sp.distribution.belowOrAtMedian.count} weaker sessions`, value: sp.distribution.belowOrAtMedian.avgUsdPerHour, display: `${fmtUsd(sp.distribution.belowOrAtMedian.avgUsdPerHour)}/hr`, sub: `at or below the $${sp.distribution.medianUsdPerHour}/hr median` }}
          />
        ) : (
          <div style={{ fontSize: 13, color: C.muted }}>Not enough rate-eligible sessions yet for a reliable performance split.</div>
        )}
      </div>

      {/* ── 7. PLATFORM PERFORMANCE ────────────────────────────────
          Two genuinely different questions, so two different sections:

            1 platform   "How am I doing on the platform I actually use?"
            2+ platforms "Which platform is worth my time?"

          The old version asked the second question always, so a creator with
          one platform got the heading "Platform performance" above a single
          card — a comparison of one thing. The data was right and the grid
          already collapsed to one column; the FRAMING was the defect, and it
          made the product read as a multi-platform dashboard the creator was
          seeing a stripped-down version of.

          Nothing here is gated. Everything below is already computed by the
          frozen analytics layer and already visible to Free; this task adds no
          paywall. ──────────────────────────────────────────────────────── */}
      {platforms.length === 1 ? (
        <SinglePlatformPerformance
          p={platforms[0]}
          sp={sp}
          delta={delta}
          curMonth={curMonth}
        />
      ) : (
      <div style={card()}>
        <div style={{ ...sectionLabel, marginBottom: 14 }}>Platform performance</div>
        {platforms.length === 0 ? (
          <div style={{ fontSize: 13, color: C.muted }}>Import your tip history to see how your platforms compare.</div>
        ) : (
          <>
            {platformEfficiencyGap && platformEfficiencyGap.multiple >= 1.3 && (
              <div style={{ fontSize: 13, color: C.text, marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.18)" }}>
                <strong style={{ color: C.cyan }}>{platformEfficiencyGap.top.platform}</strong> earns <strong style={{ color: C.cyan }}>{platformEfficiencyGap.multiple.toFixed(1)}x</strong> more per hour than <strong>{platformEfficiencyGap.bottom.platform}</strong> — {fmtUsd(platformEfficiencyGap.top.usdPerHour)}/hr vs {fmtUsd(platformEfficiencyGap.bottom.usdPerHour)}/hr.
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: platforms.length > 1 ? "repeat(auto-fit, minmax(260px, 1fr))" : "1fr", gap: 14 }}>
              {platforms.map((p) => (
                <div key={p.platform} style={{ padding: "16px 18px", borderRadius: 12, background: C.card2, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: C.white, marginBottom: 12 }}>{p.platform}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: C.green }}>{fmtUsd(p.totalUSD)}</div>
                      {/* Explicit scope: this platform total is meaningful-session-scoped
                          (the same population p.usdPerHour is built from), which can be
                          less than the account-wide totalUSD figure above (that one counts
                          every tip, including ones outside any qualifying session). */}
                      <div style={{ fontSize: 10.5, color: C.muted }}>in qualifying sessions</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: C.cyan }}>{fmtUsd(p.usdPerHour)}/hr</div>
                      <div style={{ fontSize: 10.5, color: C.muted }}>hourly rate</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginBottom: p.bestLocalDay != null ? 8 : 0 }}>{p.sessions} sessions · {fmtHours(p.hours)} streamed</div>
                  {p.bestLocalDay != null && p.bestLocalHour != null && (
                    <div style={{ fontSize: 11.5, padding: "5px 9px", borderRadius: 8, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.24)", color: C.gold, display: "inline-block" }}>
                      Best: {p.bestLocalDay}s {fmtHour(p.bestLocalHour)}{p.bestWindowConfidence && p.bestWindowConfidence !== "high" ? ` (${TIER_COPY[p.bestWindowConfidence] || p.bestWindowConfidence})` : ""}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      )}

      {/* ── 8. DAY / TIME ANALYSIS ─────────────────────────────────── */}
      <div style={card()}>
        <div style={{ ...sectionLabel, marginBottom: 14 }}>When did you perform best</div>
        {bestWindow ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: C.white }}>{bestWindow.localDay}s · {fmtWindow(bestWindow.localHour)}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: C.gold, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.28)", padding: "3px 10px", borderRadius: 20 }}>
                {TIER_COPY[bestWindow.tier] || bestWindow.tier}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 18 }}>{bestWindow.sessionCount} qualifying sessions · local time</div>
            <CompareBars
              a={{ label: `${bestWindow.localDay}s ${fmtWindow(bestWindow.localHour)}`, value: bestWindow.medianUsdPerHour, display: `${fmtUsd(bestWindow.medianUsdPerHour)}/hr` }}
              b={{ label: "Your overall rate", value: hourlyRate, display: `${fmtUsd(hourlyRate)}/hr`, sub: "estimated across every qualifying session" }}
            />
          </>
        ) : earlySignal ? (
          <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.6 }}>
            {earlySignal.localDay}s around {fmtHour(earlySignal.localHour)} is your strongest signal so far, but only {earlySignal.sessionCount} session{earlySignal.sessionCount === 1 ? "" : "s"} back it up — not yet enough to call a best window.
          </div>
        ) : (
          <div style={{ fontSize: 13.5, color: C.muted }}>Not enough qualifying sessions yet to identify a best window.</div>
        )}

        {byDay.length > 1 && (
          <div style={{ marginTop: 22 }}>
            {/* EXPLICIT UNIT + EXPLICIT RECONCILIATION. These bars are TOTAL $
                earned per day; bestWindow above is ranked by MEDIAN $/hour.
                Those answer different questions, so the longest bar is often
                NOT the best window — a reader seeing them side by side without
                this sentence would reasonably read the chart as contradicting
                the headline. Stating the difference is the honest fix; making
                the chart agree by re-ranking it would mean inventing a second
                best-time calculation, which canonical-analytics-rules.md
                forbids. */}
            <div style={{ fontSize: 11.5, color: C.text, marginBottom: 4 }}>Total earned by day of week</div>
            <div style={{ fontSize: 11.5, color: C.text, marginBottom: 12, lineHeight: 1.55, maxWidth: 620, opacity: 0.85 }}>
              Total dollars, not hourly rate — so your biggest bar isn&apos;t always your best window. Your best window above is the one with the highest median <strong style={{ color: C.white }}>$/hour</strong>, which is what actually repeats. Days with too few sessions to trust are left out.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {byDay.map(d => (
                <div key={d.day} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 38, fontSize: 11.5, color: C.text, flexShrink: 0 }}>{DAY_ABBR[d.day]}</div>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                    <div style={{ width: `${Math.max((d.totalUsd / maxDayUsd) * 100, 3)}%`, height: "100%", borderRadius: 4, background: d.day === bestWindow?.localDay ? BAR_GRADIENT : "rgba(148,163,184,0.35)" }} />
                  </div>
                  <div style={{ width: 60, fontSize: 11.5, color: C.muted, textAlign: "right", flexShrink: 0 }}>{fmtUsd0(d.totalUsd)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {missedByPlatform.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10 }}>Where you're leaving money on the table — measured rate gap vs your typical hour on that platform</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {missedByPlatform.map((m, i) => (
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
      </div>

      {/* ── 9. KEY FINDINGS ────────────────────────────────────────── */}
      {findings.length > 0 && (
        <div style={card()}>
          <div style={{ ...sectionLabel, marginBottom: 14 }}>Key findings</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {findings.map((f, i) => (
              <div key={i} style={{ padding: "13px 16px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.white, marginBottom: 4, lineHeight: 1.45 }}>{f.what}</div>
                <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55 }}>{f.why}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 10. PRO STRATEGY ───────────────────────────────────────── */}
      {!isPro && (bestWindow || platforms.length > 0) && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap",
          padding: "20px 24px", borderRadius: 16,
          background: "linear-gradient(115deg, rgba(124,92,255,0.10), rgba(236,72,153,0.08))",
          border: "1px solid rgba(124,92,255,0.26)",
        }}>
          <div style={{ minWidth: 260, flex: 1 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: C.white }}>Want to turn this history into a strategy?</div>
            <div style={{ fontSize: 12.5, color: C.text, marginTop: 6, lineHeight: 1.6 }}>
              Pro connects your best windows, platform performance, high-value fan timing, and a forecast into one personalized weekly schedule — not just more exact numbers.
            </div>
          </div>
          <UnlockButton surface="performance_strategy" onClick={() => onUpgrade?.("performance_strategy")}>Build My Strategy</UnlockButton>
        </div>
      )}
    </div>
  )
}
