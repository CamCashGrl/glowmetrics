'use client'
import { useState } from 'react'
import { PLATFORM_TOKEN_RATES, PLATFORM_VIEWER_RATES } from '../../../lib/constants'

const RATES = {
  Chaturbate:  { broadcaster: PLATFORM_TOKEN_RATES.Chaturbate,  viewer: PLATFORM_VIEWER_RATES.Chaturbate,  note: 'Standard broadcaster rate' },
  BongaCams:   { broadcaster: PLATFORM_TOKEN_RATES.BongaCams,   viewer: PLATFORM_VIEWER_RATES.BongaCams,   note: 'Standard broadcaster rate' },
  MyFreeCams:  { broadcaster: PLATFORM_TOKEN_RATES.MyFreeCams,  viewer: PLATFORM_VIEWER_RATES.MyFreeCams,  note: 'Standard MFC rate' },
  Stripchat:   { broadcaster: PLATFORM_TOKEN_RATES.Stripchat,   viewer: PLATFORM_VIEWER_RATES.Stripchat,   note: 'Approximate broadcaster rate' },
  CamSoda:     { broadcaster: PLATFORM_TOKEN_RATES.CamSoda,     viewer: PLATFORM_VIEWER_RATES.CamSoda,     note: 'Slightly higher standard rate' },
}

const COMMON = [50, 100, 200, 500, 1000, 2000, 5000, 10000]

const S = {
  bg: '#14171C',
  surface: '#1C2028',
  card: '#21262F',
  accent: '#6366F1',
  accentLight: 'rgba(99,102,241,0.12)',
  accentBorder: 'rgba(99,102,241,0.3)',
  green: '#10B981',
  gold: '#F59E0B',
  white: '#F1F5F9',
  muted: '#6B7280',
  text: '#9CA3AF',
  border: 'rgba(255,255,255,0.07)',
}

function QuickChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.15s', border: 'none',
        background: active ? S.accent : S.surface,
        color: active ? '#fff' : S.muted,
        outline: active ? `2px solid ${S.accentBorder}` : '2px solid transparent',
        outlineOffset: 1,
      }}
    >{label}</button>
  )
}

export default function TokenCalculatorClient() {
  const [tokens, setTokens] = useState('')
  const [platform, setPlatform] = useState('Chaturbate')
  const [customRate, setCustomRate] = useState('')
  const [useCustom, setUseCustom] = useState(false)

  const rate = useCustom && customRate
    ? parseFloat(customRate) || 0.05
    : RATES[platform].broadcaster

  const tokenNum = parseFloat(tokens) || 0
  const usd = tokenNum * rate

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', color: S.text }}>
      <style>{`
        * { box-sizing: border-box; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        input[type=number] { -moz-appearance: textfield; }
        .calc-input:focus { outline: none; border-color: ${S.accent} !important; box-shadow: 0 0 0 3px ${S.accentLight}; }
        .hover-fade:hover { background: rgba(255,255,255,0.04) !important; }
      `}</style>

      {/* PLATFORM SELECTOR */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 20, padding: '28px 32px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: S.accent, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14 }}>Platform</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {Object.keys(RATES).map(p => (
            <QuickChip key={p} label={p} active={platform === p && !useCustom} onClick={() => { setPlatform(p); setUseCustom(false) }} />
          ))}
          <QuickChip label="Custom rate" active={useCustom} onClick={() => setUseCustom(v => !v)} />
        </div>

        {/* CUSTOM RATE INPUT */}
        {useCustom && (
          <div style={{ background: S.surface, border: `1px solid ${S.accentBorder}`, borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 8 }}>Your payout rate ($ per token)</label>
            <input
              type="number"
              step="0.001"
              value={customRate}
              onChange={e => setCustomRate(e.target.value)}
              placeholder="e.g. 0.05"
              className="calc-input"
              style={{ width: 180, padding: '10px 14px', borderRadius: 10, background: S.card, border: `1px solid ${S.border}`, color: S.white, fontSize: 16, transition: 'all 0.15s' }}
            />
            <div style={{ fontSize: 12, color: S.muted, marginTop: 8 }}>Enter the broadcaster rate shown in your platform dashboard</div>
          </div>
        )}

        {!useCustom && (
          <div style={{ fontSize: 13, color: S.muted, padding: '8px 14px', background: S.surface, borderRadius: 8, display: 'inline-block' }}>
            Broadcaster rate: <span style={{ color: S.gold, fontWeight: 700 }}>${rate.toFixed(4)}/token</span>
            {' · '}
            Viewer pays: <span style={{ color: S.text, fontWeight: 600 }}>${RATES[platform].viewer.toFixed(2)}/token</span>
            {' · '}
            <span style={{ color: S.muted }}>{RATES[platform].note}</span>
          </div>
        )}
      </div>

      {/* TOKEN INPUT + RESULT */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 20, padding: '28px 32px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: S.accent, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14 }}>Token amount</div>

        {/* Quick select chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {COMMON.map(t => (
            <QuickChip key={t} label={t.toLocaleString()} active={parseInt(tokens) === t} onClick={() => setTokens(t.toString())} />
          ))}
        </div>

        <input
          type="number"
          value={tokens}
          onChange={e => setTokens(e.target.value)}
          placeholder="Or enter any amount..."
          className="calc-input"
          style={{
            width: '100%', padding: '16px 20px', borderRadius: 14, fontSize: 22, fontWeight: 700,
            background: S.surface, border: `1px solid ${S.border}`, color: S.white,
            transition: 'all 0.15s', marginBottom: 20,
          }}
        />

        {/* RESULT */}
        <div style={{
          padding: '24px 28px', borderRadius: 16,
          background: tokenNum > 0 ? S.accentLight : 'rgba(255,255,255,0.02)',
          border: tokenNum > 0 ? `1px solid ${S.accentBorder}` : `1px solid ${S.border}`,
          transition: 'all 0.2s',
        }}>
          <div style={{ fontSize: 11, color: S.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>You earn</div>
          <div style={{ fontSize: 60, fontWeight: 900, color: tokenNum > 0 ? S.green : S.muted, lineHeight: 1, transition: 'color 0.2s' }}>
            ${usd.toFixed(2)}
          </div>
          {tokenNum > 0 && (
            <div style={{ fontSize: 14, color: S.muted, marginTop: 10 }}>
              {tokenNum.toLocaleString()} tokens × ${rate.toFixed(4)}/token
              {useCustom ? ' (custom rate)' : ` on ${platform}`}
              {' · '}
              <span style={{ color: S.text }}>Viewer paid ~${(tokenNum * (useCustom ? rate * 2 : RATES[platform].viewer)).toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* BongaCams note */}
      {platform === 'BongaCams' && !useCustom && (
        <div style={{ padding: '12px 18px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', marginBottom: 16, fontSize: 13, color: S.gold }}>
          ⚠️ BongaCams pays $0.025/token to broadcasters — lower than Chaturbate's $0.05. Use the Custom rate button if your dashboard shows a different rate.
        </div>
      )}

      {/* COMMON AMOUNTS TABLE */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 20, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '20px 28px', borderBottom: `1px solid ${S.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: S.white }}>Common Token Amounts</div>
          <div style={{ fontSize: 13, color: S.muted, marginTop: 3 }}>
            Using {useCustom && customRate ? `custom rate $${parseFloat(customRate).toFixed(4)}` : `${platform} broadcaster rate ($${rate.toFixed(4)}/token)`}
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(99,102,241,0.05)' }}>
              {['Tokens', 'You Earn (USD)', 'Viewer Pays', ''].map(h => (
                <th key={h} style={{ padding: '10px 24px', textAlign: 'left', fontSize: 11, color: S.accent, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMMON.map(t => {
              const earnUSD = t * rate
              const viewerUSD = t * (RATES[platform]?.viewer ?? rate * 2)
              const isActive = parseInt(tokens) === t
              return (
                <tr
                  key={t}
                  className="hover-fade"
                  onClick={() => setTokens(t.toString())}
                  style={{ borderTop: `1px solid ${S.border}`, cursor: 'pointer', background: isActive ? S.accentLight : 'transparent', transition: 'background 0.1s' }}
                >
                  <td style={{ padding: '13px 24px', fontWeight: 700, color: S.white, fontSize: 14 }}>{t.toLocaleString()}</td>
                  <td style={{ padding: '13px 24px', fontWeight: 800, color: S.green, fontSize: 14 }}>${earnUSD.toFixed(2)}</td>
                  <td style={{ padding: '13px 24px', color: S.muted, fontSize: 14 }}>${viewerUSD.toFixed(2)}</td>
                  <td style={{ padding: '13px 24px' }}>
                    {isActive && <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: S.accentLight, color: S.accent, fontWeight: 700 }}>Selected</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* PLATFORM COMPARISON TABLE */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 20, overflow: 'hidden' }}>
        <div style={{ padding: '20px 28px', borderBottom: `1px solid ${S.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: S.white }}>Platform Payout Comparison</div>
          <div style={{ fontSize: 13, color: S.muted, marginTop: 3 }}>
            What {tokenNum > 0 ? tokenNum.toLocaleString() : '1,000'} tokens earns you on each platform
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(99,102,241,0.05)' }}>
              {['Platform', 'Rate/Token', `${tokenNum > 0 ? tokenNum.toLocaleString() : '1,000'} Tokens = $`, 'Note'].map(h => (
                <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, color: S.accent, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(RATES).map(([p, r], i) => {
              const t = tokenNum || 1000
              const earned = t * r.broadcaster
              const isSelected = p === platform && !useCustom
              return (
                <tr
                  key={p}
                  className="hover-fade"
                  onClick={() => { setPlatform(p); setUseCustom(false) }}
                  style={{ borderTop: `1px solid ${S.border}`, cursor: 'pointer', background: isSelected ? S.accentLight : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                >
                  <td style={{ padding: '13px 20px', fontWeight: isSelected ? 700 : 500, color: isSelected ? S.accent : S.white, fontSize: 14 }}>
                    {p}{isSelected && <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 8px', borderRadius: 10, background: S.accent, color: '#fff', fontWeight: 700 }}>ACTIVE</span>}
                  </td>
                  <td style={{ padding: '13px 20px', color: S.gold, fontSize: 14, fontWeight: 600 }}>${r.broadcaster.toFixed(4)}</td>
                  <td style={{ padding: '13px 20px', color: S.green, fontSize: 14, fontWeight: 800 }}>${earned.toFixed(2)}</td>
                  <td style={{ padding: '13px 20px', color: S.muted, fontSize: 13 }}>{r.note}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
