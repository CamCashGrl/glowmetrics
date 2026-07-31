"use client"
import { supabase } from './supabase'

const CONTEXT_STORAGE_KEY = 'camcash_checkout_context'

// Temporary UX fallback only — the authoritative copy of context lives in
// Stripe metadata (see lib/checkoutContext.js) and is retrieved server-side
// via /api/stripe/checkout-context on return. This just covers the same
// browser tab in the common case, and is cleared as soon as it's read.
export function saveCheckoutContextForReturn(context) {
  if (typeof window === 'undefined' || !context) return
  try {
    sessionStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(context))
  } catch (e) {
    // sessionStorage can be unavailable (private browsing, quota) — the
    // server-side context lookup still works without it.
  }
}

export function readAndClearStoredCheckoutContext() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(CONTEXT_STORAGE_KEY)
    sessionStorage.removeItem(CONTEXT_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch (e) {
    return {}
  }
}

// Single shared checkout-start implementation — was previously duplicated
// near-identically across UpgradeModal, PricingClient, and
// EarlyAdopterOffer, which made it easy for one call site to drift (e.g.
// forgetting to attach context, or using a different auth-header shape).
export async function startCheckout(planType, { context, onLoading, onError, track } = {}) {
  onLoading?.(planType)
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      onError?.('Your login session could not be found. Please sign in again.')
      return
    }

    if (context) saveCheckoutContextForReturn(context)

    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      credentials: 'same-origin',
      body: JSON.stringify({ plan_type: planType, context }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Unable to start Stripe Checkout.')
    if (!data.url) throw new Error('Stripe Checkout did not return a payment URL.')

    track?.('checkout_started', {
      plan_type: planType,
      gate_source: context?.gateSource || null,
      feature_name: context?.featureName || null,
    })
    window.location.assign(data.url)
  } catch (error) {
    onError?.(error?.message || 'Something went wrong while opening Stripe Checkout. Please try again.')
  } finally {
    onLoading?.(null)
  }
}
