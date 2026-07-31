"use client"

const C = {
  white: "#F1F5F9",
  muted: "#8D93AA",
  cyan: "#22D3EE",
  gold: "#f59e0b",
  green: "#10B981",
}

const STYLES = {
  activating: { border: "rgba(34,211,238,0.3)", bg: "rgba(34,211,238,0.08)", accent: C.cyan },
  active: { border: "rgba(16,185,129,0.35)", bg: "rgba(16,185,129,0.08)", accent: C.green },
  timeout: { border: "rgba(245,158,11,0.3)", bg: "rgba(245,158,11,0.08)", accent: C.gold },
  canceled: { border: "rgba(255,255,255,0.12)", bg: "rgba(255,255,255,0.04)", accent: C.muted },
}

/**
 * Shows the state of a Stripe checkout return. Never claims payment
 * succeeded just because the URL said so — `activating` means "we're
 * checking", `active` means the verified plan actually confirmed it,
 * `timeout` means it hasn't confirmed within the polling window (not a
 * failure), and `canceled` is a neutral, non-alarming notice.
 */
export default function CheckoutReturnBanner({ state, onRetry, onDismiss }) {
  if (!state) return null
  const style = STYLES[state] || STYLES.activating

  let heading, body, showRetry = false
  if (state === 'activating') {
    heading = 'Payment successful'
    body = "We're activating CamCash Pro now."
  } else if (state === 'active') {
    heading = 'CamCash Pro is active'
    body = 'Your account has been upgraded.'
  } else if (state === 'timeout') {
    heading = 'Your payment may still be processing'
    body = 'Refresh your plan status, or contact support if Pro does not activate shortly.'
    showRetry = true
  } else if (state === 'canceled') {
    heading = 'Checkout was canceled'
    body = 'Your current plan has not changed.'
  } else {
    return null
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 18px", borderRadius: 12, marginBottom: 20,
        border: `1px solid ${style.border}`, background: style.bg,
      }}
    >
      {state === 'activating' && (
        <div style={{ width: 16, height: 16, border: `2px solid ${style.accent}55`, borderTop: `2px solid ${style.accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.white }}>{heading}</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>{body}</div>
      </div>
      {showRetry && (
        <button
          onClick={onRetry}
          style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 8, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)", color: C.gold, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
        >
          Refresh plan status
        </button>
      )}
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{ flexShrink: 0, padding: "4px 8px", borderRadius: 6, background: "transparent", border: "none", color: C.muted, fontSize: 16, cursor: "pointer", lineHeight: 1 }}
      >
        ×
      </button>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
