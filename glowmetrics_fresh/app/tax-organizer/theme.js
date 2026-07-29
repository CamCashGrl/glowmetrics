// Shared color/style tokens for the Tax Organizer route — same visual
// system as app/live/page.js (dark background, cyan/pink glow borders,
// rounded cards) so this feels like part of the same product, not a
// separate government-form-style tool.
export const C = {
  bg: '#040812', card: 'rgba(15,20,32,0.75)', border: 'rgba(168,85,247,0.2)',
  purple: '#a855f7', cyan: '#22d3ee', green: '#10b981',
  white: '#f1f5f9', muted: '#94a3b8', dim: '#475569', text: '#e2e8f0',
  pink: '#ec4899', gold: '#f59e0b', red: '#f87171', orange: '#f97316',
}

export const glassCard = {
  background: 'rgba(15,20,32,0.75)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  backdropFilter: 'blur(20px)',
  boxShadow: '0 0 40px rgba(59,130,246,0.10), 0 0 80px rgba(236,72,153,0.05)',
}

export const sectionTitle = {
  fontSize: 15, fontWeight: 800, color: C.white, letterSpacing: -0.2, marginBottom: 12,
}
