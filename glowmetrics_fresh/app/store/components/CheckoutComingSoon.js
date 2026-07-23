'use client'

import { T } from './theme'

// Non-transactional by design (Phase 1: storefront only). Do not wire this
// to a real checkout flow until a payment processor is chosen.
export default function CheckoutComingSoon() {
  return (
    <div>
      <button
        type="button"
        disabled
        aria-disabled="true"
        style={{
          width: '100%',
          padding: '15px 28px',
          borderRadius: 12,
          border: 'none',
          background: 'rgba(255,255,255,0.07)',
          color: 'rgba(255,255,255,0.4)',
          fontWeight: 800,
          fontSize: 15,
          cursor: 'not-allowed',
        }}
      >
        Checkout Coming Soon
      </button>
      <p style={{ fontSize: 12, color: T.muted, textAlign: 'center', margin: '10px 0 0', lineHeight: 1.5 }}>
        Payment and secure file delivery are being finalized.
      </p>
    </div>
  )
}
