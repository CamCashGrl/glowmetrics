"use client"
import { useState } from "react"
import { startCheckout } from "../../lib/checkoutClient"
import { track } from "../../lib/track"
import { GATE_CONFIG } from "../../lib/checkoutContext"

// ============================================================
// CAMCASH — EARLY ADOPTER OFFER CARD
// Relocated from Sidebar.js's UpgradeModal (was clipped at the
// bottom of short viewports there). Copy, pricing, and the
// Subscribe button's checkout behavior are unchanged — only the
// container and placement moved, onto the Overview tab.
// ============================================================

const C = {
  cyan: "#22D3EE", pink: "#EC4899", purple: "#a855f7",
  white: "#F1F5F9", muted: "#475569",
}

const CHECKOUT_CONTEXT = {
  gateSource: GATE_CONFIG.early_adopter_offer.gateSource,
  featureName: GATE_CONFIG.early_adopter_offer.featureName,
  returnPath: GATE_CONFIG.early_adopter_offer.returnTab,
}

export default function EarlyAdopterOffer({ isPro }) {
  const [loading, setLoading] = useState(null)

  if (isPro) return null

  return (
    <div style={{ background: "rgba(236,72,153,0.08)", border: "1px solid rgba(236,72,153,0.3)", borderRadius: 14, padding: 16, marginBottom: 20, position: "relative" }}>
      <div style={{ position: "absolute", top: 0, right: 0, background: `linear-gradient(135deg, ${C.pink}, ${C.purple})`, borderRadius: "0 14px 0 10px", padding: "3px 10px", fontSize: 10, fontWeight: 700, color: "#fff" }}>BEST DEAL</div>
      <div style={{ fontSize: 11, color: C.pink, fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>Early Adopter rate</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 28, fontWeight: 900, color: C.white }}>$9.99</span>
        <span style={{ fontSize: 12, color: C.muted }}>/month</span>
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>Keep this Early Adopter rate while your subscription remains active.</div>
      <button
        onClick={() => startCheckout('early_adopter_monthly', { context: CHECKOUT_CONTEXT, track, onLoading: setLoading, onError: (message) => alert(message) })}
        disabled={loading !== null}
        style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", cursor: loading ? "wait" : "pointer", background: `linear-gradient(135deg, ${C.pink}, ${C.purple})`, color: "#fff", fontSize: 14, fontWeight: 800, boxShadow: "0 0 20px rgba(236,72,153,0.35)" }}>
        {loading === 'early_adopter_monthly' ? 'Redirecting…' : 'Subscribe — $9.99/mo →'}
      </button>
    </div>
  )
}
