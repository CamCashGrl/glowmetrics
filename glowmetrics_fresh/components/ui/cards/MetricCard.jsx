"use client"
import React from "react"
import Card from "../Card"
import GradientText from "../GradientText"
import { Eyebrow, Delta } from "./parts"

// 02 METRIC — one number deserves the attention. The figure dominates; the
// change sits beneath it rather than beside it, so nothing competes.
//
// `gradient` fills the figure with the signature gradient. Reserve it for
// the primary KPI on a screen — if every metric is gradient, none of them
// reads as special.
export default function MetricCard({
  eyebrow, value, gradient = false, delta, deltaDirection = "up", footnote,
  size = "md", variant = "glass", ...rest
}) {
  return (
    <Card variant={variant} {...rest}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <div className={size === "lg" ? "cc-t-metric cc-t-metric--lg" : "cc-t-metric"}>
        {gradient ? <GradientText>{value}</GradientText> : value}
      </div>
      {delta && <Delta direction={deltaDirection}>{delta}</Delta>}
      {footnote && <div className="cc-t-sub">{footnote}</div>}
    </Card>
  )
}
