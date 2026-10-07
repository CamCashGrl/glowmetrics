'use client'

import { useState } from 'react'

// Start / end a private interval inside the running live session. The show
// keeps running; private earnings are estimated from the per-minute rate and
// added to the show total when it is finalized.
export default function PrivateShowControl({ engine, platform }) {
  const [rate, setRate] = useState('')
  const open = engine.privateInterval
  const btn = (color) => ({
    padding: '7px 14px', borderRadius: 8, background: `${color}22`, border: `1px solid ${color}66`,
    color, fontWeight: 700, fontSize: 12, cursor: engine.actionPending ? 'not-allowed' : 'pointer',
  })

  if (open) {
    return (
      <button data-testid="private-end" disabled={engine.actionPending} onClick={engine.endPrivate} style={btn('#EC4899')}
        title={`Private since ${new Date(open.started_at).toLocaleTimeString()} at $${Number(open.rate_per_minute).toFixed(2)}/min`}>
        🔒 End Private (${Number(open.rate_per_minute).toFixed(2)}/min)
      </button>
    )
  }

  const valid = rate !== '' && Number.isFinite(Number(rate)) && Number(rate) >= 0
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <input data-testid="private-rate" type="number" min="0" step="0.01" inputMode="decimal" placeholder="$/min"
        value={rate} onChange={(e) => setRate(e.target.value)} aria-label="Private rate in USD per minute"
        style={{ width: 72, padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#F1F5F9', fontSize: 12 }} />
      <button data-testid="private-start" disabled={engine.actionPending || !valid}
        onClick={() => engine.startPrivate(Number(rate), platform)} style={btn('#EC4899')}>
        🔒 Start Private
      </button>
    </span>
  )
}
