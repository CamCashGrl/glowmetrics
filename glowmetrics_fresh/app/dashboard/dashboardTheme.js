"use client"
import React from "react"

export const TAB_LOADING = (
  <div style={{ padding: "80px 0", textAlign: "center" }}>
    <div style={{ width: 40, height: 40, border: "2px solid #1e2d45", borderTop: "2px solid #22D3EE", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
  </div>
)

export const C = {
  bg: "#05070f", card: "#121826", card2: "#161e2e", border: "#1e2d45", border2: "#2a3f5f",
  indigo: "#7C5CFF", cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B", blue: "#60A5FA",
  green: "#10B981", red: "#F87171", orange: "#FB923C", white: "#F1F5F9", text: "#94A3B8", muted: "#475569"
}

export const TIER_COLORS = {
  "Whale": C.gold, "Shark": C.blue, "Regular": C.cyan, "Dormant": C.orange
}

export const glassCard = {
  background: "rgba(15,20,32,0.75)",
  border: "1px solid rgba(255,255,255,0.08)",
  backdropFilter: "blur(20px)",
  boxShadow: "0 0 40px rgba(59,130,246,0.15), 0 0 80px rgba(236,72,153,0.08)",
}

export const formatHour = (hour) => {
  const utcHour = parseInt(hour)
  if (isNaN(utcHour)) return "—"
  const offsetHours = new Date().getTimezoneOffset() / -60
  const localHour = ((utcHour + offsetHours) % 24 + 24) % 24
  const h = Math.round(localHour)
  if (h === 0) return "12 AM"
  if (h < 12) return `${h} AM`
  if (h === 12) return "12 PM"
  return `${h - 12} PM`
}
