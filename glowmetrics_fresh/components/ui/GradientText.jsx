"use client"
import React from "react"

// ═══════════════════════════════════════════════════════════════════════════
// GRADIENT TEXT — the CamCashGrl signature typography treatment.
//
// Deliberately NOT part of Card: Card owns the shell, this owns type, and
// Button and other components will share this same utility rather than each
// re-implementing background-clip.
//
// The class itself (.cc-gradient-text, app/globals.css) carries the canonical
// gradient and a very slow drift. Use it on a handful of figures per screen —
// the headline metric, a selected heading — never on body copy, which stays
// restrained and readable.
//
// It needs a bold weight and a real size to read as intended; the class sets
// weight 800 and tight tracking, and the caller sets the size.
// ═══════════════════════════════════════════════════════════════════════════

export default function GradientText({
  children,
  as: Component = "span",
  animate = true,
  className = "",
  ...props
}) {
  const classes = [
    "cc-gradient-text",
    animate ? "" : "cc-gradient-text--static",
    className,
  ].filter(Boolean).join(" ")

  return <Component className={classes} {...props}>{children}</Component>
}
