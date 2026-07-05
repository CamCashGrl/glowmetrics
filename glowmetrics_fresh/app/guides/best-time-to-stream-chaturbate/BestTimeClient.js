'use client'

import { useState } from 'react'

const inputStyle = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'white',
  fontSize: 15,
  fontWeight: 600,
  outline: 'none',
  boxSizing: 'border-box',
}

const selectStyle = { ...inputStyle, fontWeight: 400 }

const labelStyle = {
  fontSize: 11,
  color: '#475569',
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  fontWeight: 600,
  display: 'block',
  marginBottom: 8,
}

const resultCard = (color) => ({
  padding: '16px 18px',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  textAlign: 'center',
})

// ── Peak Hour Calculator ──────────────────────────────────────────────────
export function PeakHourCalculator() {
  const [tz, setTz] = useState('EST')
  const [hours, setHours] = useState(4)
  const [daily, setDaily] = useState(80)

  const rph = hours > 0 ? (daily / hours).toFixed(2) : '0.00'

  const windows = {
    EST:  ['8 PM – 1 AM EST', '11 PM – 3 AM EST (late-night peak)', '3 PM – 7 PM EST (afternoon boost)'],
    PST:  ['5 PM – 10 PM PST', '8 PM – 12 AM PST (prime window)', '12 PM – 4 PM PST (afternoon lift)'],
    GMT:  ['8 PM – 1 AM GMT', '10 PM – 2 AM GMT (European prime)', '3 PM – 6 PM GMT (post-work)'],
    CEST: ['7 PM – 12 AM CEST', '9 PM – 1 AM CEST (Euro peak)', '2 PM – 5 PM CEST (after school)'],
    AEST: ['7 PM – 11 PM AEST', '10 PM – 2 AM AEST (Oceanic peak)', '5 PM – 8 PM AEST (evening)'],
  }

  const suggestion = windows[tz] || windows['EST']

  return (
    <div style={{ padding: '28px', borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div>
          <label htmlFor="your-timezone" style={labelStyle}>Your Timezone</label>
          <select id="your-timezone" value={tz} onChange={e => setTz(e.target.value)} style={selectStyle}>
            <option value="EST">EST — North America East</option>
            <option value="PST">PST — North America West</option>
            <option value="GMT">GMT — UK / West Europe</option>
            <option value="CEST">CEST — Central Europe</option>
            <option value="AEST">AEST — Australia East</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Avg Hours / Session</label>
          <input
            type="number"
            min="1" max="12"
            value={hours}
            onChange={e => setHours(parseFloat(e.target.value) || 1)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Avg Daily Earnings ($)</label>
          <input
            type="number"
            min="0"
            value={daily}
            onChange={e => setDaily(parseFloat(e.target.value) || 0)}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ padding: '18px 20px', borderRadius: 12, background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.2)', marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: '#22D3EE', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, marginBottom: 10 }}>
          Suggested Streaming Windows ({tz})
        </div>
        {suggestion.map((w, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < suggestion.length - 1 ? 8 : 0 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? '#22D3EE' : '#475569', flexShrink: 0 }} />
            <span style={{ fontSize: 14, color: i === 0 ? 'white' : '#94A3B8', fontWeight: i === 0 ? 700 : 400 }}>{w}</span>
            {i === 0 && <span style={{ fontSize: 11, color: '#22D3EE', fontWeight: 700, marginLeft: 4 }}>PRIMARY</span>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Your $/hr', value: `$${rph}`, color: '#22D3EE' },
          { label: 'Weekly (5 sessions)', value: `$${(daily * 5).toFixed(0)}`, color: '#10B981' },
          { label: 'Monthly est.', value: `$${(daily * 20).toFixed(0)}`, color: '#F59E0B' },
        ].map(({ label, value, color }) => (
          <div key={label} style={resultCard(color)}>
            <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, color: '#475569', marginTop: 14, marginBottom: 0 }}>
        These are general estimates based on timezone patterns. For your actual personal peak hours,{' '}
        <a href="/login" style={{ color: '#22D3EE' }}>upload your Chaturbate CSV to CamCash</a> — it calculates your real peak from your tip timestamps.
      </p>
    </div>
  )
}

// ── Revenue Per Hour Calculator ───────────────────────────────────────────
export function RevPerHourCalculator() {
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
    <div style={{ padding: '28px', borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ marginBottom: 20 }}>
        {sessions.map((s, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>{s.label} — Earnings ($)</label>
              <input
                type="number" min="0"
                value={s.earnings}
                onChange={e => update(i, 'earnings', e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Hours Streamed</label>
              <input
                type="number" min="0.5" step="0.5"
                value={s.hours}
                onChange={e => update(i, 'hours', e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <label style={labelStyle}>Revenue / Hr</label>
              <div style={{ ...inputStyle, background: 'rgba(34,211,238,0.08)', borderColor: 'rgba(34,211,238,0.2)', color: '#22D3EE', fontWeight: 800 }}>
                ${s.hours > 0 ? (s.earnings / s.hours).toFixed(2) : '0.00'}
              </div>
            </div>
          </div>
        ))}
        {sessions.length < 4 && (
          <button
            onClick={addSession}
            style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', fontSize: 13, cursor: 'pointer' }}
          >
            + Add session
          </button>
        )}
      </div>

      <div style={{ padding: '18px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600, marginBottom: 14 }}>
          Efficiency Ranking
        </div>
        {ranked.map((s, i) => (
          <div key={s.label} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 13, color: i === 0 ? 'white' : '#94A3B8', fontWeight: i === 0 ? 700 : 400 }}>
                {i === 0 ? '🏆 ' : ''}{s.label}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? '#22D3EE' : '#64748b' }}>
                ${s.rph.toFixed(2)}/hr
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, width: `${(s.rph / maxRph) * 100}%`, background: i === 0 ? 'linear-gradient(90deg, #22D3EE, #EC4899)' : 'rgba(255,255,255,0.15)', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, color: '#475569', marginTop: 14, marginBottom: 0 }}>
        The highest-earning session is not always the most efficient. Revenue per hour is the real measure of your time's value.
      </p>
    </div>
  )
}
