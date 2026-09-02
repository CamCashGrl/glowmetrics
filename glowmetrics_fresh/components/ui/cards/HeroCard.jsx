"use client"
import React from "react"
import Card from "../Card"
import GradientText from "../GradientText"
import { Eyebrow, CardAction } from "./parts"

// 08 HERO — page-level emphasis, and rare by design. Larger type, layered
// light, gradient headline. If two of these appear on one screen, neither
// is a hero any more.
//
// Padding is the one place a Hero is allowed to be bigger than the rest of
// the system; the surface, radius and border stay identical so it still
// belongs to the same set.
export default function HeroCard({
  eyebrow, headline, headlineAccent, children,
  stats = [],            // [{ value, label }]
  action, onAction, glow = "purple", variant = "accent", className = "", ...rest
}) {
  return (
    <Card variant={variant} glow={glow} padding="lg" className={`cc-card--lum-max ${className}`.trim()} {...rest}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <div className="cc-t-hero-head" style={{ marginTop: eyebrow ? 10 : 0 }}>
        {headline}{" "}
        {headlineAccent && <GradientText>{headlineAccent}</GradientText>}
      </div>
      {children && <div className="cc-t-hero-body">{children}</div>}

      {stats.length > 0 && (
        <div className="cc-t-hero-stats">
          {stats.map((s) => (
            <div className="cc-t-hero-stat" key={s.label}>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {action && <CardAction onClick={onAction}>{action}</CardAction>}
    </Card>
  )
}
