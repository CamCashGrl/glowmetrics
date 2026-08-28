"use client"
import { C, card } from '../theme'
import { money, number, shortDateLabel } from '../lib/format'
import LockedPanel from './LockedPanel'

export default function TopFans({ data, locked, onUpgrade, loading }) {
  if (locked) {
    return (
      <LockedPanel
        title="Top Fans"
        description="See who's spending the most with you — rank, total earned, transaction count, average tip, and last activity."
        onUpgrade={onUpgrade}
      />
    )
  }

  return (
    <div style={{ ...card({ padding: '20px 22px' }) }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.white, marginBottom: 16 }}>Top Fans</div>

      {loading ? (
        <div style={{ height: 200, borderRadius: 12, background: 'rgba(255,255,255,0.03)' }} />
      ) : !data || data.length === 0 ? (
        <div style={{ fontSize: 13, color: C.muted, padding: '20px 0' }}>Not enough data yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {data.slice(0, 10).map((f, i) => (
            <div key={`${f.platform}:${f.username}`} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
              borderBottom: i < 9 ? `1px solid ${C.border}` : 'none',
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, color: C.muted, background: 'rgba(255,255,255,0.04)', flexShrink: 0,
              }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.username} <span style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>· {f.platform}</span>
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  {number(f.count)} transaction{f.count === 1 ? '' : 's'} · {money(f.avg)} avg · last {shortDateLabel(f.lastDate)}
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.cyan, whiteSpace: 'nowrap' }}>{money(f.usd)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
