"use client"
import React from "react"
import FanRiskNotice from "./FanRiskNotice"

// FanFilters — mechanical extraction of the tier/platform filter pills, the
// platform risk-context banner(s), and the free-plan "Top Fan At Risk"
// conversion card, previously inlined in app/dashboard/page.js (Top Fans /
// Whales tab). No calculation, threshold, or conditional-rendering changes —
// identical logic, just moved behind explicit props.
//
// Props:
//   whales         — full (unfiltered) fan array from analytics.whales
//   whaleFilter    — current tier filter value ("ALL" | "Whale" | "Shark" | "Regular" | "Dormant")
//   setWhaleFilter — setter for whaleFilter
//   allPlatforms   — distinct platform names present in the uploaded tips
//   platformFilter — current platform filter value
//   setPlatformFilter — setter for platformFilter
//   analytics      — full analytics object (only analytics.platformRiskContext is read)
//   isPro          — Pro plan flag, gates the conversion card
//   glassCard      — shared glass-card style object
//   C              — design token object
export default function FanFilters({
  whales, whaleFilter, setWhaleFilter,
  allPlatforms, platformFilter, setPlatformFilter,
  analytics, isPro, glassCard, C,
}) {
  return (
    <>
      {/* FILTERS — each pill group scrolls horizontally within itself on
          narrow screens instead of clipping options past the viewport edge */}
      <div style={{ display: "flex", gap: 10, marginTop: 14, marginBottom: 16, flexWrap: "wrap", maxWidth: "100%" }}>
        <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.03)", padding: 3, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch" }}>
          {["ALL","Whale","Shark","Regular","Dormant"].map(t => {
            const count = t === "ALL" ? whales.length : whales.filter(w => w.tier === t).length
            const active = whaleFilter === t
            return (
              <button key={t} className="tier-filter-btn" onClick={() => setWhaleFilter(t)}
                style={{ padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none", flexShrink: 0, whiteSpace: "nowrap", background: active ? "linear-gradient(135deg, #22D3EE, #EC4899)" : "transparent", color: active ? "#06101A" : C.text }}>
                {t === "ALL" ? "All" : t}
                <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 700, opacity: active ? 0.75 : 0.6 }}>{count}</span>
              </button>
            )
          })}
        </div>
        {allPlatforms.length > 1 && (
          <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.03)", padding: 3, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch" }}>
            {["ALL", ...allPlatforms].map(p => (
              <button key={p} className="tier-filter-btn" onClick={() => setPlatformFilter(p)} style={{ padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none", flexShrink: 0, whiteSpace: "nowrap", background: platformFilter === p ? "rgba(34,211,238,0.18)" : "transparent", color: platformFilter === p ? C.cyan : C.text }}>{p}</button>
            ))}
          </div>
        )}
      </div>

      {/* RISK CONTEXT BANNER(S) — surfaces Risk Signals Paused / Data
          Needs Updating per platform instead of silently mislabeling
          fans. Scoped to whichever platform(s) are currently in view. */}
      {(() => {
        const ctx = analytics?.platformRiskContext || {}
        const platformsInView = platformFilter === "ALL" ? allPlatforms : [platformFilter]
        const anyFlagged = platformsInView.some(p => ctx[p] && (ctx[p].riskSignalsPaused || ctx[p].dataNeedsUpdating))
        if (!anyFlagged) return null
        return (
          <div style={{ marginBottom: 16 }}>
            <FanRiskNotice ctx={ctx} platformsInView={platformsInView} C={C} />
          </div>
        )
      })()}

      {/* CONVERSION CARD — free plan only. Only ever built from a REAL
          fan who is both a top tipper (Whale/Shark tier) and has
          genuinely passed the evidence-gated At Risk bar in
          lib/analytics.js (same behavioralState used everywhere else
          — never a separate/fabricated risk claim). If no such fan
          exists, nothing renders — we do not manufacture urgency. */}
      {!isPro && (() => {
        const atRiskTopFan = [...whales]
          .filter(w => (w.tier === 'Whale' || w.tier === 'Shark') && w.behavioralState === 'At Risk')
          .sort((a, b) => b.totalUSD - a.totalUSD)[0]
        if (!atRiskTopFan) return null
        return (
          <a href="/pricing" style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{
              ...glassCard, borderRadius: 16, padding: 18, marginBottom: 20, cursor: 'pointer',
              border: '1.5px solid rgba(248,113,113,0.6)',
              background: 'linear-gradient(135deg, rgba(248,113,113,0.08), rgba(251,146,60,0.05))',
              boxShadow: '0 0 24px rgba(248,113,113,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>🚨</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: C.red, textTransform: 'uppercase', letterSpacing: 0.6 }}>Top Fan At Risk</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div aria-hidden style={{ width: 46, height: 46, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))', filter: 'blur(7px)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div aria-hidden style={{ filter: 'blur(6px)', userSelect: 'none', color: C.white, fontWeight: 700, fontSize: 14, marginBottom: 3 }}>••••••••••</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{atRiskTopFan.platform} · last tipped {atRiskTopFan.daysSinceLastTip}d ago</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 19, fontWeight: 800, color: C.white }}>${atRiskTopFan.totalUSD.toFixed(0)}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>lifetime spend</div>
                </div>
              </div>
              <div style={{ marginTop: 12, padding: '9px 12px', borderRadius: 8, background: 'rgba(248,113,113,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: C.red, fontWeight: 700 }}>⚠️ One of your top tippers has broken their pattern — unlock Fan Intelligence to see who and win them back</span>
                <span style={{ fontSize: 12, color: C.red, fontWeight: 800, whiteSpace: 'nowrap' }}>Upgrade to Pro →</span>
              </div>
            </div>
          </a>
        )
      })()}
    </>
  )
}
