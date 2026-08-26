"use client"
import { useMemo, useState } from "react"
import ConfidenceBadge from "./ConfidenceBadge"

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
// How many roster rows render before "Show more". A rendering budget, not a
// plan limit — every fan is present in the list for free users and Pro alike.
const ROSTER_PAGE_SIZE = 25

const sectionLabel = { fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text }

const fmtUsd = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtUsd0 = (n) => `$${Math.round(Number(n || 0)).toLocaleString("en-US")}`
const fmtHour = (h) => { const H = ((h % 24) + 24) % 24; return H === 0 ? "12 AM" : H < 12 ? `${H} AM` : H === 12 ? "12 PM" : `${H - 12} PM` }
const fmtDays = (d) => (d == null ? "—" : d === 0 ? "today" : d === 1 ? "1 day ago" : d < 30 ? `${d} days ago` : d < 365 ? `${Math.round(d / 30)} mo ago` : `${(d / 365).toFixed(1)} yr ago`)

function BrandButton({ children, onClick, style }) {
  return (
    <button onClick={onClick} style={{
      background: CTA_GRADIENT, border: "none", borderRadius: 12, padding: "13px 24px",
      fontSize: 14.5, fontWeight: 800, color: "#06101A", cursor: "pointer",
      boxShadow: "0 0 20px rgba(34,211,238,0.22), 0 0 30px rgba(236,72,153,0.16)", ...style,
    }}>{children}</button>
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

function FanRow({ fan, rule, ctx, onMessage }) {
  return (
    // flexWrap + a flex-basis on the text column, so the action button drops
    // to its own line on narrow screens instead of squeezing the text. Without
    // it, at 390px the nowrap button held ~200px and the text column collapsed
    // to roughly one character wide — the row rendered as a vertical column of
    // single letters, ~7700px tall for the page.
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

        {/* WHY this fan is on the list — the point of the row. */}
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginBottom: 8, overflowWrap: "anywhere" }}>
          {rule.reason(fan, ctx)}
        </div>

        {/* Canonical facts, each labeled. No probability percentage. */}
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
  // computeIntelligence() output. Used ONLY by the intelligence sections
  // below. The full supporter roster stays unbadged: those rows are recorded
  // events, not inferences, and a confidence word on a recorded tip would be
  // meaningless (see the roster comment further down).
  intelligence = null,
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

  // ── FULL ROSTER (free) ────────────────────────────────────────────
  // Ranked once by lifetime value so #1 is stable regardless of the search
  // term, then filtered. isTopSupporter is read from the canonical fan
  // fields (identifyWhales) — never recomputed here.
  const [fanQuery, setFanQuery] = useState("")
  const [rosterPage, setRosterPage] = useState(1)
  const ranked = useMemo(
    () => [...whales]
      .sort((a, b) => (b.totalUSD || 0) - (a.totalUSD || 0))
      .map((f, i) => ({ ...f, rank: i + 1 })),
    [whales]
  )
  const roster = useMemo(() => {
    const q = fanQuery.trim().toLowerCase()
    return q ? ranked.filter(f => f.username.toLowerCase().includes(q)) : ranked
  }, [ranked, fanQuery])
  const visibleRosterCount = rosterPage * ROSTER_PAGE_SIZE

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={sectionLabel}>Priority fans</div>
          <ConfidenceBadge intelligence={intelligence} insight="churn_risk" />
        </div>

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

            {/* The two blurred "locked" fan rows that used to sit here are
                gone. The summary card immediately below already states what
                is being held back using this account's REAL numbers — how
                many fans, their combined lifetime tips, how many are overdue
                — which is strictly more informative than a blurred row and
                does not ask the creator to squint at their own data. */}
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={sectionLabel}>Who shows up in your best window</div>
            <ConfidenceBadge intelligence={intelligence} insight="fan_behaviour" />
          </div>
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={sectionLabel}>Concentration risk</div>
            <ConfidenceBadge intelligence={intelligence} insight="dependency_risk" />
          </div>
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

      {/* ── ALL SUPPORTERS — the full roster, free ──────────────────
          Every fan the creator has, searchable, with the observed facts
          about each: platform, first and last interaction, tip count,
          lifetime value. These are all recorded events, not predictions —
          which is why they carry no confidence state and are not gated.

          What stays Pro is the INTELLIGENCE above (cadence, churn, timing,
          re-engagement), not the creator's ability to see her own fans.
          Approved 2026-08-26. */}
      {hasAnyFans && (
        <div style={card()}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
            <div style={sectionLabel}>All supporters</div>
            <div style={{ fontSize: 11.5, color: C.muted }}>
              {roster.length === whales.length
                ? `${whales.length.toLocaleString()} total`
                : `${roster.length.toLocaleString()} of ${whales.length.toLocaleString()}`}
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 12 }}>
            Ranked by lifetime tips · everything here is observed history
          </div>

          <input
            value={fanQuery}
            onChange={(e) => setFanQuery(e.target.value)}
            placeholder="Search supporters by name…"
            aria-label="Search supporters by name"
            style={{
              width: "100%", padding: "10px 13px", marginBottom: 12,
              background: "rgba(5,9,24,0.72)", border: `1px solid ${C.border}`,
              borderRadius: 10, color: C.white, fontSize: 13, outline: "none",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {roster.slice(0, visibleRosterCount).map((f) => (
              <div key={`${f.platform}:${f.username}`} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 10,
                background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, flexWrap: "wrap",
              }}>
                <span style={{ fontSize: 11.5, color: C.muted, width: 26, flexShrink: 0 }}>#{f.rank}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: C.white, flex: 1, minWidth: 120, overflowWrap: "anywhere" }}>
                  {f.username}
                  {f.isTopSupporter && (
                    <span style={{
                      marginLeft: 8, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.06em",
                      textTransform: "uppercase", color: C.gold, padding: "2px 7px", borderRadius: 99,
                      background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.28)",
                      whiteSpace: "nowrap",
                    }}>Top Supporter</span>
                  )}
                </span>
                {f.platform && <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>{f.platform}</span>}
                <span style={{ fontSize: 11.5, color: C.muted, whiteSpace: "nowrap" }}>{f.tipCount} tips</span>
                <span style={{ fontSize: 11.5, color: C.muted, whiteSpace: "nowrap" }}>last {fmtDays(f.daysSinceLastTip)}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: C.green, whiteSpace: "nowrap" }}>{fmtUsd(f.totalUSD)}</span>
              </div>
            ))}
            {roster.length === 0 && (
              <div style={{ fontSize: 12.5, color: C.muted, padding: "10px 2px" }}>
                No supporter matches “{fanQuery}”.
              </div>
            )}
          </div>

          {roster.length > visibleRosterCount && (
            <button
              onClick={() => setRosterPage((n) => n + 1)}
              style={{
                marginTop: 12, width: "100%", padding: "10px", borderRadius: 10,
                background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
                color: C.text, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
              }}
            >
              Show {Math.min(ROSTER_PAGE_SIZE, roster.length - visibleRosterCount)} more
            </button>
          )}
        </div>
      )}
    </div>
  )
}
