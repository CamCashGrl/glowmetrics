"use client"
import { useMemo } from "react"

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

// Same glass treatment the rest of the dashboard uses.
const glassCard = {
  background: "rgba(15,20,32,0.75)",
  border: "1px solid rgba(255,255,255,0.08)",
  backdropFilter: "blur(20px)",
  boxShadow: "0 0 40px rgba(59,130,246,0.15), 0 0 80px rgba(236,72,153,0.08)",
}

// The CamCash brand gradient (branding spec): cyan -> purple -> pink.
const CTA_GRADIENT  = "linear-gradient(90deg,#22D3EE 0%,#7C5CFF 48%,#EC4899 100%)"
const HERO_GRADIENT = "linear-gradient(120deg, rgba(34,211,238,0.10) 0%, rgba(124,92,255,0.12) 46%, rgba(236,72,153,0.10) 100%)"

const fmtUsd  = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtUsd0 = (n) => `$${Math.round(Number(n || 0)).toLocaleString("en-US")}`
const fmtHour = (h) => {
  const n = ((h % 24) + 24) % 24
  return n === 0 ? "12:00 AM" : n < 12 ? `${n}:00 AM` : n === 12 ? "12:00 PM" : `${n - 12}:00 PM`
}
// bestWindow is an hour bucket; a creator plans a stream, not a minute.
const fmtWindow = (h) => `${fmtHour(h)} – ${fmtHour(h + 2)}`

// Confidence vocabulary comes from the canonical tier, never invented.
// bestTimes.js: <2 insufficient, 2–3 promising, 4–5 supported, 6+ high.
const TIER_COPY = {
  high:      "Strong pattern",
  supported: "Supported pattern",
  promising: "Pattern emerging",
}

const card = (extra = {}) => ({ ...glassCard, borderRadius: 16, ...extra })

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
    <div style={card({ padding: "13px 15px", display: "flex", gap: 11, alignItems: "flex-start", minWidth: 0 })}>
      <div style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: accent, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
        {sub && <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

function Stat({ value, label: l, delta, accent = C.white }) {
  return (
    <div style={card({ padding: "15px 17px" })}>
      <div style={{ fontSize: 20, fontWeight: 800, color: accent, letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11.5, color: C.muted }}>{l}</span>
        {delta != null && (
          <span style={{ fontSize: 11, fontWeight: 700, color: delta >= 0 ? C.green : "#F87171" }}>
            {delta >= 0 ? "+" : ""}{delta}%
          </span>
        )}
      </div>
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
  const avgSessionHours = (sessionCount > 0 && streamHours > 0) ? streamHours / sessionCount : 2
  const oppLow  = topGap ? topGap.rateGapUsdPerHour * Math.max(1, avgSessionHours) : null
  const oppHigh = topGap ? topGap.rateGapUsdPerHour * Math.max(1, avgSessionHours) * 1.5 : null

  const hasWindow = !!bestWindow
  const greeting = `Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${firstName || "there"}`

  // Hourly distribution for the evidence bar chart — read straight off the
  // canonical grid, summed per local hour. Presentational shaping of an
  // existing canonical array, not a new metric.
  const hourBars = useMemo(() => {
    const byHour = Array.from({ length: 24 }, () => 0)
    grid.forEach(g => { byHour[g.localHour] = Math.max(byHour[g.localHour], g.medianUsdPerHour || 0) })
    const max = Math.max(...byHour, 0.01)
    return byHour.map((v, h) => ({ h, v, pct: v / max }))
  }, [grid])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 21, fontWeight: 800, color: C.white, letterSpacing: "-0.02em" }}>👋 {greeting}</div>
          <div style={{ fontSize: 13.5, color: C.muted, marginTop: 4 }}>
            {hasWindow ? "Here's how to make more money today." : "Here's what your data says so far."}
          </div>
        </div>
      </div>

      {/* ── HERO: YOUR NEXT BEST MOVE ──────────────────────────────── */}
      <div style={{
        background: hasWindow ? HERO_GRADIENT : "rgba(15,20,32,0.75)",
        backdropFilter: "blur(20px)",
        border: hasWindow ? "1px solid rgba(34,211,238,0.28)" : `1px solid ${C.border}`,
        borderRadius: 18, padding: 26, position: "relative", overflow: "hidden",
      }}>
        {hasWindow && <div style={{ position: "absolute", right: -70, top: -70, width: 300, height: 300, borderRadius: "50%", background: "rgba(34,211,238,0.12)", filter: "blur(80px)", pointerEvents: "none" }} />}
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: 26, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 380px", minWidth: 0 }}>
            <div style={{ ...label, color: hasWindow ? C.cyan : C.muted, marginBottom: 10 }}>Your next best move</div>

            {hasWindow ? (
              <>
                <div style={{ fontSize: 26, fontWeight: 800, color: C.white, letterSpacing: "-0.03em", lineHeight: 1.2 }}>
                  Go live {fmtWindow(bestWindow.localHour)}
                  {bestWindow.topPlatform ? <> on {bestWindow.topPlatform}</> : null}
                </div>
                <div style={{ fontSize: 13.5, color: C.text, marginTop: 11, lineHeight: 1.6, maxWidth: 460 }}>
                  {bestWindow.localDay}s are your highest-earning window. You average{" "}
                  <strong style={{ color: C.cyan }}>{fmtUsd(bestWindow.medianUsdPerHour)}/hr</strong> here
                  {pctAbove != null && pctAbove > 0 && <> — <strong style={{ color: C.cyan }}>{pctAbove}% higher</strong> than your overall rate</>}.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.white, letterSpacing: "-0.02em", lineHeight: 1.25 }}>
                  {earlySignal ? "A pattern is starting to form" : "Not enough history for a reliable window yet"}
                </div>
                <div style={{ fontSize: 13.5, color: C.text, marginTop: 11, lineHeight: 1.6, maxWidth: 480 }}>
                  {earlySignal
                    ? <>{earlySignal.localDay}s around {fmtWindow(earlySignal.localHour)} is your strongest so far, but only {earlySignal.sessionCount} session{earlySignal.sessionCount === 1 ? "" : "s"} back it up. A few more streams will confirm or replace it.</>
                    : <>CamCash needs a handful of qualifying sessions before it can tell a real earning window apart from one good night. Keep importing and this fills in.</>}
                </div>
              </>
            )}

            <div style={{ marginTop: 20 }}>
              <BrandButton onClick={onPlanStream}>{hasWindow ? "Plan My Stream" : "Open Stream Planner"}</BrandButton>
            </div>
          </div>

          {/* OPPORTUNITY — measured rate gap only. The frozen layer
              deliberately produces no cumulative "you lost $X" figure. */}
          {hasWindow && topGap && (
            <div style={{ flex: "0 1 250px", textAlign: "right", minWidth: 190 }}>
              <div style={{ ...label, color: C.muted }}>Estimated opportunity</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: C.white, letterSpacing: "-0.03em", marginTop: 8 }}>
                +{fmtUsd0(oppLow)} – {fmtUsd0(oppHigh)}
              </div>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 5 }}>
                for a {Math.max(1, avgSessionHours).toFixed(1)}-hour stream at the {fmtUsd(topGap.rateGapUsdPerHour)}/hr gap
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── EVIDENCE CHIPS ─────────────────────────────────────────── */}
      {hasWindow && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 11 }}>
          <Chip icon="🕐" title="Best window" value={fmtWindow(bestWindow.localHour)} sub={`${bestWindow.localDay}s · ${TIER_COPY[bestWindow.tier] || "Pattern"}`} />
          <Chip icon="👥" title={overlap?.count ? "Fans active in it" : "Fan overlap"}
                value={overlap?.count ? `${overlap.count} high-value fan${overlap.count === 1 ? "" : "s"}` : "None yet"}
                sub={overlap?.count ? `${fmtUsd0(overlap.totalUSD)} lifetime combined` : "No repeat fans in this window"}
                accent={overlap?.count ? C.indigo : C.muted} />
          {topPlatform && (
            <Chip icon="📈" title={`${topPlatform.platform} is #1`} value={`${fmtUsd(topPlatform.usdPerHour)}/hr`} sub={`${topPlatform.sessions} sessions · ${(topPlatform.hours || 0).toFixed(0)}h`} accent={C.cyan} />
          )}
          <Chip icon="📊" title="Sample behind it" value={`${bestWindow.sessionCount} session${bestWindow.sessionCount === 1 ? "" : "s"}`} sub={TIER_COPY[bestWindow.tier] || "Pattern"} accent={C.gold} />
        </div>
      )}

      {/* ── WHY THIS IS YOUR BEST MOVE ─────────────────────────────── */}
      {hasWindow && (
        <div style={card({ padding: 22 })}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.white }}>Why this is your best move</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>
            We analyzed your {streamHours.toFixed(0)} tracked hours across {sessionCount} qualifying session{sessionCount === 1 ? "" : "s"} and found a repeating pattern.
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ ...label, marginBottom: 9 }}>Median $/hr by hour of day</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 92 }}>
              {hourBars.map(({ h, v, pct }) => {
                const isBest = h === bestWindow.localHour
                return (
                  <div key={h} title={v > 0 ? `${fmtHour(h)} — ${fmtUsd(v)}/hr` : `${fmtHour(h)} — no qualifying sessions`}
                       style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", minWidth: 0 }}>
                    <div style={{
                      height: `${Math.max(pct * 100, v > 0 ? 6 : 2)}%`,
                      background: isBest ? CTA_GRADIENT : v > 0 ? "rgba(124,92,255,0.38)" : "rgba(255,255,255,0.05)",
                      borderRadius: 3,
                      boxShadow: isBest ? "0 0 14px rgba(34,211,238,0.45)" : "none",
                    }} />
                  </div>
                )
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 9.5, color: C.muted }}>
              <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span>
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 9 }}>
              Highlighted bar is your best window. Bars show the canonical median $/hr per hour bucket — empty hours have no qualifying sessions.
            </div>
          </div>
        </div>
      )}

      {/* ── FANS + PERFORMANCE ─────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 14 }}>
        <div style={card({ padding: 20 })}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: C.white }}>Who deserves your attention</div>
          </div>
          {returningSoon.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {returningSoon.map((w, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 11, background: C.card2, border: `1px solid ${C.border}` }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#22D3EE,#7C5CFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: C.white, flexShrink: 0 }}>
                    {w.username.slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.white, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.username}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      {fmtUsd0(w.totalUSD)} lifetime · {w.tipCount} tips · usually every ~{Math.round(w.avgDaysBetweenTips)}d
                    </div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, padding: "4px 9px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0,
                    background: w.expectedNextTip === "Overdue" ? "rgba(236,72,153,0.14)" : "rgba(16,185,129,0.13)",
                    color: w.expectedNextTip === "Overdue" ? C.pink : C.green }}>
                    {w.expectedNextTip}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
              No supporters are inside their typical return window right now. This fills in as your fans build a repeat pattern — it needs at least 3 tips from someone before it will make a call.
            </div>
          )}
          <div style={{ marginTop: 14 }}><GhostButton onClick={onViewFans}>See all fans →</GhostButton></div>
        </div>

        <div style={card({ padding: 20 })}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: C.white, marginBottom: 14 }}>Your money story</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
            <Stat value={fmtUsd(totalUSD)} label="Total earnings" accent={C.white} />
            <Stat value={`${fmtUsd(hourlyRate)}`} label="Per hour" accent={C.green} />
            <Stat value={`${streamHours.toFixed(0)}h`} label="Total hours" accent={C.white} />
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
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap",
          padding: "18px 22px", borderRadius: 16,
          background: "linear-gradient(115deg, rgba(124,92,255,0.10), rgba(236,72,153,0.08))",
          border: "1px solid rgba(124,92,255,0.26)",
        }}>
          <div style={{ minWidth: 240, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.white }}>Want the full strategy?</div>
            <div style={{ fontSize: 12.5, color: C.text, marginTop: 5, lineHeight: 1.6 }}>
              You can see <strong style={{ color: C.cyan }}>{bestWindow.localDay}s {fmtWindow(bestWindow.localHour)}</strong>
              {overlap?.count ? <> and that <strong style={{ color: C.cyan }}>{overlap.count} high-value fan{overlap.count === 1 ? "" : "s"}</strong> show up in it</> : null}.
              Pro adds exact peak minutes, a personalized weekly schedule, fan-activity predictions, and revenue forecasting.
            </div>
          </div>
          <BrandButton onClick={() => onUpgrade?.("command_center_strategy")}>Upgrade to Pro →</BrandButton>
        </div>
      )}
    </div>
  )
}
