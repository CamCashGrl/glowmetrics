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

export function tokenRate(platform) {
  return PLATFORM_TOKEN_RATES[platform] ?? DEFAULT_TOKEN_RATE
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
