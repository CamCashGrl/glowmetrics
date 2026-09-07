"use client"
import React from "react"
import Card from "../Card"
import GradientText from "../GradientText"
import { Eyebrow, CardAction } from "./parts"

// 03 SPLIT / DASHBOARD — a primary figure plus the detail behind it. The
// rule under the figure is the composition: above it is the headline number,
// below it the supporting rows, quieter and tabular so they scan as a set.
//
// Different from Metric on purpose: Metric answers "how much?", Split
// answers "how much, and what makes it up?".
export default function SplitCard({
  eyebrow, value, valueSub, gradient = false,
  rows = [],            // [{ label, value }] — supplied by the parent
  action, onAction, variant = "glass", ...rest
}) {
  return (
    <Card variant={variant} {...rest}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <div className="cc-t-metric">
        {gradient ? <GradientText>{value}</GradientText> : value}
      </div>
      {valueSub && <div className="cc-t-sub">{valueSub}</div>}

      {rows.length > 0 && (
        <div className="cc-t-split-rows">
          {rows.map((r) => (
            <div className="cc-t-split-row" key={r.label}>
              <span>{r.label}</span>
              <strong>{r.value}</strong>
            </div>
          ))}
        </div>
      )}

      {action && <CardAction onClick={onAction}>{action}</CardAction>}
    </Card>
  )
}
