'use client'
import { useState } from 'react'

const RATES = {
  Chaturbate:  { broadcaster: 0.05,   viewer: 0.10,  note: 'Standard broadcaster rate' },
 BongaCams:   { broadcaster: 0.05,   viewer: 0.10,  note: 'Completed profile rate. Incomplete profile = $0.025/token' }, },
  MyFreeCams:  { broadcaster: 0.05,   viewer: 0.10,  note: 'Standard MFC rate' },
  Stripchat:   { broadcaster: 0.05,   viewer: 0.09,  note: 'Approximate broadcaster rate' },
  CamSoda:     { broadcaster: 0.055,  viewer: 0.10,  note: 'Approximate broadcaster rate' },
}

const COMMON = [50, 100, 200, 500, 1000, 2000, 5000, 10000]

const C = {
  bg: '#05070f', card: 'rgba(15,20,32,0.75)', border: 'rgba(255,255,255,0.08)',
  cyan: '#22D3EE', pink: '#EC4899', gold: '#F59E0B', white: '#F1F5F9',
  muted: '#475569', text: '#94A3B8', green: '#10B981',
}

export default function TokenCalculatorClient() {
  const [tokens, setTokens] = useState('')
  const [platform, setPlatform] = useState('Chaturbate')
  const [customRate, setCustomRate] = useState('')
  const [useCustom, setUseCustom] = useState(false)

  const rate = useCustom && customRate
    ? parseFloat(customRate) || 0.05
    : RATES[platform].broadcaster

  const usd = tokens ? (parseFloat(tokens) || 0) * rate : 0

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus { outline: none; border-color: rgba(34,211,238,0.5) !important; }
        select:focus { outline: none; }
        .hover-row:hover { background: rgba(255,255,255,0.04) !important; }
        .platform-btn:hover { border-color: rgba(34,211,238,0.4) !important; }
      `}</style>

      {/* NAV */}
      <nav style={{ padding: '18px 40px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/landing" style={{ fontWeight: 800, fontSize: 20, color: C.white, textDecoration: 'none' }}>
          Cam<span style={{ color: C.cyan }}>Cash</span>
        </a>
        <a href="/login" style={{ padding: '8px 20px', borderRadius: 8, background: 'linear-gradient(135deg, #22D3EE, #EC4899)', color: 'white', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
          Start Free →
        </a>
      </nav>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '52px 24px 100px' }}>

        {/* BREADCRUMB */}
        <nav style={{ marginBottom: 24, fontSize: 13 }}>
          <a href="/landing" style={{ color: C.cyan, textDecoration: 'none' }}>Home</a>
          <span style={{ margin: '0 8px', color: C.muted }}>›</span>
          <a href="/landing#guides" style={{ color: C.cyan, textDecoration: 'none' }}>Guides</a>
          <span style={{ margin: '0 8px', color: C.muted }}>›</span>
          <span style={{ color: C.muted }}>Token Calculator</span>
        </nav>

        {/* HEADER */}
        <h1 style={{ fontSize: 40, fontWeight: 900, color: C.white, lineHeight: 1.15, marginBottom: 16, letterSpacing: '-0.02em' }}>
          Chaturbate Token Calculator
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.7, color: '#CBD5E1', marginBottom: 40, paddingLeft: 20, borderLeft: `3px solid ${C.cyan}` }}>
          See exactly what your tokens are worth in USD. Works for Chaturbate, BongaCams, MyFreeCams, Stripchat and CamSoda — using real broadcaster payout rates.
        </p>

        {/* MAIN CALCULATOR CARD */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 32, marginBottom: 28, backdropFilter: 'blur(20px)', boxShadow: '0 0 40px rgba(59,130,246,0.1)' }}>

          {/* PLATFORM SELECTOR */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Platform</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.keys(RATES).map(p => (
                <button
                  key={p}
                  className="platform-btn"
                  onClick={() => { setPlatform(p); setUseCustom(false) }}
                  style={{
                    padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s',
                    background: platform === p && !useCustom ? 'linear-gradient(135deg, rgba(34,211,238,0.2), rgba(236,72,153,0.15))' : 'rgba(255,255,255,0.04)',
                    border: platform === p && !useCustom ? `1px solid ${C.cyan}` : '1px solid rgba(255,255,255,0.08)',
                    color: platform === p && !useCustom ? C.white : C.muted,
                  }}
                >{p}</button>
              ))}
            </div>
          </div>

          {/* TOKEN INPUT */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8 }}>
              Tokens
            </label>
            <input
              type="number"
              value={tokens}
              onChange={e => setTokens(e.target.value)}
              placeholder="Enter token amount..."
              style={{
                width: '100%', padding: '14px 18px', borderRadius: 12, fontSize: 18,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: C.white, transition: 'border-color 0.15s',
              }}
            />
          </div>

          {/* RESULT */}
          <div style={{
            padding: '20px 24px', borderRadius: 14,
            background: usd > 0 ? 'linear-gradient(135deg, rgba(34,211,238,0.1), rgba(236,72,153,0.08))' : 'rgba(255,255,255,0.03)',
            border: usd > 0 ? `1px solid rgba(34,211,238,0.35)` : '1px solid rgba(255,255,255,0.06)',
            marginBottom: 20, transition: 'all 0.2s',
          }}>
            <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>You earn</div>
            <div style={{ fontSize: 48, fontWeight: 900, background: 'linear-gradient(135deg, #22D3EE, #EC4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>
              ${usd.toFixed(2)}
            </div>
            {tokens && (
              <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>
                {parseFloat(tokens).toLocaleString()} tokens × ${rate.toFixed(4)}/token on {useCustom ? 'custom rate' : platform}
              </div>
            )}
          </div>

          {/* RATE INFO */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ padding: '6px 14px', borderRadius: 20, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', fontSize: 12, color: C.gold }}>
              📡 Broadcaster rate: ${rate.toFixed(4)}/token
            </div>
            {!useCustom && (
              <div style={{ padding: '6px 14px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12, color: C.muted }}>
                👀 Viewer pays: ${RATES[platform].viewer.toFixed(2)}/token
              </div>
            )}
            <button
              onClick={() => setUseCustom(v => !v)}
              style={{ padding: '6px 14px', borderRadius: 20, background: useCustom ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.04)', border: useCustom ? `1px solid ${C.cyan}` : '1px solid rgba(255,255,255,0.08)', fontSize: 12, color: useCustom ? C.cyan : C.muted, cursor: 'pointer' }}
            >
              ✏️ Custom rate
            </button>
          </div>

          {/* CUSTOM RATE INPUT */}
          {useCustom && (
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 6 }}>Your payout rate ($ per token)</label>
              <input
                type="number"
                step="0.001"
                value={customRate}
                onChange={e => setCustomRate(e.target.value)}
                placeholder="e.g. 0.05"
                style={{ width: 160, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.cyan}`, color: C.white, fontSize: 14 }}
              />
            </div>
          )}
        </div>

        {/* CONVERSION TABLE */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 28 }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.white }}>Common Token Amounts</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Using {useCustom && customRate ? `custom rate $${parseFloat(customRate).toFixed(4)}` : `${platform} broadcaster rate ($${rate.toFixed(4)}/token)`}</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                {['Tokens', 'You Earn (USD)', 'Viewer Pays'].map(h => (
                  <th key={h} style={{ padding: '10px 24px', textAlign: 'left', fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMMON.map(t => {
                const earnUSD = t * rate
                const viewerUSD = t * RATES[platform].viewer
                return (
                  <tr
                    key={t}
                    className="hover-row"
                    onClick={() => setTokens(t.toString())}
                    style={{ borderTop: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', background: parseInt(tokens) === t ? 'rgba(34,211,238,0.06)' : 'transparent', transition: 'background 0.1s' }}
                  >
                    <td style={{ padding: '12px 24px', fontWeight: 600, color: C.white, fontSize: 14 }}>{t.toLocaleString()}</td>
                    <td style={{ padding: '12px 24px', fontWeight: 800, color: C.green, fontSize: 14 }}>${earnUSD.toFixed(2)}</td>
                    <td style={{ padding: '12px 24px', color: C.muted, fontSize: 14 }}>${viewerUSD.toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* PLATFORM COMPARISON TABLE */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 36 }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.white }}>Platform Payout Comparison</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>What {tokens || '1,000'} tokens earns you on each platform</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                {['Platform', 'Rate/Token', `${tokens ? parseInt(tokens).toLocaleString() : '1,000'} Tokens = USD`, 'Note'].map(h => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(RATES).map(([p, r]) => {
                const t = parseFloat(tokens) || 1000
                const earned = t * r.broadcaster
                const isSelected = p === platform && !useCustom
                return (
                  <tr key={p} className="hover-row" onClick={() => { setPlatform(p); setUseCustom(false) }}
                    style={{ borderTop: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', background: isSelected ? 'rgba(34,211,238,0.06)' : 'transparent' }}>
                    <td style={{ padding: '12px 20px', fontWeight: isSelected ? 700 : 400, color: isSelected ? C.cyan : C.white, fontSize: 14 }}>{p}</td>
                    <td style={{ padding: '12px 20px', color: C.gold, fontSize: 14, fontWeight: 600 }}>${r.broadcaster.toFixed(4)}</td>
                    <td style={{ padding: '12px 20px', color: C.green, fontSize: 14, fontWeight: 800 }}>${earned.toFixed(2)}</td>
                    <td style={{ padding: '12px 20px', color: C.muted, fontSize: 12 }}>{r.note}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* INFO SECTIONS */}
        {[
          { h2: 'How Much Does Chaturbate Pay Per Token?', body: 'Chaturbate pays broadcasters $0.05 per token. Viewers purchase tokens at $0.10 each, so Chaturbate keeps 50% and you receive 50%. Some models with high traffic negotiate higher rates directly with Chaturbate — if you have a custom rate, use the "Custom rate" button above to get accurate numbers.' },
          { h2: 'Broadcaster Rate vs Viewer Rate', body: 'The viewer rate ($0.10/token on Chaturbate) is what fans pay to buy tokens. Your broadcaster rate ($0.05/token) is what you receive. This 50% split is standard across most cam platforms. BongaCams and CamSoda rates vary slightly and can increase with model level or traffic milestones.' },
          { h2: 'Track More Than Just Token Math', body: 'A token calculator shows you what individual tips are worth — but CamCash shows you your total earning history, which fans tip the most, what time of day you earn the most, and how your platforms compare. It turns your raw CSV data into a complete analytics dashboard. Free for cam models during beta.' },
        ].map(({ h2, body }) => (
          <section key={h2} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: C.white, marginBottom: 10, letterSpacing: '-0.01em' }}>{h2}</h2>
            <p style={{ fontSize: 16, lineHeight: 1.8, color: C.text }}>{body}</p>
          </section>
        ))}

        {/* BOTTOM CTA */}
        <div style={{ padding: '40px 32px', borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', marginTop: 48 }}>
          <h2 style={{ fontSize: 26, fontWeight: 900, color: C.white, marginBottom: 10 }}>Want to track ALL your earnings — not just one tip?</h2>
          <p style={{ fontSize: 15, color: C.muted, marginBottom: 28, lineHeight: 1.6 }}>Upload your CSV from Chaturbate, BongaCams, or MFC and get a complete analytics dashboard — top fans, peak hours, session breakdowns, and personalized recommendations. Free during beta.</p>
          <a href="/login" style={{ display: 'inline-block', padding: '14px 40px', borderRadius: 12, background: 'linear-gradient(135deg, #22D3EE, #EC4899)', color: 'white', fontWeight: 800, fontSize: 16, textDecoration: 'none', boxShadow: '0 0 40px rgba(34,211,238,0.25)' }}>
            Start Tracking Free →
          </a>
        </div>

        {/* RELATED */}
        <div style={{ marginTop: 48 }}>
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 14 }}>Related guides</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {[
              ['chaturbate-earnings-tracker', 'Chaturbate Earnings Tracker'],
              ['chaturbate-best-hours', 'Best Hours to Stream'],
              ['chaturbate-token-tracker', 'Chaturbate Token Tracker'],
              ['cam-model-income-tracker', 'Cam Model Income Tracker'],
            ].map(([slug, label]) => (
              <a key={slug} href={`/guides/${slug}`} style={{ padding: '6px 14px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: C.cyan, fontSize: 13, textDecoration: 'none' }}>{label}</a>
            ))}
          </div>
        </div>
      </div>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '32px 40px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: C.muted }}>© 2026 CamCash — Built for cam models who want to grow</p>
      </footer>
    </div>
  )
}
