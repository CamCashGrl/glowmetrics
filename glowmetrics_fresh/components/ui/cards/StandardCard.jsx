"use client"
import React from "react"
import Card from "../Card"
import { Eyebrow, CardTitle, CardAction } from "./parts"

// 01 STANDARD GLASS — the workhorse. General supporting information, small
// dashboard modules, secondary content. Quiet by default: it should never
// compete with a Metric or Insight sitting beside it.
//
//   EYEBROW
//   TITLE
//   content
//   optional action
export default function StandardCard({
  eyebrow, title, children, action, onAction,
  variant = "glassQuiet", ...rest
}) {
  return (
    <Card variant={variant} {...rest}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      {title && <CardTitle>{title}</CardTitle>}
      {children}
      {action && <CardAction onClick={onAction}>{action}</CardAction>}
    </Card>
  )
}
