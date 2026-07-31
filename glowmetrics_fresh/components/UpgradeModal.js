"use client"
import { useEffect, useRef, useState } from "react"
import { supabase } from "../lib/supabase"
import { track } from "../lib/track"
import Button from "./ui/Button"

const C = {
  white: "#F1F5F9",
  muted: "#8D93AA",
  cyan: "#22D3EE",
  pink: "#EC4899",
  gold: "#f59e0b",
}

// Mirrors the prices shown on /pricing (app/pricing/PricingClient.js). Kept
// here only for the savings-percentage display, computed from these same
// numbers so the claim can't drift out of sync with what's actually charged.
const STANDARD_MONTHLY_PRICE = 19.99
const STANDARD_ANNUAL_PRICE = 99
const ANNUAL_SAVINGS_PERCENT = Math.round(
  (1 - STANDARD_ANNUAL_PRICE / (STANDARD_MONTHLY_PRICE * 12)) * 100
)

async function startCheckout(planType, { onLoading, onError }) {
  onLoading(planType)
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      onError("Your login session could not be found. Please sign in again.")
      return
    }

    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      credentials: "same-origin",
      body: JSON.stringify({ plan_type: planType }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || "Unable to start Stripe Checkout.")
    if (!data.url) throw new Error("Stripe Checkout did not return a payment URL.")

    track("checkout_started", { plan_type: planType })
    window.location.assign(data.url)
  } catch (error) {
    onError(error?.message || "Something went wrong. Please try again.")
  } finally {
    onLoading(null)
  }
}

/**
 * Shared contextual Pro upgrade modal. The content adapts to whatever gate
 * opened it (source), but the checkout mechanics — auth, price allowlist,
 * annual availability — are the same for every caller so there's exactly
 * one place upgrade behavior can drift.
 *
 * Props:
 *  - source: string, e.g. "whales_empty" — used for analytics + returned
 *    to /dashboard so the page can restore the triggering context
 *  - featureName: short label for analytics
 *  - headline / description: contextual copy
 *  - discoveredValue: optional real, already-computed value to show (e.g.
 *    "3 additional high-value fans found") — never invent this if it isn't
 *    a real computed number
 *  - benefits: short list (3-4 max) of what THIS gate unlocks — keep it
 *    scoped to the feature that opened the modal, not the full Pro feature
 *    list, so a Fan Intelligence gate doesn't advertise Live Mode features
 *  - monthlyPlanType / annualPlanType: plan_type values understood by
 *    /api/stripe/checkout (defaults to the standard plan)
 *  - onClose: called on dismiss ("Not now" / Escape / backdrop click)
 */
export default function UpgradeModal({
  source,
  featureName,
  headline = "Unlock your full CamCash dashboard",
  description = "See your best stream windows, full fan rankings, session breakdowns, and platform comparison.",
  discoveredValue,
  benefits = [],
  monthlyPlanType = "standard_monthly",
  annualPlanType = "standard_annual",
  onClose,
}) {
  const [loadingPlan, setLoadingPlan] = useState(null)
  const [error, setError] = useState("")
  const [annualAvailable, setAnnualAvailable] = useState(true)
  const dialogRef = useRef(null)
  const previouslyFocused = useRef(null)

  useEffect(() => {
    track("upgrade_prompt_viewed", { gate_source: source, feature_name: featureName })
  }, [source, featureName])

  useEffect(() => {
    let cancelled = false
    fetch("/api/stripe/plan-config")
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setAnnualAvailable(Boolean(data.annualAvailable)) })
      .catch(() => { if (!cancelled) setAnnualAvailable(false) })
    return () => { cancelled = true }
  }, [])

  // Focus management: move focus into the dialog on open, restore it on
  // close, and trap Tab/Shift+Tab within the dialog while it's open.
  useEffect(() => {
    previouslyFocused.current = document.activeElement
    dialogRef.current?.focus()
    return () => {
      if (previouslyFocused.current?.focus) previouslyFocused.current.focus()
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        onClose?.()
        return
      }
      if (e.key !== "Tab" || !dialogRef.current) return
      const focusable = dialogRef.current.querySelectorAll(
        'button, a[href], input, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  function handleChoosePlan(planType) {
    track("upgrade_prompt_clicked", { gate_source: source, feature_name: featureName, plan_type: planType })
    startCheckout(planType, { onLoading: setLoadingPlan, onError: setError })
  }

  return (
    <div
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1002, padding: 20 }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-headline"
        tabIndex={-1}
        style={{ width: 480, maxWidth: "100%", background: "rgba(15,20,32,0.97)", backdropFilter: "blur(24px)", borderRadius: 24, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 0 80px rgba(59,130,246,0.2), 0 0 160px rgba(236,72,153,0.1)", overflow: "hidden" }}
      >
        <div style={{ height: 4, background: "linear-gradient(90deg, #3b82f6, #a855f7, #ec4899)" }} />
        <div style={{ padding: 36 }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <h2 id="upgrade-modal-headline" style={{ fontSize: 24, fontWeight: 800, color: C.white, marginBottom: 8 }}>{headline}</h2>
            <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>{description}</p>
          </div>

          {discoveredValue && (
            <div style={{ textAlign: "center", padding: "12px 16px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: C.gold, fontWeight: 600 }}>{discoveredValue}</div>
            </div>
          )}

          {benefits.length > 0 && (
            <ul style={{ margin: "0 0 20px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
              {benefits.slice(0, 4).map((benefit) => (
                <li key={benefit} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: C.white }}>
                  <span aria-hidden="true" style={{ color: C.cyan, flexShrink: 0 }}>✓</span>
                  {benefit}
                </li>
              ))}
            </ul>
          )}

          {error && (
            <div role="alert" style={{ textAlign: "center", padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, marginBottom: 16, color: "#fca5a5", fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
            <Button
              type="button"
              disabled={loadingPlan !== null}
              onClick={() => handleChoosePlan(monthlyPlanType)}
              style={{ width: "100%", padding: "15px", fontSize: 15 }}
            >
              {loadingPlan === monthlyPlanType ? "Redirecting…" : "Upgrade monthly — $19.99/mo"}
            </Button>

            {annualAvailable && (
              <Button
                type="button"
                variant="secondary"
                disabled={loadingPlan !== null}
                onClick={() => handleChoosePlan(annualPlanType)}
                style={{ width: "100%", padding: "15px", fontSize: 15 }}
              >
                {loadingPlan === annualPlanType ? "Redirecting…" : `Upgrade annually — $99/yr (save ${ANNUAL_SAVINGS_PERCENT}%)`}
              </Button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{ width: "100%", padding: "11px", borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: C.muted, fontSize: 13, cursor: "pointer" }}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
