"use client"
import { useEffect } from 'react'
import { C, card } from '../theme'

const TYPE_OPTIONS = [
  { id: 'tip', label: 'Tips' },
  { id: 'private', label: 'Private' },
  { id: 'group', label: 'Group' },
  { id: 'spy', label: 'Spy' },
  { id: 'other', label: 'Other' },
]

const AMOUNT_OPTIONS = [
  { id: 'under5', label: 'Under $5', min: null, max: 5 },
  { id: '5-25', label: '$5–$25', min: 5, max: 25 },
  { id: '25-50', label: '$25–$50', min: 25, max: 50 },
  { id: '50-100', label: '$50–$100', min: 50, max: 100 },
  { id: '100plus', label: '$100+', min: 100, max: null },
]

export default function FilterDrawer({ open, onClose, types, onTypesChange, amountRange, onAmountRangeChange, platforms, availableTypes }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const toggleType = (id) => {
    onTypesChange(types.includes(id) ? types.filter(t => t !== id) : [...types, id])
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(380px, 100vw)',
        background: C.panel, borderLeft: `1px solid ${C.border}`, padding: 22, overflowY: 'auto',
        animation: 'txSlideIn .25s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.white }}>Filters</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={sectionLabel}>Transaction Type</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TYPE_OPTIONS.filter(t => !availableTypes || availableTypes.includes(t.id)).map(t => (
              <button key={t.id} onClick={() => toggleType(t.id)} style={chip(types.includes(t.id))}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={sectionLabel}>Amount</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {AMOUNT_OPTIONS.map(a => (
              <button key={a.id}
                onClick={() => onAmountRangeChange(amountRange?.id === a.id ? null : a)}
                style={chip(amountRange?.id === a.id)}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={sectionLabel}>Status</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ ...chip(true), cursor: 'default' }}>Completed</span>
          </div>
          <div style={{ fontSize: 11, color: C.faint, marginTop: 6 }}>
            All imported transactions are recorded as completed — pending/failed states aren't tracked yet.
          </div>
        </div>
      </div>
      <style>{`@keyframes txSlideIn { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </div>
  )
}

const sectionLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, marginBottom: 10 }

function chip(active) {
  return {
    padding: '7px 13px', borderRadius: 100, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    border: `1px solid ${active ? C.cyan + '66' : C.border}`,
    background: active ? C.cyanSoft : 'rgba(255,255,255,0.03)',
    color: active ? C.cyan : C.text,
  }
}
