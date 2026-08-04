'use client'

import { useState, useEffect } from 'react'

export default function UserCounter({ variant = 'full' }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/user-count')
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => {
        setData({ total: 0 })
        setLoading(false)
      })
  }, [])

  const total = data?.total ?? 0
  const dash = '--'
  const label = loading ? dash : total.toLocaleString()

  // ── pill ────────────────────────────────────────────────────────────────────
  if (variant === 'pill') {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 12px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: 'rgba(0,0,0,0.3)',
        color: '#10b981',
        border: '1px solid rgba(16,185,129,0.4)',
        letterSpacing: '0.2px',
      }}>
        🎉 {label} creators joined
      </span>
    )
  }

  // ── compact ─────────────────────────────────────────────────────────────────
  if (variant === 'compact') {
    return (
      <span style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>
        {label} creators joined
      </span>
    )
  }

  // ── full (default) ──────────────────────────────────────────────────────────
  return (
    <p style={{ fontSize: 15, fontWeight: 600, color: '#10b981', margin: 0 }}>
      🎉 {label} creators have joined CamCash
    </p>
  )
}
