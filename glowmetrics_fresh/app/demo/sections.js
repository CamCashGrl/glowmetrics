'use client'

import { useState } from 'react'
import SiteFooter from '../components/SiteFooter'

// ─── Color constants ───────────────────────────────────────────────────────────
const C = {
  bg:      '#040812',
  bg2:     '#060e1e',
  card:    '#0d1424',
  purple:  '#a855f7',
  pink:    '#ec4899',
  cyan:    '#22d3ee',
  green:   '#10b981',
  gold:    '#f59e0b',
  white:   '#f1f5f9',
  muted:   '#94a3b8',
  dim:     '#475569',
  red:     '#ef4444',
  border:  'rgba(168,85,247,0.15)',
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
      background:   '#060e1e',
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
            }}>
              While you stream
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: C.white, margin: '0 0 14px' }}>
              Live Extension
            </h3>
            <ol style={{ margin: '0 0 22px', padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {['Install Chrome extension', 'Go live on your platform', 'Auto-captures tips in real time', 'Syncs to your dashboard'].map((s, i) => (
                <li key={i} style={{ fontSize: '14px', color: C.muted, lineHeight: 1.5 }}>{s}</li>
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
            }}>
              Your full history
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: C.white, margin: '0 0 14px' }}>
              CSV Upload
            </h3>
            <p style={{ fontSize: '14px', color: C.muted, lineHeight: 1.6, margin: '0 0 22px' }}>
              Upload your CSV from Chaturbate, BongaCams, or MFC to see ALL your historical data — fan rankings, peak hours, and session breakdowns going back to day one.
            </p>
            <a href="/landing" style={{
              display:        'inline-flex',
              alignItems:     'center',
              gap:            '6px',
              padding:        '11px 20px',
              borderRadius:   '9px',
              background:     `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
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
              background:   'rgba(0,0,0,0.4)',
              border:       '1px solid rgba(168,85,247,0.15)',
              borderRadius: '10px',
              padding:      '18px 20px',
              fontFamily:   'monospace',
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
                {steps[activeTab].map((s, i) => (
                  <li key={i} style={{ fontSize: '13px', color: C.muted, lineHeight: 1.55 }}>
                    <span style={{ color: C.purple, fontWeight: 700 }}>{i + 1}.</span>{' '}
                    {s}
                  </li>
                ))}
              </ol>

              <div style={{
                marginTop:  '16px',
                paddingTop: '12px',
                borderTop:  '1px solid rgba(168,85,247,0.1)',
                fontSize:   '12px',
                color:      C.dim,
                lineHeight: 1.5,
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

// ─── HowItWorksSection ────────────────────────────────────────────────────────
export function HowItWorksSection() {
  const steps = [
    {
      num:   '1',
      icon:  '📄',
      title: 'Upload your CSV',
      body:  'Export your CSV from Chaturbate, BongaCams, or MFC. Takes 2 minutes — we show you exactly how.',
    },
    {
      num:   '2',
      icon:  '⚡',
      title: 'Your data, analyzed instantly',
      body:  'CamCash maps every tip to a session, ranks your fans, finds your peak hours, and surfaces patterns you can act on.',
    },
    {
      num:   '3',
      icon:  '📈',
      title: 'Know what to do next',
      body:  'See which fans to re-engage, when to stream, how to title your room. Data-driven decisions, real results.',
    },
  ]

  return (
    <section style={{ padding: '80px 20px', background: C.bg }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '52px' }}>
          <h2 style={{
            fontSize:      'clamp(24px, 4vw, 36px)',
            fontWeight:    800,
            color:         C.white,
            margin:        '0 0 14px',
            letterSpacing: '-0.02em',
          }}>
            How CamCash works
          </h2>
          <p style={{
            fontSize:   '16px',
            color:      C.muted,
            maxWidth:   '460px',
            margin:     '0 auto',
            lineHeight: 1.6,
          }}>
            From CSV upload to actionable insights in minutes.
          </p>
        </div>

        {/* Three step cards */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap:                 '0',
          alignItems:          'start',
          position:            'relative',
        }}>
          {steps.map((s, i) => (
            <div key={s.num} style={{ display: 'flex', alignItems: 'flex-start', gap: '0' }}>
              <div style={{
                background:   C.card,
                border:       `1px solid ${C.border}`,
                borderRadius: '14px',
                padding:      '28px 24px',
                flex:         1,
                position:     'relative',
              }}>
                {/* Numbered circle */}
                <div style={{
                  width:          '36px',
                  height:         '36px',
                  borderRadius:   '50%',
                  background:     `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  fontSize:       '14px',
                  fontWeight:     800,
                  color:          '#fff',
                  marginBottom:   '16px',
                  flexShrink:     0,
                }}>
                  {s.num}
                </div>

                <div style={{ fontSize: '28px', marginBottom: '12px' }}>{s.icon}</div>

                <h3 style={{
                  fontSize:     '16px',
                  fontWeight:   700,
                  color:        C.white,
                  margin:       '0 0 10px',
                  lineHeight:   1.3,
                }}>
                  {s.title}
                </h3>

                <p style={{
                  fontSize:   '14px',
                  color:      C.muted,
                  lineHeight: 1.65,
                  margin:     0,
                }}>
                  {s.body}
                </p>
              </div>

              {/* Arrow between cards (not after last) */}
              {i < steps.length - 1 && (
                <div style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  width:          '36px',
                  flexShrink:     0,
                  paddingTop:     '60px',
                  color:          C.dim,
                  fontSize:       '20px',
                  fontWeight:     700,
                }}>
                  →
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <a href="/landing" style={{
            display:        'inline-flex',
            alignItems:     'center',
            gap:            '6px',
            padding:        '13px 32px',
            borderRadius:   '10px',
            background:     `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
            color:          '#fff',
            fontWeight:     700,
            fontSize:       '15px',
            textDecoration: 'none',
            boxShadow:      '0 0 24px rgba(168,85,247,0.35)',
          }}>
            Try it with your data →
          </a>
        </div>
      </div>
    </section>
  )
}

// ─── FinalCTASection ──────────────────────────────────────────────────────────
export function FinalCTASection() {
  return (
    <>
      <section style={{
        width:      '100%',
        padding:    '100px 20px',
        textAlign:  'center',
        background: `linear-gradient(180deg, ${C.bg} 0%, #060e1e 100%)`,
        backgroundImage: `
          linear-gradient(180deg, #040812 0%, #060e1e 100%),
          radial-gradient(ellipse 60% 50% at 50% 0%, rgba(168,85,247,0.10) 0%, rgba(4,8,18,0) 70%)
        `,
        boxSizing:  'border-box',
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>

          <h2 style={{
            fontSize:             'clamp(28px, 5vw, 46px)',
            fontWeight:           800,
            margin:               '0 0 18px',
            letterSpacing:        '-0.03em',
            lineHeight:           1.15,
            background:           `linear-gradient(135deg, ${C.purple} 0%, ${C.pink} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor:  'transparent',
            backgroundClip:       'text',
          }}>
            Ready to see your real data?
          </h2>

          <p style={{
            fontSize:   '17px',
            color:      C.muted,
            lineHeight: 1.65,
            margin:     '0 0 36px',
            maxWidth:   '480px',
            marginLeft: 'auto',
            marginRight:'auto',
          }}>
            Upload your CSV free — no credit card, no account required to try.
          </p>

          <div style={{ marginBottom: '32px' }}>
            <a href="/landing" style={{
              display:        'inline-block',
              background:     `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
              color:          '#fff',
              fontSize:       '16px',
              fontWeight:     700,
              padding:        '15px 40px',
              borderRadius:   '12px',
              textDecoration: 'none',
              boxShadow:      '0 4px 28px rgba(168,85,247,0.4)',
              letterSpacing:  '0.01em',
            }}>
              Start free →
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
