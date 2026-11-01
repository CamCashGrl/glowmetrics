'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PLATFORM_TOKEN_RATES, PLATFORM_VIEWER_RATES } from '../../../lib/constants'

const RATES = {
  Chaturbate:  { broadcaster: PLATFORM_TOKEN_RATES.Chaturbate,  viewer: PLATFORM_VIEWER_RATES.Chaturbate },
  BongaCams:   { broadcaster: PLATFORM_TOKEN_RATES.BongaCams,   viewer: PLATFORM_VIEWER_RATES.BongaCams },
  MyFreeCams:  { broadcaster: PLATFORM_TOKEN_RATES.MyFreeCams,  viewer: PLATFORM_VIEWER_RATES.MyFreeCams },
  Stripchat:   { broadcaster: PLATFORM_TOKEN_RATES.Stripchat,   viewer: PLATFORM_VIEWER_RATES.Stripchat },
  CamSoda:     { broadcaster: PLATFORM_TOKEN_RATES.CamSoda,     viewer: PLATFORM_VIEWER_RATES.CamSoda },
}

const COMMON = [50, 100, 250, 500, 1000, 2500, 5000, 10000]
const MILESTONE_STEP = 50

const C = {
  cyan: '#16F4FF',
  pink: '#FF2BAE',
  purple: '#7C5CFF',
  gold: '#F59E0B',
  green: '#10B981',
  red: '#F87171',
  white: '#FFFFFF',
  text: '#B9BED3',
  muted: '#8D93AA',
  faint: '#5E647C',
  card: 'rgba(12,16,34,0.78)',
  border: 'rgba(255,255,255,0.09)',
  grad: 'linear-gradient(90deg,#16F4FF,#7C5CFF,#FF2BAE)',
}

function card(extra = {}) {
  return {
    borderRadius: 22,
    border: `1px solid ${C.border}`,
    background: C.card,
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 14px 34px rgba(0,0,0,0.28)',
    padding: '22px 24px',
    position: 'relative',
    ...extra,
  }
}

function SectionLabel({ children, color = C.cyan }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color, marginBottom: 14 }}>
      {children}
    </div>
  )
}

function Chip({ label, active, onClick, icon }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '9px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700,
        cursor: 'pointer', transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: 6,
        background: active ? C.grad : 'rgba(255,255,255,0.04)',
        color: active ? '#06101A' : C.text,
        border: active ? '1px solid transparent' : `1px solid ${C.border}`,
        boxShadow: active ? '0 0 20px rgba(22,244,255,0.22)' : 'none',
      }}
    >
      {icon && <span>{icon}</span>}
      {label}
    </button>
  )
}

const fmt$ = (v) => `$${(isFinite(v) ? v : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmt4 = (v) => `$${(isFinite(v) ? v : 0).toFixed(4)}`
const fmtN = (v) => (isFinite(v) ? v : 0).toLocaleString('en-US')

export default function TokenCalculatorClient() {
  const router = useRouter()
  const [tokens, setTokens] = useState('1000')
  const [platform, setPlatform] = useState('Chaturbate')
  const [customRate, setCustomRate] = useState('')
  const [useCustom, setUseCustom] = useState(false)

  const rate = useCustom
    ? (parseFloat(customRate) || 0)
    : RATES[platform].broadcaster

  const tokenNum = Math.max(0, parseInt(tokens) || 0)
  const earnings = tokenNum * rate

  const adjustTokens = (delta) => setTokens(String(Math.max(0, tokenNum + delta)))

  // Next round-number milestone above current earnings, in $MILESTONE_STEP increments.
  const milestone = rate > 0 ? (Math.floor(earnings / MILESTONE_STEP) + 1) * MILESTONE_STEP : 0
  const milestoneTokensTotal = rate > 0 ? Math.ceil(milestone / rate) : 0
  const milestoneTokensNeeded = Math.max(0, milestoneTokensTotal - tokenNum)

  const compareTokens = tokenNum || 1000
  const highestPayout = Object.entries(RATES).reduce((best, [p, r]) => {
    const value = compareTokens * r.broadcaster
    return value > best.value ? { platform: p, value } : best
  }, { platform: platform, value: -1 })

  return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif", color: C.text }}>
      <style>{`
        .cc-input:focus { outline: none; border-color: ${C.cyan} !important; box-shadow: 0 0 0 3px rgba(22,244,255,0.12); }
        .cc-row:hover { background: rgba(255,255,255,0.03) !important; }
      `}</style>

      <p style={{ fontSize: 13, color: C.text, marginBottom: 12, lineHeight: 1.6 }}>
        Convert tokens into estimated earnings across supported cam platforms.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, fontSize: 12, color: C.muted, marginBottom: 20 }}>
        ⓘ Rates may vary by platform, account type, promotions, or payout rules.
      </div>

      {/* CALCULATOR — platform, token amount, and estimated earnings together above the fold */}
      <div style={{ marginBottom: 16 }}>
        <div style={card({ border: '1px solid rgba(255,43,174,0.25)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 0 40px rgba(255,43,174,0.08)' })}>
          <SectionLabel color={C.cyan}>Calculator</SectionLabel>

          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Platform</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {Object.keys(RATES).map(p => (
              <Chip key={p} label={p} active={platform === p && !useCustom} icon={platform === p && !useCustom ? '✓' : null} onClick={() => { setPlatform(p); setUseCustom(false) }} />
            ))}
            <Chip label="Custom Rate" active={useCustom} onClick={() => setUseCustom(v => !v)} />
          </div>

          {useCustom && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(22,244,255,0.3)`, borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 8 }}>Your payout rate ($ per token)</label>
              <input
                type="number"
                step="0.001"
                value={customRate}
                onChange={e => setCustomRate(e.target.value)}
                placeholder="e.g. 0.05"
                className="cc-input"
                style={{ width: 180, padding: '10px 14px', borderRadius: 10, background: 'rgba(5,9,24,0.72)', border: `1px solid ${C.border}`, color: C.white, fontSize: 15 }}
              />
            </div>
          )}

          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Token Amount</div>
          <div style={{ position: 'relative', marginBottom: 20 }}>
            <input
              type="number"
              value={tokens}
              onChange={e => setTokens(e.target.value)}
              className="cc-input"
              style={{ width: '100%', padding: '16px 44px 16px 18px', borderRadius: 14, fontSize: 24, fontWeight: 800, background: 'rgba(5,9,24,0.72)', border: `1px solid ${C.border}`, color: C.white, WebkitAppearance: 'none', MozAppearance: 'textfield' }}
            />
            <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button onClick={() => adjustTokens(50)} style={{ width: 26, height: 20, borderRadius: 6, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.05)', color: C.text, cursor: 'pointer', fontSize: 10 }}>▲</button>
              <button onClick={() => adjustTokens(-50)} style={{ width: 26, height: 20, borderRadius: 6, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.05)', color: C.text, cursor: 'pointer', fontSize: 10 }}>▼</button>
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Estimated Earnings</div>
          <div style={{
            fontSize: 46, fontWeight: 900, lineHeight: 1, marginBottom: 20,
            backgroundImage: C.grad, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          }}>
            {fmt$(earnings)}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {COMMON.map(t => (
              <Chip key={t} label={fmtN(t)} active={tokenNum === t} onClick={() => setTokens(String(t))} />
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Your Rate {!useCustom ? '(Standard)' : '(Custom)'}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.cyan }}>{fmt4(rate)} per token</div>
            </div>
            <button onClick={() => { setTokens(''); setCustomRate(''); setUseCustom(false); setPlatform('Chaturbate') }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: C.muted, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              ↺ Clear
            </button>
          </div>

          {[
            ['Platform', useCustom ? 'Custom rate' : platform],
            ['Token Amount', fmtN(tokenNum)],
            ['Rate', `${fmt4(rate)} / token`],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid rgba(255,255,255,0.06)`, fontSize: 13 }}>
              <span style={{ color: C.muted }}>{label}</span>
              <span style={{ color: C.white, fontWeight: 700 }}>{value}</span>
            </div>
          ))}

          <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Calculation</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 4 }}>
              {fmtN(tokenNum)} tokens × {fmt4(rate)} = {fmt$(earnings)}
            </div>
            <div style={{ fontSize: 11, color: C.faint }}>Estimated earnings</div>
          </div>
        </div>
      </div>

      {/* EARNINGS CONTEXT */}
      <SectionLabel color={C.cyan}>Earnings Context</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginBottom: 16 }}>
        <div style={card({ display: 'flex', alignItems: 'flex-start', gap: 12 })}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(124,92,255,0.14)', border: '1px solid rgba(124,92,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>🎯</div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>You will earn</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.green, marginBottom: 2 }}>{fmt$(earnings)}</div>
            <div style={{ fontSize: 11, color: C.faint }}>on {useCustom ? 'your custom rate' : platform}</div>
          </div>
        </div>
        <div style={card({ display: 'flex', alignItems: 'flex-start', gap: 12 })}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,43,174,0.14)', border: '1px solid rgba(255,43,174,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>📈</div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{rate > 0 ? `${fmtN(milestoneTokensNeeded)} tokens to reach` : 'Set a rate to see milestones'}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.pink, marginBottom: 2 }}>{rate > 0 ? fmt$(milestone) : '—'}</div>
            <div style={{ fontSize: 11, color: C.faint }}>{rate > 0 ? `(${fmtN(milestoneTokensTotal)} total)` : ''}</div>
          </div>
        </div>
        <div style={card({ display: 'flex', alignItems: 'flex-start', gap: 12 })}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>🏆</div>
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Highest payout</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.gold, marginBottom: 2 }}>{fmt$(highestPayout.value)}</div>
            <div style={{ fontSize: 11, color: C.faint }}>on {highestPayout.platform}</div>
          </div>
        </div>
      </div>

      {/* QUICK CONVERSION + COMPARE PLATFORMS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, marginBottom: 16 }}>

        <div style={card({ padding: 0, overflow: 'hidden' })}>
          <div style={{ padding: '20px 22px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.cyan, marginBottom: 4 }}>Quick Conversion Reference</div>
            <div style={{ fontSize: 12, color: C.muted }}>Estimates for {useCustom ? 'your custom rate' : platform}</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Tokens', 'Estimated Earnings'].map(h => (
                  <th key={h} style={{ padding: '8px 22px', textAlign: 'left', fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMMON.map(t => {
                const isActive = tokenNum === t
                return (
                  <tr key={t} className="cc-row" onClick={() => setTokens(String(t))} style={{ cursor: 'pointer', background: isActive ? 'rgba(255,43,174,0.08)' : 'transparent', transition: 'background 0.1s' }}>
                    <td style={{ padding: '11px 22px', fontSize: 13, fontWeight: 700, color: C.white, borderBottom: `1px solid rgba(255,255,255,0.04)` }}>{fmtN(t)}</td>
                    <td style={{ padding: '11px 22px', fontSize: 13, fontWeight: 800, color: C.green, borderBottom: `1px solid rgba(255,255,255,0.04)` }}>{fmt$(t * rate)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ padding: '12px 22px', fontSize: 11, color: C.faint, fontStyle: 'italic' }}>Rates update when you change platforms. ⓘ</div>
        </div>

        <div style={card({ padding: 0, overflow: 'hidden' })}>
          <div style={{ padding: '20px 22px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.purple, marginBottom: 4 }}>Compare Platform Earnings</div>
            <div style={{ fontSize: 12, color: C.muted }}>Estimates for {fmtN(compareTokens)} tokens</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Platform', 'Rate', 'Estimated Earnings', 'Difference'].map(h => (
                  <th key={h} style={{ padding: '8px 18px', textAlign: 'left', fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(RATES).map(([p, r]) => {
                const isSelected = p === platform && !useCustom
                const value = compareTokens * r.broadcaster
                const diff = value - (compareTokens * (useCustom ? rate : RATES[platform].broadcaster))
                return (
                  <tr key={p} className="cc-row" onClick={() => { setPlatform(p); setUseCustom(false) }} style={{ cursor: 'pointer', background: isSelected ? 'rgba(22,244,255,0.06)' : 'transparent', transition: 'background 0.1s' }}>
                    <td style={{ padding: '11px 18px', fontSize: 13, fontWeight: isSelected ? 800 : 600, color: isSelected ? C.cyan : C.white, borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                      {p}{isSelected && <span style={{ marginLeft: 8, fontSize: 9, padding: '2px 8px', borderRadius: 100, background: C.cyan, color: '#06101A', fontWeight: 800 }}>SELECTED</span>}
                    </td>
                    <td style={{ padding: '11px 18px', fontSize: 13, color: C.gold, fontWeight: 600, borderBottom: `1px solid rgba(255,255,255,0.04)` }}>{fmt4(r.broadcaster)}</td>
                    <td style={{ padding: '11px 18px', fontSize: 13, color: C.green, fontWeight: 800, borderBottom: `1px solid rgba(255,255,255,0.04)` }}>{fmt$(value)}</td>
                    <td style={{ padding: '11px 18px', fontSize: 13, fontWeight: 700, color: isSelected ? C.faint : diff > 0 ? C.green : diff < 0 ? C.red : C.faint, borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                      {isSelected ? '—' : `${diff > 0 ? '+' : diff < 0 ? '-' : ''}${fmt$(Math.abs(diff))}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ padding: '12px 22px', fontSize: 11, color: C.faint, fontStyle: 'italic' }}>Rates are estimates and vary by account and promotions. ⓘ</div>
        </div>
      </div>

      {/* HELPFUL GUIDES */}
      <SectionLabel color={C.cyan}>Helpful Guides</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
        {[
          { icon: '📈', title: 'Best Times to Cam', desc: 'Find your highest earning hours based on data.', href: '/guides/chaturbate-hours' },
          { icon: '🎮', title: 'Live Mode Coaching', desc: 'Get real-time coaching alerts while you stream.', href: '/dashboard?tab=live' },
          { icon: '🪙', title: "Why Streams Aren't Making Money", desc: 'Fix the most common income leaks.', href: '/blog/why-youre-not-making-money-on-chaturbate' },
        ].map(g => (
          <button key={g.title} onClick={() => router.push(g.href)} style={{ ...card({ padding: '18px 20px' }), textAlign: 'left', cursor: 'pointer', width: '100%' }}>
            <div style={{ fontSize: 20, marginBottom: 10 }}>{g.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.white, marginBottom: 4 }}>{g.title}</div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{g.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
