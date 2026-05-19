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
        setData({ total: 0, remaining: 100, earlyAdopterOpen: true })
        setLoading(false)
      })
  }, [])

  const remaining = data?.remaining ?? 100
  const earlyAdopterOpen = data?.earlyAdopterOpen ?? true
  const total = data?.total ?? 0

  const urgencyColor =
    remaining > 50 ? '#10b981' : remaining > 20 ? '#f59e0b' : '#ec4899'

  const dash = '--'

  // ── pill ────────────────────────────────────────────────────────────────────
  if (variant === 'pill') {
    if (!earlyAdopterOpen && !loading) {
      return (
        <span style={{
          display: 'inline-block',
          padding: '4px 12px',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          background: 'rgba(71,85,105,0.3)',
          color: '#64748b',
          border: '1px solid rgba(71,85,105,0.3)',
        }}>
          Early adopter offer closed
        </span>
      )
    }
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
        color: urgencyColor,
        border: `1px solid ${urgencyColor}40`,
        letterSpacing: '0.2px',
      }}>
        ⚡ {loading ? dash : remaining} spots left
      </span>
    )
  }

  // ── compact ─────────────────────────────────────────────────────────────────
  if (variant === 'compact') {
    if (!earlyAdopterOpen && !loading) {
      return (
        <span style={{ fontSize: 13, color: '#475569', fontStyle: 'italic' }}>
          Early adopter offer closed
        </span>
      )
    }
    return (
      <span style={{ fontSize: 14, fontWeight: 700, color: urgencyColor }}>
        {loading ? dash : remaining}/100 spots remaining
      </span>
    )
  }

  // ── full (default) ──────────────────────────────────────────────────────────
  if (!earlyAdopterOpen && !loading) {
    return (
      <p style={{ fontSize: 14, color: '#475569', fontStyle: 'italic', margin: 0 }}>
        Early adopter offer closed
      </p>
    )
  }

  return (
    <p style={{ fontSize: 15, fontWeight: 600, color: urgencyColor, margin: 0 }}>
      🎉 {loading ? dash : total} creators joined · {loading ? dash : remaining} early adopter spots left
    </p>
  )
}
