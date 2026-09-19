"use client"
import React from "react"

// FanRiskNotice — presentational extraction of the "Risk Signals Paused /
// Data Needs Updating" banner(s) previously inlined in app/dashboard/page.js
// (Top Fans tab). Behavior-preserving: identical selection logic and copy,
// just consolidated into one component.
//
// Props:
//   ctx            — analytics.platformRiskContext (object keyed by platform)
//   platformsInView — array of platform names currently in view
//   C              — design token object from page.js
export default function FanRiskNotice({ ctx, platformsInView, C }) {
  const flagged = (platformsInView || [])
    .map(p => ctx?.[p])
    .filter(c => c && (c.riskSignalsPaused || c.dataNeedsUpdating))

  if (!flagged.length) return null

  // Part 7: when multiple platforms are all "paused" (the common case, and
  // the only case that's purely informational rather than a data-quality
  // flag), consolidate into a single compact notice instead of repeating
  // the same sentence per platform.
  const allPaused = flagged.every(c => c.riskSignalsPaused)
  if (allPaused && flagged.length > 1) {
    const names = flagged.map(c => c.platform).join(", ")
    return (
      <div className="fan-risk-notice fan-risk-notice--paused">
        <strong style={{ color: C.muted }}>Risk Signals Paused — {names}</strong>
        <div className="fan-risk-notice-body" style={{ color: C.muted }}>
          You haven't had a meaningful stream on these platforms recently, so CamCash isn't labeling inactive fans as at risk.
        </div>
      </div>
    )
  }

  return (
    <div className="fans-risk-notice-group">
      {flagged.map(c => (
        <div
          key={c.platform}
          className={`fan-risk-notice ${c.riskSignalsPaused ? "fan-risk-notice--paused" : "fan-risk-notice--stale"}`}
        >
          <strong style={{ color: c.riskSignalsPaused ? C.muted : C.gold }}>
            {c.riskSignalsPaused ? `Risk Signals Paused — ${c.platform}` : `Data Needs Updating — ${c.platform}`}
          </strong>
          <div className="fan-risk-notice-body" style={{ color: C.muted }}>
            {c.riskSignalsPaused
              ? "You haven't had a meaningful stream here recently, so CamCash isn't labeling inactive fans as at risk."
              : `Your ${c.platform} fan data is ${c.dataAgeDays ?? "?"} days old, so current fan behavior may not be complete.`}
          </div>
        </div>
      ))}
    </div>
  )
}
