// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM IDENTITY — one source of truth for how a platform LOOKS and is
// LABELLED, the same way lib/constants.js is the one source for what a
// platform's tokens are WORTH.
//
// Before this file, the same platform wore three different colours: CamSoda
// was green on the Money Map, blue in the Transaction Hub, and magenta on the
// Platforms tab, because each surface kept its own local map. A creator has
// no way to read that as one platform.
//
// Adding a platform is now one entry here. Nothing in this file touches
// analytics: no rates, no revenue, no session logic — presentation only.
// Token rates stay in lib/constants.js and must never be duplicated here.
// ═══════════════════════════════════════════════════════════════════════════

// Keyed by the normalized (lowercase, alphanumeric) platform name so callers
// can pass DB casing ('camsoda'), display casing ('CamSoda'), or CSV casing.
export const PLATFORM_IDENTITY = {
  chaturbate: { label: 'Chaturbate', short: 'CB',  color: '#22D3EE' }, // cyan
  bongacams:  { label: 'BongaCams',  short: 'BC',  color: '#EC4899' }, // pink
  myfreecams: { label: 'MyFreeCams', short: 'MFC', color: '#A855F7' }, // purple
  stripchat:  { label: 'Stripchat',  short: 'SC',  color: '#FB923C' }, // amber
  camsoda:    { label: 'CamSoda',    short: 'CS',  color: '#D946EF' }, // magenta
}

// Unknown/undetected platforms get a neutral slate identity rather than being
// handed another platform's brand colour. 'Unknown' is the CSV parser's
// undetected bucket, not a platform the creator streams on.
export const NEUTRAL_PLATFORM = { label: 'Other', short: '—', color: '#8B96B8' }

export const normalizePlatformKey = (name) =>
  String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '')

export function platformIdentity(name) {
  const known = PLATFORM_IDENTITY[normalizePlatformKey(name)]
  if (known) return known
  // Derive an abbreviation from the name itself rather than inventing a brand
  // identity for a platform we have no colour for.
  const words = String(name || '').trim().split(/\s+/).filter(Boolean)
  const short = words.length > 1
    ? words.map(w => w[0]).join('').slice(0, 3).toUpperCase()
    : String(name || '?').slice(0, 2).toUpperCase()
  return { ...NEUTRAL_PLATFORM, label: String(name || NEUTRAL_PLATFORM.label), short }
}

export const platformColor = (name) => platformIdentity(name).color
export const platformShort = (name) => platformIdentity(name).short

// Canonical display order for every platform CamCash supports, for pickers,
// filters and upload dropdowns. Order is stable so the same list reads the
// same way on every surface.
export const CAM_PLATFORMS = Object.values(PLATFORM_IDENTITY).map(p => p.label)
