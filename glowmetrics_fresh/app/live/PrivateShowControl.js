'use client'

import { useState } from 'react'

// Start / end a private interval inside the running live session. The show
// keeps running; ending private never ends the stream. The platform is the
// running session's own (recorded server-side, never guessed here). The
// estimate is the same model the database uses when it closes the interval:
// rate_per_minute x elapsed minutes (_close_private_intervals).
export function privateElapsedSeconds(interval, now = Date.now()) {
  if (!interval?.started_at) return 0
  return Math.max(0, (now - new Date(interval.started_at).getTime()) / 1000)
}

export function privateEstimateUsd(interval, now = Date.now()) {
  // Number(null) is 0: a missing rate must give no estimate, not $0.
  if (interval?.rate_per_minute === null || interval?.rate_per_minute === undefined || interval?.rate_per_minute === '') return null
  const rate = Number(interval.rate_per_minute)
  if (!Number.isFinite(rate)) return null
  return Math.round(rate * (privateElapsedSeconds(interval, now) / 60) * 100) / 100
}

function fmt(sec) {
  const s = Math.floor(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export default function PrivateShowControl({ engine }) {
  const [rate, setRate] = useState('')
  const [username, setUsername] = useState('')
  const open = engine.privateInterval
  const session = engine.serverSession
  const platform = session?.stream_platform || null
  const btn = (color, disabled) => ({
    padding: '7px 14px', borderRadius: 8, background: `${color}22`, border: `1px solid ${color}66`,
    color, fontWeight: 700, fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
  })
  const input = {
    padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.05)', color: '#F1F5F9', fontSize: 12,
  }

  if (open) {
    const estimate = privateEstimateUsd(open)
    return (
      <span data-testid="private-open" style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#F9A8D4' }}>
          🔒 Private{open.username ? ` with ${open.username}` : ''} · {open.platform}
        </span>
        <span data-testid="private-elapsed" style={{ fontFamily: 'monospace', fontSize: 12, color: '#F1F5F9' }}>
          {fmt(privateElapsedSeconds(open))}
        </span>
        <span data-testid="private-estimate" style={{ fontSize: 12, color: '#10B981', fontWeight: 700 }}>
          {estimate === null ? '—' : `~$${estimate.toFixed(2)}`} <span style={{ color: '#94A3B8', fontWeight: 400 }}>at ${Number(open.rate_per_minute).toFixed(2)}/min</span>
        </span>
        <button data-testid="private-end" disabled={engine.actionPending} onClick={engine.endPrivate} style={btn('#EC4899', engine.actionPending)}>
          End Private
        </button>
      </span>
    )
  }

  const rateNum = Number(rate)
  const name = username.trim()
  const valid = rate !== '' && Number.isFinite(rateNum) && rateNum >= 0 && rateNum <= 1000 && name.length > 0 && name.length <= 80
  const canStart = !!platform && session?.status === 'live'
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input data-testid="private-username" type="text" placeholder="Fan username" maxLength={80}
        value={username} onChange={(e) => setUsername(e.target.value)} aria-label="Private show fan username"
        style={{ ...input, width: 130 }} />
      <input data-testid="private-rate" type="number" min="0" max="1000" step="0.01" inputMode="decimal" placeholder="$/min"
        value={rate} onChange={(e) => setRate(e.target.value)} aria-label="Private rate in USD per minute"
        style={{ ...input, width: 72 }} />
      <button data-testid="private-start" disabled={engine.actionPending || !valid || !canStart}
        title={canStart ? `Private on ${platform}` : 'Available once your stream is live'}
        onClick={async () => { if (await engine.startPrivate(rateNum, name)) { setUsername(''); setRate('') } }}
        style={btn('#EC4899', engine.actionPending || !valid || !canStart)}>
        🔒 Start Private{platform ? ` · ${platform}` : ''}
      </button>
    </span>
  )
}
