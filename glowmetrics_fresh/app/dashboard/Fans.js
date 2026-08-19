"use client"
import { useMemo } from "react"
import LockedModule, { UnlockButton, InsufficientData } from "./components/LockedModule"
import LockedValue from "./components/LockedValue"
import { PRO_PRICE_MONTHLY_LABEL, PRO_PRICE_NOTE } from "../../lib/constants"

// ═══════════════════════════════════════════════════════════════════════════
// FANS
//
// Answers "who should I pay attention to?" — an action queue, not a CRM table.
// The old tab led with a filterable grid of every supporter; a creator opening
// it had to do the prioritising themselves. This leads with PRIORITY FANS:
// each row states WHY it is on the list and WHAT to do, both derived from
// canonical per-fan fields (lib/analytics.js's identifyWhales()).
//
// Like CommandCenter.js and Performance.js, this component COMPUTES NOTHING.
// It reads canonical fan fields, orders them, and labels them. Specifically it
// does NOT:
//   - re-bucket a fan's tips to find their peak hour. identifyWhales() already
//     computes that (peakLocalHour/peakHourTipCount, the numeric form of
//     typicalOnlineHours); the old Fans block re-derived it from raw tips,
//     which was a second implementation of the same calculation.
//   - display a probability percentage. calcTipProbability() emits fixed
//     percentages (85/70/50/30/15) that nothing calibrates, so only its
//     qualitative level is ever used, and the row states the OBSERVATION
//     behind it ("usually every ~7d, last seen 12d ago") instead.
//
// ORDERING vs MEASURING: priority order is a heuristic ranking (documented in
// PRIORITY_RULES below), not a score shown to the creator. No number on screen
// comes from it — every figure in a row is a canonical field.
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

const fmtUsd = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtUsd0 = (n) => `$${Math.round(Number(n || 0)).toLocaleString("en-US")}`
const fmtHour = (h) => { const H = ((h % 24) + 24) % 24; return H === 0 ? "12 AM" : H < 12 ? `${H} AM` : H === 12 ? "12 PM" : `${H - 12} PM` }
const fmtDays = (d) => (d == null ? "—" : d === 0 ? "today" : d === 1 ? "1 day ago" : d < 30 ? `${d} days ago` : d < 365 ? `${Math.round(d / 30)} mo ago` : `${(d / 365).toFixed(1)} yr ago`)

// BrandButton removed. It was a THIRD button style in the app (cyan->pink with
// dark text), which is exactly the "another random button" problem — the
// conversion system already has one signature CTA in components/ui/Button.js,
// surfaced through UnlockButton. Fans now uses that.

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
    // Precise about what bestWindowFanOverlap actually means: the fan has at
    // least one tip inside that exact day+hour bucket (and 3+ tips overall).
    // It does NOT mean that is their usual hour — a fan can peak at 8 PM and
    // still have tipped during your 8 AM window, and the row shows both.
    // "Tips during ..." implied a habit the field does not establish.
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

function FanRow({ fan, rule, ctx, onMessage, dimmed = false }) {
  return (
    // flexWrap + a flex-basis on the text column, so the action button drops
    // to its own line on narrow screens instead of squeezing the text. Without
    // it, at 390px the nowrap button held ~200px and the text column collapsed
    // to roughly one character wide — the row rendered as a vertical column of
    // single letters, ~7700px tall for the page.
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap", padding: "16px 16px", borderRadius: 12,
      background: dimmed ? "rgba(255,255,255,0.02)" : C.card2,
      border: `1px solid ${dimmed ? C.border : rule.color + "33"}`,
      pointerEvents: dimmed ? "none" : "auto",
      userSelect: dimmed ? "none" : "auto",
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: "50%", background: `linear-gradient(135deg,${rule.color},${C.indigo})`,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800,
        color: C.white, flexShrink: 0,
      }}>{dimmed ? "?" : fan.username.slice(0, 1).toUpperCase()}</div>

      <div style={{ flex: "1 1 210px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 5 }}>
          {/* A locked row keeps its RANK and its rule label — that is the shape
              of the answer — and redacts the identity plus every figure. The
              redaction is not decorative: /api/insights genuinely withholds
              these fans' fields from Free (see verify-whale-entitlement.mjs),
              so rendering them here would widen Free access past what the
              server enforces. */}
          {dimmed
            ? <LockedValue C={C} seed={`u${rule.id}${fan.username}`} size={15} blocks={9} accent={rule.color} />
            : <span style={{ fontSize: 15, fontWeight: 700, color: C.white, overflowWrap: "anywhere" }}>{fan.username}</span>}
          <span style={{
            fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap",
            background: `${rule.color}1f`, color: rule.color, border: `1px solid ${rule.color}3d`,
          }}>{rule.label}</span>
          {dimmed && (
            <span style={{
              fontSize: 9.5, fontWeight: 900, letterSpacing: "0.09em", textTransform: "uppercase",
              padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap",
              color: C.indigo, border: `1px solid ${C.indigo}55`, background: "rgba(0,0,0,0.25)",
            }}>Pro</span>
          )}
        </div>

        {/* WHY this fan is on the list — the point of the row. */}
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginBottom: 8, overflowWrap: "anywhere" }}>
          {dimmed
            ? <>This supporter matched <strong style={{ color: C.white }}>{rule.label.toLowerCase()}</strong> — Pro names them and why.</>
            : rule.reason(fan, ctx)}
        </div>

        {/* Canonical facts, each labeled. No probability percentage. */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: C.muted }}>
          {dimmed ? (
            <>
              <span><LockedValue C={C} seed={`l${fan.username}`} size={12.5} prefix="$" blocks={4} accent={C.green} /> lifetime</span>
              <span><LockedValue C={C} seed={`t${fan.username}`} size={12.5} blocks={3} /> tips</span>
              <span>every ~<LockedValue C={C} seed={`f${fan.username}`} size={12.5} blocks={3} /></span>
              <span>last seen <LockedValue C={C} seed={`s${fan.username}`} size={12.5} blocks={4} /></span>
            </>
          ) : (
            <>
              <span><strong style={{ color: C.white }}>{fmtUsd0(fan.totalUSD)}</strong> lifetime</span>
              <span><strong style={{ color: C.white }}>{fan.tipCount}</strong> tips</span>
              {fan.tipCount >= 3 && <span>every ~<strong style={{ color: C.white }}>{Math.round(fan.avgDaysBetweenTips)}d</strong></span>}
              {fan.peakLocalHour != null && <span>usually around <strong style={{ color: C.white }}>{fmtHour(fan.peakLocalHour)}</strong></span>}
              <span>last seen <strong style={{ color: C.white }}>{fmtDays(fan.daysSinceLastTip)}</strong></span>
            </>
          )}
        </div>
      </div>

      {!dimmed && (
        <button
          onClick={() => onMessage?.(fan.username)}
          style={{
            flexShrink: 0, padding: "9px 14px", borderRadius: 10, cursor: "pointer",
            background: `${rule.color}1a`, border: `1px solid ${rule.color}40`,
            color: rule.color, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
          }}>{rule.action}</button>
      )}
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

  const ctx = useMemo(() => ({
    bestWindow,
    bestWindowUsernames: new Set(overlap?.usernames || []),
  }), [bestWindow, overlap])

  // Assign each fan to the FIRST matching rule, so nobody appears twice.
  // Fans matching no rule are not "unimportant" — they simply have no
  // timing signal worth acting on, and land in the supporters list below.
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

  // Summary of what Free is not seeing — real counts from the hidden slice,
  // so the upsell describes this account rather than a generic promise.
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

      {/* ── PRIORITY FANS ──────────────────────────────────────────── */}
      <div style={card()}>
        <div style={{ ...sectionLabel, marginBottom: 14 }}>Priority fans</div>

        {!hasAnyFans ? (
          <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6 }}>
            No supporters imported yet. Once you import your tip history, the fans worth messaging show up here first.
          </div>
        ) : visible.length === 0 ? (
          <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6 }}>
            None of your supporters have enough history yet for a timing call — it takes at least 3 tips from someone before their return pattern means anything. Your full supporter list is below.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {visible.map(({ fan, rule }) => (
              <FanRow key={fan.username} fan={fan} rule={rule} ctx={ctx} onMessage={onMessageFan} />
            ))}

            {/* Free preview: real rows from this account, blurred. Never
                fabricated placeholder fans. */}
            {hidden.slice(0, 2).map(({ fan, rule }) => (
              <FanRow key={`locked-${fan.username}`} fan={fan} rule={rule} ctx={ctx} dimmed />
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
            {/* The page's ONE primary CTA. Everything else about fan
                intelligence is a quiet secondary, so the page never becomes a
                column of competing upgrade buttons. */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <UnlockButton surface="fans_priority_locked" onClick={() => onUpgrade?.("fans_priority_locked")}>
                Find My Highest-Value Fans
              </UnlockButton>
              <span style={{ fontSize: 11.5, color: C.muted, whiteSpace: "nowrap" }}>
                {PRO_PRICE_MONTHLY_LABEL} · {PRO_PRICE_NOTE}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── WHAT PRO FINDS ─────────────────────────────────────────────
          Capabilities, not fabricated metrics. Every number quoted is a real
          aggregate this account already produced (hiddenSummary), and the
          bullets describe analysis the engine genuinely performs — nothing
          here promises an insight the product cannot compute. Renders only
          when there is something actually held back. */}
      {hiddenSummary && (
        <LockedModule
          C={C}
          variant="pro"
          surface="fans_intelligence"
          icon="🐳"
          title="Fan intelligence"
          description="CamCash doesn't just show you who tipped. Pro tells you who to act on next."
          ctaLabel="Unlock fan intelligence"
          onUpgrade={() => onUpgrade?.("fans_intelligence")}
          footnote={
            `${hiddenSummary.count} more ${hiddenSummary.count === 1 ? "supporter" : "supporters"} ranked · ` +
            `${fmtUsd0(hiddenSummary.lifetimeUSD)} in lifetime tips` +
            (hiddenSummary.overdue > 0 ? ` · ${hiddenSummary.overdue} past their usual return window` : "")
          }
        >
          <div style={{ display: "grid", gap: 9, marginBottom: 12 }}>
              {[
                "Who is most likely to tip again",
                "When each supporter usually returns",
                "Which supporters are overdue",
                "Who is worth re-engaging first",
              ].map(t => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: C.text }}>
                  <span style={{ color: C.green, fontWeight: 900, flexShrink: 0 }} aria-hidden="true">✓</span>
                  <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{t}</span>
              </div>
            ))}
          </div>
        </LockedModule>
      )}

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

      {/* ── ALL SUPPORTERS ─────────────────────────────────────────── */}
      {hasAnyFans && (
        <div style={card()}>
          <div style={{ ...sectionLabel, marginBottom: 6 }}>All supporters</div>
          <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 14 }}>
            Ranked by lifetime tips{!isPro && whales.length > freeFanLimit ? ` · showing your top ${freeFanLimit}` : ""}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(isPro ? whales : whales.slice(0, freeFanLimit)).map((f, i) => (
              <div key={f.username} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 10,
                background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`,
              }}>
                <span style={{ fontSize: 11.5, color: C.muted, width: 22, flexShrink: 0 }}>#{i + 1}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: C.white, flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{f.username}</span>
                <span style={{ fontSize: 11.5, color: C.muted, whiteSpace: "nowrap" }}>{f.tipCount} tips</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: C.green, whiteSpace: "nowrap" }}>{fmtUsd(f.totalUSD)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
