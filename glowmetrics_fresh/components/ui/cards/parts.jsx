"use client"
import React from "react"

// Small shared pieces used by more than one master template. They exist so
// the eight templates share a type scale and spacing rhythm instead of each
// restating it — the reason the set reads as one product.
// Presentation only: no data, no logic.

export function Eyebrow({ children, className = "", ...props }) {
  return <div className={`cc-t-eyebrow ${className}`.trim()} {...props}>{children}</div>
}

export function CardTitle({ children, className = "", ...props }) {
  return <div className={`cc-t-title ${className}`.trim()} {...props}>{children}</div>
}

export function CardBody({ children, className = "", ...props }) {
  return <div className={`cc-t-body ${className}`.trim()} {...props}>{children}</div>
}

// A change figure. `direction` is passed by the caller from its own data —
// this component never infers meaning from the string.
export function Delta({ children, direction = "up", className = "", ...props }) {
  const dir = direction === "down" ? "cc-t-delta--down" : "cc-t-delta--up"
  return <div className={`cc-t-delta ${dir} ${className}`.trim()} {...props}>{children}</div>
}

// Footer action. Deliberately a text link, not a Button: Button is the
// page-level commitment, this is navigation within a card.
export function CardAction({ children, onClick, className = "", ...props }) {
  return (
    <div className="cc-t-foot">
      <button type="button" className={`cc-t-link ${className}`.trim()} onClick={onClick} {...props}>
        {children} <span aria-hidden="true">→</span>
      </button>
    </div>
  )
}
