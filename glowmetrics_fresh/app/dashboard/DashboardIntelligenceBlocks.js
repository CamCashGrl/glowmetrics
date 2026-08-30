"use client"

// ═══════════════════════════════════════════════════════════════════════════
// CAMCASH NOTICED — rotating daily-intelligence carousel
//
// Sits directly under the Command Center's "Your next best move" hero.
// The hero answers "what should I do right now" (best window / top
// platform). This carousel answers "what else did CamCash notice about
// you" — so it deliberately excludes the 'time' insight type, since that
// is the same best-window fact the hero already leads with.
//
// CONTENT SOURCE: analytics.insights, produced by generateInsights() in
// lib/analytics.js — the same engine already computing day-of-week,
// fan/whale concentration, session-duration, retention, and week-over-week
// momentum insights elsewhere in the app. Nothing here re-derives a metric;
// this file only selects, labels, and rotates through what generateInsights()
// already produced. validateInsights() (also in lib/analytics.js) has
// already stripped anything with a $0 or a suspicious 100%-returning claim
// before this ever sees it.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react"

const C = {
  cyan: "#22D3EE",
  indigo: "#7C5CFF",
  pink: "#EC4899",
  gold: "#F59E0B",
  green: "#10B981",
  white: "#F1F5F9",
  text: "#94A3B8",
  muted: "#64748B",
  border: "rgba(255,255,255,0.08)",
}

const glass = {
  background: "rgba(15,20,32,0.75)",
  border: `1px solid ${C.border}`,
  backdropFilter: "blur(20px)",
  boxShadow: "0 0 34px rgba(59,130,246,0.12), 0 0 60px rgba(236,72,153,0.06)",
}

const CTA_GRADIENT = "linear-gradient(90deg,#22D3EE 0%,#7C5CFF 48%,#EC4899 100%)"

// Label + accent per generateInsights() `type`. 'time' is intentionally
// absent — filtered out below, not just unmapped, so a future insight type
// added upstream doesn't accidentally render as "Insight" with no color.
const TYPE_META = {
  day:       { label: "Day pattern",        accent: C.cyan },
  whales:    { label: "Fan insight",        accent: C.pink },
  duration:  { label: "Session insight",    accent: C.indigo },
  retention: { label: "Retention insight",  accent: C.green },
  momentum:  { label: "Performance trend",  accent: C.gold },
}

// Momentum is the one type whose real-world valence flips (up vs down); its
// icon already encodes that (📈 vs 📉), so give the down case a warmer,
// less "everything is great" accent instead of hardcoding green for both.
function accentFor(insight) {
  const meta = TYPE_META[insight.type]
  if (!meta) return C.cyan
  if (insight.type === "momentum" && insight.icon === "📉") return C.gold
  return meta.accent
}

export default function CamCashNoticedCarousel({ analytics, onPlanStream }) {
  const [index, setIndex] = useState(0)

  // Same exclusion rule stated above: drop 'time' so this never repeats the
  // hero's "go live at X" headline. Everything else generateInsights()
  // produced is fair game — it is already gated on real sample-size
  // thresholds (see lib/analytics.js: >=3 long AND >=3 short sessions for
  // duration, >10 unique fans for retention, etc.), so nothing here needs a
  // second confidence check layered on top.
  const notices = useMemo(() => {
    const raw = Array.isArray(analytics?.insights) ? analytics.insights : []
    return raw
      .filter((i) => i?.type !== "time" && TYPE_META[i?.type])
      .map((i) => ({ ...i, label: TYPE_META[i.type].label, accent: accentFor(i) }))
      .slice(0, 6)
  }, [analytics?.insights])

  useEffect(() => {
    if (notices.length <= 1) return undefined
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % notices.length)
    }, 6000)
    return () => window.clearInterval(id)
  }, [notices.length])

  useEffect(() => {
    if (index >= notices.length) setIndex(0)
  }, [index, notices.length])

  const active = notices[index] || null

  // Insufficient data: never fabricate a placeholder stat. Say so plainly
  // and point at the same action (Plan My Stream / import more) that grows
  // the sample this card runs on.
  if (!active) {
    return (
      <section style={{
        ...glass,
        borderRadius: 16,
        padding: "18px 20px",
        animation: "fadeUp 220ms ease both",
      }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 8 }}>
          CamCash Noticed
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.white }}>Still building your daily brief</div>
        <div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.55, color: C.text }}>
          A few more streams will unlock patterns beyond your best window — things like your strongest day, fan
          retention, and session-length trends.
        </div>
        {onPlanStream && (
          <button onClick={onPlanStream} style={{ marginTop: 14, padding: "10px 18px", borderRadius: 10, border: 0, cursor: "pointer", color: C.white, fontWeight: 800, fontSize: 12.5, background: CTA_GRADIENT, boxShadow: "0 5px 20px rgba(124,92,255,0.25)" }}>
            Build Personalized Streaming Plan →
          </button>
        )}
      </section>
    )
  }

  return (
    <section style={{
      ...glass,
      borderRadius: 16,
      padding: "16px 18px",
      borderColor: `${active.accent}45`,
      background: "rgba(11,15,26,0.72)",
      animation: "fadeUp 220ms ease both",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", background: `${active.accent}18`, border: `1px solid ${active.accent}30`, fontSize: 15, flexShrink: 0 }}>
            {active.icon}
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>CamCash Noticed</div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: active.accent, marginTop: 1 }}>{active.label}</div>
          </div>
        </div>
        {notices.length > 1 && (
          <div aria-label="Insight position" style={{ display: "flex", gap: 5 }}>
            {notices.map((n, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Show insight ${i + 1} of ${notices.length}`}
                style={{
                  width: 5, height: 5, borderRadius: "50%", padding: 0, border: 0, cursor: "pointer",
                  background: i === index ? active.accent : "rgba(255,255,255,0.16)",
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.55, color: C.white, fontWeight: 600 }}>
        {active.text}
      </div>

      {onPlanStream && (
        <div style={{ marginTop: 13 }}>
          <button onClick={onPlanStream} style={{ padding: "9px 16px", borderRadius: 9, border: 0, cursor: "pointer", color: C.white, fontWeight: 800, fontSize: 12, background: CTA_GRADIENT, boxShadow: "0 4px 16px rgba(124,92,255,0.25)" }}>
            Build Personalized Streaming Plan →
          </button>
        </div>
      )}
    </section>
  )
}
