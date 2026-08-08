"use client"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { C, card, TYPE_COLORS } from '../theme'
import { money, pct } from '../lib/format'
import LockedPanel from './LockedPanel'

export default function EarningsDonut({ data, locked, onUpgrade, loading }) {
  if (locked) {
    return (
      <LockedPanel
        title="Earnings by Type"
        description="See exactly how much of your revenue comes from tips vs private, group, and other session types."
        onUpgrade={onUpgrade}
      />
    )
  }

  const hasData = data && data.length > 0

  return (
    <div style={{ ...card({ padding: '20px 22px' }) }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.white, marginBottom: 16 }}>Earnings by Type</div>

      {loading ? (
        <div style={{ height: 200, borderRadius: 12, background: 'rgba(255,255,255,0.03)' }} />
      ) : !hasData ? (
        <div style={{ fontSize: 13, color: C.muted, padding: '20px 0' }}>Not enough data yet</div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ width: 150, height: 150, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="usd" nameKey="label" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none">
                  {data.map(d => <Cell key={d.type} fill={TYPE_COLORS[d.label] || C.muted} />)}
                </Pie>
                <Tooltip
                  formatter={(v, n) => [money(v), n]}
                  contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: C.white }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.map(d => (
              <div key={d.type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: TYPE_COLORS[d.label] || C.muted, display: 'inline-block' }} />
                  <span style={{ fontSize: 12, color: C.text }}>{d.label}</span>
                </div>
                <span style={{ fontSize: 12, color: C.muted }}>{money(d.usd)} · {pct(d.pct, { withSign: false })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
