'use client'
// ============================================================
// CAMCASH — SELECTIVE VALUE MASKING
//
// The single most important primitive in the conversion system.
//
// The failure this replaces, in two generations:
//   1. blur(4px) over an entire card  — the creator learns nothing
//   2. a mask fading the whole preview — better, but still hides the labels
//
// Both hid the wrong half. What makes a preview persuasive is the STRUCTURE
// and the creator's own LABELS — "Tuesday, 7 PM – 10 PM" is their real data
// and should be perfectly legible. Only the premium figure is withheld:
//
//     Tuesday   7 PM – 10 PM   ████/hr
//     Thursday  8 PM – 11 PM   ████/hr
//
// The creator reads their own life in that table and wants the last column.
// That is a product preview. A blurred rectangle is a locked door.
//
// The mask is drawn as real block glyphs rather than a blurred number,
// because blur reads as "broken/loading" while a redaction bar reads as
// "deliberately withheld" — which is the truth, and looks intentional.
// ============================================================

// Deterministic width from the label, so a given row renders the same bar on
// every re-render and on the server — Math.random() here would produce a
// hydration mismatch and jitter the layout on every keystroke elsewhere.
function widthFor(seed, min, max) {
  let h = 0
  for (let i = 0; i < String(seed).length; i++) h = (h * 31 + String(seed).charCodeAt(i)) | 0
  return min + (Math.abs(h) % (max - min + 1))
}

export default function LockedValue({
  C, seed = 'v', blocks, size = 13, prefix, suffix, accent, title,
}) {
  const n = blocks || widthFor(seed, 4, 6)
  const color = accent || C?.indigo || '#7c5cff'
  return (
    <span
      title={title || 'Unlocked with Pro'}
      aria-label={`${prefix || ''}hidden value${suffix || ''} — unlocked with Pro`}
      style={{ display: 'inline-flex', alignItems: 'baseline', gap: 1, whiteSpace: 'nowrap' }}
    >
      {prefix && <span style={{ fontSize: size, fontWeight: 800, color, opacity: 0.55 }}>{prefix}</span>}
      <span
        aria-hidden="true"
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: size * 0.95,
          letterSpacing: '-0.06em',
          color,
          opacity: 0.42,
          userSelect: 'none',
        }}
      >
        {'█'.repeat(n)}
      </span>
      {suffix && <span style={{ fontSize: size * 0.85, fontWeight: 700, color: C?.muted || '#94a3b8' }}>{suffix}</span>}
    </span>
  )
}

// A masked horizontal bar, for charts and confidence meters. Same idea: the
// axis, the labels and the bar's PRESENCE are real; only its magnitude is
// withheld, so the creator sees that a measurement exists.
export function LockedBar({ C, seed = 'b', height = 9, accent }) {
  const pct = widthFor(seed, 38, 88)
  const color = accent || C?.indigo || '#7c5cff'
  return (
    <span
      aria-label="hidden magnitude — unlocked with Pro"
      style={{
        display: 'block', height, borderRadius: height / 2, minWidth: 0,
        background: 'rgba(255,255,255,0.05)', overflow: 'hidden',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'block', height: '100%', width: `${pct}%`, borderRadius: height / 2,
          background: `repeating-linear-gradient(90deg, ${color}66 0 6px, ${color}22 6px 11px)`,
        }}
      />
    </span>
  )
}
