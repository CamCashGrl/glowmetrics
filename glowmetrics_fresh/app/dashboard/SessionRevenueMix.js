"use client"
import { useMemo, useState } from "react"
import { computeRevenueMix } from "../../lib/analytics/revenueMix"

// All figures come from computeRevenueMix() — the one place allowed to sum
// the three revenue tables. This component only lays them out.

const fmtUsd = n => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtPct = p => `${p < 1 && p > 0 ? p.toFixed(1) : Math.round(p)}%`

function StackedBar({ segments, height = 34 }) {
  return (
    <div style={{ display: "flex", height, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
      {segments.map(seg => (
        <div
          key={seg.key}
          title={`${seg.label}: ${fmtUsd(seg.usd)} (${fmtPct(seg.pct)})`}
          style={{ width: `${seg.pct}%`, background: seg.color, display: "flex", alignItems: "center", justifyContent: "center", minWidth: seg.pct > 0 ? 2 : 0, transition: "width 0.35s" }}
        >
          {seg.pct >= 11 && (
            <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(8,12,24,0.85)", whiteSpace: "nowrap", padding: "0 4px" }}>
              {fmtPct(seg.pct)}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * freeChatSessions: the SAME session population the tab is displaying, so the
 * mix never disagrees with the cards below it.
 * paidSessions: raw paid_sessions rows. liveTotalUSD: null to omit the stream.
 */
export default function SessionRevenueMix({ C, glassCard, freeChatSessions = [], paidSessions = [], liveTotalUSD = null, populationLabel = "" }) {
  const [view, setView] = useState("type")

  const mix = useMemo(
    () => computeRevenueMix({ freeChatSessions, paidSessions, liveTotalUSD }),
    [freeChatSessions, paidSessions, liveTotalUSD]
  )

  if (mix.isEmpty) return null

  const multiplatform = mix.byPlatform.length > 1
  const topStream = mix.byStream[0]

  return (
    <div style={{ ...glassCard, borderRadius: 16, padding: "18px 20px", marginBottom: 24 }}>

      {/* HEADER + VIEW TOGGLE */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.white, marginBottom: 2 }}>💰 Where Your Money Comes From</div>
          <div style={{ fontSize: 11, color: C.muted }}>
            {fmtUsd(mix.totalUSD)} across all revenue streams{populationLabel ? ` • free chat: ${populationLabel}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, padding: 3, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {[
            { id: "type", label: "By session type" },
            { id: "platform", label: multiplatform ? "By platform" : "Platform" },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              style={{
                padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
                border: "1px solid " + (view === t.id ? "rgba(34,211,238,0.35)" : "transparent"),
                background: view === t.id ? "rgba(34,211,238,0.14)" : "transparent",
                color: view === t.id ? C.cyan : C.muted,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {view === "type" ? (
        <>
          <StackedBar segments={mix.byStream} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 16 }}>
            {mix.byStream.map(s => (
              <div key={s.key} style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>{s.label}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{fmtUsd(s.usd)}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                  {fmtPct(s.pct)} of earnings{s.count > 0 ? ` • ${s.count} session${s.count !== 1 ? "s" : ""}` : ""}
                </div>
              </div>
            ))}
          </div>

          {topStream && (
            <div style={{ marginTop: 14, padding: "9px 12px", borderRadius: 9, background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.18)", fontSize: 12, color: C.text }}>
              <span style={{ color: C.cyan }}>→</span>{" "}
              {topStream.label} is your biggest earner at {fmtPct(topStream.pct)} of total revenue
              {mix.byStream.length > 1 && ` — ${mix.byStream.length} streams active`}
            </div>
          )}
        </>
      ) : (
        <>
          {!multiplatform && (
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>
              All tracked earnings come from {mix.byPlatform[0].platform}. Import a second platform&apos;s history to compare.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {mix.byPlatform.map(p => (
              <div key={p.platform}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.white }}>{p.platform}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>
                    <span style={{ color: C.green, fontWeight: 800 }}>{fmtUsd(p.totalUSD)}</span> • {fmtPct(p.pct)} of total
                  </span>
                </div>
                <StackedBar segments={p.streams} height={26} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
                  {p.streams.map(s => (
                    <span key={s.key} style={{ fontSize: 10, color: C.muted, display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 4, background: s.color }} />
                      {s.label} {fmtUsd(s.usd)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: 14, fontSize: 10, color: C.muted, lineHeight: 1.5 }}>
        Free chat, paid sessions, and Live Mode are stored separately and each counted once — these figures add up, they never overlap.
        {liveTotalUSD === null && " Live Mode earnings are not included here."}
      </div>
    </div>
  )
}
