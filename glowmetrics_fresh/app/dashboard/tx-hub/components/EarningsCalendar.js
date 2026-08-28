"use client"
import { C, card } from '../theme'
import { money } from '../lib/format'
import LockedPanel from './LockedPanel'

function intensity(usd, max) {
  if (!max || usd <= 0) return 0
  return Math.min(1, usd / max)
}

export default function EarningsCalendar({ data, locked, onUpgrade, onSelectDate, loading }) {
  if (locked) {
    return (
      <LockedPanel
        title="Daily Earnings Calendar"
        description="Spot your strongest earning days at a glance with a full heatmap of daily revenue."
        onUpgrade={onUpgrade}
      />
    )
  }

  const hasData = data && data.length > 0
  const max = hasData ? Math.max(...data.map(d => d.usd)) : 0

  return (
    <div style={{ ...card({ padding: '20px 22px' }) }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.white, marginBottom: 16 }}>Daily Earnings</div>

      {loading ? (
        <div style={{ height: 120, borderRadius: 12, background: 'rgba(255,255,255,0.03)' }} />
      ) : !hasData ? (
        <div style={{ fontSize: 13, color: C.muted, padding: '20px 0' }}>Not enough data yet</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 8 }}>
          {data.map(d => {
            const t = intensity(d.usd, max)
            const day = new Date(`${d.date}T00:00:00Z`)
            const label = day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
            return (
              <button key={d.date} onClick={() => onSelectDate(d.date)} title={`${label}: ${money(d.usd)}`} style={{
                border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 8px', cursor: 'pointer',
                background: `rgba(56,213,232,${0.06 + t * 0.28})`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}>
                <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', fontWeight: 700 }}>
                  {day.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}
                </span>
                <span style={{ fontSize: 12, fontWeight: 800, color: C.white }}>{money(d.usd)}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
