"use client"
import { useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { C, card } from '../theme'
import { money, number, shortDateLabel } from '../lib/format'

const METRICS = [
  { id: 'usd', label: 'Revenue' },
  { id: 'tips', label: 'Tips' },
  { id: 'count', label: 'Transactions' },
  { id: 'avg', label: 'Avg Transaction' },
]

function fmtBucketLabel(key, granularity) {
  if (granularity === 'hourly') {
    const d = new Date(key)
    return isNaN(d) ? key : d.toLocaleTimeString('en-US', { hour: 'numeric' })
  }
  if (granularity === 'monthly') {
    const [y, m] = key.split('-')
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }
  return shortDateLabel(key)
}

function CustomTooltip({ active, payload, granularity }) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0].payload
  return (
    <div style={{ ...card({ padding: '10px 14px' }), fontSize: 12 }}>
      <div style={{ color: C.white, fontWeight: 800, marginBottom: 6 }}>{fmtBucketLabel(d.date, granularity)}</div>
      <div style={{ color: C.cyan, fontWeight: 700 }}>{money(d.usd)}</div>
      <div style={{ color: C.muted, marginTop: 2 }}>{number(d.count)} transaction{d.count === 1 ? '' : 's'}</div>
      <div style={{ color: C.muted }}>{money(d.avg)} avg transaction</div>
    </div>
  )
}

export default function EarningsChart({ data, granularity, loading }) {
  const [metric, setMetric] = useState('usd')

  const series = useMemo(() => data || [], [data])
  const hasData = series.length > 0

  return (
    <div style={{ ...card({ padding: '20px 22px' }), marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.white }}>Earnings Over Time</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2, textTransform: 'capitalize' }}>{granularity} view</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {METRICS.map(m => (
            <button key={m.id} onClick={() => setMetric(m.id)} style={{
              padding: '6px 12px', borderRadius: 100, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${metric === m.id ? C.cyan + '55' : C.border}`,
              background: metric === m.id ? C.cyanSoft : 'transparent',
              color: metric === m.id ? C.cyan : C.muted,
            }}>{m.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ height: 260, borderRadius: 12, background: 'rgba(255,255,255,0.03)' }} />
      ) : !hasData ? (
        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 13 }}>
          Not enough data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={series} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="txHubFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.cyan} stopOpacity={0.35} />
                <stop offset="100%" stopColor={C.cyan} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(v) => fmtBucketLabel(v, granularity)}
              tick={{ fill: C.muted, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} minTickGap={24} />
            <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={(v) => metric === 'usd' || metric === 'tips' || metric === 'avg' ? `$${v}` : v} width={54} />
            <Tooltip content={<CustomTooltip granularity={granularity} />} />
            <Area type="monotone" dataKey={metric} stroke={C.cyan} strokeWidth={2} fill="url(#txHubFill)" animationDuration={500} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
