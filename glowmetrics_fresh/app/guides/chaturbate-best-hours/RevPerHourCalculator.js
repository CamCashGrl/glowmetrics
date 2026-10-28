'use client'

// Revenue-per-hour comparison calculator.
// Carried over from the retired /guides/best-time-to-stream-chaturbate page
// (now 301-redirected here). Pure arithmetic on the numbers the visitor types:
// revenue per hour = earnings ÷ hours streamed. No platform data is assumed.

import { useState } from 'react'

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#f1f5f9',
  fontSize: 15,
  fontWeight: 600,
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle = {
  fontSize: 11,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  fontWeight: 600,
  display: 'block',
  marginBottom: 6,
}

export default function RevPerHourCalculator() {
  const [sessions, setSessions] = useState([
    { label: 'Session A', earnings: 120, hours: 2 },
    { label: 'Session B', earnings: 180, hours: 6 },
  ])

  const addSession = () => {
    if (sessions.length < 4) {
      setSessions(prev => [...prev, { label: `Session ${String.fromCharCode(65 + prev.length)}`, earnings: 0, hours: 1 }])
    }
  }

  const update = (i, field, val) => {
    setSessions(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: parseFloat(val) || 0 } : s))
  }

  const ranked = [...sessions]
    .map(s => ({ ...s, rph: s.hours > 0 ? s.earnings / s.hours : 0 }))
    .sort((a, b) => b.rph - a.rph)

  const maxRph = Math.max(...ranked.map(r => r.rph), 1)

  return (
    <div style={{ padding: '20px', borderRadius: 12, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 20 }}>
      <div style={{ marginBottom: 16 }}>
        {sessions.map((s, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 12 }}>
            <div>
              <label htmlFor={`rph-earn-${i}`} style={labelStyle}>{s.label} earnings ($)</label>
              <input id={`rph-earn-${i}`} type="number" min="0" value={s.earnings} onChange={e => update(i, 'earnings', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label htmlFor={`rph-hrs-${i}`} style={labelStyle}>Hours streamed</label>
              <input id={`rph-hrs-${i}`} type="number" min="0.5" step="0.5" value={s.hours} onChange={e => update(i, 'hours', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Revenue / hr</div>
              <div style={{ ...inputStyle, background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.2)', color: '#10b981', fontWeight: 800 }}>
                ${s.hours > 0 ? (s.earnings / s.hours).toFixed(2) : '0.00'}
              </div>
            </div>
          </div>
        ))}
        {sessions.length < 4 && (
          <button
            type="button"
            onClick={addSession}
            style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}
          >
            + Add session
          </button>
        )}
      </div>

      <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ ...labelStyle, marginBottom: 12 }}>Ranked by revenue per hour</div>
        {ranked.map((s, i) => (
          <div key={s.label} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: i === 0 ? '#f1f5f9' : '#94a3b8', fontWeight: i === 0 ? 700 : 400 }}>{s.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? '#10b981' : '#64748b' }}>${s.rph.toFixed(2)}/hr</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, width: `${(s.rph / maxRph) * 100}%`, background: i === 0 ? 'linear-gradient(90deg, #6366f1, #10b981)' : 'rgba(255,255,255,0.15)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
