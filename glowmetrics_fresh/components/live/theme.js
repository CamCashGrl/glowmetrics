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
  background: LM.panel,
  border: `1px solid ${LM.border}`,
  borderRadius: 14,
  padding: 18,
}

export const labelStyle = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: 0.8,
  textTransform: 'uppercase',
  color: LM.textMuted,
}
