"use client"
import { useEffect } from "react"

const C = {
  bg: "#05070f", card: "#121826", border: "#1e2d45",
  cyan: "#22D3EE", white: "#F1F5F9", text: "#94A3B8",
}

export default function AppError({ error, reset }) {
  useEffect(() => {
    console.error('[app/error]', error)
  }, [error])

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 440, textAlign: "center", background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "36px 28px" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <h1 style={{ color: C.white, fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
          Something went wrong
        </h1>
        <p style={{ color: C.text, fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
          Please try again. Your data is safe.
        </p>
        <button
          onClick={() => reset()}
          style={{ background: C.cyan, color: "#05070f", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
        >
          Try again
        </button>
      </div>
    </div>
  )
}
