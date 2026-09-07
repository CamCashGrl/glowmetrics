// ═══════════════════════════════════════════════════════════════════════════
// CANONICAL PLATFORM DEFINITIONS — single source of truth for platform
// names, short codes, and brand-accent colours across the dashboard.
//
// Extracted verbatim from app/dashboard/Performance.js (the approved
// Platforms tab) so every surface that needs a platform's colour or
// abbreviation reads the same mapping instead of keeping its own copy.
// Performance.js now imports from here; nothing about its behaviour or
// output changed in that move.
//
// The name list itself (PLATFORM_NAMES) mirrors lib/constants.js's
// PLATFORM_TOKEN_RATES keys — the platforms the product actually supports —
// not a per-creator "platforms you have data on" list. Use analytics.platforms
// (from lib/analytics.js) when you need the latter.
// ═══════════════════════════════════════════════════════════════════════════

import { PLATFORM_TOKEN_RATES } from "./constants"

export const PLATFORM_NAMES = Object.keys(PLATFORM_TOKEN_RATES)

// One restrained accent per platform — a dark glass card with white primary
// type and muted metadata, lifted by a single colour and a very subtle glow.
// Unknown/undetected platforms fall through to the neutral slate accent
// rather than being given a brand identity they don't have.
export const PLATFORM_STYLES = {
  chaturbate: { short: "CB",  accent: "#22D3EE" },
  bongacams:  { short: "BC",  accent: "#EC4899" },
  myfreecams: { short: "MFC", accent: "#7C5CFF" },
  camsoda:    { short: "CS",  accent: "#D946EF" },
  stripchat:  { short: "SC",  accent: "#FB923C" },
  streamate:  { short: "SM",  accent: "#38BDF8" },
  flirt4free: { short: "F4F", accent: "#F472B6" },
  cam4:       { short: "C4",  accent: "#34D399" },
  livejasmin: { short: "LJ",  accent: "#FBBF24" },
}
export const NEUTRAL_PLATFORM_STYLE = { short: "—", accent: "#94A3B8" }

// Card's glow prop takes a canonical palette name, so each platform's accent
// maps onto the nearest one. An insight is lit in its own platform's colour
// without introducing a fifth colour into the system.
export const GLOW_BY_ACCENT = {
  "#22D3EE": "cyan", "#38BDF8": "blue", "#7C5CFF": "purple", "#A855F7": "purple",
  "#EC4899": "pink", "#D946EF": "pink", "#F472B6": "pink", "#FB923C": "pink",
}

export function styleForPlatform(name) {
  const key = String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "")
  if (PLATFORM_STYLES[key]) return PLATFORM_STYLES[key]
  // Derive an abbreviation from the name itself rather than inventing a brand
  // accent for a platform we don't have colours for.
  const words = String(name || "").trim().split(/\s+/).filter(Boolean)
  const short = words.length > 1
    ? words.map(w => w[0]).join("").slice(0, 3).toUpperCase()
    : String(name || "?").slice(0, 2).toUpperCase()
  return { ...NEUTRAL_PLATFORM_STYLE, short }
}

export function glowNameForPlatform(name) {
  return GLOW_BY_ACCENT[styleForPlatform(name).accent] || "purple"
}
