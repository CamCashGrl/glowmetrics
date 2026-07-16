// Shared palette for the Collab Board — matches the dashboard/live page
// tokens (app/dashboard/Sidebar.js, app/live/page.js), not the separate
// admin-panel palette.
export const C = {
  bg: '#05070f',
  card: 'rgba(15,20,32,0.78)',
  cardSolid: '#0d1322',
  border: 'rgba(255,255,255,0.08)',
  cyan: '#22D3EE',
  pink: '#EC4899',
  purple: '#a855f7',
  gold: '#F59E0B',
  green: '#10B981',
  red: '#F87171',
  white: '#F1F5F9',
  muted: '#475569',
  text: '#94A3B8',
}

export const glassCard = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 18,
  backdropFilter: 'blur(20px)',
  boxShadow: '0 0 40px rgba(59,130,246,0.10), 0 8px 32px rgba(0,0,0,0.28)',
}

export const GRADIENT_TEXT = {
  background: 'linear-gradient(90deg,#22D3EE,#EC4899)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}
