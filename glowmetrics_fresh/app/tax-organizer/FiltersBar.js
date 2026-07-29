'use client'
import { C, glassCard } from './theme'

const inputStyle = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10, color: C.white, fontSize: 13, padding: '8px 10px', outline: 'none',
}
const labelStyle = { fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, display: 'block' }

export default function FiltersBar({
  mode, onModeChange,
  year, onYearChange, availableYears,
  customStart, customEnd, onCustomStartChange, onCustomEndChange,
  allPlatforms, selectedPlatforms, onTogglePlatform,
  search, onSearchChange,
  onReset,
}) {
  return (
    <div style={{ ...glassCard, padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-end' }}>
        <div>
          <label style={labelStyle} htmlFor="tax-organizer-period-mode">Period</label>
          <select
            id="tax-organizer-period-mode"
            value={mode}
            onChange={e => onModeChange(e.target.value)}
            style={inputStyle}
          >
            <option value="year">Tax year</option>
            <option value="custom">Custom date range</option>
          </select>
        </div>

        {mode === 'year' ? (
          <div>
            <label style={labelStyle} htmlFor="tax-organizer-year">Tax year</label>
            <select
              id="tax-organizer-year"
              value={year}
              onChange={e => onYearChange(e.target.value)}
              style={inputStyle}
            >
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label style={labelStyle} htmlFor="tax-organizer-start">Start date</label>
              <input
                id="tax-organizer-start" type="date" value={customStart}
                onChange={e => onCustomStartChange(e.target.value)} style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="tax-organizer-end">End date</label>
              <input
                id="tax-organizer-end" type="date" value={customEnd}
                onChange={e => onCustomEndChange(e.target.value)} style={inputStyle}
              />
            </div>
          </>
        )}

        <div style={{ flex: '1 1 240px', minWidth: 200 }}>
          <label style={labelStyle} htmlFor="tax-organizer-search">Search records</label>
          <input
            id="tax-organizer-search" type="text" placeholder="Username, platform, income type…"
            value={search} onChange={e => onSearchChange(e.target.value)}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>

        <button
          onClick={onReset}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10, color: C.muted, fontSize: 12, fontWeight: 700, padding: '9px 14px', cursor: 'pointer',
          }}
        >
          Reset filters
        </button>
      </div>

      {allPlatforms.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <label style={labelStyle}>Platforms</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} role="group" aria-label="Filter by platform">
            {allPlatforms.map(p => {
              const active = selectedPlatforms.length === 0 || selectedPlatforms.includes(p)
              return (
                <button
                  key={p}
                  onClick={() => onTogglePlatform(p)}
                  aria-pressed={active}
                  style={{
                    padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    border: active ? '1px solid rgba(34,211,238,0.5)' : '1px solid rgba(255,255,255,0.1)',
                    background: active ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.03)',
                    color: active ? C.cyan : C.muted,
                  }}
                >
                  {p}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
