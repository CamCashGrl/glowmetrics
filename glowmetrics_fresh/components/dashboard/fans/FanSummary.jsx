"use client"
import React from "react"

// FanSummary — compact metrics row for the Fan Intelligence header.
// Every number here is derived directly from the `whales` array already
// produced by lib/analytics.js (identifyWhales) — no new calculations,
// thresholds, or business rules are introduced.
//
// Props:
//   whales — full (unfiltered) fan array from analytics.whales
//   C      — design token object from page.js
export default function FanSummary({ whales, C }) {
  const list = whales || []
  const totalFans = list.length
  const activeTippers = list.filter(w => w.behavioralState === "Active").length
  const whaleCount = list.filter(w => w.tier === "Whale").length
  const totalSpend = list.reduce((sum, w) => sum + (w.totalUSD || 0), 0)

  const stats = [
    { label: "Total Fans", value: totalFans.toLocaleString() },
    { label: "Active Tippers", value: activeTippers.toLocaleString() },
    { label: "Whales", value: whaleCount.toLocaleString() },
    { label: "Fan Revenue", value: `$${totalSpend.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` },
  ]

  return (
    <div className="fans-summary">
      {stats.map(s => (
        <div key={s.label} className="fans-summary-stat">
          <div className="fans-summary-value" style={{ color: C.white }}>{s.value}</div>
          <div className="fans-summary-label" style={{ color: C.text }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}
