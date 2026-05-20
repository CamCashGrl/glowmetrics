'use client'

import { useState, useEffect, useRef } from 'react'
import {
  CSVImportSection,
  FanProfilesSection,
  FanReEngagementSection,
  RoomTitleSection,
  ComparisonSection,
  FinalCTASection,
} from './sections'

// ─── Color constants ──────────────────────────────────────────────────────────
const C = {
  bg:           '#040812',
  card:         '#0d1424',
  purple:       '#a855f7',
  pink:         '#ec4899',
  cyan:         '#22d3ee',
  green:        '#10b981',
  gold:         '#f59e0b',
  white:        '#f1f5f9',
  muted:        '#94a3b8',
  dim:          '#475569',
  red:          '#ef4444',
  cardBorder:   'rgba(168,85,247,0.18)',
  cardBorderHot:'rgba(168,85,247,0.42)',
}

// ─── Fake data ────────────────────────────────────────────────────────────────
const AI_INSIGHTS = [
  { icon: '🎯', text: 'High-conversion viewer detected — xDarkMatter3 has tipped 150+ tokens in 3 of your last 4 sessions. Make eye contact.', confidence: 94 },
  { icon: '📈', text: 'Viewer retention spiked 31% during your last 4 minutes of direct conversation. Your audience responds to intimacy cues.', confidence: 89 },
  { icon: '💰', text: 'Tip velocity is 2.4× your session average right now. Room momentum is building — stay in this energy.', confidence: 97 },
  { icon: '🐋', text: "PurpleRain99 hasn't tipped in 22 minutes. A personal shoutout converts 80% of the time for this viewer profile.", confidence: 82 },
  { icon: '⏱️', text: 'Engagement historically drops in minutes 35–45 of your sessions. Consider a goal announcement or chat interaction spike now.', confidence: 91 },
  { icon: '🔥', text: '3 repeat high-value viewers entered in the last 90 seconds. This is your highest-revenue viewer cluster pattern.', confidence: 96 },
]

const TIP_POOL = [
  { user: 'xDarkMatter3',   tokens: 150,  note: 'you look amazing tonight 🔥' },
  { user: 'PurpleRain99',   tokens: 500,  note: '' },
  { user: 'nightcrawler_k', tokens: 25,   note: '' },
  { user: 'euro_titan88',   tokens: 200,  note: 'keep going 💜' },
  { user: 'vaultmaster',    tokens: 75,   note: '' },
  { user: 'shadow_wolf_x',  tokens: 50,   note: 'so good' },
  { user: 'kingwolf99',     tokens: 1000, note: '💜💜💜' },
  { user: 'midnightfan',    tokens: 30,   note: '' },
  { user: 'redstar_tx',     tokens: 100,  note: 'stunning' },
  { user: 'ghosttip42',     tokens: 25,   note: '' },
]

const INITIAL_TIPS = [
  { id: 1000, user: 'kingwolf99',     tokens: 1000, note: '💜💜💜',                          isNew: false },
  { id: 1001, user: 'euro_titan88',   tokens: 200,  note: 'keep going 💜',                   isNew: false },
  { id: 1002, user: 'xDarkMatter3',   tokens: 150,  note: 'you look amazing tonight 🔥',     isNew: false },
  { id: 1003, user: 'vaultmaster',    tokens: 75,   note: '',                                isNew: false },
  { id: 1004, user: 'shadow_wolf_x',  tokens: 50,   note: 'so good',                         isNew: false },
  { id: 1005, user: 'nightcrawler_k', tokens: 25,   note: '',                                isNew: false },
]

const MOMENTUM_CYCLE = ['Rising 🚀', 'Hot 🔥', 'Rising 🚀', 'Stable ⚡']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function tokensToUSD(tokens) {
  const usd = tokens * 0.05
  return usd >= 10 ? `$${usd.toFixed(0)}` : `$${usd.toFixed(2)}`
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}

// ─── StickyBar ────────────────────────────────────────────────────────────────
function StickyBar() {
  return (
    <div style={{
      position:       'fixed',
      top:            0,
      left:           0,
      right:          0,
      zIndex:         1000,
      height:         '56px',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        '0 20px',
      background:     'rgba(4,8,18,0.92)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom:   '1px solid rgba(168,85,247,0.2)',
    }}>
      <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '20px' }}>💜</span>
        <span style={{
          fontWeight:           700,
          fontSize:             '17px',
          background:           `linear-gradient(90deg, ${C.purple}, ${C.pink})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor:  'transparent',
          backgroundClip:       'text',
          letterSpacing:        '-0.3px',
        }}>CamCash</span>
      </a>

      <a href="/signup" style={{
        display:        'inline-flex',
        alignItems:     'center',
        gap:            '4px',
        padding:        '8px 18px',
        borderRadius:   '8px',
        background:     `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
        color:          '#fff',
        fontWeight:     700,
        fontSize:       '13px',
        textDecoration: 'none',
        letterSpacing:  '0.2px',
        whiteSpace:     'nowrap',
        boxShadow:      `0 0 16px rgba(168,85,247,0.35)`,
        transition:     'opacity 0.2s',
      }}>
        Create Free Account →
      </a>
    </div>
  )
}

// ─── HeroSection ─────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section style={{
      paddingTop: '56px',
      position:   'relative',
      overflow:   'hidden',
      textAlign:  'center',
      padding:    '120px 20px 80px',
    }}>
      <div style={{
        position:      'absolute',
        inset:         0,
        background:    'radial-gradient(ellipse 70% 55% at 50% 0%, rgba(168,85,247,0.18) 0%, rgba(4,8,18,0) 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', maxWidth: '760px', margin: '0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <PulseDot color={C.purple} />
          <span style={{
            fontSize:      '11px',
            fontWeight:    800,
            letterSpacing: '2.5px',
            color:         C.purple,
            textTransform: 'uppercase',
          }}>Free · No Signup Needed</span>
        </div>

        <h1 style={{
          fontSize:             'clamp(32px, 6vw, 58px)',
          fontWeight:           800,
          lineHeight:           1.1,
          margin:               '0 0 22px',
          background:           `linear-gradient(135deg, ${C.purple} 0%, ${C.pink} 60%, #f97316 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor:  'transparent',
          backgroundClip:       'text',
          letterSpacing:        '-1px',
        }}>
          See your stream analytics<br />come alive
        </h1>

        <p style={{
          fontSize:   'clamp(15px, 2vw, 18px)',
          color:      C.muted,
          lineHeight: 1.65,
          margin:     '0 auto 36px',
          maxWidth:   '600px',
        }}>
          CamCash tracks your tips, viewers, and engagement in real time — giving you AI coaching while you're live. Try the demo below, free.
        </p>

        <div style={{
          display:        'flex',
          flexWrap:       'wrap',
          gap:            '14px',
          justifyContent: 'center',
          marginBottom:   '32px',
        }}>
          <a href="#live-demo" style={{
            display:        'inline-flex',
            alignItems:     'center',
            gap:            '6px',
            padding:        '14px 28px',
            borderRadius:   '10px',
            background:     `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
            color:          '#fff',
            fontWeight:     700,
            fontSize:       '15px',
            textDecoration: 'none',
            boxShadow:      `0 0 24px rgba(168,85,247,0.45)`,
          }}>
            Try the Live Demo ↓
          </a>
          <a href="/signup" style={{
            display:        'inline-flex',
            alignItems:     'center',
            gap:            '6px',
            padding:        '14px 28px',
            borderRadius:   '10px',
            background:     'transparent',
            color:          C.white,
            fontWeight:     700,
            fontSize:       '15px',
            textDecoration: 'none',
            border:         `1.5px solid rgba(168,85,247,0.55)`,
          }}>
            Create Free Account →
          </a>
        </div>

        <div style={{
          display:        'flex',
          flexWrap:       'wrap',
          gap:            '8px',
          justifyContent: 'center',
          alignItems:     'center',
        }}>
          <span style={{ fontSize: '13px', color: C.dim }}>Works on:</span>
          {['Chaturbate', 'BongaCams', 'MyFreeCams', 'Stripchat'].map((p) => (
            <span key={p} style={{
              padding:      '4px 12px',
              borderRadius: '20px',
              fontSize:     '12px',
              fontWeight:   600,
              color:        C.muted,
              background:   'rgba(168,85,247,0.08)',
              border:       '1px solid rgba(168,85,247,0.18)',
            }}>{p}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── PulseDot ─────────────────────────────────────────────────────────────────
function PulseDot({ color = C.red, size = 8 }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const id = setInterval(() => setVisible((v) => !v), 900)
    return () => clearInterval(id)
  }, [])
  return (
    <span style={{
      display:      'inline-block',
      width:        size,
      height:       size,
      borderRadius: '50%',
      background:   color,
      boxShadow:    `0 0 ${size + 2}px ${color}`,
      opacity:      visible ? 1 : 0.25,
      transition:   'opacity 0.4s',
      flexShrink:   0,
    }} />
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, change }) {
  return (
    <div style={{
      flex:          '1 1 130px',
      background:    C.card,
      border:        `1px solid ${C.cardBorder}`,
      borderRadius:  '10px',
      padding:       '14px 16px',
      display:       'flex',
      flexDirection: 'column',
      gap:           '4px',
    }}>
      <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', color: C.dim, textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{
        fontSize:   'clamp(22px, 4vw, 28px)',
        fontWeight: 800,
        color:      color,
        lineHeight: 1,
        transition: 'color 0.4s',
      }}>
        {value}
      </span>
      {change && (
        <span style={{ fontSize: '11px', color: C.muted }}>{change}</span>
      )}
    </div>
  )
}

// ─── TipRow ──────────────────────────────────────────────────────────────────
function TipRow({ tip }) {
  const [highlight, setHighlight] = useState(tip.isNew)
  useEffect(() => {
    if (!tip.isNew) return
    const id = setTimeout(() => setHighlight(false), 1600)
    return () => clearTimeout(id)
  }, [tip.isNew])

  const isWhale = tip.tokens > 200

  return (
    <div style={{
      display:      'flex',
      alignItems:   'flex-start',
      gap:          '8px',
      padding:      '9px 10px',
      borderRadius: '8px',
      background:   highlight ? 'rgba(168,85,247,0.13)' : 'transparent',
      border:       highlight ? '1px solid rgba(168,85,247,0.3)' : '1px solid transparent',
      transition:   'background 0.6s, border-color 0.6s',
      marginBottom: '3px',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 700, fontSize: '13px', color: C.purple, marginRight: '6px' }}>{tip.user}</span>
        {isWhale && (
          <span style={{
            fontSize:     '10px',
            fontWeight:   800,
            color:        C.gold,
            background:   'rgba(245,158,11,0.12)',
            border:       '1px solid rgba(245,158,11,0.3)',
            borderRadius: '4px',
            padding:      '1px 5px',
          }}>WHALE 🐋</span>
        )}
        {tip.note ? (
          <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px', lineHeight: 1.4 }}>{tip.note}</div>
        ) : null}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: '14px', color: C.cyan }}>{tip.tokens} tk</div>
        <div style={{ fontSize: '11px', color: C.green }}>{tokensToUSD(tip.tokens)}</div>
      </div>
    </div>
  )
}

// ─── AICoachCard ─────────────────────────────────────────────────────────────
function AICoachCard({ insight, visible }) {
  return (
    <div style={{
      background:   'rgba(168,85,247,0.06)',
      border:       `1px solid rgba(168,85,247,0.25)`,
      borderRadius: '10px',
      padding:      '14px',
      opacity:      visible ? 1 : 0,
      transform:    visible ? 'translateY(0)' : 'translateY(6px)',
      transition:   'opacity 0.55s, transform 0.55s',
      flex:         1,
    }}>
      <div style={{ fontSize: '28px', marginBottom: '10px' }}>{insight.icon}</div>
      <p style={{ fontSize: '13px', color: C.white, lineHeight: 1.65, margin: '0 0 14px' }}>{insight.text}</p>

      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span style={{ fontSize: '10px', color: C.dim, letterSpacing: '1px', textTransform: 'uppercase' }}>Confidence</span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: C.purple }}>{insight.confidence}%</span>
        </div>
        <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(168,85,247,0.15)', overflow: 'hidden' }}>
          <div style={{
            height:       '100%',
            width:        `${insight.confidence}%`,
            borderRadius: '2px',
            background:   `linear-gradient(90deg, ${C.purple}, ${C.pink})`,
            transition:   'width 0.8s ease',
          }} />
        </div>
      </div>

      <a href="/signup" style={{
        fontSize:       '12px',
        fontWeight:     700,
        color:          C.purple,
        textDecoration: 'none',
        display:        'flex',
        alignItems:     'center',
        gap:            '4px',
      }}>
        Unlock persistent AI memory →
      </a>
    </div>
  )
}

// ─── LiveDashboardSection ─────────────────────────────────────────────────────
function LiveDashboardSection() {
  const [viewers,        setViewers]        = useState(89)
  const [engagement,     setEngagement]     = useState(74)
  const [tipVelocity,    setTipVelocity]    = useState(18)
  const [momentumIdx,    setMomentumIdx]    = useState(0)
  const [sessionSecs,    setSessionSecs]    = useState(2847)
  const [recentTips,     setRecentTips]     = useState(INITIAL_TIPS)
  const [activeInsight,  setActiveInsight]  = useState(0)
  const [insightVisible, setInsightVisible] = useState(true)
  const [sessionUSD,     setSessionUSD]     = useState(42.50)
  const [goalTokens,     setGoalTokens]     = useState(340)
  const goalTarget = 500

  const tipIdRef    = useRef(2000)
  const tipTimerRef = useRef(null)

  // Session clock
  useEffect(() => {
    const id = setInterval(() => setSessionSecs((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Viewers — every 4s
  useEffect(() => {
    const id = setInterval(() => {
      setViewers((v) => clamp(v + Math.round((Math.random() - 0.45) * 24), 40, 200))
    }, 4000)
    return () => clearInterval(id)
  }, [])

  // Engagement — every 3s
  useEffect(() => {
    const id = setInterval(() => {
      setEngagement((v) => clamp(v + Math.round((Math.random() - 0.48) * 8), 50, 99))
    }, 3000)
    return () => clearInterval(id)
  }, [])

  // Tip velocity — every 5s
  useEffect(() => {
    const id = setInterval(() => {
      setTipVelocity((v) => clamp(v + Math.round((Math.random() - 0.45) * 10), 5, 60))
    }, 5000)
    return () => clearInterval(id)
  }, [])

  // Momentum — every 12s
  useEffect(() => {
    const id = setInterval(() => {
      setMomentumIdx((i) => (i + 1) % MOMENTUM_CYCLE.length)
    }, 12000)
    return () => clearInterval(id)
  }, [])

  // AI insight cycle — every 9s with fade
  useEffect(() => {
    const id = setInterval(() => {
      setInsightVisible(false)
      setTimeout(() => {
        setActiveInsight((i) => (i + 1) % AI_INSIGHTS.length)
        setInsightVisible(true)
      }, 500)
    }, 9000)
    return () => clearInterval(id)
  }, [])

  // Tip feed — random 8–12s interval, also increments earnings + goal
  useEffect(() => {
    function scheduleNext() {
      const delay = 8000 + Math.random() * 4000
      tipTimerRef.current = setTimeout(() => {
        const pool   = TIP_POOL[Math.floor(Math.random() * TIP_POOL.length)]
        const newTip = { ...pool, id: tipIdRef.current++, isNew: true }
        setRecentTips((prev) => [newTip, ...prev].slice(0, 8))
        setSessionUSD((prev) => parseFloat((prev + pool.tokens * 0.05).toFixed(2)))
        setGoalTokens((prev) => Math.min(goalTarget, prev + pool.tokens))
        scheduleNext()
      }, delay)
    }
    scheduleNext()
    return () => clearTimeout(tipTimerRef.current)
  }, [])

  const momentum      = MOMENTUM_CYCLE[momentumIdx]
  const goalPct       = Math.min(100, Math.round((goalTokens / goalTarget) * 100))
  const goalRemaining = Math.max(0, goalTarget - goalTokens)

  return (
    <section id="live-demo" style={{ padding: '60px 20px 80px', background: C.bg }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* Section title */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          gap:            '10px',
          marginBottom:   '28px',
          justifyContent: 'center',
        }}>
          <PulseDot color={C.red} size={9} />
          <h2 style={{
            fontSize:      'clamp(20px, 3.5vw, 26px)',
            fontWeight:    800,
            color:         C.white,
            margin:        0,
            letterSpacing: '-0.4px',
          }}>Live Session Demo</h2>
        </div>

        {/* Main dashboard card */}
        <div style={{
          background:   C.card,
          borderRadius: '16px',
          border:       `1px solid rgba(168,85,247,0.35)`,
          boxShadow:    `0 0 48px rgba(168,85,247,0.12), 0 2px 40px rgba(0,0,0,0.6)`,
          overflow:     'hidden',
        }}>

          {/* Stream header bar */}
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '12px 18px',
            background:     'rgba(0,0,0,0.35)',
            borderBottom:   `1px solid rgba(168,85,247,0.15)`,
            flexWrap:       'wrap',
            gap:            '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PulseDot color={C.red} size={8} />
                <span style={{ fontSize: '11px', fontWeight: 800, color: C.red, letterSpacing: '1.5px' }}>LIVE</span>
              </div>
              <span style={{ fontSize: '13px', color: C.muted }}>
                Chaturbate · <span style={{ color: C.white, fontWeight: 600 }}>sweetpetal_live</span>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{
                fontVariantNumeric: 'tabular-nums',
                fontWeight:         700,
                fontSize:           '14px',
                color:              C.cyan,
                fontFamily:         'monospace',
              }}>
                {formatTime(sessionSecs)} ↑
              </span>
              <span style={{
                fontSize:     '12px',
                fontWeight:   700,
                color:        C.gold,
                background:   'rgba(245,158,11,0.1)',
                border:       '1px solid rgba(245,158,11,0.3)',
                borderRadius: '6px',
                padding:      '3px 8px',
              }}>
                {momentum}
              </span>
            </div>
          </div>

          {/* Stat cards row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '14px 14px 0' }}>
            <StatCard
              label="Viewers"
              value={viewers}
              color={C.cyan}
              change={`${viewers > 89 ? '↑' : '↓'} vs session avg`}
            />
            <StatCard
              label="Engagement"
              value={`${engagement}%`}
              color={C.green}
              change="Chat + reactions"
            />
            <StatCard
              label="Tip Rate"
              value={`${tipVelocity} tk/m`}
              color={C.gold}
              change="Tokens per minute"
            />
            <StatCard
              label="Session Earnings"
              value={`$${sessionUSD.toFixed(2)}`}
              color={C.green}
              change="This session"
            />
          </div>

          {/* Goal Progress bar */}
          <div style={{ padding: '12px 14px 0' }}>
            <div style={{
              background:   'rgba(168,85,247,0.06)',
              border:       '1px solid rgba(168,85,247,0.2)',
              borderRadius: '10px',
              padding:      '12px 14px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: C.dim, letterSpacing: '1.2px', textTransform: 'uppercase' }}>
                  Token Goal
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: C.purple }}>
                  {goalTokens} / {goalTarget} tk
                  {goalRemaining > 0
                    ? <span style={{ color: C.muted, fontWeight: 400 }}> · {goalRemaining} remaining</span>
                    : <span style={{ color: C.green }}> · Goal reached! 🎉</span>
                  }
                </span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(168,85,247,0.15)', overflow: 'hidden' }}>
                <div style={{
                  height:       '100%',
                  width:        `${goalPct}%`,
                  borderRadius: '4px',
                  background:   goalPct >= 100
                    ? `linear-gradient(90deg, ${C.green}, ${C.cyan})`
                    : `linear-gradient(90deg, ${C.purple}, ${C.pink})`,
                  transition:   'width 0.7s ease',
                }} />
              </div>
              <div style={{ fontSize: '10px', color: C.dim, marginTop: '5px' }}>{goalPct}% complete</div>
            </div>
          </div>

          {/* Tips + AI Coach columns */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0', padding: '14px' }}>

            {/* Recent Tips */}
            <div style={{
              flex:         '1 1 280px',
              paddingRight: '12px',
              borderRight:  '1px solid rgba(168,85,247,0.1)',
            }}>
              <div style={{
                fontSize:      '11px',
                fontWeight:    800,
                letterSpacing: '1.5px',
                color:         C.dim,
                textTransform: 'uppercase',
                marginBottom:  '10px',
              }}>Recent Tips</div>
              <div>
                {recentTips.map((tip) => (
                  <TipRow key={tip.id} tip={tip} />
                ))}
              </div>
            </div>

            {/* AI Coach */}
            <div style={{
              flex:          '1 1 240px',
              paddingLeft:   '12px',
              display:       'flex',
              flexDirection: 'column',
            }}>
              <div style={{
                fontSize:      '11px',
                fontWeight:    800,
                letterSpacing: '1.5px',
                color:         C.dim,
                textTransform: 'uppercase',
                marginBottom:  '10px',
              }}>AI Coach</div>
              <AICoachCard insight={AI_INSIGHTS[activeInsight]} visible={insightVisible} />
            </div>
          </div>
        </div>

        <p style={{
          textAlign:     'center',
          fontSize:      '11px',
          color:         C.dim,
          marginTop:     '14px',
          letterSpacing: '0.3px',
        }}>
          Demo data · Simulates real extension behavior
        </p>
      </div>
    </section>
  )
}

// ─── DemoClient (main export) ─────────────────────────────────────────────────
export default function DemoClient() {
  return (
    <div style={{ background: '#040812', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <StickyBar />
      <HeroSection />
      <LiveDashboardSection />
      <CSVImportSection />
      <FanProfilesSection />
      <FanReEngagementSection />
      <RoomTitleSection />
      <ComparisonSection />
      <FinalCTASection />
    </div>
  )
}
