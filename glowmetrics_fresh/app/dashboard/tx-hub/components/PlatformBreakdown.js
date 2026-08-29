"use client"
import { C, card, platformColor } from '../theme'
import { money, pct } from '../lib/format'
import LockedPanel from './LockedPanel'

export default function PlatformBreakdown({ data, locked, onUpgrade, onSelectPlatform, loading }) {
  if (locked) {
    return (
      <LockedPanel
        title="Where Your Money Comes From"
        description="See exactly how much each platform contributed to your earnings, with a full breakdown by dollar amount and share of total."
        onUpgrade={onUpgrade}
      />
    )
  }

  return (
    <div style={{ ...card({ padding: '20px 22px' }) }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.white, marginBottom: 4 }}>Where Your Money Comes From</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Click a platform to filter your transactions.</div>

      {loading ? (
        <div style={{ height: 140, borderRadius: 12, background: 'rgba(255,255,255,0.03)' }} />
      ) : !data || data.length === 0 ? (
        <div style={{ fontSize: 13, color: C.muted, padding: '20px 0' }}>Not enough data yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {data.map(p => (
            <button key={p.platform} onClick={() => onSelectPlatform(p.platform)} style={{
              background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{p.platform}</span>
                <span style={{ fontSize: 13, color: C.muted }}>{money(p.usd)} · {pct(p.pct, { withSign: false })}</span>
              </div>
              <div style={{ height: 8, borderRadius: 100, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${p.pct}%`, borderRadius: 100,
                  background: platformColor(p.platform), transition: 'width .5s ease',
                }} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
