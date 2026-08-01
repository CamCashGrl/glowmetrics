'use client'

import { useEffect } from 'react'

// global-error.js replaces the root layout when an error escapes it, so it
// must render its own <html>/<body> — the normal app/layout.js is not
// mounted at that point.
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#05070f' }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#e2e8f0',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: 24,
          textAlign: 'center',
        }}>
          <div style={{ maxWidth: 420 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🚨</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#fff' }}>
              CamCash hit a critical error
            </h1>
            <p style={{ fontSize: 14, color: '#8a93ab', marginBottom: 24, lineHeight: 1.5 }}>
              Please try reloading the page. If this keeps happening, contact support.
            </p>
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
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
