"use client"
import React from "react"
import Card from "../Card"
import Button from "../Button"
import { Eyebrow, CardBody } from "./parts"

// 06 FEATURE / CTA — an important action, feature or upgrade. Stronger
// ambient light is allowed here because there should only ever be one of
// these on a screen.
//
// Uses the existing Button component untouched; this template arranges the
// pitch around it and owns no entitlement or Free/Pro logic — the parent
// decides whether to render it at all.
export default function FeatureCard({
  eyebrow, headline, children,
  bullets = [], cta, onCta,
  glow = "pink", variant = "accent", ...rest
}) {
  return (
    <Card variant={variant} glow={glow} {...rest}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <div className="cc-t-feature-head" style={{ marginTop: eyebrow ? 10 : 0 }}>{headline}</div>
      {children && <CardBody>{children}</CardBody>}
      {bullets.length > 0 && (
        <ul className="cc-t-feature-list">
          {bullets.map((b) => <li key={b}>{b}</li>)}
        </ul>
      )}
      {cta && (
        <div className="cc-t-feature-action">
          <Button onClick={onCta}>{cta}</Button>
        </div>
      )}
    </Card>
  )
}
