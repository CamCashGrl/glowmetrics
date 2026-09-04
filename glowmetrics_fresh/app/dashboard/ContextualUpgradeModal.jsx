'use client'
// ═══════════════════════════════════════════════════════════════════════════
// CONTEXTUAL UPGRADE MODAL  (Phase 2C-4)
//
// The ONE in-dashboard upgrade experience. It replaces the generic modal that
// listed six feature bullets regardless of why it opened — including "AI fan
// behavior predictions & return forecasts", a capability the engine does not
// have and must never sell.
//
// THE SHAPE OF THE ASK:
//   discovery  -> what CamCash just found, in the creator's own numbers
//   why        -> what Pro does about that specific thing
//   action     -> contextual Stripe checkout, monthly or annual
//
// The discovery that caused the click is preserved all the way through: it is
// rendered at the top of the modal, carried into every tracking event as
// `feature_name` + `insight_id`, and carried through checkout as a `ctx`
// parameter so the return lands the creator back where she was.
//
// WHAT THIS FILE DOES NOT DO:
//   - compute anything (the context object arrives built)
//   - hardcode a price id (it posts a plan_type; lib/stripe-plans.js resolves)
//   - implement a second checkout (it posts to the existing /api/stripe/checkout)
//   - claim income, urgency, scarcity, or any prediction
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useCallback } from 'react'
import { track } from '../../lib/track'

const C = {
  white: '#F1F5F9', text: '#94A3B8', muted: '#64748B',
  cyan: '#22D3EE', indigo: '#7C5CFF', pink: '#EC4899', red: '#f87171',
  border: 'rgba(255,255,255,0.10)',
}
const GRADIENT = 'linear-gradient(90deg,#22D3EE,#7C5CFF,#EC4899)'

/** Plan strings the checkout route already understands (lib/stripe-plans.js). */
export const PLAN_MONTHLY = 'standard_monthly'
export const PLAN_ANNUAL = 'standard_annual'

/**
 * @param {Object}   props
 * @param {boolean}  props.open
 * @param {Function} props.onClose
 * @param {Object}   props.context   - buildUpgradeContext() output
 * @param {boolean} [props.isPro]    - already subscribed
 * @param {boolean} [props.trialEligible]
 * @param {Function}[props.getAccessToken] - async () => string|null
 * @param {Function}[props.onProAction]    - already-Pro: take the deeper action
 */
export default function ContextualUpgradeModal({
  open, onClose, context, isPro = false, trialEligible = false,
  getAccessToken, onProAction,
}) {
  const [plan, setPlan] = useState(PLAN_MONTHLY)
  const [status, setStatus] = useState('idle') // idle | loading | error
  const [errorMessage, setErrorMessage] = useState(null)

  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  // The control that opened the modal, so focus can be handed back to it.
  const returnFocusRef = useRef(null)

  const source = context?.source || 'default'
  const insightId = context?.insightId || null

  // ── OPEN: remember focus, announce, reset transient state ────────────────
  useEffect(() => {
    if (!open) return
    returnFocusRef.current = typeof document !== 'undefined' ? document.activeElement : null
    setStatus('idle')
    setErrorMessage(null)
    track('contextual_upgrade_opened', {
      feature_name: source, insight_id: insightId,
      has_discovery: !!context?.hasDiscovery, already_pro: isPro,
    })
    const t = setTimeout(() => closeRef.current?.focus(), 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source])

  const close = useCallback((reason) => {
    if (reason === 'dismissed') {
      track('contextual_upgrade_cancelled', { feature_name: source, insight_id: insightId })
    }
    onClose?.()
    // Focus goes back to whatever opened this, so a keyboard user is not
    // dumped at the top of the document.
    const el = returnFocusRef.current
    if (el && typeof el.focus === 'function') setTimeout(() => el.focus(), 0)
  }, [onClose, source, insightId])

  // ── ESCAPE + FOCUS CONTAINMENT ───────────────────────────────────────────
  // Contained, never trapped: Escape always works, and Tab cycles inside the
  // dialog only while it is open.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close('dismissed'); return }
      if (e.key !== 'Tab') return
      const nodes = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (!nodes || nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open, close])

  if (!open || !context) return null

  // ── CHECKOUT ─────────────────────────────────────────────────────────────
  async function startCheckout() {
    setStatus('loading')
    setErrorMessage(null)
    track('contextual_upgrade_checkout_started', {
      feature_name: source, insight_id: insightId, plan_type: plan,
    })
    try {
      const token = getAccessToken ? await getAccessToken() : null
      if (!token) {
        setStatus('error')
        setErrorMessage('Your session expired. Please sign in again, then retry.')
        return
      }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        // plan_type only — the price id is resolved server-side by
        // lib/stripe-plans.js, so a standard purchase can never be routed
        // through an early-adopter price from here.
        body: JSON.stringify({ plan_type: plan, upgrade_source: source }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        setStatus('error')
        setErrorMessage(data.error || 'We could not open checkout just now. Please try again — you have not been charged.')
        track('checkout_failed', { feature_name: source, plan_type: plan, status: res.status })
        return
      }
      // The discovery is carried by `upgrade_source` in the request above:
      // the route builds it into both the success and cancel URLs, so the
      // return lands back on the right tab. Stripe's own URL is left alone.
      window.location.assign(data.url)
    } catch {
      setStatus('error')
      setErrorMessage('We could not reach checkout. Please check your connection and try again — you have not been charged.')
      track('checkout_failed', { feature_name: source, plan_type: plan, reason: 'network' })
    }
  }

  const busy = status === 'loading'
  const titleId = 'contextual-upgrade-title'
  const descId = 'contextual-upgrade-desc'

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) close('dismissed') }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.86)', zIndex: 1002,
        display: 'flex', justifyContent: 'center',
        // Bottom sheet on small screens, centred dialog above them.
        alignItems: 'flex-end', padding: 0,
      }}
      className="cu-overlay"
    >
      {/* Plain <style>, not styled-jsx: the two class names are unique to this
          component, and a bare tag renders identically everywhere including
          server-side tests. Bottom sheet on a phone, centred dialog above. */}
      <style>{`
        @media (min-width: 620px) {
          .cu-overlay { align-items: center !important; padding: 20px !important; }
          .cu-dialog { max-width: 500px; border-radius: 22px !important; max-height: 88vh; }
        }
        @media (max-width: 619px) {
          .cu-dialog { border-radius: 22px 22px 0 0 !important; max-height: 92vh; }
        }
      `}</style>

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="cu-dialog"
        style={{
          width: '100%', background: 'rgba(15,20,32,0.98)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          border: `1px solid ${C.border}`, overflow: 'auto',
          boxShadow: '0 0 80px rgba(59,130,246,0.18)',
        }}
      >
        <div style={{ height: 3, background: GRADIENT }} />
        <div style={{ padding: '22px 22px 24px' }}>

          {/* Dismiss sits first in the tab order so the sheet is always easy
              to leave, on a phone as much as with a keyboard. */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
            <button
              ref={closeRef}
              onClick={() => close('dismissed')}
              aria-label="Close"
              style={{
                width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
                color: C.text, fontSize: 15, lineHeight: 1,
              }}
            >✕</button>
          </div>

          {/* ── ALREADY PRO ───────────────────────────────────────────────
              No upgrade is offered to someone who already pays. The deeper
              action is offered instead. */}
          {isPro ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.indigo, marginBottom: 8 }}>
                Creator Pro is active
              </div>
              <h2 id={titleId} style={{ fontSize: 20, fontWeight: 800, color: C.white, marginBottom: 10, lineHeight: 1.3 }}>
                {context.headline}
              </h2>
              <p id={descId} style={{ fontSize: 13.5, color: C.text, lineHeight: 1.65, marginBottom: 20 }}>
                {context.unlock.replace(/^With Pro, /, 'You can ')}
              </p>
              {onProAction && (
                <button onClick={() => { onProAction(source); close() }} style={primaryBtn}>
                  {context.primaryCta.replace(/ with Pro$/, '')} →
                </button>
              )}
            </>
          ) : (
            <>
              {/* ── THE DISCOVERY ─────────────────────────────────────────
                  Rendered only when there IS one. No discovery is invented to
                  justify an upsell; the modal simply describes the feature. */}
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.cyan, marginBottom: 8 }}>
                {context.eyebrow}
              </div>
              <h2 id={titleId} style={{ fontSize: 20, fontWeight: 800, color: C.white, marginBottom: context.hasDiscovery ? 12 : 10, lineHeight: 1.3 }}>
                {context.hasDiscovery ? context.discovery[0] : context.headline}
              </h2>
              {context.hasDiscovery && context.discovery.slice(1).map((line, i) => (
                <div key={i} style={{ fontSize: 15, color: C.white, fontWeight: 600, lineHeight: 1.5, marginBottom: 6 }}>{line}</div>
              ))}

              <p id={descId} style={{ fontSize: 13.5, color: C.text, lineHeight: 1.65, margin: '14px 0 18px' }}>
                {context.unlock}
              </p>

              {/* ── PLAN ──────────────────────────────────────────────── */}
              <div role="radiogroup" aria-label="Billing period" style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {[
                  { id: PLAN_MONTHLY, label: 'Monthly' },
                  { id: PLAN_ANNUAL, label: 'Annual' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    role="radio"
                    aria-checked={plan === id}
                    disabled={busy}
                    onClick={() => setPlan(id)}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 12, cursor: busy ? 'default' : 'pointer',
                      fontSize: 13, fontWeight: 700,
                      background: plan === id ? 'rgba(34,211,238,0.10)' : 'transparent',
                      border: `1px solid ${plan === id ? 'rgba(34,211,238,0.45)' : C.border}`,
                      color: plan === id ? C.cyan : C.text,
                    }}
                  >{label}</button>
                ))}
              </div>

              {trialEligible && (
                <div style={{ fontSize: 12.5, color: C.cyan, marginBottom: 14, lineHeight: 1.5 }}>
                  Free for 7 days — every Pro feature, on your own data. Cancel before it ends and you pay nothing.
                </div>
              )}

              {/* ── CHECKOUT ERROR ────────────────────────────────────── */}
              {status === 'error' && errorMessage && (
                <div role="alert" style={{
                  fontSize: 12.5, color: C.red, lineHeight: 1.55, marginBottom: 14,
                  padding: '10px 12px', borderRadius: 10,
                  background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.28)',
                }}>{errorMessage}</div>
              )}

              <button onClick={startCheckout} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }}>
                {busy ? 'Opening secure checkout…' : `${context.primaryCta} →`}
              </button>

              <div style={{ fontSize: 11.5, color: C.muted, textAlign: 'center', margin: '10px 0 14px', lineHeight: 1.5 }}>
                Secure checkout powered by Stripe. Cancel any time.
              </div>

              {/* The public pricing page stays available as the full
                  comparison — it is the secondary path, never the first stop. */}
              <a
                href="/pricing"
                onClick={() => track('contextual_upgrade_compare_plans', { feature_name: source })}
                style={{
                  display: 'block', textAlign: 'center', padding: '10px',
                  fontSize: 12.5, color: C.text, textDecoration: 'none',
                  borderRadius: 10, border: `1px solid ${C.border}`,
                }}
              >See full plan comparison</a>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const primaryBtn = {
  width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: 'pointer',
  background: GRADIENT, color: '#06101A', fontSize: 14.5, fontWeight: 800,
}
