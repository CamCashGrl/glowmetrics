"use client"

// Lightweight, optional Performed/Skip controls for a single coaching
// prompt. No modal, no forced response, no interruption to streaming —
// unmarked stays unmarked until the user chooses otherwise, and the choice
// can always be changed later. Used both inline on the live coaching page
// and in the Coaching History list.

const C = { cyan: '#22D3EE', pink: '#EC4899', green: '#10B981', muted: '#94a3b8', dim: '#475569' }

export default function CoachingActionButtons({ status, onSetStatus, visible = true, size = 'normal' }) {
  if (!visible) return null

  const pad = size === 'compact' ? '4px 10px' : '6px 13px'
  const fontSize = size === 'compact' ? 11 : 12

  const baseBtn = {
    padding: pad, borderRadius: 999, fontSize, fontWeight: 700, cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.03)',
    color: C.muted, transition: 'all 0.15s',
  }

  const performedStyle = status === 'performed'
    ? { ...baseBtn, background: 'rgba(16,185,129,0.16)', borderColor: 'rgba(16,185,129,0.5)', color: C.green }
    : baseBtn
  const skippedStyle = status === 'skipped'
    ? { ...baseBtn, background: 'rgba(148,163,184,0.16)', borderColor: 'rgba(148,163,184,0.5)', color: '#e2e8f0' }
    : baseBtn

  const toggle = (next) => {
    // Clicking the already-active state clears it back to unmarked —
    // marks are never forced or final.
    onSetStatus(status === next ? 'unmarked' : next)
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
      <button type="button" style={performedStyle} onClick={() => toggle('performed')}>
        {status === 'performed' ? '✓ Performed' : 'Performed'}
      </button>
      <button type="button" style={skippedStyle} onClick={() => toggle('skipped')}>
        {status === 'skipped' ? '✓ Skipped' : 'Skip'}
      </button>
    </div>
  )
}
