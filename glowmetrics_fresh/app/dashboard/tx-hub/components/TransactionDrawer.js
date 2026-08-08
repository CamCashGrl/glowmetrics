"use client"
import { useEffect } from 'react'
import { C, card, TYPE_COLORS, platformColor } from '../theme'
import { money, number, dateLabel, timeLabel } from '../lib/format'

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
      <span style={{ fontSize: 13, color: C.white, fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

export default function TransactionDrawer({ tx, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    if (tx) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [tx, onClose])

  if (!tx) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(420px, 100vw)',
        background: C.panel, borderLeft: `1px solid ${C.border}`, padding: 26, overflowY: 'auto',
        animation: 'txSlideIn .25s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Transaction Amount</div>
          <div style={{ fontSize: 40, fontWeight: 900, color: C.white, letterSpacing: '-0.03em' }}>{money(tx.usd)}</div>
          <div style={{ marginTop: 10, display: 'inline-flex', gap: 8 }}>
            <span style={{
              fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 100,
              color: TYPE_COLORS[tx.typeLabel] || C.muted, background: `${TYPE_COLORS[tx.typeLabel] || C.muted}18`,
              border: `1px solid ${TYPE_COLORS[tx.typeLabel] || C.muted}40`,
            }}>{tx.typeLabel}</span>
            <span style={{
              fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 100,
              color: C.green, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
              textTransform: 'capitalize',
            }}>{tx.status}</span>
          </div>
        </div>

        <div>
          <Row label="Platform" value={<span style={{ color: platformColor(tx.platform) }}>{tx.platform}</span>} />
          <Row label="Username" value={tx.username} />
          <Row label="Date" value={dateLabel(tx.dateTime)} />
          <Row label="Time" value={timeLabel(tx.dateTime)} />
          <Row label="Transaction ID" value={<span style={{ fontFamily: 'monospace', fontSize: 12 }}>{tx.id}</span>} />
          <Row label="Transaction Type" value={tx.rawType || tx.typeLabel} />
          {tx.tokens > 0 && <Row label="Tokens" value={`${number(tx.tokens)} tokens`} />}
          <Row label="USD Conversion" value={money(tx.usd)} />
          <Row label="Session" value={tx.sessionLabel || 'Not part of a detected session'} />
        </div>

        <div style={{ marginTop: 18, fontSize: 11, color: C.faint, lineHeight: 1.5 }}>
          Fan profiles and session detail pages aren't available yet in CamCash — this view shows everything currently tracked for this transaction.
        </div>
      </div>
      <style>{`@keyframes txSlideIn { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </div>
  )
}
