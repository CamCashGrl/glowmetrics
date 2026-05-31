'use client'
import { useState, useEffect, useRef } from 'react'

const C = {
  bg: '#040812', card: 'rgba(15,20,32,0.88)', border: 'rgba(168,85,247,0.18)',
  purple: '#a855f7', cyan: '#22d3ee', green: '#10b981',
  white: '#f1f5f9', muted: '#94a3b8', dim: '#475569', text: '#e2e8f0',
  pink: '#ec4899', gold: '#f59e0b', red: '#f87171', orange: '#f97316',
}

const glass = {
  background: 'rgba(15,20,32,0.82)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(20px)',
  boxShadow: '0 0 40px rgba(124,92,255,0.1)',
}

// ── Rotating coaching insights ────────────────────────────────────────────────
const INSIGHTS = [
  { icon: '⚡', color: C.green,  label: 'STRIKE NOW',     text: 'kingwhale99 tipped 6 minutes ago — they\'re engaged. Send a personal shoutout immediately to lock in another tip.' },
  { icon: '💰', color: C.gold,   label: 'GOAL MOMENT',    text: 'You\'re 280 tokens from your goal. Call it out in chat — "280 tokens to go!" — this is your highest-conversion moment.' },
  { icon: '🔥', color: C.orange, label: 'MOMENTUM',       text: 'Your pace is 22% above your average for this hour. Keep energy high — you\'re in a hot window.' },
  { icon: '🐳', color: C.cyan,   label: 'WHALE ACTIVE',   text: 'diamondkingx is in your room and hasn\'t tipped yet this session. Direct engagement — mention their name.' },
  { icon: '📊', color: C.purple, label: 'PACE CHECK',     text: 'You\'re on track for $1,200+ this session. Your second-half pace is stronger than your first — maintain the energy.' },
  { icon: '💬', color: C.pink,   label: 'CHAT QUIET',     text: 'Chat has been silent for 4 minutes. Ask a question — "what do you want to see next?" reactivates passive viewers.' },
  { icon: '🎯', color: C.green,  label: 'CHAIN GOAL',     text: 'Goal hit! Set the next one immediately. Don\'t let the momentum drop — announce a 500-token goal now.' },
  { icon: '⏰', color: C.gold,   label: 'PEAK WINDOW',    text: 'You\'re in your 1 AM peak window. This is historically your highest-earning hour — go harder, not easier.' },
]

const DEMO_TIPS = [
  { username: 'diamondkingx', tokens: 500, usd: 25, note: 'incredible 🔥' },
  { username: 'kingwhale99',  tokens: 200, usd: 10, note: '' },
  { username: 'velvet_fan',   tokens: 100, usd: 5,  note: 'love your energy' },
  { username: 'toptipper88',  tokens: 1000, usd: 50, note: 'queen 👑' },
  { username: 'neonrider',    tokens: 50,  usd: 2.5, note: '' },
  { username: 'cbwhale_x',    tokens: 300, usd: 15,  note: 'best streamer' },
  { username: 'darkfan99',    tokens: 150, usd: 7.5,  note: '' },
  { username: 'diamondkingx', tokens: 2000, usd: 100, note: 'you\'re the best 💎' },
  { username: 'velvet_fan',   tokens: 200, usd: 10,  note: '' },
  { username: 'goldmember_x', tokens: 500, usd: 25,  note: 'amazing show' },
]

const METRICS_BASE = {
  revenue: 842, goal: 1000, tokens: 16840, tips: 22, viewers: 187,
  topFan: 'diamondkingx', topFanUSD: 165, pace: 218, avgPace: 178,
}

export default function LiveDemoPage() {
  const [tick, setTick]           = useState(0)
  const [elapsed, setElapsed]     = useState(0)   // seconds
  const [insightIdx, setInsightIdx] = useState(0)
  const [tipFeed, setTipFeed]     = useState([])
  const [tipIdx, setTipIdx]       = useState(0)
  const [revenue, setRevenue]     = useState(METRICS_BASE.revenue)
  const [tokens, setTokens]       = useState(METRICS_BASE.tokens)
  const [tipCount, setTipCount]   = useState(METRICS_BASE.tips)
  const [viewers, setViewers]     = useState(METRICS_BASE.viewers)
  const [flashId, setFlashId]     = useState(null)
  const [goalProgress, setGoalProgress] = useState(METRICS_BASE.revenue)
  const [goalTarget]              = useState(METRICS_BASE.goal)
  const [pace, setPace]           = useState(METRICS_BASE.pace)
  const [insightVisible, setInsightVisible] = useState(true)

  const tipFeedRef = useRef(null)

  // Main simulation tick — every second
  useEffect(() => {
    const id = setInterval(() => {
      setTick(t => t + 1)
      setElapsed(e => e + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Rotate coaching insight every 12s
  useEffect(() => {
    if (elapsed > 0 && elapsed % 12 === 0) {
      setInsightVisible(false)
      setTimeout(() => {
        setInsightIdx(i => (i + 1) % INSIGHTS.length)
        setInsightVisible(true)
      }, 400)
    }
  }, [elapsed])

  // Drop a new tip every 8–15 seconds (simulated)
  useEffect(() => {
    if (elapsed > 0 && elapsed % 10 === 0) {
      const tip = DEMO_TIPS[tipIdx % DEMO_TIPS.length]
      const id  = Date.now()
      const newTip = { ...tip, id, ts: new Date() }
      setTipFeed(prev => [newTip, ...prev].slice(0, 20))
      setTipIdx(i => i + 1)
      setRevenue(r => parseFloat((r + tip.usd).toFixed(2)))
      setTokens(t => t + tip.tokens)
      setTipCount(c => c + 1)
      setGoalProgress(r => Math.min(parseFloat((r + tip.usd).toFixed(2)), goalTarget * 1.2))
      setFlashId(id)
      setTimeout(() => setFlashId(null), 1200)
    }
  }, [elapsed])

  // Drift viewers ±3 every 5s
  useEffect(() => {
    if (elapsed > 0 && elapsed % 5 === 0) {
      setViewers(v => Math.max(140, Math.min(260, v + (Math.random() > 0.5 ? 3 : -2))))
    }
  }, [elapsed])

  // Drift pace
  useEffect(() => {
    if (elapsed > 0 && elapsed % 15 === 0) {
      setPace(p => Math.max(140, Math.min(310, p + (Math.random() > 0.4 ? 8 : -5))))
    }
  }, [elapsed])

  // Scroll tip feed
  useEffect(() => {
    if (tipFeedRef.current) tipFeedRef.current.scrollTop = 0
  }, [tipFeed.length])

  const insight = INSIGHTS[insightIdx]
  const goalPct  = Math.min(100, Math.round((goalProgress / goalTarget) * 100))
  const goalReached = goalProgress >= goalTarget

  const fmtElapsed = (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  const paceColor = pace > METRICS_BASE.avgPace ? C.green : pace > METRICS_BASE.avgPace * 0.8 ? C.gold : C.red
  const paceLabel = pace > METRICS_BASE.avgPace ? 'Above avg' : 'At avg'

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(circle at 15% 20%,rgba(124,92,255,0.2),transparent 40%),radial-gradient(circle at 85% 75%,rgba(236,72,153,0.15),transparent 40%),${C.bg}`, fontFamily: 'Inter,system-ui,sans-serif', color: C.text }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.55;transform:scale(1.35)}}
        @keyframes flash{0%{background:rgba(16,185,129,0.25)}100%{background:transparent}}
        @keyframes insightIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes goalFill{from{width:0}to{width:var(--w)}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:rgba(124,92,255,0.25);border-radius:2px}
        .tip-row{animation:fadeUp 0.35s ease both}
        .tip-row.flash{animation:flash 1.2s ease}
      `}</style>

      {/* DEMO BANNER */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'linear-gradient(90deg,rgba(124,92,255,0.95),rgba(34,211,238,0.92))', padding: '9px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>👀 You're viewing a Live Mode demo — simulated data</span>
        <a href="/login" style={{ padding: '4px 14px', borderRadius: 20, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>Sign Up Free →</a>
        <a href="/live" style={{ padding: '4px 14px', borderRadius: 20, background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>← Back to Live</a>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 80px' }}>

        {/* SESSION HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, boxShadow: `0 0 8px ${C.green}`, animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: C.green }}>LIVE</span>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.white }}>CamCash Live Mode</div>
              <div style={{ fontSize: 12, color: C.dim }}>Chaturbate · {fmtElapsed(elapsed + 2847)} elapsed</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(124,92,255,0.1)', border: '1px solid rgba(124,92,255,0.25)', fontSize: 11, color: C.purple, fontWeight: 600 }}>DEMO MODE</div>
            <a href="/login" style={{ padding: '8px 18px', borderRadius: 10, background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`, color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Use My Data →</a>
          </div>
        </div>

        {/* ── AI COACHING CARD (main feature) ─────────────────────────── */}
        <div style={{ ...glass, borderRadius: 20, padding: '22px 26px', marginBottom: 20, border: `1px solid ${insight.color}44`, boxShadow: `0 0 40px ${insight.color}15`, transition: 'border-color 0.5s, box-shadow 0.5s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: insight.color, boxShadow: `0 0 8px ${insight.color}`, animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 10, fontWeight: 800, color: insight.color, textTransform: 'uppercase', letterSpacing: 1.5 }}>AI Coach · Do This Now</span>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', animation: insightVisible ? 'insightIn 0.4s ease' : 'none', opacity: insightVisible ? 1 : 0, transition: 'opacity 0.3s' }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: `${insight.color}18`, border: `1.5px solid ${insight.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>{insight.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: insight.color, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 }}>{insight.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.white, lineHeight: 1.55 }}>{insight.text}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
            {INSIGHTS.map((ins, i) => (
              <div key={i} style={{ width: 28, height: 4, borderRadius: 2, background: i === insightIdx ? insight.color : 'rgba(255,255,255,0.08)', transition: 'background 0.3s', boxShadow: i === insightIdx ? `0 0 6px ${insight.color}` : 'none' }} />
            ))}
          </div>
        </div>

        {/* ── 4-METRIC GRID ─────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Session Revenue', value: `$${revenue.toFixed(2)}`, sub: `${tipCount} tips`, icon: '💰', color: C.green },
            { label: 'Tokens',          value: tokens.toLocaleString(), sub: `~$${(tokens * 0.05).toFixed(0)} value`, icon: '🪙', color: C.gold },
            { label: 'Viewers',         value: viewers.toString(), sub: `${Math.max(0, viewers - 180)} from last hr`, icon: '👁', color: C.cyan },
            { label: '$/hr Pace',       value: `$${pace}`, sub: paceLabel, icon: '📈', color: paceColor },
          ].map(({ label, value, sub, icon, color }, i) => (
            <div key={label} style={{ ...glass, borderRadius: 14, padding: '16px 16px', animation: `fadeUp 0.3s ease ${i * 0.06}s both` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>{label}</span>
                <span style={{ fontSize: 16 }}>{icon}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: 11, color: C.dim }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ── GOAL TRACKER + TIP FEED ───────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

          {/* Goal tracker */}
          <div style={{ ...glass, borderRadius: 18, padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>🎯 Session Goal</div>
              {goalReached && <div style={{ fontSize: 11, fontWeight: 700, color: C.green, padding: '3px 10px', borderRadius: 20, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>✓ Reached!</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: goalReached ? C.green : C.white }}>${goalProgress.toFixed(0)}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.dim, alignSelf: 'flex-end' }}>/ ${goalTarget}</span>
            </div>
            <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ height: '100%', width: `${goalPct}%`, borderRadius: 5, background: goalReached ? `linear-gradient(90deg, ${C.green}, #34d399)` : `linear-gradient(90deg, ${C.purple}, ${C.pink})`, boxShadow: `0 0 12px ${goalReached ? C.green : C.purple}60`, transition: 'width 1.5s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.dim }}>
              <span>{goalPct}% complete</span>
              <span>${(goalTarget - goalProgress).toFixed(0) > 0 ? `$${(goalTarget - goalProgress).toFixed(0)} to go` : 'Goal exceeded!'}</span>
            </div>

            {/* Fan intelligence */}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 11, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, marginBottom: 10 }}>Fan Intelligence</div>
              {[
                { user: 'diamondkingx', status: 'In room · likely to tip again', risk: 'Low', lifetime: '$165', color: C.green },
                { user: 'kingwhale99',  status: 'Tipped 6 min ago · warm',       risk: 'Low', lifetime: '$90',  color: C.cyan },
                { user: 'toptipper88',  status: '14 days since last tip · at risk', risk: 'Medium', lifetime: '$58', color: C.gold },
              ].map(({ user, status, lifetime, color }, i) => (
                <div key={user} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color, flexShrink: 0 }}>
                    {user[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.white }}>{user}</div>
                    <div style={{ fontSize: 11, color: C.dim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{status}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>{lifetime}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Live tip feed */}
          <div style={{ ...glass, borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, boxShadow: `0 0 6px ${C.green}`, animation: 'pulse 2s infinite' }} />
              <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>Live Tip Feed</div>
            </div>
            <div ref={tipFeedRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 380 }}>
              {tipFeed.length === 0 ? (
                <div style={{ fontSize: 13, color: C.dim, textAlign: 'center', padding: '40px 0' }}>Waiting for tips…</div>
              ) : tipFeed.map((t, i) => (
                <div key={t.id} className={`tip-row${t.id === flashId ? ' flash' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: t.id === flashId ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.025)', border: `1px solid ${t.id === flashId ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.05)'}`, transition: 'background 0.5s, border-color 0.5s', animationDelay: `${i * 0.02}s` }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, rgba(124,92,255,0.2), rgba(236,72,153,0.15))', border: '1px solid rgba(124,92,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: C.purple, flexShrink: 0 }}>
                    {t.username[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{t.username}</span>
                    {t.note && <span style={{ fontSize: 11, color: C.dim, marginLeft: 6 }}>{t.note}</span>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: C.green }}>${t.usd.toFixed(2)}</div>
                    <div style={{ fontSize: 10, color: C.dim }}>{t.tokens} tokens</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── PLATFORM + PACE STRIP ────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
          {[
            { label: 'Platform', value: 'Chaturbate', sub: 'Primary · $1,211/hr avg', icon: '🎬', color: C.cyan },
            { label: 'Top Fan Today', value: METRICS_BASE.topFan, sub: `$${METRICS_BASE.topFanUSD} this session`, icon: '👑', color: C.gold },
            { label: 'Session Health', value: pace >= METRICS_BASE.avgPace * 1.1 ? 'Strong 🔥' : 'On Track', sub: `${((pace / METRICS_BASE.avgPace - 1) * 100).toFixed(0)}% vs your average`, icon: '📊', color: pace >= METRICS_BASE.avgPace ? C.green : C.gold },
          ].map(({ label, value, sub, icon, color }) => (
            <div key={label} style={{ ...glass, borderRadius: 14, padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 22 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 10, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color, marginTop: 2 }}>{value}</div>
                <div style={{ fontSize: 11, color: C.dim }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── CTA SECTION ──────────────────────────────────────────────── */}
        <div style={{ background: 'linear-gradient(135deg, rgba(124,92,255,0.12), rgba(236,72,153,0.08))', border: '1px solid rgba(124,92,255,0.22)', borderRadius: 22, padding: '40px 44px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.purple, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14 }}>Ready for the Real Thing?</div>
          <h2 style={{ fontSize: 'clamp(22px,3.5vw,34px)', fontWeight: 900, color: C.white, marginBottom: 14, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Live coaching with<br /><span style={{ background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>your actual tip data</span>
          </h2>
          <p style={{ fontSize: 15, color: C.muted, marginBottom: 28, maxWidth: 500, margin: '0 auto 28px', lineHeight: 1.7 }}>
            Connect the CamCash browser extension and this dashboard updates live as tokens come in — real AI coaching based on your real fans, your real patterns, your real peak hours.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            <a href="/login" style={{ padding: '14px 32px', borderRadius: 12, background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`, color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none', boxShadow: `0 0 28px rgba(124,92,255,0.4)` }}>
              Start Free — Use My Data →
            </a>
            <a href="/live" style={{ padding: '14px 32px', borderRadius: 12, background: 'transparent', border: `1px solid rgba(255,255,255,0.1)`, color: C.muted, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
              ← Back to Live Page
            </a>
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['Real-time AI coaching','Fan intelligence live','Peak hour alerts','Goal tracking','Multi-platform support','Free to start'].map(t => (
              <span key={t} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: C.dim }}>✓ {t}</span>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div style={{ marginTop: 60 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: C.white, marginBottom: 8 }}>How CamCash Live Mode Works</h3>
            <p style={{ fontSize: 14, color: C.muted }}>Three steps from zero to real-time coaching</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { step: '01', icon: '🔌', title: 'Install the extension', body: 'Add the CamCash Chrome extension. It runs invisibly in your browser and captures tip events directly from your streaming platform.' },
              { step: '02', icon: '🔴', title: 'Go live on your platform', body: 'Start streaming on Chaturbate, BongaCams, or MyFreeCams. The extension automatically detects your session and begins capturing.' },
              { step: '03', icon: '⚡', title: 'Get coached in real time', body: 'CamCash analyzes every tip as it happens — who tipped, how fast, who\'s in the room — and gives you specific actions to take right now.' },
            ].map(({ step, icon, title, body }) => (
              <div key={step} style={{ ...glass, borderRadius: 16, padding: '22px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{icon}</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.purple, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Step {step}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.white, marginBottom: 8 }}>{title}</div>
                <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.65 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Related links */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 11, color: C.dim, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 12 }}>Related</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              ['/live','Live Mode'],
              ['/demo','Full Dashboard Demo'],
              ['/guides/cam-model-room-title-generator','Title Generator'],
              ['/blog/how-to-make-more-money-on-chaturbate','Make More on Chaturbate'],
              ['/blog/how-to-build-loyal-fans','Build Loyal Fans'],
              ['/tools/cam-model-name-generator','Name Generator'],
            ].map(([href,label]) => (
              <a key={href} href={href} style={{ fontSize: 13, padding: '6px 14px', borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: C.cyan, textDecoration: 'none' }}>→ {label}</a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
