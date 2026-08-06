"use client"
// Account & Billing — the app previously had no way for a user to see their
// plan, manage billing, or cancel from inside the product; the only paths
// were external (email support) or nonexistent. Backed by the already-working
// /api/stripe/portal route, which just had no UI pointing at it.
import { useState } from 'react'
import { track as gtmTrack } from '../../lib/track'

const C = {
  cyan: '#22D3EE', pink: '#EC4899', gold: '#F59E0B', green: '#10B981',
  white: '#F1F5F9', muted: '#94A3B8', dim: '#5A6270', purple: '#a855f7', red: '#f87171',
}

function fmtDate(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  } catch (_) { return null }
}

export default function Settings({ user, profile, isPro, supabase }) {
  const [portalLoading, setPortalLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [error, setError] = useState(null)

  const hasStripeCustomer = !!profile?.stripe_customer_id
  const expiresAt = fmtDate(profile?.plan_expires_at)
  const isTimeLimited = isPro && !!profile?.plan_expires_at

  const openBillingPortal = async () => {
    setError(null)
    setPortalLoading(true)
    gtmTrack('billing_portal_opened', {})
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not open billing portal.')
      window.location.assign(data.url)
    } catch (e) {
      setError(e?.message || 'Something went wrong opening billing management. Please try again.')
      setPortalLoading(false)
    }
  }

  const startCheckout = async () => {
    setError(null)
    setCheckoutLoading(true)
    gtmTrack('upgrade_checkout_clicked', { source: 'settings' })
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        credentials: 'include',
        body: JSON.stringify({ plan_type: 'standard_monthly' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) throw new Error(data.error || 'Unable to start checkout.')
      window.location.assign(data.url)
    } catch (e) {
      setError(e?.message || 'Something went wrong starting checkout. Please try again.')
      setCheckoutLoading(false)
    }
  }

  return (
    <div style={{ animation: 'fadeUp 0.3s ease', maxWidth: 640 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.white, marginBottom: 4 }}>⚙️ Account &amp; Billing</div>
        <div style={{ fontSize: 13, color: C.muted }}>Manage your plan, billing, and account details.</div>
      </div>

      {/* Plan status */}
      <div style={{ borderRadius: 18, padding: '20px 22px', marginBottom: 16, background: isPro ? 'linear-gradient(135deg,rgba(34,211,238,0.1),rgba(168,85,247,0.08))' : 'rgba(12,16,34,0.78)', border: `1px solid ${isPro ? 'rgba(34,211,238,0.3)' : 'rgba(255,255,255,0.09)'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Current Plan</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.white }}>
              {isPro ? '✦ Creator Pro' : 'Free'}
            </div>
            {isTimeLimited && (
              <div style={{ fontSize: 12, color: C.gold, marginTop: 4 }}>
                {hasStripeCustomer ? `Renews ${expiresAt}` : `Access until ${expiresAt}`}
              </div>
            )}
            {isPro && !isTimeLimited && (
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Active subscription</div>
            )}
          </div>

          {isPro ? (
            hasStripeCustomer ? (
              <button onClick={openBillingPortal} disabled={portalLoading} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: C.white, fontSize: 13, fontWeight: 700, cursor: portalLoading ? 'default' : 'pointer', opacity: portalLoading ? 0.6 : 1 }}>
                {portalLoading ? 'Opening…' : 'Manage Billing'}
              </button>
            ) : (
              <div style={{ fontSize: 11, color: C.muted, textAlign: 'right', maxWidth: 180 }}>
                Granted access — no billing on file
              </div>
            )
          ) : (
            <button onClick={startCheckout} disabled={checkoutLoading} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', cursor: checkoutLoading ? 'default' : 'pointer', fontWeight: 700, fontSize: 13, color: '#06101A', background: `linear-gradient(90deg, ${C.cyan}, ${C.purple}, ${C.pink})`, opacity: checkoutLoading ? 0.7 : 1 }}>
              {checkoutLoading ? 'Redirecting…' : 'Upgrade to Pro — $19.99/mo'}
            </button>
          )}
        </div>

        {hasStripeCustomer && (
          <div style={{ fontSize: 11, color: C.dim, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            Manage Billing opens Stripe's secure portal — update your card, view invoices, or cancel your subscription. Canceling never deletes your data.
          </div>
        )}

        {error && <div style={{ fontSize: 12, color: C.red, marginTop: 12 }}>{error}</div>}
      </div>

      {/* Account info */}
      <div style={{ borderRadius: 18, padding: '20px 22px', background: 'rgba(12,16,34,0.78)', border: '1px solid rgba(255,255,255,0.09)' }}>
        <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Account</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize: 13, color: C.muted }}>Email</span>
          <span style={{ fontSize: 13, color: C.white, fontWeight: 600 }}>{user?.email}</span>
        </div>
        {user?.created_at && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ fontSize: 13, color: C.muted }}>Member since</span>
            <span style={{ fontSize: 13, color: C.white, fontWeight: 600 }}>{fmtDate(user.created_at)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
