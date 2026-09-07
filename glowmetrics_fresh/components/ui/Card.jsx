"use client"
import React from "react"

// ═══════════════════════════════════════════════════════════════════════════
// CARD — the shared CamCashGrl glass surface.
//
// Presentation only. This component owns the shell: glass, border, ambient
// glow, depth and hover. It owns nothing else — no data, no analytics, no
// entitlement or Free/Pro logic, no content layout. Parents pass children.
//
// The visual definition lives in app/globals.css under "CAMCASHGRL CARD
// SYSTEM", so radius, blur and shadow are tuned in one place rather than in
// every consumer. See that block for the structure:
//     .cc-card > .cc-card__inner > children
//
// Density is deliberate: padding defaults to the compact size. This is an
// analytics command center — six to ten of these share a screen, so the
// surface stays quiet and the content carries the page.
// ═══════════════════════════════════════════════════════════════════════════

// Inline-style equivalent of the .cc-card surface, for the many existing
// call sites that spread a style object rather than render this component.
// Exported so those files stop each defining their own copy — this is the
// same surface the CSS class produces, expressed for inline use.
export const CARD_SURFACE = {
  background: "rgba(10, 14, 32, 0.82)",
  border: "1px solid rgba(255, 255, 255, 0.075)",
  borderRadius: 15,
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 14px 34px rgba(0,0,0,0.34)",
}

const VARIANTS = {
  glass:      "cc-card cc-card--glass",
  glassQuiet: "cc-card cc-card--quiet",
  accent:     "cc-card cc-card--accent",
  flat:       "cc-card cc-card--flat",
}

const PADDING = {
  sm:   "cc-card--pad-sm",
  md:   "cc-card--pad-md",
  lg:   "cc-card--pad-lg",
  none: "",
}

// Ambient light colour, from the canonical palette only. A card tints the
// light in its corner; it never becomes a coloured box.
const GLOW = {
  cyan:   "var(--cc-cyan)",
  blue:   "var(--cc-blue)",
  purple: "var(--cc-purple)",
  pink:   "var(--cc-pink)",
}

export default function Card({
  children,
  variant = "glass",
  padding = "md",
  glow,            // "cyan" | "blue" | "purple" | "pink" — defaults to purple in CSS
  className = "",
  innerClassName = "",
  style,
  onClick,
  as: Component = "div",
  ...props
}) {
  const interactive = typeof onClick === "function"

  const classes = [
    VARIANTS[variant] || VARIANTS.glass,
    PADDING[padding] ?? PADDING.md,
    interactive ? "cc-card--interactive" : "",
    className,
  ].filter(Boolean).join(" ")

  // A custom glow is passed as a CSS variable so the border, ambient wash and
  // hover state all read the same colour without four separate props.
  const glowStyle = GLOW[glow] ? { "--cc-glow": GLOW[glow] } : null

  // Keyboard parity: a div that responds to click must also respond to Enter
  // and Space, and must be reachable by tab.
  const a11y = interactive && Component === "div"
    ? {
        role: "button",
        tabIndex: 0,
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(e) }
        },
      }
    : null

  return (
    <Component
      className={classes}
      style={glowStyle ? { ...glowStyle, ...style } : style}
      onClick={onClick}
      {...a11y}
      {...props}
    >
      <div className={innerClassName ? `cc-card__inner ${innerClassName}` : "cc-card__inner"}>
        {children}
      </div>
    </Component>
  )
}
