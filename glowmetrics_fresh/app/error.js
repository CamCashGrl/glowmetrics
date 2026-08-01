'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('App-level error:', error)
  }, [error])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#05070f',
      color: '#e2e8f0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: 24,
      textAlign: 'center',
    }}>
      <div style={{ maxWidth: 420 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#fff' }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 14, color: '#8a93ab', marginBottom: 24, lineHeight: 1.5 }}>
          This page hit an unexpected error. You can try again, or head back to the dashboard.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={() => reset()}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: 'none',
              background: '#22D3EE',
              color: '#05070f',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          <a
            href="/dashboard"
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: '1px solid #1e2d45',
              background: 'transparent',
              color: '#e2e8f0',
              fontWeight: 600,
              fontSize: 14,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
