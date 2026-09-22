"use client"
import React from "react"
import { BUTTON_GRADIENT as GRADIENT, BUTTON_GRADIENT_SHADOW as GRADIENT_SHADOW, BUTTON_GRADIENT_SHADOW_HOVER as GRADIENT_SHADOW_HOVER } from "@/lib/theme/colors"
export { GRADIENT, GRADIENT_SHADOW, GRADIENT_SHADOW_HOVER }

// Single source of truth for the app's signature gradient button.
// Style, shadow, hover-lift, and shimmer are copied 1:1 from the landing
// page's LPBtn (app/landing/LandingClient.js) so every CTA in the app is
// visually identical. The shimmer sweep (.lp-btn-primary) lives in
// app/globals.css.

export default function Button({
  as = "button",
  href,
  type,
  onClick,
  children,
  variant = "primary",
  disabled = false,
  loading = false,
  style = {},
  className,
  ...rest
}) {
  const Comp = as
  const isPrimary = variant === "primary"
  const isDisabled = disabled || loading

  const baseStyle = isPrimary ? {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: "13px 28px", borderRadius: 12, border: "none",
    background: isDisabled ? "rgba(255,255,255,0.07)" : GRADIENT,
    color: isDisabled ? "rgba(255,255,255,0.25)" : "white",
    fontWeight: 800, fontSize: 15, letterSpacing: "-0.01em",
    textDecoration: "none", cursor: isDisabled ? "not-allowed" : "pointer",
    boxShadow: isDisabled ? "none" : GRADIENT_SHADOW,
    transition: "all 0.18s",
  } : {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: "12px 22px", borderRadius: 11, border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)", color: "rgba(203,213,225,0.85)",
    fontWeight: 700, fontSize: 14, textDecoration: "none",
    cursor: isDisabled ? "not-allowed" : "pointer",
    opacity: isDisabled ? 0.5 : 1,
    transition: "all 0.18s",
  }

  const handlers = isPrimary ? {
    onMouseEnter: e => { if (!isDisabled) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = GRADIENT_SHADOW_HOVER } },
    onMouseLeave: e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = isDisabled ? "none" : GRADIENT_SHADOW },
    onMouseDown: e => { if (!isDisabled) e.currentTarget.style.transform = "translateY(0)" },
  } : {
    onMouseEnter: e => { if (!isDisabled) { e.currentTarget.style.borderColor = "rgba(33,230,243,0.45)"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(33,230,243,0.07)" } },
    onMouseLeave: e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "rgba(203,213,225,0.85)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)" },
  }

  const extra = as === "a" ? { href } : as === "button" ? { type: type || "button", disabled: isDisabled } : {}
  const classes = [isPrimary && !isDisabled ? "lp-btn-primary" : "", className].filter(Boolean).join(" ")

  return (
    <Comp
      className={classes || undefined}
      onClick={isDisabled ? undefined : onClick}
      style={{ ...baseStyle, ...style }}
      {...handlers}
      {...rest}
      {...extra}
    >
      {children}
    </Comp>
  )
}
