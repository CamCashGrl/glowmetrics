// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD THEME — the one place the dashboard's surface colors are defined.
//
// This exists because eight components written during the conversion redesign
// each declared their own local `const C`, and each reached for translucency
// (`rgba(255,255,255,0.03)` fills over `rgba(255,255,255,0.09)` borders)
// instead of the solid navy panels the rest of the dashboard has always used.
// The result was a page with no card edges and no figure/ground separation.
//
// The values below are the dashboard's original tokens, unchanged — the same
// ones page.js and CommandCenter.js still carry. Cards are SOLID (#121826 on
// a #05070f page), borders are a real navy with actual value contrast
// (#1e2d45), and depth comes from glow and inset highlights rather than from
// letting the background show through the card.
//
// Import from here. Do not re-declare a palette in a component.
// ═══════════════════════════════════════════════════════════════════════════

export const C = {
  bg:      "#05070f",
  card:    "#121826",
  card2:   "#161e2e",
  border:  "#1e2d45",
  border2: "#2a3f5f",
  indigo:  "#7C5CFF",
  cyan:    "#22D3EE",
  pink:    "#EC4899",
  gold:    "#F59E0B",
  blue:    "#60A5FA",
  green:   "#10B981",
  red:     "#F87171",
  orange:  "#FB923C",
  white:   "#F1F5F9",
  text:    "#94A3B8",
  muted:   "#475569",
}

export const GRADIENT = "linear-gradient(90deg,#16F4FF,#7C5CFF,#FF2BAE)"

/** Standard content card.
 *
 *  This is the dashboard's ORIGINAL glass treatment, byte-for-byte — the one
 *  page.js and CommandCenter.js have carried since before July. It is barely
 *  translucent (0.75 over a #05070f page) and, critically, it keeps the
 *  blue/pink bloom that gives a card presence against the background.
 *
 *  Fans.js and Performance.js had a DEGRADED copy: same fill and border, but
 *  the bloom dropped. That, plus the 0.03-white fills in the newer components,
 *  is what flattened the page. Use this everywhere. */
export const panel = {
  background: "rgba(15,20,32,0.75)",
  border: "1px solid rgba(255,255,255,0.08)",
  backdropFilter: "blur(20px)",
  borderRadius: 18,
  boxShadow: "0 0 40px rgba(59,130,246,0.15), 0 0 80px rgba(236,72,153,0.08)",
}

/** Nested/secondary surface — a step lighter so it reads inside a panel. */
export const panelInset = {
  background: C.card2,
  border: `1px solid ${C.border}`,
  borderRadius: 14,
}

/** The one dominant block on a screen. Brighter edge, real bloom behind it. */
export const panelHero = {
  background: `linear-gradient(150deg, #17203a, ${C.card} 60%)`,
  border: `1px solid ${C.border2}`,
  borderRadius: 22,
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.07), 0 0 44px rgba(124,92,255,0.20), 0 14px 40px rgba(0,0,0,0.55)",
}

/** Primary CTA — the CamCash gradient, never a flat fill. */
export const primaryBtn = {
  padding: "13px 24px",
  borderRadius: 100,
  border: "none",
  cursor: "pointer",
  background: GRADIENT,
  color: "#06101A",
  fontSize: 14,
  fontWeight: 850,
  boxShadow: "0 10px 30px rgba(124,92,255,0.30)",
}

/** Secondary CTA — dark glass with a cyan-leaning edge. */
export const secondaryBtn = {
  padding: "11px 20px",
  borderRadius: 100,
  cursor: "pointer",
  background: C.card2,
  border: `1px solid ${C.border2}`,
  color: C.white,
  fontSize: 13,
  fontWeight: 700,
}

/** Small uppercase section label. */
export const sectionLabel = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: C.cyan,
}
