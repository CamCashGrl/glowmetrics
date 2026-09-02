"use client"
import React from "react"

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM FILTER — shared pill selector: "All Platforms" plus one pill per
// supported platform. One implementation so no tab has to build or maintain
// its own copy. Presentation only: the caller owns the list of platforms to
// show (usually lib/platforms.js's PLATFORM_NAMES, or a data-driven subset)
// and the selected value/onChange — this component holds no state and knows
// nothing about sessions, tips, or any other domain data.
// ═══════════════════════════════════════════════════════════════════════════

export default function PlatformFilter({ platforms = [], value = "all", onChange, className = "" }) {
  return (
    <div className={`platform-filter-pills ${className}`.trim()} role="group" aria-label="Filter by platform">
      <button
        type="button"
        className={`session-pill${value === "all" ? " active" : ""}`}
        onClick={() => onChange?.("all")}
      >
        All Platforms
      </button>
      {platforms.map((p) => (
        <button
          key={p}
          type="button"
          className={`session-pill${value === p ? " active" : ""}`}
          onClick={() => onChange?.(p)}
        >
          {p}
        </button>
      ))}
    </div>
  )
}
