"use client"

import { useEffect } from 'react'

// Root-level error boundary. Without this file, Next.js has nothing to catch
// an uncaught render error with — the visitor just gets a blank page and the
// text "Application error: a client-side exception has occurred" with no way
// to recover short of knowing to hit refresh.
//
// The most common trigger is a stale deployment: the visitor's browser has an
// HTML shell that references a JS chunk hash from a build that's since been
// replaced, so the chunk 404s (ChunkLoadError) and the app never finishes
// loading. That's a stale-asset problem, not a bug in this render, so the fix
// is just a fresh fetch of the current deployment — which we do automatically
// once, before ever bothering the visitor with an error screen.
function isChunkLoadError(error) {
  const msg = `${error?.message || ''} ${error?.name || ''}`
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk/i.test(msg)
}

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('[GlobalError]', error)

    if (isChunkLoadError(error)) {
      const key = 'camcash_chunk_reload_at'
      const last = Number(sessionStorage.getItem(key) || 0)
      // Only auto-reload once per 10s so a genuinely broken deployment can't
      // trap the visitor in a refresh loop.
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(key, String(Date.now()))
        window.location.reload()
      }
    }
  }, [error])

  return (
    <html lang="en">
      <body style={{
        margin: 0,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#050713',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: 24,
      }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: '#8D93AA', marginBottom: 20, lineHeight: 1.5 }}>
            We hit an unexpected error loading this page. This is usually
            fixed by refreshing.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => { try { reset() } finally { window.location.reload() } }}
              style={{
                padding: '11px 22px',
                borderRadius: 10,
                background: 'linear-gradient(90deg, #16F4FF 0%, #55B8FF 28%, #7C5CFF 52%, #FF2BAE 100%)',
                color: '#06101A',
                fontWeight: 700,
                fontSize: 14,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Reload page
            </button>

            <div style={{ borderTop: '1px solid #2a2d3a', paddingTop: 16, marginTop: 8 }}>
              <p style={{ fontSize: 12, color: '#8D93AA', marginBottom: 12 }}>Still having issues?</p>
              <a
                href="mailto:support@glowmetrics.com?subject=Bug Report - Site Error&body=I encountered an error on glowmetrics.com%0A%0AError details:%0A"
                style={{
                  display: 'inline-block',
                  padding: '12px 24px',
                  borderRadius: 8,
                  background: '#FF2BAE',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 14,
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(255, 43, 174, 0.3)',
                }}
              >
                🚨 REPORT A BUG TO GET US BACK ONLINE
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
