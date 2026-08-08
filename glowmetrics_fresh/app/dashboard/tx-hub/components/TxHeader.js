"use client"
import { useState, useRef, useEffect } from 'react'
import { C, card } from '../theme'
import { DATE_PRESETS, presetToRange } from '../lib/format'

function DateRangePicker({ preset, from, to, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const label = DATE_PRESETS.find(p => p.id === preset)?.label || 'Custom'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={pillBtnStyle(open)}>
        📅 {label}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 30, width: 260,
          ...card({ padding: 10 }),
        }}>
          {DATE_PRESETS.map(p => (
            <button key={p.id}
              onClick={() => {
                if (p.id === 'custom') { onChange({ preset: 'custom', from, to }); return }
                const r = presetToRange(p.id)
                onChange({ preset: p.id, ...r })
                setOpen(false)
              }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 9,
                border: 'none', cursor: 'pointer', marginBottom: 2,
                background: preset === p.id ? C.cyanSoft : 'transparent',
                color: preset === p.id ? C.cyan : C.text, fontSize: 13, fontWeight: 600,
              }}>
              {p.label}
            </button>
          ))}
          {preset === 'custom' && (
            <div style={{ display: 'flex', gap: 8, padding: '8px 6px 2px' }}>
              <input type="date" value={from} onChange={e => onChange({ preset: 'custom', from: e.target.value, to })}
                style={inputStyle} />
              <input type="date" value={to} onChange={e => onChange({ preset: 'custom', from, to: e.target.value })}
                style={inputStyle} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const pillBtnStyle = (active) => ({
  padding: '9px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
  border: `1px solid ${active ? C.cyan + '55' : C.border}`,
  background: active ? C.cyanSoft : 'rgba(255,255,255,0.03)',
  color: active ? C.cyan : C.text, whiteSpace: 'nowrap',
})

const inputStyle = {
  flex: 1, padding: '7px 8px', borderRadius: 8, border: `1px solid ${C.border}`,
  background: '#080a12', color: C.white, fontSize: 12,
}

export default function TxHeader({
  dateState, onDateChange, platforms, platform, onPlatformChange,
  search, onSearchChange, onExport, canExport, onOpenFilters, activeFilterCount,
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.white, letterSpacing: '-0.02em' }}>TX Hub</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
            Your complete earnings and transaction history.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <input
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search username, platform, amount…"
              aria-label="Search transactions"
              style={{
                padding: '9px 12px 9px 32px', borderRadius: 10, border: `1px solid ${C.border}`,
                background: 'rgba(255,255,255,0.03)', color: C.white, fontSize: 13, width: 220,
              }}
            />
            <span style={{ position: 'absolute', left: 10, top: 9, fontSize: 13, color: C.muted }}>🔎</span>
          </div>

          <select
            value={platform}
            onChange={e => onPlatformChange(e.target.value)}
            style={{ ...pillBtnStyle(platform !== 'all'), appearance: 'none', paddingRight: 24 }}
          >
            <option value="all">All platforms</option>
            {platforms.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <DateRangePicker preset={dateState.preset} from={dateState.from} to={dateState.to} onChange={onDateChange} />

          <button onClick={onOpenFilters} style={pillBtnStyle(activeFilterCount > 0)}>
            ⚙️ Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>

          <button
            onClick={onExport}
            disabled={!canExport}
            title={canExport ? 'Export CSV' : 'Upgrade to Pro to export'}
            style={{
              ...pillBtnStyle(false),
              opacity: canExport ? 1 : 0.5, cursor: canExport ? 'pointer' : 'not-allowed',
              background: `linear-gradient(90deg, ${C.cyan}, ${C.blue})`, color: '#06131a', border: 'none',
            }}
          >
            ⬇ Export
          </button>
        </div>
      </div>
    </div>
  )
}
