"use client"
import { useEffect } from "react"

const C = {
  bg: "#05070f", card: "#121826", border: "#1e2d45",
  cyan: "#22D3EE", white: "#F1F5F9", text: "#94A3B8",
}

export default function DashboardError({ error, reset }) {
  useEffect(() => {
    console.error('[dashboard/error]', error)
  }, [error])

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 440, textAlign: "center", background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "36px 28px" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <h1 style={{ color: C.white, fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
          Your dashboard hit a snag
        </h1>
        <p style={{ color: C.text, fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
          Something went wrong while loading your data. Your data is safe — this is just a display error.
          Try again, or reload the page if it keeps happening.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={() => reset()}
            style={{ background: C.cyan, color: "#05070f", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            Try again
          </button>
          <button
            onClick={() => { if (typeof window !== 'undefined') window.location.reload() }}
            style={{ background: "transparent", color: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  )
}
