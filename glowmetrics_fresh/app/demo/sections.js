'use client'

import { useState } from 'react'
import SiteFooter from '../components/SiteFooter'

// ─── Shared color tokens ──────────────────────────────────────────────────────
const C = {
  bg:        '#040812',
  bg2:       '#060e1e',
  card:      '#0d1424',
  purple:    '#a855f7',
  pink:      '#ec4899',
  cyan:      '#22d3ee',
  green:     '#10b981',
  gold:      '#f59e0b',
  red:       '#ef4444',
  white:     '#f1f5f9',
  muted:     '#94a3b8',
  dim:       '#475569',
  border:    'rgba(168,85,247,0.18)',
}

// ─── CSVImportSection ─────────────────────────────────────────────────────────
export function CSVImportSection() {
  const [activeTab, setActiveTab] = useState('Chaturbate')

  const platforms = ['Chaturbate', 'BongaCams', 'MyFreeCams']

  const steps = {
    Chaturbate: [
      'Log into Chaturbate.com',
      'Click your username → "My Profile"',
      'Select "Stats & Tokens" in the left sidebar',
      'Scroll to "Token History" → click "Export to CSV"',
      'Upload the downloaded file to CamCash — done',
    ],
    BongaCams: [
      'Log into BongaCams.com',
      'Click your username → "Statistics"',
      'Click "Referral Statistics" or "Payouts" in the menu',
      'Find the "Export CSV" or "Download Report" button',
      'Upload to CamCash — your full history loads instantly',
    ],
    MyFreeCams: [
      'Log into MyFreeCams.com',
      'Click "Account" → "Tip & Token History"',
      'Set your date range (go back as far as possible)',
      'Click "Export" or "Download CSV"',
      'Upload to CamCash — fan rankings generate automatically',
    ],
  }

  return (
    <section style={{
      padding:      '80px 20px',
      background:   C.bg2,
      borderTop:    '1px solid rgba(168,85,247,0.1)',
      borderBottom: '1px solid rgba(168,85,247,0.1)',
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{
            fontSize:      'clamp(24px, 4vw, 36px)',
            fontWeight:    800,
            color:         C.white,
            margin:        '0 0 14px',
            letterSpacing: '-0.02em',
          }}>
            Two ways to get your data in
          </h2>
          <p style={{
            fontSize:   '16px',
            color:      C.muted,
            maxWidth:   '520px',
            margin:     '0 auto',
            lineHeight: 1.6,
          }}>
            Use the extension for live tracking, or upload your CSV for historical analytics.
          </p>
        </div>

        {/* Two-column cards */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap:                 '20px',
          marginBottom:        '48px',
        }}>
          {/* Extension card */}
          <div style={{
            background:   C.card,
            border:       '1px solid rgba(34,211,238,0.25)',
            borderRadius: '16px',
            padding:      '28px 24px',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '14px' }}>🧩</div>
            <div style={{
              fontSize:      '10px',
              fontWeight:    800,
              letterSpacing: '1.5px',
              color:         C.cyan,
              textTransform: 'uppercase',
              marginBottom:  '8px',
            }}>While you stream</div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: C.white, margin: '0 0 14px' }}>
              Live Extension
            </h3>
            <ol style={{ margin: '0 0 22px', padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {['Install Chrome extension', 'Go live on your platform', 'Auto-captures tips in real time', 'Syncs to your dashboard'].map((step, i) => (
                <li key={i} style={{ fontSize: '14px', color: C.muted, lineHeight: 1.5 }}>{step}</li>
              ))}
            </ol>
            <a href="/extension" style={{
              display:        'inline-flex',
              alignItems:     'center',
              gap:            '6px',
              padding:        '11px 20px',
              borderRadius:   '9px',
              background:     'rgba(34,211,238,0.08)',
              border:         '1px solid rgba(34,211,238,0.35)',
              color:          C.cyan,
              fontWeight:     700,
              fontSize:       '14px',
              textDecoration: 'none',
            }}>
              Get Extension →
            </a>
          </div>

          {/* CSV Upload card */}
          <div style={{
            background:   C.card,
            border:       '1px solid rgba(168,85,247,0.25)',
            borderRadius: '16px',
            padding:      '28px 24px',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '14px' }}>📄</div>
            <div style={{
              fontSize:      '10px',
              fontWeight:    800,
              letterSpacing: '1.5px',
              color:         C.purple,
              textTransform: 'uppercase',
              marginBottom:  '8px',
            }}>Your full history</div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: C.white, margin: '0 0 14px' }}>
              CSV Upload
            </h3>
            <p style={{ fontSize: '14px', color: C.muted, lineHeight: 1.6, margin: '0 0 22px' }}>
              Upload your CSV from Chaturbate or BongaCams to see ALL your historical data — fan rankings, peak hours, session breakdowns going back to day 1.
            </p>
            <a href="/landing" style={{
              display:        'inline-flex',
              alignItems:     'center',
              gap:            '6px',
              padding:        '11px 20px',
              borderRadius:   '9px',
              background:     'linear-gradient(135deg, #a855f7, #ec4899)',
              color:          '#fff',
              fontWeight:     700,
              fontSize:       '14px',
              textDecoration: 'none',
              boxShadow:      '0 0 20px rgba(168,85,247,0.3)',
            }}>
              Upload CSV →
            </a>
          </div>
        </div>

        {/* How-to export */}
        <div style={{
          background:   C.card,
          border:       `1px solid ${C.border}`,
          borderRadius: '16px',
          overflow:     'hidden',
        }}>
          <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.border}` }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: C.white, margin: 0 }}>
              How to export your CSV
            </h3>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '2px', padding: '12px 20px 0', borderBottom: `1px solid ${C.border}` }}>
            {platforms.map((p) => (
              <button
                key={p}
                onClick={() => setActiveTab(p)}
                style={{
                  padding:      '8px 16px',
                  borderRadius: '8px 8px 0 0',
                  border:       'none',
                  cursor:       'pointer',
                  fontSize:     '13px',
                  fontWeight:   700,
                  background:   activeTab === p ? 'rgba(168,85,247,0.15)' : 'transparent',
                  color:        activeTab === p ? C.purple : C.dim,
                  borderBottom: activeTab === p ? `2px solid ${C.purple}` : '2px solid transparent',
                  transition:   'all 0.2s',
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Step content */}
          <div style={{ padding: '20px' }}>
            <div style={{
              background:  'rgba(0,0,0,0.4)',
              border:      '1px solid rgba(168,85,247,0.15)',
              borderRadius:'10px',
              padding:     '18px 20px',
              fontFamily:  'monospace',
            }}>
              <div style={{
                display:       'flex',
                alignItems:    'center',
                gap:           '6px',
                marginBottom:  '14px',
                paddingBottom: '10px',
                borderBottom:  '1px solid rgba(168,85,247,0.12)',
              }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                <span style={{ fontSize: '11px', color: C.dim, marginLeft: '8px' }}>{activeTab} — Export Steps</span>
              </div>

              <ol style={{ margin: 0, padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {steps[activeTab].map((step, i) => (
                  <li key={i} style={{ fontSize: '13px', color: C.muted, lineHeight: 1.55 }}>
                    <span style={{ color: C.purple, fontWeight: 700 }}>{i + 1}.</span>{' '}
                    {step}
                  </li>
                ))}
              </ol>

              <div style={{
                marginTop:   '16px',
                paddingTop:  '12px',
                borderTop:   '1px solid rgba(168,85,247,0.1)',
                fontSize:    '12px',
                color:       C.dim,
                lineHeight:  1.5,
              }}>
                💡 Your data never leaves our secure servers. We don&apos;t share it with anyone.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── FanProfilesSection ───────────────────────────────────────────────────────
const FANS = [
  { rank: 1, user: 'PurpleRain99',   platform: 'Chaturbate', lifetime: 2840, tips: 196, avg: 14.50, lastTip: '2 days ago',  interval: 3.2,  risk: 'LOW',    badge: '' },
  { rank: 2, user: 'xDarkMatter3',   platform: 'Chaturbate', lifetime: 1320, tips: 151, avg: 8.75,  lastTip: '5 days ago',  interval: 4.1,  risk: 'MEDIUM', badge: '' },
  { rank: 3, user: 'euro_titan88',   platform: 'BongaCams',  lifetime: 960,  tips: 40,  avg: 24.00, lastTip: '12 days ago', interval: 8.5,  risk: 'HIGH',   badge: '🔴' },
  { rank: 4, user: 'kingwolf99',     platform: 'Chaturbate', lifetime: 750,  tips: 15,  avg: 50.00, lastTip: '1 day ago',   interval: 7.2,  risk: 'LOW',    badge: '🐋' },
  { rank: 5, user: 'shadow_wolf_x',  platform: 'Chaturbate', lifetime: 480,  tips: 64,  avg: 7.50,  lastTip: '21 days ago', interval: 9.1,  risk: 'HIGH',   badge: '🔴' },
  { rank: 6, user: 'vaultmaster',    platform: 'MyFreeCams', lifetime: 380,  tips: 50,  avg: 7.60,  lastTip: '8 days ago',  interval: 6.3,  risk: 'MEDIUM', badge: '' },
  { rank: 7, user: 'nightcrawler_k', platform: 'Chaturbate', lifetime: 240,  tips: 32,  avg: 7.50,  lastTip: '3 days ago',  interval: 4.8,  risk: 'LOW',    badge: '' },
  { rank: 8, user: 'redstar_tx',     platform: 'BongaCams',  lifetime: 195,  tips: 13,  avg: 15.00, lastTip: '14 days ago', interval: 10.2, risk: 'HIGH',   badge: '🔴' },
]

const PLATFORM_COLORS = {
  Chaturbate: { bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  color: '#f59e0b' },
  BongaCams:  { bg: 'rgba(236,72,153,0.1)',  border: 'rgba(236,72,153,0.3)',  color: '#ec4899' },
  MyFreeCams: { bg: 'rgba(34,211,238,0.1)',  border: 'rgba(34,211,238,0.3)',  color: '#22d3ee' },
  Stripchat:  { bg: 'rgba(168,85,247,0.1)',  border: 'rgba(168,85,247,0.3)',  color: '#a855f7' },
}

const RISK_STYLES = {
  LOW:    { bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)',  color: '#10b981' },
  MEDIUM: { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)',  color: '#f59e0b' },
  HIGH:   { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)',   color: '#ef4444' },
}

export function FanProfilesSection() {
  return (
    <section style={{ padding: '80px 20px', background: C.bg }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <h2 style={{
            fontSize:      'clamp(24px, 4vw, 36px)',
            fontWeight:    800,
            color:         C.white,
            margin:        '0 0 14px',
            letterSpacing: '-0.02em',
          }}>
            Fan Intelligence — Know your most valuable fans
          </h2>
          <p style={{
            fontSize:   '16px',
            color:      C.muted,
            maxWidth:   '580px',
            margin:     '0 auto',
            lineHeight: 1.6,
          }}>
            CamCash ranks every fan by lifetime spend, tracks their tipping patterns, and alerts you when they&apos;re at risk of going cold.
          </p>
        </div>

        {/* Fan table */}
        <div style={{
          background:   C.card,
          border:       `1px solid ${C.border}`,
          borderRadius: '16px',
          overflow:     'hidden',
          marginBottom: '24px',
        }}>
          {/* Table header */}
          <div style={{
            display:             'grid',
            gridTemplateColumns: '36px 1fr 100px 80px 60px 70px 90px 72px',
            gap:                 '0',
            padding:             '10px 16px',
            background:          'rgba(0,0,0,0.3)',
            borderBottom:        `1px solid ${C.border}`,
          }}>
            {['#', 'Fan', 'Platform', 'Lifetime', 'Tips', 'Avg Tip', 'Last Tip', 'Risk'].map((h) => (
              <span key={h} style={{
                fontSize:      '10px',
                fontWeight:    800,
                letterSpacing: '1.2px',
                color:         C.dim,
                textTransform: 'uppercase',
              }}>{h}</span>
            ))}
          </div>

          {FANS.map((fan, idx) => {
            const plt = PLATFORM_COLORS[fan.platform] || PLATFORM_COLORS.Chaturbate
            const rsk = RISK_STYLES[fan.risk]
            return (
              <div
                key={fan.user}
                style={{
                  display:             'grid',
                  gridTemplateColumns: '36px 1fr 100px 80px 60px 70px 90px 72px',
                  gap:                 '0',
                  padding:             '12px 16px',
                  alignItems:          'center',
                  borderBottom:        idx < FANS.length - 1 ? '1px solid rgba(168,85,247,0.07)' : 'none',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 700, color: C.dim }}>{fan.rank}</span>

                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: C.purple }}>{fan.user}</span>
                  {fan.badge && <span style={{ marginLeft: '5px', fontSize: '13px' }}>{fan.badge}</span>}
                </div>

                <span style={{
                  display:      'inline-flex',
                  alignItems:   'center',
                  padding:      '2px 8px',
                  borderRadius: '20px',
                  fontSize:     '11px',
                  fontWeight:   600,
                  background:   plt.bg,
                  border:       `1px solid ${plt.border}`,
                  color:        plt.color,
                  width:        'fit-content',
                }}>
                  {fan.platform}
                </span>

                <span style={{ fontSize: '15px', fontWeight: 800, color: C.green }}>${fan.lifetime.toLocaleString()}</span>

                <span style={{ fontSize: '13px', color: C.muted }}>{fan.tips}</span>

                <span style={{ fontSize: '13px', color: C.muted }}>${fan.avg.toFixed(2)}</span>

                <span style={{ fontSize: '12px', color: C.dim }}>{fan.lastTip}</span>

                <span style={{
                  display:      'inline-flex',
                  alignItems:   'center',
                  padding:      '3px 8px',
                  borderRadius: '20px',
                  fontSize:     '11px',
                  fontWeight:   700,
                  background:   rsk.bg,
                  border:       `1px solid ${rsk.border}`,
                  color:        rsk.color,
                  width:        'fit-content',
                }}>
                  {fan.risk}
                </span>
              </div>
            )
          })}
        </div>

        {/* Risk legend */}
        <div style={{
          display:      'flex',
          flexWrap:     'wrap',
          gap:          '16px',
          marginBottom: '28px',
          padding:      '14px 18px',
          background:   'rgba(168,85,247,0.04)',
          border:       `1px solid ${C.border}`,
          borderRadius: '10px',
        }}>
          <span style={{ fontSize: '12px', color: C.dim, fontWeight: 600 }}>Risk levels:</span>
          <span style={{ fontSize: '12px', color: C.green }}>🟢 <strong>Low</strong> = within normal interval</span>
          <span style={{ fontSize: '12px', color: C.gold }}>🟡 <strong>Medium</strong> = 25–75% overdue</span>
          <span style={{ fontSize: '12px', color: C.red }}>🔴 <strong>High</strong> = 75%+ overdue — re-engage now</span>
        </div>

        {/* Summary stats */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap:                 '12px',
          marginBottom:        '28px',
        }}>
          {[
            { label: 'Total Fan Lifetime Value', value: '$7,165', color: C.green },
            { label: 'Average Fan Value',         value: '$895',   color: C.cyan },
            { label: 'High-Risk Fans',            value: '3',      color: C.red },
            { label: 'Fans Due for Tip',          value: '2',      color: C.gold },
          ].map((stat) => (
            <div key={stat.label} style={{
              background:   C.card,
              border:       `1px solid ${C.border}`,
              borderRadius: '10px',
              padding:      '14px 16px',
              textAlign:    'center',
            }}>
              <div style={{ fontSize: '22px', fontWeight: 800, color: stat.color, marginBottom: '4px' }}>{stat.value}</div>
              <div style={{ fontSize: '11px', color: C.dim, fontWeight: 600, letterSpacing: '0.3px' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center' }}>
          <a href="/landing" style={{
            fontSize:       '14px',
            fontWeight:     600,
            color:          C.purple,
            textDecoration: 'none',
            borderBottom:   '1px solid rgba(168,85,247,0.3)',
            paddingBottom:  '2px',
          }}>
            See your fan rankings →
          </a>
        </div>
      </div>
    </section>
  )
}

// ─── FanReEngagementSection ───────────────────────────────────────────────────
const AT_RISK_FANS = [
  {
    user:      'euro_titan88',
    platform:  'BongaCams',
    lifetime:  '$960',
    daysSince: 12,
    interval:  8.5,
    overdue:   41,
    message:   "Hey! It's been a little while — I hope everything's good 💜 I'm streaming tonight at 9pm if you feel like stopping by. Your energy in the room always makes the session better 🔥",
  },
  {
    user:      'shadow_wolf_x',
    platform:  'Chaturbate',
    lifetime:  '$480',
    daysSince: 21,
    interval:  9.1,
    overdue:   131,
    message:   "Miss your vibe in the room honestly 👀 Been a minute! I'm live Thursday at 10pm — would love to see you back. Your spot's still here 💜",
  },
  {
    user:      'redstar_tx',
    platform:  'BongaCams',
    lifetime:  '$195',
    daysSince: 14,
    interval:  10.2,
    overdue:   37,
    message:   "Hey — hasn't been the same without you lately 😊 Streaming this Saturday night, hope to see you there. No pressure, just wanted to reach out 💜",
  },
]

const PLT_COLORS = {
  BongaCams:  { bg: 'rgba(236,72,153,0.1)',  border: 'rgba(236,72,153,0.3)',  color: '#ec4899' },
  Chaturbate: { bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  color: '#f59e0b' },
  MyFreeCams: { bg: 'rgba(34,211,238,0.1)',  border: 'rgba(34,211,238,0.3)',  color: '#22d3ee' },
}

function ReEngagementCard({ fan }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(fan.message).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const plt = PLT_COLORS[fan.platform] || { bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.3)', color: '#a855f7' }

  return (
    <div style={{
      background:    C.card,
      border:        '1px solid rgba(239,68,68,0.25)',
      borderRadius:  '14px',
      padding:       '22px',
      display:       'flex',
      flexDirection: 'column',
      gap:           '14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: C.purple }}>{fan.user}</span>
            <span style={{
              padding:      '2px 8px',
              borderRadius: '20px',
              fontSize:     '11px',
              fontWeight:   600,
              background:   plt.bg,
              border:       `1px solid ${plt.border}`,
              color:        plt.color,
            }}>{fan.platform}</span>
          </div>
          <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600 }}>
            🔴 High Risk · {fan.daysSince} days since last tip · Normal interval: {fan.interval} days ({fan.overdue}% overdue)
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: C.dim, marginBottom: '2px' }}>Lifetime value</div>
          <div style={{ fontSize: '17px', fontWeight: 800, color: C.green }}>{fan.lifetime}</div>
        </div>
      </div>

      <div style={{
        background:   'rgba(168,85,247,0.06)',
        border:       '1px solid rgba(168,85,247,0.2)',
        borderRadius: '10px',
        padding:      '14px 16px',
      }}>
        <div style={{
          fontSize:      '10px',
          fontWeight:    800,
          letterSpacing: '1.2px',
          color:         C.dim,
          textTransform: 'uppercase',
          marginBottom:  '8px',
        }}>Generated Message</div>
        <p style={{ fontSize: '14px', color: C.white, lineHeight: 1.65, margin: 0 }}>{fan.message}</p>
      </div>

      <button
        onClick={handleCopy}
        style={{
          alignSelf:    'flex-start',
          padding:      '9px 18px',
          borderRadius: '8px',
          border:       copied ? '1px solid rgba(16,185,129,0.5)' : '1px solid rgba(168,85,247,0.4)',
          background:   copied ? 'rgba(16,185,129,0.1)' : 'rgba(168,85,247,0.1)',
          color:        copied ? C.green : C.purple,
          fontWeight:   700,
          fontSize:     '13px',
          cursor:       'pointer',
          transition:   'all 0.2s',
        }}
      >
        {copied ? 'Copied! ✓' : 'Copy Message'}
      </button>
    </div>
  )
}

export function FanReEngagementSection() {
  return (
    <section style={{
      padding:   '80px 20px',
      background: C.bg2,
      borderTop:  '1px solid rgba(168,85,247,0.1)',
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <h2 style={{
            fontSize:      'clamp(24px, 4vw, 36px)',
            fontWeight:    800,
            color:         C.white,
            margin:        '0 0 14px',
            letterSpacing: '-0.02em',
          }}>
            Re-engagement alerts — catch fans before they go cold
          </h2>
          <p style={{
            fontSize:   '16px',
            color:      C.muted,
            maxWidth:   '560px',
            margin:     '0 auto',
            lineHeight: 1.6,
          }}>
            CamCash watches your tipping patterns and generates personalized messages when a high-value fan goes quiet.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
          {AT_RISK_FANS.map((fan) => (
            <ReEngagementCard key={fan.user} fan={fan} />
          ))}
        </div>

        <div style={{
          background:   'rgba(168,85,247,0.06)',
          border:       '1px solid rgba(168,85,247,0.2)',
          borderRadius: '12px',
          padding:      '16px 20px',
          marginBottom: '24px',
          fontSize:     '13px',
          color:        C.muted,
          lineHeight:   1.6,
        }}>
          <span style={{ color: C.purple, fontWeight: 700 }}>💡 </span>
          Messages are generated based on each fan&apos;s tipping history, platform, and lifetime value — never generic.
        </div>

        <div style={{ textAlign: 'center' }}>
          <a href="/landing" style={{
            fontSize:       '14px',
            fontWeight:     600,
            color:          C.purple,
            textDecoration: 'none',
            borderBottom:   '1px solid rgba(168,85,247,0.3)',
            paddingBottom:  '2px',
          }}>
            Set up re-engagement alerts →
          </a>
        </div>
      </div>
    </section>
  )
}

// ─── RoomTitleSection ─────────────────────────────────────────────────────────
const TITLE_SETS = {
  'Sweet|Token Goal|Tonight Only': [
    "💕 soft & sweet | 🎯 goal: 300 tokens for full show | tip to get closer 🌸 (tonight only)",
    "gentle vibes ✨ | hit 500 = special reward 🎀 | tip menu active | tonight only 💜",
    "🍭 cozy & yours tonight | 200 tk goal | every tip brings us closer 💕",
  ],
  'Dominant|Token Goal|Tonight Only': [
    "🔥 I'm in control tonight | 500 tk goal = you decide what happens 😈 | tip menu open",
    "dominant energy 👑 | hit 300 = I lose control | tonight ONLY 🔥 | tip to control my Lush",
    "💋 who's brave enough | 400 tk goal | consequences for winners 😈 | limited tonight",
  ],
  'Playful|Interactive Toy|Tonight Only': [
    "🎮 tip to control my Lush | 500 goal = full takeover 😈 | toy is ON | tonight only",
    "interactive & dangerous 🔥 | 300 tk goal | tip menu + Lush active | don't be shy 👀",
    "💜 chaos mode | tip = I feel it | 400 tk goal tonight | first 3 tippers get priority",
  ],
  'Chill|Countdown|Limited Spots': [
    "✨ chill vibes | 🕐 counting down to something special | limited spots in my DMs 💜",
    "late night energy 🌙 | 200 tk countdown | 3 spots left for tonight's special 💕",
    "mellow & mysterious 🌙 | countdown active | limited access tonight ✨ | tip to join",
  ],
}

const VIBE_OPTIONS    = ['Sweet 🍭', 'Dominant 🔥', 'Playful 😈', 'Chill 🌙']
const GOAL_OPTIONS    = ['Token Goal', 'Tip Menu', 'Interactive Toy', 'Countdown']
const URGENCY_OPTIONS = ['Tonight Only', 'Limited Spots', 'Almost There', 'Just Started']

function resolveTitles(vibe, goal, urgency) {
  const key = `${vibe}|${goal}|${urgency}`
  if (TITLE_SETS[key]) return TITLE_SETS[key]
  const fallback = Object.keys(TITLE_SETS).find((k) => k.startsWith(vibe))
  return fallback ? TITLE_SETS[fallback] : TITLE_SETS['Playful|Interactive Toy|Tonight Only']
}

function TitleCopyRow({ title }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(title).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{
      display:      'flex',
      alignItems:   'flex-start',
      gap:          '12px',
      padding:      '13px 16px',
      background:   'rgba(168,85,247,0.04)',
      border:       '1px solid rgba(168,85,247,0.15)',
      borderRadius: '10px',
      marginBottom: '10px',
    }}>
      <p style={{ flex: 1, fontSize: '14px', color: C.white, lineHeight: 1.55, margin: 0 }}>{title}</p>
      <button
        onClick={handleCopy}
        style={{
          flexShrink:   0,
          padding:      '6px 12px',
          borderRadius: '7px',
          border:       copied ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(168,85,247,0.3)',
          background:   copied ? 'rgba(16,185,129,0.1)' : 'rgba(168,85,247,0.1)',
          color:        copied ? C.green : C.purple,
          fontWeight:   700,
          fontSize:     '12px',
          cursor:       'pointer',
          transition:   'all 0.2s',
          whiteSpace:   'nowrap',
        }}
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  )
}

function PillRow({ label, options, value, onChange }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{
        fontSize:      '11px',
        fontWeight:    800,
        letterSpacing: '1.2px',
        color:         C.dim,
        textTransform: 'uppercase',
        marginBottom:  '8px',
      }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {options.map((opt) => {
          const isActive = value === opt
          return (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              style={{
                padding:      '7px 14px',
                borderRadius: '20px',
                border:       isActive ? `1px solid ${C.purple}` : '1px solid rgba(168,85,247,0.2)',
                background:   isActive ? 'rgba(168,85,247,0.18)' : 'rgba(168,85,247,0.05)',
                color:        isActive ? C.purple : C.muted,
                fontSize:     '13px',
                fontWeight:   isActive ? 700 : 500,
                cursor:       'pointer',
                transition:   'all 0.18s',
                whiteSpace:   'nowrap',
              }}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function RoomTitleSection() {
  const [vibe,    setVibe]    = useState('Playful 😈')
  const [goal,    setGoal]    = useState('Interactive Toy')
  const [urgency, setUrgency] = useState('Tonight Only')

  // Strip emoji suffix for lookup key
  const vibeKey = vibe.split(' ')[0]

  const titles = resolveTitles(vibeKey, goal, urgency)

  return (
    <section style={{ padding: '80px 20px', background: C.bg }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <h2 style={{
            fontSize:      'clamp(24px, 4vw, 36px)',
            fontWeight:    800,
            color:         C.white,
            margin:        '0 0 14px',
            letterSpacing: '-0.02em',
          }}>
            Room Title Generator — get more clicks from your title
          </h2>
          <p style={{
            fontSize:   '16px',
            color:      C.muted,
            maxWidth:   '540px',
            margin:     '0 auto',
            lineHeight: 1.6,
          }}>
            High-converting titles follow a formula: Hook + Goal + Reward + Urgency. CamCash generates them for you.
          </p>
        </div>

        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap:                 '24px',
          marginBottom:        '24px',
        }}>
          {/* Selectors */}
          <div style={{
            background:   C.card,
            border:       `1px solid ${C.border}`,
            borderRadius: '14px',
            padding:      '24px',
          }}>
            <div style={{
              fontSize:      '12px',
              fontWeight:    700,
              color:         C.dim,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom:  '18px',
            }}>Customize your title</div>

            <PillRow label="Vibe"      options={VIBE_OPTIONS}    value={vibe}    onChange={setVibe}    />
            <PillRow label="Goal type" options={GOAL_OPTIONS}    value={goal}    onChange={setGoal}    />
            <PillRow label="Urgency"   options={URGENCY_OPTIONS} value={urgency} onChange={setUrgency} />
          </div>

          {/* Generated titles */}
          <div style={{
            background:   C.card,
            border:       `1px solid ${C.border}`,
            borderRadius: '14px',
            padding:      '24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <div style={{
                fontSize:      '12px',
                fontWeight:    700,
                color:         C.dim,
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}>Generated Titles</div>
              <span style={{
                padding:      '2px 8px',
                borderRadius: '20px',
                fontSize:     '10px',
                fontWeight:   700,
                background:   'rgba(16,185,129,0.1)',
                border:       '1px solid rgba(16,185,129,0.25)',
                color:        C.green,
              }}>3 options</span>
            </div>
            {titles.map((title, i) => (
              <TitleCopyRow key={i} title={title} />
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '20px', fontSize: '13px', color: C.dim }}>
          9 sentence structures, updated weekly — so your titles never feel repetitive.
        </div>

        <div style={{ textAlign: 'center' }}>
          <a href="/guides/chaturbate-room-title-generator" style={{
            fontSize:       '14px',
            fontWeight:     600,
            color:          C.purple,
            textDecoration: 'none',
            borderBottom:   '1px solid rgba(168,85,247,0.3)',
            paddingBottom:  '2px',
          }}>
            Try the full generator →
          </a>
        </div>
      </div>
    </section>
  )
}

// ─── ComparisonSection ────────────────────────────────────────────────────────
export function ComparisonSection() {
  const freeFeatures = [
    'Live tip tracking during stream',
    'Real-time viewer count',
    'Session earnings display',
    'Basic AI suggestions',
    'Room momentum indicator',
    'Current session stats',
    'Works on 4 platforms',
  ]

  const accountFeatures = [
    'Everything in Extension Only',
    'Saved session history & trends',
    'AI coaching with memory',
    'Fan behavior & whale detection',
    'Long-term performance analytics',
    'Multi-session pattern recognition',
    'Earnings optimization insights',
    'Creator benchmarking',
    'Smart re-engagement alerts',
    'Advanced coaching recommendations',
  ]

  return (
    <section style={{
      background:  C.bg2,
      padding:     '80px 20px',
      borderTop:   '1px solid rgba(168,85,247,0.1)',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h2 style={{
          fontSize:      'clamp(24px, 4vw, 36px)',
          fontWeight:    800,
          color:         C.white,
          margin:        '0 0 12px',
          letterSpacing: '-0.02em',
        }}>
          Useful immediately. Powerful when connected.
        </h2>
        <p style={{
          fontSize:   '16px',
          color:      C.muted,
          maxWidth:   '500px',
          margin:     '0 auto',
          lineHeight: 1.6,
        }}>
          The extension works the moment you install it. Your account is what makes it learn.
        </p>
      </div>

      <div style={{
        maxWidth:            '820px',
        margin:              '0 auto',
        display:             'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap:                 '24px',
      }}>
        {/* Free card */}
        <div style={{
          background:   C.card,
          border:       '1px solid rgba(34,211,238,0.2)',
          borderRadius: '18px',
          overflow:     'hidden',
        }}>
          <div style={{
            background:     'rgba(34,211,238,0.06)',
            borderBottom:   '1px solid rgba(34,211,238,0.2)',
            padding:        '20px 24px',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            flexWrap:       'wrap',
            gap:            '8px',
          }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: C.white }}>🧩 Extension Only</span>
            <span style={{
              fontSize:     '11px',
              fontWeight:   700,
              background:   'rgba(16,185,129,0.15)',
              color:        C.green,
              border:       '1px solid rgba(16,185,129,0.3)',
              borderRadius: '20px',
              padding:      '3px 10px',
              letterSpacing:'0.04em',
            }}>Free · No account needed</span>
          </div>
          <div style={{ padding: '24px' }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {freeFeatures.map((f) => (
                <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span style={{ color: C.cyan, fontWeight: 700, flexShrink: 0, marginTop: '1px' }}>✓</span>
                  <span style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: 1.4 }}>{f}</span>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: '28px' }}>
              <a href="/extension" style={{
                display:        'block',
                textAlign:      'center',
                border:         '1px solid rgba(34,211,238,0.4)',
                color:          C.cyan,
                fontSize:       '14px',
                fontWeight:     600,
                padding:        '12px 20px',
                borderRadius:   '10px',
                textDecoration: 'none',
                background:     'rgba(34,211,238,0.05)',
              }}>
                Get the extension →
              </a>
            </div>
          </div>
        </div>

        {/* Account card */}
        <div style={{
          background:   C.card,
          border:       '1px solid rgba(168,85,247,0.35)',
          borderRadius: '18px',
          overflow:     'hidden',
          boxShadow:    '0 0 32px rgba(168,85,247,0.12)',
        }}>
          <div style={{
            background:     'rgba(168,85,247,0.1)',
            borderBottom:   '1px solid rgba(168,85,247,0.35)',
            padding:        '20px 24px',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            flexWrap:       'wrap',
            gap:            '8px',
          }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: C.white }}>💜 CamCash Account</span>
            <span style={{
              fontSize:     '11px',
              fontWeight:   700,
              background:   'rgba(168,85,247,0.18)',
              color:        '#d8b4fe',
              border:       '1px solid rgba(168,85,247,0.35)',
              borderRadius: '20px',
              padding:      '3px 10px',
              letterSpacing:'0.04em',
            }}>Free · Unlock everything</span>
          </div>
          <div style={{ padding: '24px' }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {accountFeatures.map((f) => (
                <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span style={{ color: C.purple, fontWeight: 700, flexShrink: 0, marginTop: '1px' }}>✓</span>
                  <span style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: 1.4 }}>{f}</span>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: '28px' }}>
              <a href="/signup" style={{
                display:        'block',
                textAlign:      'center',
                background:     'linear-gradient(135deg, #a855f7, #7c3aed)',
                color:          '#fff',
                fontSize:       '14px',
                fontWeight:     700,
                padding:        '12px 20px',
                borderRadius:   '10px',
                textDecoration: 'none',
                boxShadow:      '0 4px 20px rgba(168,85,247,0.3)',
              }}>
                Create Free Account →
              </a>
            </div>
          </div>
        </div>
      </div>

      <p style={{ textAlign: 'center', marginTop: '28px', fontSize: '13px', color: C.dim }}>
        Both are free. The account just makes the extension smarter over time.
      </p>
    </section>
  )
}

// ─── FinalCTASection ──────────────────────────────────────────────────────────
const FINAL_PILLS = ['No credit card', 'Free forever', 'Works in 60 seconds', '4 platforms supported']

export function FinalCTASection() {
  return (
    <>
      <section style={{
        width:      '100%',
        padding:    '100px 20px',
        textAlign:  'center',
        backgroundImage: `
          radial-gradient(ellipse at center, rgba(168,85,247,0.12) 0%, #040812 70%),
          repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(168,85,247,0.04) 39px, rgba(168,85,247,0.04) 40px),
          repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(168,85,247,0.04) 39px, rgba(168,85,247,0.04) 40px)
        `,
        boxSizing:  'border-box',
      }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>

          <div style={{
            fontSize:      '11px',
            fontWeight:    700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color:         C.purple,
            marginBottom:  '16px',
          }}>
            Get Started Free
          </div>

          <h2 style={{
            fontSize:             'clamp(28px, 5vw, 48px)',
            fontWeight:           800,
            margin:               '0 0 20px',
            letterSpacing:        '-0.03em',
            lineHeight:           1.15,
            background:           'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor:  'transparent',
            backgroundClip:       'text',
          }}>
            Start understanding your stream tonight
          </h2>

          <p style={{ fontSize: '17px', color: C.muted, lineHeight: 1.65, margin: '0 0 36px' }}>
            Install the extension, go live, and CamCash starts working immediately. Create a free account to unlock the analytics that make you grow.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', marginBottom: '40px' }}>
            {FINAL_PILLS.map((pill) => (
              <span key={pill} style={{
                fontSize:     '12px',
                fontWeight:   600,
                color:        C.cyan,
                background:   'rgba(34,211,238,0.07)',
                border:       '1px solid rgba(34,211,238,0.2)',
                borderRadius: '20px',
                padding:      '5px 14px',
              }}>{pill}</span>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '14px', marginBottom: '40px' }}>
            <a href="/signup" style={{
              display:        'inline-block',
              background:     'linear-gradient(135deg, #a855f7, #ec4899)',
              color:          '#fff',
              fontSize:       '16px',
              fontWeight:     700,
              padding:        '15px 36px',
              borderRadius:   '12px',
              textDecoration: 'none',
              boxShadow:      '0 4px 28px rgba(168,85,247,0.4)',
              letterSpacing:  '0.01em',
            }}>
              Create Free Account →
            </a>
            <a href="#live-demo" style={{
              display:        'inline-block',
              border:         '1px solid rgba(168,85,247,0.35)',
              color:          '#d8b4fe',
              fontSize:       '16px',
              fontWeight:     600,
              padding:        '15px 36px',
              borderRadius:   '12px',
              textDecoration: 'none',
              background:     'rgba(168,85,247,0.06)',
            }}>
              Try the Demo Again ↑
            </a>
          </div>

          <p style={{ fontSize: '13px', color: C.dim, margin: 0 }}>
            Used by cam models on Chaturbate, BongaCams, MyFreeCams, and Stripchat
          </p>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
