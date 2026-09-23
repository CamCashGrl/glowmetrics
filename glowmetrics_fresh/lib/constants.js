// ============================================================
// CAMCASH — PLATFORM TOKEN RATES
// Single source of truth. Import tokenRate() from here.
// Never hardcode a platform rate anywhere else in the codebase.
// ============================================================

export const PLATFORM_TOKEN_RATES = {
  Chaturbate: 0.05,
  BongaCams:  0.025,
  MyFreeCams: 0.05,
  Stripchat:  0.05,
  CamSoda:    0.05,
}

export const DEFAULT_TOKEN_RATE = 0.05

// Lowercased lookup so callers passing DB/API casing (e.g. 'bongacams' from
// live_tips.platform) still resolve to the correct rate instead of silently
// falling through to DEFAULT_TOKEN_RATE.
const PLATFORM_TOKEN_RATES_LOWER = Object.fromEntries(
  Object.entries(PLATFORM_TOKEN_RATES).map(([k, v]) => [k.toLowerCase(), v])
)

export function tokenRate(platform) {
  if (!platform) return DEFAULT_TOKEN_RATE
  return PLATFORM_TOKEN_RATES_LOWER[platform.toLowerCase()] ?? DEFAULT_TOKEN_RATE
}

// What viewers pay per token to buy it (not what the model receives).
// Source: per-platform token calculators (e.g. camcalcs.com), checked July 2026.
export const PLATFORM_VIEWER_RATES = {
  Chaturbate: 0.10,
  BongaCams:  0.0682253,
  MyFreeCams: 0.0908909,
  Stripchat:  0.0925741,
  CamSoda:    0.1099,
}

export const DEFAULT_VIEWER_RATE = 0.10

export function viewerRate(platform) {
  return PLATFORM_VIEWER_RATES[platform] ?? DEFAULT_VIEWER_RATE
}

// ============================================================
// CAMCASH — PLATFORM DISPLAY IDENTITY (name casing + color)
// Single source of truth for platform badges. Reuses the same colors
// already used for platforms in AnalyticsCharts.js (Chaturbate/BongaCams/
// MyFreeCams) rather than inventing a new palette; Stripchat/CamSoda
// extend it using colors already established elsewhere in the app.
// Never hardcode a platform color anywhere else in the codebase.
// ============================================================

export const PLATFORM_COLORS = {
  Chaturbate: "#a855f7",
  BongaCams:  "#ec4899",
  MyFreeCams: "#22d3ee",
  Stripchat:  "#60A5FA",
  CamSoda:    "#34D399",
}

const DEFAULT_PLATFORM_COLOR = "#64748b"

// Canonical display name (correct capitalization), matched case-insensitively
// so DB/CSV casing variants (e.g. 'bongacams') still resolve correctly.
const PLATFORM_NAMES_LOWER = Object.fromEntries(
  Object.keys(PLATFORM_TOKEN_RATES).map(k => [k.toLowerCase(), k])
)

export function platformDisplayName(platform) {
  if (!platform) return "Unknown"
  return PLATFORM_NAMES_LOWER[platform.toLowerCase()] || platform
}

export function platformColor(platform) {
  if (!platform) return DEFAULT_PLATFORM_COLOR
  const canonical = PLATFORM_NAMES_LOWER[platform.toLowerCase()]
  return (canonical && PLATFORM_COLORS[canonical]) || DEFAULT_PLATFORM_COLOR
}
