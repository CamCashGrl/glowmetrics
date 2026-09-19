"use client"
import React from "react"

// FanSearchModal — mechanical extraction of the "Search Fan" modal
// previously inlined in app/dashboard/page.js. Deliberately searches the
// FULL `whales` array (not `filteredWhales`), matching the original
// behavior exactly — the search ignores the active tier/platform filters.
//
// Props:
//   open             — fanSearchOpen state
//   query            — fanSearchQuery state
//   setOpen          — setFanSearchOpen
//   setQuery         — setFanSearchQuery
//   whales           — full (unfiltered) fan array from analytics.whales
//   C                — design token object
//   TIER_COLORS      — tier -> color map
export default function FanSearchModal({ open, query, setOpen, setQuery, whales, C, TIER_COLORS }) {
  if (!open) return null
  const q = query.toLowerCase().trim()
  const results = q.length < 1 ? [] : whales.filter(w => w.username?.toLowerCase().includes(q)).slice(0, 8)
  return (
    <div onClick={() => { setOpen(false); setQuery("") }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1010, padding: "80px 20px 20px" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 540, background: "rgba(15,20,32,0.98)", backdropFilter: "blur(24px)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 0 80px rgba(59,130,246,0.2)", overflow: "hidden" }}>
        <div style={{ height: 3, background: "linear-gradient(90deg, #3b82f6, #a855f7, #ec4899)" }} />
        <div style={{ padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, background: "rgba(255,255,255,0.05)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", padding: "10px 14px" }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>🔍</span>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by username..."
              style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.white, fontSize: 15, fontFamily: "inherit" }}
            />
            {query && (
              <button onClick={() => setQuery("")} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1 }}>✕</button>
            )}
          </div>

          {q.length < 1 && (
            <p style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "20px 0" }}>Type a username to search your fans</p>
          )}

          {q.length >= 1 && results.length === 0 && (
            <p style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: "20px 0" }}>No fans found matching "{query}"</p>
          )}

          {results.map((w, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, rgba(59,130,246,0.3), rgba(236,72,153,0.3))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: C.white, flexShrink: 0 }}>
                  {w.username?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.white }}>{w.username}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{w.platform} · {w.tipCount} tips · last {new Date(w.lastTipDate).toLocaleDateString()}</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.green }}>${w.totalUSD.toFixed(2)}</div>
                <span style={{ padding: "3px 8px", borderRadius: 100, background: `${TIER_COLORS[w.tier]}20`, color: TIER_COLORS[w.tier], fontSize: 10, fontWeight: 600 }}>{w.tier}</span>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 16, textAlign: "center" }}>
            <button onClick={() => { setOpen(false); setQuery("") }} style={{ padding: "8px 20px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: C.muted, fontSize: 13, cursor: "pointer" }}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
