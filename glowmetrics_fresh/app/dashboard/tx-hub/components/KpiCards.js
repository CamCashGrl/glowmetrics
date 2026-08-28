"use client"
import { useEffect, useRef, useState } from 'react'
import { C, card, glowTop } from '../theme'
import { money, number, pct, dateLabel } from '../lib/format'

function useCountUp(target, duration = 600) {
  const [value, setValue] = useState(0)
  const raf = useRef(null)
  useEffect(() => {
    const start = performance.now()
    const from = 0
    const to = typeof target === 'number' ? target : 0
    function tick(now) {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(from + (to - from) * eased)
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => raf.current && cancelAnimationFrame(raf.current)
  }, [target, duration])
  return value
}

function Trend({ pctValue }) {
  if (pctValue == null) return null
  const up = pctValue >= 0
  return (
    <span style={{
      fontSize: 12, fontWeight: 700, color: up ? C.green : C.red,
      display: 'inline-flex', alignItems: 'center', gap: 3,
    }}>
      {up ? '▲' : '▼'} {pct(Math.abs(pctValue), { withSign: false })} vs previous period
    </span>
  )
}

function Kpi({ label, value, formatted, trend, sub, accent, delay = 0 }) {
  const animated = useCountUp(typeof value === 'number' ? value : 0)
  const display = formatted ? formatted(animated) : animated
  return (
    <div style={{
      ...card({ padding: '18px 20px', minWidth: 190, flex: '1 1 190px', position: 'relative', overflow: 'hidden', animation: `txfade .5s ease ${delay}ms both` }),
    }}>
      <div style={glowTop(accent || C.cyan)} />
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: C.white, marginBottom: 6, letterSpacing: '-0.02em' }}>
        {display}
      </div>
      {trend !== undefined && <Trend pctValue={trend} />}
      {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function KpiCards({ kpis, isPro, loading }) {
  if (loading || !kpis) {
    return (
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{ ...card({ padding: 18 }), flex: '1 1 190px', height: 92, opacity: 0.5 }} />
        ))}
      </div>
    )
  }

  const largest = kpis.largestTransaction

  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
      <Kpi
        label="Total Earned"
        value={kpis.totalEarned}
        formatted={(v) => money(v)}
        trend={isPro ? kpis.totalEarnedChangePct : undefined}
        accent={C.cyan}
        delay={0}
      />
      <Kpi
        label="Total Transactions"
        value={kpis.totalTransactions}
        formatted={(v) => number(Math.round(v))}
        trend={isPro ? kpis.totalTransactionsChangePct : undefined}
        accent={C.blue}
        delay={60}
      />
      <Kpi
        label="Average Transaction"
        value={kpis.averageTransaction}
        formatted={(v) => money(v)}
        accent={C.gold}
        delay={120}
      />
      <div style={{ ...card({ padding: '18px 20px', flex: '1 1 190px', position: 'relative', overflow: 'hidden' }) }}>
        <div style={glowTop(C.purple)} />
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>
          Largest Transaction
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: C.white, marginBottom: 6, letterSpacing: '-0.02em' }}>
          {largest ? money(largest.usd) : '—'}
        </div>
        <div style={{ fontSize: 12, color: C.muted }}>
          {largest ? `${largest.platform} · ${dateLabel(largest.dateTime)}` : 'No transactions yet'}
        </div>
      </div>
      <style>{`@keyframes txfade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}
