'use client'

import { useEffect, useState } from 'react'

const PLATFORM_OPTIONS = ['Chaturbate', 'BongaCams', 'MyFreeCams']

export default function PrivateShowControl({ engine, platform }) {
  const [enabled, setEnabled] = useState(false)
  const [username, setUsername] = useState('')
  const [rate, setRate] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState(platform || 'Chaturbate')
  const [tick, setTick] = useState(0)
  const open = engine.privateInterval

  useEffect(() => {
    if (platform) setSelectedPlatform(platform)
  }, [platform])

  useEffect(() => {
    if (!open) return
    const id = setInterval(() => setTick((v) => v + 1), 1000)
    return () => clearInterval(id)
  }, [open])

  useEffect(() => {
    if (open) setEnabled(true)
  }, [open])

  // `tick` exists only to trigger one render per second while a private is
  // open. Do not put Date.now() in a dependency array — it is not React state
  // and creates a new dependency value on every render.
  void tick
  const elapsedSeconds = open?.started_at
    ? Math.max(0, Math.floor((Date.now() - new Date(open.started_at).getTime()) / 1000))
    : 0

  const estimated = open
    ? (Number(open.rate_per_minute) || 0) * elapsedSeconds / 60
    : 0

  const numericRate = Number(rate)
  const valid = username.trim().length > 0 && username.trim().length <= 80 && rate !== '' && Number.isFinite(numericRate) && numericRate >= 0 && numericRate <= 1000
  const mins = Math.floor(elapsedSeconds / 60)
  const secs = String(elapsedSeconds % 60).padStart(2, '0')

  if (open) {
    return (
      <div style={{ padding: 12, borderRadius: 14, border: '1px solid rgba(236,72,153,.38)', background: 'linear-gradient(135deg,rgba(236,72,153,.12),rgba(124,92,255,.08))', minWidth: 300 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <div style={{ color: '#F9A8D4', fontSize: 12, fontWeight: 900 }}>🔒 PRIVATE · {mins}:{secs}</div>
          <div style={{ color: '#22D3EE', fontSize: 11, fontWeight: 800 }}>{open.platform || selectedPlatform}</div>
        </div>
        <div style={{ color: '#F8FAFC', fontSize: 13, fontWeight: 800, marginBottom: 4 }}>{open.username || username || 'Private fan'}</div>
        <div style={{ color: '#94A3B8', fontSize: 11, marginBottom: 9 }}>${Number(open.rate_per_minute).toFixed(2)}/min · estimated ${estimated.toFixed(2)}</div>
        <button data-testid="private-end" disabled={engine.actionPending} onClick={engine.endPrivate}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid rgba(236,72,153,.5)', background: 'rgba(236,72,153,.16)', color: '#F9A8D4', fontWeight: 900, cursor: engine.actionPending ? 'not-allowed' : 'pointer' }}>
          End Private
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 13, border: `1px solid ${enabled ? 'rgba(236,72,153,.38)' : 'rgba(255,255,255,.10)'}`, background: enabled ? 'rgba(236,72,153,.07)' : 'rgba(255,255,255,.03)', minWidth: 300 }}>
      <button type="button" onClick={() => setEnabled((v) => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, border: 0, padding: 0, background: 'transparent', color: '#F8FAFC', cursor: 'pointer', fontWeight: 800, fontSize: 12 }}>
        <span>🔒 Private Mode</span>
        <span style={{ color: enabled ? '#F472B6' : '#64748B' }}>{enabled ? '● ON' : '○ OFF'}</span>
      </button>

      {enabled && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 118px', gap: 7 }}>
            <input value={username} maxLength={80} onChange={(e) => setUsername(e.target.value)} placeholder="Fan username" aria-label="Private fan username" style={inputStyle} />
            <select value={selectedPlatform} onChange={(e) => setSelectedPlatform(e.target.value)} aria-label="Private platform" style={inputStyle}>
              {PLATFORM_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            <input data-testid="private-rate" type="number" min="0" max="1000" step="0.01" inputMode="decimal" placeholder="$/min"
              value={rate} onChange={(e) => setRate(e.target.value)} aria-label="Private rate in USD per minute" style={inputStyle} />
            <button data-testid="private-start" disabled={engine.actionPending || !valid}
              onClick={() => engine.startPrivate(numericRate, selectedPlatform, username.trim())}
              style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(236,72,153,.5)', background: valid ? 'rgba(236,72,153,.18)' : 'rgba(255,255,255,.04)', color: valid ? '#F9A8D4' : '#64748B', fontWeight: 900, cursor: engine.actionPending || !valid ? 'not-allowed' : 'pointer' }}>
              Start Private
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '8px 9px', borderRadius: 9,
  border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(4,7,15,.7)',
  color: '#F1F5F9', fontSize: 11,
}
