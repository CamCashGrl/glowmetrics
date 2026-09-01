import { platformColor as sharedPlatformColor } from '../../../lib/platforms'
// TX Hub design tokens — deliberately a muted cyan/blue navy palette rather
// than the site-wide neon cyan-to-pink gradient (see branding skill). This
// surface is a financial command center and should read closer to a
// premium fintech dashboard (Stripe-adjacent) than a creator-marketing
// screen. Keep every TX Hub component importing from here instead of
// hand-rolling its own color object.
export const C = {
  bg: '#0a0b14',
  panel: '#0d0f1e',
  card: '#12141f',
  cardAlt: '#14172400',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  cyan: '#38D5E8',
  cyanSoft: 'rgba(56,213,232,0.14)',
  blue: '#5B8DEF',
  gold: '#F59E0B',
  purple: '#A855F7',
  green: '#22C55E',
  red: '#F87171',
  white: '#F8FAFC',
  text: '#CBD5E1',
  muted: '#94A3B8',
  faint: '#5B6472',
}

export const RADIUS = { card: 18, pill: 999, input: 12, panel: 24 }

export const card = (extra = {}) => ({
  background: `linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.005)), ${C.card}`,
  border: `1px solid ${C.border}`,
  borderRadius: RADIUS.card,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 28px rgba(0,0,0,0.28)',
  ...extra,
})

export const glowTop = (color) => ({
  position: 'absolute', top: 0, left: 16, right: 16, height: 2, borderRadius: 2,
  background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
  opacity: 0.7,
})

// Platform colours come from lib/platforms.js so a platform reads the same
// here as on the Platforms tab and the Money Map. This file used to keep its
// own map, which coloured CamSoda blue here and magenta there.
export { PLATFORM_IDENTITY } from '../../../lib/platforms'

export function platformColor(platform) {
  // 'Unknown' is the parser's undetected bucket, not a platform — it keeps the
  // muted treatment rather than being given a brand colour.
  if (!platform || String(platform).toLowerCase() === 'unknown') return C.muted
  return sharedPlatformColor(platform)
}

// Keyed by TX_TYPE_LABELS values (lib/txHub.js). Full-Private is a distinct
// stream, not a shade of Private, so it needs its own entry — without one it
// would fall back to C.muted and read as "Other" in the donut.
export const TYPE_COLORS = {
  Tip: C.cyan,
  Private: C.gold,
  'Full-Private': C.purple,
  Group: C.green,
  Spy: C.blue,
  Other: C.muted,
}
