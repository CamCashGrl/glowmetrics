// Live Mode dark-neon design tokens — mirrors the `cc-*` Tailwind tokens in
// tailwind.config.js. The rest of the codebase renders with inline styles
// (no Tailwind classes used in app/live or app/dashboard), so this is the
// single JS-side source of truth these components import from.
export const LM = {
  bg: '#030812',
  bgSecondary: '#070B17',
  panel: '#0A0D1B',
  card: '#12121F',
  surface: '#1A1D2E',
  border: '#24283A',
  borderStrong: '#34384D',
  text: '#F7F7FB',
  textSecondary: '#A1A7BA',
  textMuted: '#70788E',
  magenta: '#E82AB8',
  magentaDark: '#B91C8F',
  purple: '#8B5CF6',
  cyan: '#19CFF4',
  teal: '#10D8B0',
  green: '#19D39A',
  orange: '#FF9B22',
  yellow: '#FFC62E',
  red: '#FF4D5E',
}

export const cardBase = {
  background: `linear-gradient(180deg, ${LM.card} 0%, ${LM.panel} 100%)`,
  border: `1px solid ${LM.border}`,
  borderRadius: 14,
  padding: 18,
  boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
}

export const labelStyle = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: 0.8,
  textTransform: 'uppercase',
  color: LM.textMuted,
}

// Shared keyframes for Live Mode's "alive" motion language — injected once
// from page.js's top-level <style> block. Every animated element below
// references one of these names rather than defining its own.
export const LM_KEYFRAMES = `
  @keyframes lm-breathe   { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.55; transform: scale(0.82); } }
  @keyframes lm-glow      { 0%,100% { box-shadow: 0 0 0 rgba(0,0,0,0); } 50% { box-shadow: 0 0 28px var(--lm-glow-color, rgba(232,42,184,0.35)); } }
  @keyframes lm-fade-in   { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes lm-slide-in  { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes lm-point-pulse { 0%,100% { r: 4.5; opacity: 1; } 50% { r: 7; opacity: 0.6; } }
  @keyframes lm-bar-fill  { from { transform: scaleX(0); } to { transform: scaleX(1); } }
`
