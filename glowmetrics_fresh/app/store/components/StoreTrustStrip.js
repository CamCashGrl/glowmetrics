'use client'

import { T } from './theme'

export default function StoreTrustStrip() {
  const items = ['Instant Digital Downloads', 'Made for Adult Creators', 'Secure Checkout Coming Soon']

  return (
    <div
      style={{
        borderTop: `1px solid ${T.border}`,
        borderBottom: `1px solid ${T.border}`,
        padding: '18px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 10,
      }}
    >
      {items.map((item, i) => (
        <span key={item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.text, letterSpacing: '0.02em' }}>{item}</span>
          {i < items.length - 1 && <span style={{ color: T.muted, fontSize: 12 }}>•</span>}
        </span>
      ))}
    </div>
  )
}
