'use client'

import { useEffect, useState } from 'react'
import { clock } from '../../lib/liveSession/allowanceView'

// The only platforms Private Mode accepts. Nothing is ever defaulted: the
// dropdown is pre-selected from the live session's platform only when that is
// one of these, it is visible and editable, and the server re-validates.
export const PRIVATE_PLATFORMS = ['Chaturbate', 'BongaCams', 'MyFreeCams']

// Start / end a private interval inside the running live session. The show
// keeps running when Private ends.
//
// Timing and earnings have ONE source: the database. started_at/ended_at are
// written server-side and elapsed time here is derived from started_at (read
// against the server's clock); the per-minute figure shown while private is
// an on-screen ESTIMATE only — it is never written back. Earnings are
// finalized by the existing close path when the interval ends.
export default function PrivateShowControl({ engine, platform }) {
  const open = engine.privateInterval
  const [rate, setRate] = useState('')
  const [username, setUsername] = useState('')
  const [chosen, setChosen] = useState(PRIVATE_PLATFORMS.includes(platform) ? platform : '')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!open) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [open])

  const btn = (color) => ({
    padding: '7px 14px', borderRadius: 8, background: `${color}22`, border: `1px solid ${color}66`,
    color, fontWeight: 700, fontSize: 12, cursor: engine.actionPending ? 'not-allowed' : 'pointer',
  })

  if (open) {
    // Read the elapsed time against the server's clock so a wrong device clock
    // can't distort it.
    const serverNow = engine.allowance?.server_now ? Date.parse(engine.allowance.server_now) : null
    const offset = serverNow && engine.allowanceReceivedAt ? serverNow - engine.allowanceReceivedAt : 0
    const elapsedSeconds = Math.max(0, (now + offset - Date.parse(open.started_at)) / 1000)
    const estimate = (Number(open.rate_per_minute) * elapsedSeconds) / 60
    return (
      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span data-testid="private-status" style={{ fontSize: 12, color: '#F1F5F9' }}>
          🔒 {open.username ? <b>{open.username}</b> : 'Private'} · {open.platform || ''} ·{' '}
          <span data-testid="private-elapsed" style={{ fontFamily: 'monospace' }}>{clock(elapsedSeconds)}</span>
          {' · '}
          <span data-testid="private-estimate" title="Estimate from the per-minute rate. Final earnings are calculated when the private show ends.">
            ≈ ${estimate.toFixed(2)} (estimate)
          </span>
        </span>
        <button data-testid="private-end" disabled={engine.actionPending} onClick={engine.endPrivate} style={btn('#EC4899')}
          title={`Private since ${new Date(open.started_at).toLocaleTimeString()} at $${Number(open.rate_per_minute).toFixed(2)}/min`}>
          End Private
        </button>
      </span>
    )
  }

  const rateOk = rate !== '' && Number.isFinite(Number(rate)) && Number(rate) >= 0 && Number(rate) <= 1000
  const valid = rateOk && username.trim().replace(/^@+/, '') !== '' && PRIVATE_PLATFORMS.includes(chosen)
  const field = { padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#F1F5F9', fontSize: 12 }
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input data-testid="private-username" type="text" maxLength={80} placeholder="Fan username" value={username}
        onChange={(e) => setUsername(e.target.value)} aria-label="Fan username" style={{ ...field, width: 120 }} />
      <select data-testid="private-platform" value={chosen} onChange={(e) => setChosen(e.target.value)} aria-label="Private show platform" style={field}>
        <option value="">Platform…</option>
        {PRIVATE_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <input data-testid="private-rate" type="number" min="0" max="1000" step="0.01" inputMode="decimal" placeholder="$/min"
        value={rate} onChange={(e) => setRate(e.target.value)} aria-label="Private rate in USD per minute" style={{ ...field, width: 72 }} />
      <button data-testid="private-start" disabled={engine.actionPending || !valid}
        onClick={() => engine.startPrivate(Number(rate), chosen, username.trim())} style={btn('#EC4899')}>
        🔒 Start Private
      </button>
    </span>
  )
}
