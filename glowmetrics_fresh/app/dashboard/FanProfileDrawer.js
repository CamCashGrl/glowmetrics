"use client"
import { useEffect } from "react"
import { calcPotentialEarningsRecovery, computeFanTrend } from "../../lib/analytics"

// ═══════════════════════════════════════════════════════════════════════════
// FAN PROFILE DRAWER — right-side slide-in panel, same chrome pattern as
// app/dashboard/tx-hub/components/TransactionDrawer.js (backdrop click /
// Escape to close, fixed-width panel sliding in from the right). Reused
// here rather than inventing a second modal/drawer convention.
//
// Renders one of two states:
//   - Pro: the full profile (tipping pattern, dependency/engagement,
//     classification, insights) — all from canonical identifyWhales() /
//     calcPotentialEarningsRecovery() fields, nothing re-derived here.
//   - Free: a locked preview naming what Pro unlocks, no fabricated data.
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  cyan: "#22D3EE", indigo: "#7C5CFF", pink: "#EC4899", gold: "#F59E0B",
  green: "#10B981", red: "#F87171", white: "#F1F5F9", text: "#94A3B8",
  muted: "#475569", border: "#1e2d45", panel: "#0b0f1a",
}
const CTA_GRADIENT = "linear-gradient(90deg,#22D3EE 0%,#7C5CFF 48%,#EC4899 100%)"

const fmtUsd = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtUsd0 = (n) => `$${Math.round(Number(n || 0)).toLocaleString("en-US")}`
const fmtDays = (d) => (d == null ? "—" : d === 0 ? "today" : d === 1 ? "1 day ago" : d < 30 ? `${d} days ago` : d < 365 ? `${Math.round(d / 30)} mo ago` : `${(d / 365).toFixed(1)} yr ago`)

const CHURN_COLOR = { Low: C.green, Medium: C.gold, High: "#FB923C", Critical: C.red, Unknown: C.muted }
const TREND_COLOR = { up: C.green, down: "#FB923C", stable: C.muted, emerging: C.cyan, insufficient: C.muted }
const TREND_LABEL = { up: "↑ Trending up", down: "↓ Trending down", stable: "→ Stable", emerging: "✦ New · Emerging", insufficient: "Not enough data" }

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 12, color: C.text }}>{label}</span>
      <span style={{ fontSize: 12.5, color: C.white, fontWeight: 700, textAlign: "right" }}>{value}</span>
    </div>
  )
}

// Compact 2-up stat pair — used for tipping-pattern figures so two related
// numbers sit side by side instead of each eating a full-width row. Keeps
// the drawer from turning into a long scroll of single-stat rows.
function StatPair({ items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px", padding: "8px 0 10px" }}>
      {items.map(({ label, value }) => (
        <div key={label}>
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: C.muted, marginBottom: 3 }}>{label}</div>
          <div style={{ fontSize: 13, fontWeight: 750, color: C.white }}>{value}</div>
        </div>
      ))}
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.text, marginTop: 16, marginBottom: 6 }}>
      {children}
    </div>
  )
}

export default function FanProfileDrawer({ fan, isPro, onClose, onUpgrade, onMessage, dependencyRisk }) {
  useEffect(() => {
    if (!fan) return undefined
    const onKey = (e) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [fan, onClose])

  if (!fan) return null

  const churnColor = CHURN_COLOR[fan.churnRisk?.level] || C.muted
  const trend = computeFanTrend(fan)
  const trendColor = TREND_COLOR[trend.trend] || C.muted
  const trendLabel = TREND_LABEL[trend.trend] || "Not enough data"
  const isTopFan = dependencyRisk?.topFanUsername === fan.username
  // Only the actual dependency-risk top fan carries a concentration figure —
  // that stat describes ONE relationship (analytics.dependencyRisk), not
  // every fan, so it's never invented for anyone else.
  const recovery = isTopFan ? dependencyRisk?.potentialRecovery : null

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} />
      <div style={{
        position: "absolute", top: 0, right: 0, bottom: 0, width: "min(440px, 100vw)",
        background: C.panel, borderLeft: `1px solid ${C.border}`, padding: 26, overflowY: "auto",
        animation: "fanDrawerIn .22s ease",
      }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        {/* ── HEADER — identical for Free/Pro; identity is never blurred in
            the drawer itself (only the dependency-risk CARD blurs a name
            before a fan is even opened) ── */}
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%", margin: "0 auto 12px",
            background: `linear-gradient(135deg,${C.indigo},${C.pink})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 800, color: C.white,
          }}>{fan.username.slice(0, 1).toUpperCase()}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.white, overflowWrap: "anywhere" }}>{fan.username}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{fan.platform} · {fan.tier}</div>
          <div style={{
            display: "inline-flex", marginTop: 8, padding: "3px 10px", borderRadius: 999,
            fontSize: 10.5, fontWeight: 800, color: trendColor, background: `${trendColor}1a`, border: `1px solid ${trendColor}45`,
          }}>
            {trendLabel}{trend.changePct != null ? ` (${trend.changePct > 0 ? "+" : ""}${trend.changePct}%)` : ""}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 4 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{fmtUsd(fan.totalUSD)}</div>
            <div style={{ fontSize: 10.5, color: C.muted }}>Lifetime tipped</div>
          </div>
          <div style={{ width: 1, background: C.border }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.white }}>{fan.tipCount}</div>
            <div style={{ fontSize: 10.5, color: C.muted }}>Tips</div>
          </div>
          <div style={{ width: 1, background: C.border }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.cyan }}>{`Top ${100 - fan.spendPercentile}%`}</div>
            <div style={{ fontSize: 10.5, color: C.muted }}>Spend percentile</div>
          </div>
        </div>

        {!isPro ? (
          <>
            <SectionLabel>Basic profile</SectionLabel>
            <Row label="Status" value={fan.tier} />
            <Row label="Total tipped" value={fmtUsd(fan.totalUSD)} />
            <Row label="Tip count" value={fan.tipCount} />
            <Row label="Last active" value={fmtDays(fan.daysSinceLastTip)} />

            <div style={{
              marginTop: 22, padding: "18px 18px", borderRadius: 14,
              background: "linear-gradient(115deg, rgba(124,92,255,0.10), rgba(236,72,153,0.08))",
              border: "1px solid rgba(124,92,255,0.26)",
            }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 10 }}>Unlock Full Fan Profile</div>
              {["🔒 Tipping pattern", "🔒 Dependency risk", "🔒 Engagement trend", "🔒 Advanced fan insights"].map((t) => (
                <div key={t} style={{ fontSize: 12.5, color: C.text, padding: "6px 0" }}>{t}</div>
              ))}
              <button onClick={() => onUpgrade?.("fan_profile_locked")} style={{
                marginTop: 12, width: "100%", padding: "11px 16px", borderRadius: 10, border: 0, cursor: "pointer",
                color: C.white, fontWeight: 800, fontSize: 13, background: CTA_GRADIENT,
              }}>Unlock with Pro →</button>
            </div>
          </>
        ) : (
          <>
            <SectionLabel>Tipping pattern</SectionLabel>
            <StatPair items={[
              { label: "Average tip", value: fmtUsd(fan.avgTipSize) },
              { label: "Biggest tip", value: fmtUsd(fan.biggestTip) },
            ]} />
            <StatPair items={[
              { label: "Typical cadence", value: fan.tipCount >= 3 ? `every ~${Math.round(fan.avgDaysBetweenTips)}d` : "Not enough history" },
              { label: "Typical active hours", value: fan.typicalOnlineHours },
            ]} />
            <Row label="Expected next tip" value={fan.expectedNextTip} />

            <SectionLabel>Engagement</SectionLabel>
            <Row label="Status" value={<span style={{ color: churnColor }}>{fan.churnRisk?.risk || "—"}</span>} />
            <Row label="Last active" value={fmtDays(fan.daysSinceLastTip)} />
            <Row label="Projected monthly value" value={fan.lifetimeValue?.monthly != null ? fmtUsd(fan.lifetimeValue.monthly) : "—"} />

            {isTopFan && dependencyRisk && (
              <>
                <SectionLabel>Dependency risk</SectionLabel>
                <Row label="Share of your earnings" value={`${dependencyRisk.top1Pct}%`} />
                <Row label="Earnings at risk" value={fmtUsd0(dependencyRisk.lossIfTopFanLeaves)} />
                {recovery ? (
                  <>
                    <Row label="Potential earnings recovery" value={fmtUsd0(recovery.amount)} />
                    <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.5, marginTop: 6 }}>{recovery.basis}</div>
                  </>
                ) : (
                  <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.5, marginTop: 6 }}>
                    This fan is tipping on schedule right now — no recovery opportunity to estimate.
                  </div>
                )}
              </>
            )}

            <SectionLabel>Classification</SectionLabel>
            <Row label="Tier" value={fan.tier} />
            <Row label="Spend percentile" value={`Top ${100 - fan.spendPercentile}%`} />

            <SectionLabel>Recommended action</SectionLabel>
            <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>
              {(() => {
                const level = fan.churnRisk?.level
                if (level === "Unknown") return "Not enough history yet for a recommendation."
                if (level === "Critical" || level === "High") {
                  return recovery
                    ? `Consider a re-engagement message — they're overdue based on their own pattern (~${recovery.overdueDays}d past their usual ${Math.round(fan.avgDaysBetweenTips)}d cadence).`
                    : "Consider a re-engagement message — they're overdue based on their own pattern."
                }
                if (trend.trend === "up") return "Keep it up — this fan's engagement is trending up right now."
                if (level === "Medium") return "Keep this fan in your rotation — mention them if you go live soon."
                return "This fan is active and tipping on their normal schedule — no action needed."
              })()}
            </div>

            {onMessage && (
              <button onClick={() => onMessage(fan.username)} style={{
                marginTop: 22, width: "100%", padding: "12px 16px", borderRadius: 10, border: 0, cursor: "pointer",
                color: "#06101A", fontWeight: 800, fontSize: 13.5, background: CTA_GRADIENT,
              }}>Message this fan →</button>
            )}
          </>
        )}
      </div>
      <style jsx>{`
        @keyframes fanDrawerIn { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
    </div>
  )
}
