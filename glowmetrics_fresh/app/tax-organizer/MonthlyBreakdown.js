'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { C, glassCard, sectionTitle } from './theme'

const fmtUsd = v => `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function MonthlyBreakdown({ monthly }) {
  return (
    <div style={{ ...glassCard, padding: 20, marginBottom: 20 }}>
      <div style={sectionTitle}>Monthly Earnings</div>

      {(!monthly || monthly.length === 0) ? (
        <div style={{ fontSize: 13, color: C.muted }}>No earnings recorded for this period.</div>
      ) : (
        <>
          <div style={{ width: '100%', height: 240, marginBottom: 20 }}>
            <ResponsiveContainer>
              <BarChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: '#0d1322', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: C.white }}
                  formatter={(value, name) => [fmtUsd(value), name]}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} />
                <Bar dataKey="tipsUSD" name="Tips & imported" stackId="a" fill={C.cyan} radius={[0, 0, 0, 0]} />
                <Bar dataKey="paidSessionUSD" name="Paid sessions" stackId="a" fill={C.purple} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: C.muted, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '6px 8px' }}>Month</th>
                  <th style={{ padding: '6px 8px' }}>Tips & imported</th>
                  <th style={{ padding: '6px 8px' }}>Paid sessions</th>
                  <th style={{ padding: '6px 8px' }}>Total</th>
                  <th style={{ padding: '6px 8px' }}>Records</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map(m => (
                  <tr key={m.month} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '7px 8px', color: C.white }}>{m.month}</td>
                    <td style={{ padding: '7px 8px', color: C.text }}>{fmtUsd(m.tipsUSD)}</td>
                    <td style={{ padding: '7px 8px', color: C.text }}>{fmtUsd(m.paidSessionUSD)}</td>
                    <td style={{ padding: '7px 8px', color: C.white, fontWeight: 700 }}>{fmtUsd(m.totalUSD)}</td>
                    <td style={{ padding: '7px 8px', color: C.muted }}>{m.recordCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
