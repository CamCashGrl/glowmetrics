"use client"
import PricingClient from "../pricing/PricingClient"

// Renders the actual pricing page in-app, over the dashboard, instead of
// navigating to /pricing — the user's Supabase session (cookie-based) is
// untouched either way, but staying in this overlay preserves dashboard
// state (active tab, scroll position, in-memory data) that a full
// navigation away and back would otherwise reset.
export default function PricingOverlay({ onClose, isPro }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1200, overflowY: "auto", background: "#050713" }}>
      <PricingClient embedded onBack={onClose} currentPlan={isPro ? "pro" : "free"} />
    </div>
  )
}
