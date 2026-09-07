"use client"
import React from "react"
import Card from "../Card"
import GradientText from "../GradientText"
import { Eyebrow, CardBody, CardAction } from "./parts"

// 04 INSIGHT — analytics turned into a takeaway. The headline is a sentence,
// not a KPI: the figure lives inside running text so the card reads as
// intelligence rather than another number in a grid.
//
// `headline` is composed by the parent (which owns the data); `figure`, when
// given, is the one part of the sentence that carries the gradient.
export default function InsightCard({
  eyebrow, icon, headline, figure, headlineAfter, children,
  action, onAction, glow = "pink", variant = "glass", className = "", ...rest
}) {
  return (
    <Card variant={variant} glow={glow} className={`cc-card--lum-plus ${className}`.trim()} {...rest}>
      {eyebrow && (
        <Eyebrow style={{ display: "flex", alignItems: "center" }}>
          {icon && <span className="cc-t-insight-icon" aria-hidden="true">{icon}</span>}
          {eyebrow}
        </Eyebrow>
      )}
      <div className="cc-t-insight-head">
        {headline}{" "}
        {figure && <GradientText>{figure}</GradientText>}
        {headlineAfter ? ` ${headlineAfter}` : null}
      </div>
      {children && <CardBody>{children}</CardBody>}
      {action && <CardAction onClick={onAction}>{action}</CardAction>}
    </Card>
  )
}
