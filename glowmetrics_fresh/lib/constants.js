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

// Absolute lifetime-spend threshold for the "whale" label used by
// StreamPlanner's Whale Roster/Whale Watch and MoneyMap's Whales stat. Both
// hardcoded `500` independently before this constant existed.
//
// This is deliberately NOT the same concept as lib/analytics.js's
// identifyWhales() tiers (Whale/Shark/Regular/Dormant), which are RELATIVE —
// percentile ranks within a given creator's own fan base, so a creator's
// top-5% "Whale" may have spent far less than 500 tokens, and a creator with
// many big spenders may have dozens of 500+ fans who don't rank top-5%.
// Both answer real questions ("who are my biggest spenders in absolute
// terms?" vs "who are my top fans relative to my own base?"), and both
// surfaces label themselves accordingly ("Fans with 500+ tokens lifetime"
// / "500+ tokens lifetime" vs the tier badges). Keep them distinct; just
// don't duplicate the number.
export const WHALE_LIFETIME_TOKEN_THRESHOLD = 500

// The CSV parser's bucket for a row whose platform could not be detected
// (see detectPlatform()/parseCSV in lib/analytics.js). It is an ABSENCE of
// a platform, not a platform — so it must never be ranked as a creator's
// best or most profitable one. Kept here rather than as a scattered string
// literal so every consumer excludes the same value.
export const UNDETECTED_PLATFORM = 'Unknown'

// ============================================================
// PLATFORM NAME NORMALIZATION
//
// The same platform reaches the database under several spellings, so one
// site can be counted as two. Verified in production (2026-08-26):
//   tips:      Chaturbate 141,394 · BongaCams 11,860 · Unknown 831 ·
//              BC 519 · MyFreeCams 79 · chaturbate 4
//   live_tips: chaturbate 821 · myfreecams 1   (all lowercase — the
//              extension path writes a different casing than the CSV path,
//              and live tips mirrored into `tips` carry it across)
//
// Consequences this fixes:
//   - platform COUNT is wrong (one site counted twice, which also collides
//     with the free-tier 1-platform rule)
//   - SESSIONS FRAGMENT: detectSessions() starts a new session on any
//     platform change, so every BongaCams<->BC boundary splits one real
//     stream in two
//   - platform comparison ranks the same site against itself at two rates
//   - tokenRate('BC') misses the lookup and returns the 0.05 default
//     instead of BongaCams' 0.025
//
// This is normalization ONLY. It changes no formula, no threshold and no
// definition, and it never rewrites or deletes a stored row — historical
// rows keep whatever string they were written with and are canonicalized on
// read. Adding an alias here is the single place to fix a new spelling.
// ============================================================

// alias (lowercased) -> canonical platform name
export const PLATFORM_ALIASES = {
  // short codes — the source of the 519 'BC' rows. app/onboarding/page.js's
  // PLATFORMS map carries short:'CB'/'BC'/'MFC' for display, and a CSV whose
  // own platform column uses the short code previously passed straight
  // through parseCSV's inline substring chain untouched.
  cb: 'Chaturbate',
  bc: 'BongaCams',
  mfc: 'MyFreeCams',
  sc: 'Stripchat',
  cs: 'CamSoda',
  // spacing / punctuation variants
  'bonga cams': 'BongaCams',
  'bonga-cams': 'BongaCams',
  bongamodels: 'BongaCams',
  'my free cams': 'MyFreeCams',
  'strip chat': 'Stripchat',
  'cam soda': 'CamSoda',
}

// Substring fallbacks, applied in order when no exact alias matches. These
// are the same rules parseCSV() applied inline before this function existed —
// moved here so ingestion and read-side normalization cannot disagree.
const PLATFORM_SUBSTRINGS = [
  ['bonga', 'BongaCams'],
  ['chaturbate', 'Chaturbate'],
  ['freecams', 'MyFreeCams'],
  ['stripchat', 'Stripchat'],
  ['camsoda', 'CamSoda'],
]

const CANONICAL_BY_LOWER = Object.fromEntries(
  Object.keys(PLATFORM_TOKEN_RATES).map(name => [name.toLowerCase(), name])
)

/**
 * The canonical display name for any platform spelling.
 *
 * Returns UNDETECTED_PLATFORM ('Unknown') for empty input, and passes an
 * unrecognised name through UNCHANGED rather than guessing — a platform we
 * do not know about must not be silently folded into one we do.
 *
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function canonicalPlatform(value) {
  if (value == null) return UNDETECTED_PLATFORM
  const raw = String(value).trim()
  if (!raw) return UNDETECTED_PLATFORM
  const lower = raw.toLowerCase()
  if (CANONICAL_BY_LOWER[lower]) return CANONICAL_BY_LOWER[lower]   // casing only
  if (PLATFORM_ALIASES[lower]) return PLATFORM_ALIASES[lower]        // known alias
  for (const [needle, canonical] of PLATFORM_SUBSTRINGS) {
    if (lower.includes(needle)) return canonical
  }
  return raw
}

/**
 * Canonicalize the platform on a set of tip/session rows, without mutating
 * the originals. The read boundary every analytics consumer should pass
 * through, so downstream code never sees two spellings of one site.
 */
export function normalizeRowPlatforms(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return rows
  let changed = false
  const out = rows.map(row => {
    if (!row || typeof row !== 'object') return row
    const canonical = canonicalPlatform(row.platform)
    if (canonical === row.platform) return row
    changed = true
    return { ...row, platform: canonical }
  })
  return changed ? out : rows
}
