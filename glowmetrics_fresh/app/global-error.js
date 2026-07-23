"use client"
import { useEffect } from "react"

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('[global-error]', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ background: "#05070f", margin: 0 }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui, sans-serif" }}>
          <div style={{ maxWidth: 440, textAlign: "center", background: "#121826", border: "1px solid #1e2d45", borderRadius: 16, padding: "36px 28px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h1 style={{ color: "#F1F5F9", fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
              Something went wrong
            </h1>
            <p style={{ color: "#94A3B8", fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
              CamCash hit an unexpected error. Your data is safe. Please try again.
            </p>
            <button
              onClick={() => reset()}
              style={{ background: "#22D3EE", color: "#05070f", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
