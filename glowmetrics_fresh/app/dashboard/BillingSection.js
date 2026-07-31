"use client"
import { useState } from "react"
import { supabase } from "../../lib/supabase"
import { track as gtmTrack } from "../../lib/track"
import Button from "../../components/ui/Button"
import { isProPlan } from "../../lib/plan"

const C = {
  white: "#F1F5F9", muted: "#8D93AA", cyan: "#22D3EE",
  pink: "#EC4899", gold: "#f59e0b", green: "#10B981", red: "#ef4444",
}

const BILLING_STATUS_COPY = {
  past_due: { label: "Payment needs attention", color: C.gold },
  unpaid: { label: "Payment needs attention", color: C.gold },
  incomplete: { label: "Payment needs attention", color: C.gold },
  canceled: { label: "Canceled", color: C.muted },
  ok: { label: "Active", color: C.green },
}

function fmtDate(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
  } catch (e) {
    return null
  }
}

/**
 * Plan & Billing section. Shows only what's actually true — never claims a
 * renewal date, interval, or billing status the profile doesn't have data
 * for, and never renders a Stripe customer/subscription ID.
 */
export default function BillingSection({ profile, isPro: isProProp }) {
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState("")

  const isPro = isProProp ?? isProPlan(profile?.plan)
  const billingStatus = profile?.billing_status || (isPro ? "ok" : null)
  const needsAttention = billingStatus && billingStatus !== "ok" && billingStatus !== "canceled"
  const renewalDate = fmtDate(profile?.current_period_end)
  const interval = profile?.billing_interval === "year" ? "Annual" : profile?.billing_interval === "month" ? "Monthly" : null
  const statusCopy = BILLING_STATUS_COPY[billingStatus] || null

  async function openBillingPortal() {
    setPortalError("")
    setPortalLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setPortalError("Your login session could not be found. Please sign in again.")
        return
      }
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        credentials: "same-origin",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        setPortalError(
          res.status === 404
            ? "Billing management isn't set up yet for this account — subscribe to Pro first, then billing management becomes available here."
            : "Couldn't open the billing portal right now. Please try again shortly."
        )
        return
      }
      gtmTrack("billing_portal_opened", { current_plan: profile?.plan || "free" })
      window.location.assign(data.url)
    } catch (e) {
      setPortalError("Couldn't open the billing portal right now. Please try again shortly.")
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 8 }}>💳 Plan &amp; Billing</h1>
      <p style={{ fontSize: 14, color: C.muted, marginBottom: 24 }}>Manage your CamCash subscription.</p>

      {needsAttention && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", borderRadius: 12, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", marginBottom: 20 }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.white, marginBottom: 2 }}>Your latest CamCash payment needs attention</div>
            <div style={{ fontSize: 12.5, color: C.muted }}>Update your payment method to keep Pro access active.</div>
          </div>
        </div>
      )}

      <div style={{ background: "rgba(15,20,32,0.75)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 28, marginBottom: 16 }}>
        {isPro ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.pink, marginBottom: 8 }}>
              {profile?.is_early_adopter ? "CamCash Pro — Early Adopter" : "CamCash Pro"}
            </div>
            <div style={{ fontSize: 15, color: C.white, marginBottom: 16 }}>
              {statusCopy ? (
                <span style={{ color: statusCopy.color, fontWeight: 700 }}>{statusCopy.label}</span>
              ) : "Your subscription is active."}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {interval && (
                <div style={{ fontSize: 13, color: C.muted }}>Billing interval: <span style={{ color: C.white }}>{interval}</span></div>
              )}
              {renewalDate && (
                <div style={{ fontSize: 13, color: C.muted }}>{billingStatus === "canceled" ? "Access ends" : "Renews"}: <span style={{ color: C.white }}>{renewalDate}</span></div>
              )}
              {!interval && !renewalDate && (
                <div style={{ fontSize: 12.5, color: C.muted, fontStyle: "italic" }}>Billing details will appear here shortly after your subscription activates.</div>
              )}
            </div>

            <Button onClick={openBillingPortal} disabled={portalLoading} style={{ padding: "12px 24px", fontSize: 14 }}>
              {portalLoading ? "Opening…" : "Manage billing"}
            </Button>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 10 }}>
              Opens Stripe's secure billing portal, where you can update your payment method or manage your subscription.
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.cyan, marginBottom: 8 }}>Free plan</div>
            <p style={{ fontSize: 14, color: C.text, lineHeight: 1.6, marginBottom: 20 }}>
              Upgrade to unlock all platforms and advanced insights.
            </p>
            <Button as="a" href="/pricing" style={{ padding: "12px 24px", fontSize: 14 }}>View Pro options</Button>
          </>
        )}

        {portalError && (
          <div role="alert" style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 12.5 }}>
            {portalError}
          </div>
        )}
      </div>
    </div>
  )
}
