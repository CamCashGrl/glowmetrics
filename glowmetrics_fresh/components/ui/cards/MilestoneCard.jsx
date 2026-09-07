"use client"
import React from "react"
import Card from "../Card"
import { Eyebrow } from "./parts"

// 07 MILESTONE — goals, progress, streaks. Celebratory through restraint:
// one gradient progress bar and quiet day markers. No trophies, no badges,
// no confetti — this is a creator's business, not a game.
//
// Every figure here is supplied by the parent; the card computes nothing.
// `percent` is the caller's own number, clamped only for rendering width.
export default function MilestoneCard({
  eyebrow, value, target, percent = 0, remaining,
  streakLabel, streak = [],   // [{ day: "M", hit: true }]
  variant = "glass", glow = "cyan", ...rest
}) {
  const width = Math.max(0, Math.min(100, Number(percent) || 0))
  return (
    <Card variant={variant} glow={glow} {...rest}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}

      <div className="cc-t-goal">
        <strong>{value}</strong>
        {target && <span>/ {target}</span>}
      </div>

      <div className="cc-t-progress">
        <div className="cc-t-progress-fill" style={{ width: `${width}%` }} />
      </div>
      <div className="cc-t-progress-meta">
        <span>{remaining}</span>
        <span>{width}%</span>
      </div>

      {streak.length > 0 && (
        <div className="cc-t-foot">
          {streakLabel && <Eyebrow>{streakLabel}</Eyebrow>}
          <div className="cc-t-streak">
            {streak.map((d, i) => (
              <div className="cc-t-streak-day" key={`${d.day}-${i}`}>
                <div className={d.hit ? "cc-t-streak-dot is-hit" : "cc-t-streak-dot"}>
                  {d.hit ? "✓" : ""}
                </div>
                {d.day}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
