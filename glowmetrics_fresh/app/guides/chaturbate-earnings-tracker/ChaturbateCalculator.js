'use client'

import { useState } from 'react'

export default function ChaturbateCalculator() {
  const [tokens, setTokens] = useState(1000)
  const [rate, setRate] = useState(0.05)

  const session = tokens * rate
  const weekly = session * 5
  const monthly = session * 20

  return (
    <div style={{ padding: "28px 28px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div>
          <label style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600, display: "block", marginBottom: 8 }}>
            Token Amount
          </label>
          <input
            type="number"
            value={tokens}
            min="0"
            style={{ width: "100%", padding: "11px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: 16, fontWeight: 700, outline: "none", boxSizing: "border-box" }}
            onChange={(e) => setTokens(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600, display: "block", marginBottom: 8 }}>
            Payout Rate ($/token)
          </label>
          <select
            value={rate}
            style={{ width: "100%", padding: "11px 14px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: 14, outline: "none", boxSizing: "border-box" }}
            onChange={(e) => setRate(parseFloat(e.target.value) || 0.05)}
          >
            <option value="0.05">$0.05 — Chaturbate standard</option>
            <option value="0.06">$0.06 — Chaturbate negotiated</option>
            <option value="0.025">$0.025 — BongaCams (incomplete profile)</option>
            <option value="0.05">$0.05 — MyFreeCams</option>
            <option value="0.05">$0.05 — Stripchat</option>
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { label: "This session", value: session, color: "#22D3EE" },
          { label: "Weekly (5 sessions)", value: weekly, color: "#10B981" },
          { label: "Monthly (20 sessions)", value: monthly, color: "#F59E0B" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: "16px 18px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color }}>${value.toFixed(2)}</div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, color: "#475569", marginTop: 14, marginBottom: 0 }}>
        For precise per-session analytics based on your real history, <a href="/login" style={{ color: "#22D3EE" }}>upload your CSV to CamCash</a>.
      </p>
    </div>
  )
}
