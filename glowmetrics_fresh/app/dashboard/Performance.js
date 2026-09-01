"use client"
import { useMemo } from "react"

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM PERFORMANCE  (the "Platforms" tab)
//
// Answers ONE question: "how is each platform doing?" — the account-wide
// "how am I doing overall?" question belongs to the Overview/Command Center,
// which is why the generic KPI strip and trend charts no longer open this
// page. The per-platform cards lead, so "which site actually makes me the
// most money" is readable in about two seconds.
//
// PRESENTATION: this tab uses the same design system as the Sessions and
// Fans tabs — .platforms-page, .glass-panel, .session-stat-box,
// .gradient-button and the gradient page title, all defined in
// app/globals.css. Styling lives in that stylesheet, not in inline style
// objects here, so a change to the dashboard's look happens in one place.
// The only inline value is each platform's --accent, which the card's
// border, badge and corner glow read from.
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

// One restrained accent per platform, in the dashboard's existing palette.
// Unknown/undetected platforms fall through to the neutral slate accent
// rather than being given a brand identity they don't have.
const PLATFORM_STYLES = {
  chaturbate: { short: "CB",  accent: "#22D3EE" },
  bongacams:  { short: "BC",  accent: "#EC4899" },
  myfreecams: { short: "MFC", accent: "#A855F7" },
  camsoda:    { short: "CS",  accent: "#D946EF" },
  stripchat:  { short: "SC",  accent: "#FB923C" },
  streamate:  { short: "SM",  accent: "#38BDF8" },
  flirt4free: { short: "F4F", accent: "#F472B6" },
  cam4:       { short: "C4",  accent: "#21D99A" },
  livejasmin: { short: "LJ",  accent: "#FFC43D" },
}
const NEUTRAL_STYLE = { short: "—", accent: "#8B96B8" }
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

// Same box the Sessions tab uses for a session's stats, so a metric looks
// like a metric everywhere in the dashboard.
function Stat({ label, value, accent }) {
  return (
    <div className="session-stat-box">
      <div className="session-stat-label">{label}</div>
      <div className="session-stat-value" style={accent ? { color: accent } : undefined}>{value}</div>
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
    <div className="glass-panel platform-card" style={{ "--accent": s.accent }}>
      <div className="platform-card-top">
        <div className="platform-badge">{s.short}</div>
        <div>
          <div className="platform-card-name">{p.platform}</div>
          <div className="platform-card-sub">Platform performance</div>
        </div>
      </div>

      <div className="platform-money">
        <strong>{fmtUsd(p.totalUSD)}</strong>
        <span>Total earned</span>
        {/* Explicit scope: platform totals are meaningful-session-scoped (the
            same population usdPerHour is built from), so they can sum to less
            than the account-wide total, which counts every tip. */}
        <small>in qualifying sessions</small>
      </div>

      <div className="platform-stats">
        <Stat label="Hourly average" value={p.hours > 0 ? `${fmtUsd(p.usdPerHour)}/hr` : "—"} accent="#26e0ff" />
        <Stat label="Streaming time" value={fmtHoursLong(p.hours)} />
      </div>
      <div className="platform-stats platform-stats-secondary">
        <Stat label="Tips" value={Number(p.tips || 0).toLocaleString()} />
        <Stat label="Fans" value={p.uniqueFans != null ? Number(p.uniqueFans).toLocaleString() : "—"} />
        <Stat label="Average tip" value={p.tips > 0 ? fmtUsd(p.avgTipSize) : "—"} />
        <Stat label="Sessions" value={Number(p.sessions || 0).toLocaleString()} />
      </div>

      {share != null && (
        <div className="platform-share">
          <div className="platform-share-row">
            <span>Revenue share</span>
            <strong>{share.toFixed(1)}%</strong>
          </div>
          <div className="platform-share-track">
            <div className="platform-share-fill" style={{ width: `${Math.max(share, 1.5)}%` }} />
          </div>
        </div>
      )}

      {/* best window — never shown without its confidence tier */}
      {p.bestLocalDay != null && p.bestLocalHour != null && (
        <div className="platform-window">
          <span>Best streaming window</span>
          <strong>{p.bestLocalDay}s · {fmtWindow(p.bestLocalHour)}</strong>
          <small>{TIER_COPY[p.bestWindowConfidence] || p.bestWindowConfidence} · local time</small>
        </div>
      )}

      {onViewBreakdown && (
        <button className="gradient-button" onClick={() => onViewBreakdown(p.platform)}>View in Money Map →</button>
      )}
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

    // The rate line, reused whether it stands alone or folds into the revenue
    // card — one platform commonly leads both, and two cards naming the same
    // platform read as a bug rather than as two findings.
    const rateLine = (top) => (
      platformEfficiencyGap && platformEfficiencyGap.top.platform === top.platform && platformEfficiencyGap.multiple >= 1.3
        ? `${fmtUsd(top.usdPerHour)}/hr — ${platformEfficiencyGap.multiple.toFixed(1)}x what you earn per hour on ${platformEfficiencyGap.bottom.platform}.`
        : `You're averaging ${fmtUsd(top.usdPerHour)}/hr here across ${top.sessions} qualifying session${top.sessions === 1 ? "" : "s"}.`
    )
    const revenueLeader = byRevenue[0] || null
    const hourlyLeader = byHourly[0] || null
    const leadsBoth = revenueLeader && hourlyLeader && revenueLeader.platform === hourlyLeader.platform

    if (revenueLeader) {
      const share = shareOf(revenueLeader)
      out.push({
        platform: revenueLeader.platform,
        title: leadsBoth ? "Highest revenue and hourly rate" : "Highest revenue",
        body: `${fmtUsd(revenueLeader.totalUSD)} in qualifying sessions${share != null ? ` — ${share.toFixed(1)}% of everything you earned across your platforms` : ""}.`
          + (leadsBoth ? ` It also pays the most per hour: ${rateLine(revenueLeader)}` : ""),
      })
    }
    if (hourlyLeader && !leadsBoth) {
      out.push({
        platform: hourlyLeader.platform,
        title: "Highest hourly earnings",
        body: rateLine(hourlyLeader),
      })
    }
    if (byAvgTip.length && byAvgTip[0].platform !== hourlyLeader?.platform) {
      const top = byAvgTip[0]
      out.push({
        platform: top.platform,
        title: "Highest average tip",
        body: `Your average tip is ${fmtUsd(top.avgTipSize)} here, across ${Number(top.tips).toLocaleString()} tips.`,
      })
    }
    if (byFans.length && byFans[0].platform !== revenueLeader?.platform) {
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
    <div className="platforms-page">

      <div className="sessions-header">
        <div>
          <div className="sessions-title">PLATFORM PERFORMANCE</div>
          <div className="sessions-subtitle">See exactly where your money, time, and fans are coming from.</div>
        </div>
      </div>

      {!hasPlatforms ? (
        <div className="glass-panel platform-panel">
          <div className="section-label">Your platforms</div>
          <div className="session-empty-body" style={{ margin: 0 }}>Import your tip history to see how each of your platforms is performing.</div>
        </div>
      ) : (
        <>
          {/* ── 1. YOUR PLATFORMS — the first and most important section ── */}
          <section className="platforms-section">
            <div className="platforms-section-head">
              <div>
                <div className="section-label" style={{ marginBottom: 0 }}>Your platforms</div>
                <p>Individual performance across every platform you&apos;ve imported.</p>
              </div>
              <div className="platforms-section-count">{platforms.length} platform{platforms.length === 1 ? "" : "s"}</div>
            </div>

            {platformEfficiencyGap && platformEfficiencyGap.multiple >= 1.3 && (
              <div className="platform-lede">
                <strong style={{ color: "#26e0ff" }}>{platformEfficiencyGap.top.platform}</strong> earns <strong style={{ color: "#26e0ff" }}>{platformEfficiencyGap.multiple.toFixed(1)}x</strong> more per hour than <strong>{platformEfficiencyGap.bottom.platform}</strong> — {fmtUsd(platformEfficiencyGap.top.usdPerHour)}/hr vs {fmtUsd(platformEfficiencyGap.bottom.usdPerHour)}/hr.
              </div>
            )}

            <div className="platform-grid" style={platforms.length === 1 ? { gridTemplateColumns: "1fr" } : undefined}>
              {platforms.map(p => (
                <PlatformCard key={p.platform} p={p} share={shareOf(p)} onViewBreakdown={onViewPlatform} />
              ))}
            </div>
          </section>

          {/* ── 2. REVENUE DISTRIBUTION ─────────────────────────────── */}
          {platforms.length > 1 && (
            <div className="glass-panel platform-panel">
              <div className="platform-panel-head">
                <div>
                  <div className="section-label" style={{ marginBottom: 0 }}>Revenue distribution</div>
                  <p>How your earnings split across platforms.</p>
                </div>
                <div className="platform-panel-total">{fmtUsd(platformTotal)} total</div>
              </div>
              <div className="platform-dist-rows">
                {platforms.map(p => {
                  const share = shareOf(p) ?? 0
                  return (
                    <div key={p.platform}>
                      <div className="platform-dist-row-top">
                        <span>{p.platform}</span>
                        <strong>{share.toFixed(1)}% · {fmtUsd0(p.totalUSD)}</strong>
                      </div>
                      <div className="platform-dist-track">
                        <div className="platform-dist-fill" style={{ width: `${Math.max(share, 1.5)}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── 3. PLATFORM COMPARISON ──────────────────────────────── */}
          {platforms.length > 1 && (
            <div className="glass-panel platform-panel">
              <div className="platform-panel-head">
                <div>
                  <div className="section-label" style={{ marginBottom: 0 }}>Platform comparison</div>
                  <p>Every figure measured over the same qualifying sessions. Highlights are calculated from these numbers, not fixed rankings.</p>
                </div>
              </div>
              <div className="session-table-wrap">
                <table className="platform-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      {platforms.map(p => {
                        const s = styleFor(p.platform)
                        return <th key={p.platform} title={p.platform} style={{ color: s.accent }}>{s.short}</th>
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
                          <td>{row.label}</td>
                          {platforms.map(p => (
                            <td key={p.platform} className={leader && leader.platform === p.platform ? "is-leader" : undefined}>
                              {row.fmt(p)}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="platform-table-note">
                Green marks the leading platform on rates and totals where more than one platform is measurable. Hours, tips, fans and sessions are volume, not performance, so they aren&apos;t ranked.
              </div>
            </div>
          )}

          {/* ── 4. WHAT DROVE THE CHANGE — per-platform attribution ───
                 Always rendered, never silently dropped: a section that
                 vanishes reads as a bug, and the two reasons it can be
                 empty (a single-platform account vs. not enough history)
                 are different facts the reader deserves to be told apart. */}
          <div className="glass-panel platform-panel">
            <div className="platform-panel-head">
              <div>
                <div className="section-label" style={{ marginBottom: 0 }}>What drove the change</div>
                <p>Month-over-month movement, split by platform.</p>
              </div>
            </div>
            {!canAttribute ? (
              <div className="session-empty-body" style={{ margin: 0 }}>
                {delta && delta.platforms.length < 2
                  ? "Single-platform account — your month-over-month change isn't split across platforms."
                  : "Not enough history to attribute this change."}
              </div>
            ) : (
              <div>
                {delta.platforms.map((p, i) => (
                  <div key={p.platform} className={`platform-delta-row${i === 0 ? " is-lead" : ""}`}>
                    <div>
                      {i === 0 && (p.deltaUSD >= 0 ? "🔼 " : "🔽 ")}{p.platform}
                      {i === 0 && <em> contributed the largest share of the {p.deltaUSD >= 0 ? "increase" : "decrease"}</em>}
                    </div>
                    <strong className={p.deltaUSD >= 0 ? "platform-delta-up" : "platform-delta-down"}>
                      {p.deltaUSD >= 0 ? "+" : ""}{fmtUsd(p.deltaUSD)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 5. WHERE YOU'RE LEAVING MONEY — per-platform rate gap ── */}
          {missedByPlatform.length > 0 && (
            <div className="glass-panel platform-panel">
              <div className="platform-panel-head">
                <div>
                  <div className="section-label" style={{ marginBottom: 0 }}>Where you&apos;re leaving money on the table</div>
                  <p>Measured rate gap between each platform&apos;s best window and a typical hour on it.</p>
                </div>
              </div>
              <div>
                {missedByPlatform.map(m => (
                  <div key={m.platform} className="platform-gap-row">
                    <div>
                      {m.platform} — {m.bestLocalDay}s {fmtHour(m.bestLocalHour)} earns <strong style={{ color: "#21d99a" }}>{fmtUsd(m.bestWindowMedianUsdPerHour)}/hr</strong> vs <strong style={{ color: "#f4f7ff" }}>{fmtUsd(m.overallMedianUsdPerHour)}/hr</strong> typical
                    </div>
                    <strong>+{fmtUsd(m.rateGapUsdPerHour)}/hr gap</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 6. WHAT YOUR DATA SAYS ──────────────────────────────── */}
          {insights.length > 0 && (
            <div className="glass-panel platform-panel">
              <div className="section-label">What your data says</div>
              <div className="platform-insight-grid">
                {insights.map((ins, i) => (
                  <div key={i} className="platform-insight" style={{ "--accent": styleFor(ins.platform).accent }}>
                    <span>{ins.platform}</span>
                    <strong>{ins.title}</strong>
                    <p>{ins.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 7. ACCOUNT-WIDE CONTEXT — explicitly not per-platform ─ */}
          {(byDay.length > 1 || (dep && dep.level !== "low") || earningsTrend) && (
            <div className="glass-panel platform-panel">
              <div className="platform-panel-head">
                <div>
                  <div className="section-label" style={{ marginBottom: 0 }}>Account-wide context</div>
                  <p>Across every platform combined — not a per-platform figure.</p>
                </div>
              </div>

              {byDay.length > 1 && (
                <div>
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
                  <div className="session-stat-label">Total earned by day of week</div>
                  <div className="platform-day-note">
                    Total dollars, not hourly rate — so your biggest bar isn&apos;t always your best window. Your best window is the one with the highest median <strong style={{ color: "#f4f7ff" }}>$/hour</strong>, which is what actually repeats. Days with too few sessions to trust are left out.
                  </div>
                  {byDay.map(d => (
                    <div key={d.day} className="platform-day-row">
                      <span>{DAY_ABBR[d.day]}</span>
                      <div className="platform-day-track">
                        <div className={`platform-day-fill${d.day === bestWindow?.localDay ? " is-best" : ""}`} style={{ width: `${Math.max((d.totalUsd / maxDayUsd) * 100, 3)}%` }} />
                      </div>
                      <strong>{fmtUsd0(d.totalUsd)}</strong>
                    </div>
                  ))}
                </div>
              )}

              {earningsTrend && (
                <div style={{ marginTop: 22 }}>
                  <div className="session-stat-label">Earnings trend, all platforms combined</div>
                  <div style={{ marginTop: 10 }}>{earningsTrend}</div>
                </div>
              )}

              {dep && dep.level !== "low" && (
                <div className="platform-dependency">
                  <strong>{dep.top1Pct}% of your revenue comes from a single fan</strong>
                  <p>If they stopped tipping you&apos;d lose {fmtUsd0(dep.lossIfTopFanLeaves)} — worth building a second and third relationship to the same size.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── PRO STRATEGY ───────────────────────────────────────────── */}
      {!isPro && hasPlatforms && (
        <div className="platform-pro">
          <div className="platform-pro-copy">
            <strong>Want to turn this into a schedule?</strong>
            <p>Pro connects your platform performance, best windows, high-value fan timing, and a forecast into one personalized weekly plan — not just more exact numbers.</p>
          </div>
          <button className="gradient-button" onClick={() => onUpgrade?.("performance_strategy")}>Build My Strategy →</button>
        </div>
      )}
    </div>
  )
}
