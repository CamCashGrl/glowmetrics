'use client'

import { useState, useEffect } from 'react'
import UserCounter from '../components/UserCounter'
import SiteFooter from '../components/SiteFooter'

async function startCheckout(planType, setLoading) {
  setLoading(planType)
  try {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_type: planType }),
    })
    if (res.status === 401) {
      window.location.href = `/landing?plan=${planType}`
      return
    }
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      alert('Something went wrong. Please try again.')
    }
  } catch {
    alert('Something went wrong. Please try again.')
  } finally {
    setLoading(null)
  }
}

// ── Color palette ─────────────────────────────────────────────────────────────
const C = {
  bg:         '#040812',
  card:       '#0d1424',
  card2:      '#111827',
  border:     'rgba(168,85,247,0.15)',
  borderPink: 'rgba(236,72,153,0.2)',
  purple:     '#a855f7',
  pink:       '#ec4899',
  cyan:       '#22d3ee',
  green:      '#10b981',
  gold:       '#f59e0b',
  white:      '#f1f5f9',
  text:       '#94a3b8',
  muted:      '#475569',
}

// ── Reusable check mark line ──────────────────────────────────────────────────
function CheckLine({ children, color = C.cyan }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
      <span style={{ color, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
      <span style={{ color: C.text, fontSize: 14, lineHeight: 1.55 }}>{children}</span>
    </div>
  )
}

// ── Section 1: Sticky Top Bar ─────────────────────────────────────────────────
function TopBar() {
  return (
    <div style={{
      position:        'fixed',
      top:             0,
      left:            0,
      right:           0,
      zIndex:          1000,
      height:          '56px',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'space-between',
      padding:         '0 20px',
      background:      'rgba(4,8,18,0.92)',
      backdropFilter:  'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom:    '1px solid rgba(168,85,247,0.2)',
    }}>
      <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 20 }}>💜</span>
        <span style={{
          fontWeight:           700,
          fontSize:             17,
          background:           `linear-gradient(90deg, ${C.purple}, ${C.pink})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor:  'transparent',
          backgroundClip:       'text',
          letterSpacing:        '-0.3px',
        }}>CamCash</span>
      </a>
      <a href="/landing" style={{
        display:        'inline-flex',
        alignItems:     'center',
        gap:            4,
        padding:        '8px 18px',
        borderRadius:   8,
        background:     `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
        color:          '#fff',
        fontWeight:     700,
        fontSize:       13,
        textDecoration: 'none',
        letterSpacing:  '0.2px',
        whiteSpace:     'nowrap',
        boxShadow:      `0 0 16px rgba(168,85,247,0.35)`,
      }}>
        Create Free Account →
      </a>
    </div>
  )
}

// ── Section 2: Hero ───────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section style={{
      paddingTop:  80,
      paddingBottom: 60,
      paddingLeft:  20,
      paddingRight: 20,
      textAlign:   'center',
      position:    'relative',
    }}>
      <div style={{
        position:   'absolute',
        inset:      0,
        background: 'radial-gradient(ellipse 70% 55% at 50% 0%, rgba(168,85,247,0.13) 0%, rgba(4,8,18,0) 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', maxWidth: 760, margin: '0 auto' }}>
        <p style={{
          fontSize:      11,
          fontWeight:    800,
          letterSpacing: '2.5px',
          color:         C.purple,
          textTransform: 'uppercase',
          fontVariant:   'small-caps',
          marginBottom:  18,
          margin:        '0 0 18px',
        }}>
          Transparent Pricing
        </p>
        <h1 style={{
          fontSize:             'clamp(30px, 6vw, 54px)',
          fontWeight:           800,
          lineHeight:           1.1,
          margin:               '0 0 22px',
          background:           `linear-gradient(135deg, ${C.purple} 0%, ${C.pink} 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor:  'transparent',
          backgroundClip:       'text',
          letterSpacing:        '-1px',
        }}>
          Transparent Pricing.<br />Powerful Platform.
        </h1>
        <p style={{
          fontSize:   'clamp(15px, 2vw, 18px)',
          color:      C.text,
          lineHeight: 1.65,
          margin:     '0 auto',
          maxWidth:   620,
        }}>
          See exactly what changes after launch. Free tier always exists. No surprises. We're telling you now.
        </p>
      </div>
    </section>
  )
}

// ── Section 3: Launch Phase Banner ───────────────────────────────────────────
function LaunchBanner() {
  return (
    <section style={{ padding: '0 20px 64px', position: 'relative' }}>
      <div style={{
        maxWidth:     800,
        margin:       '0 auto',
        border:       '2px solid rgba(16,185,129,0.4)',
        background:   'rgba(16,185,129,0.08)',
        borderRadius: 16,
        padding:      '32px 40px',
      }}>
        {/* Top row */}
        <div style={{
          display:       'flex',
          flexWrap:      'wrap',
          gap:           24,
          alignItems:    'center',
          justifyContent:'space-between',
          marginBottom:  24,
        }}>
          {/* Left */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <span style={{ fontSize: 36, lineHeight: 1 }}>🎉</span>
            <div>
              <h2 style={{ color: C.white, fontWeight: 800, fontSize: 22, margin: '0 0 6px' }}>
                Right Now — Launch Phase
              </h2>
              <p style={{ color: C.text, fontSize: 15, margin: 0, lineHeight: 1.5 }}>
                Everything is completely free. No limits. No paywall.
              </p>
            </div>
          </div>
          {/* Right */}
          <div style={{ textAlign: 'center' }}>
            <p style={{
              fontSize:    56,
              fontWeight:  900,
              color:       C.green,
              margin:      0,
              lineHeight:  1,
              letterSpacing: '-2px',
            }}>FREE</p>
            <p style={{ color: C.muted, fontSize: 13, margin: '4px 0 0', fontWeight: 600 }}>
              Until 100 users
            </p>
          </div>
        </div>

        {/* Counter */}
        <div style={{ marginBottom: 28 }}>
          <UserCounter variant="full" />
        </div>

        {/* CTA */}
        <a href="/landing" style={{
          display:        'inline-flex',
          alignItems:     'center',
          gap:            6,
          padding:        '13px 28px',
          borderRadius:   10,
          background:     C.green,
          color:          '#fff',
          fontWeight:     800,
          fontSize:       15,
          textDecoration: 'none',
          letterSpacing:  '0.2px',
          boxShadow:      '0 0 20px rgba(16,185,129,0.35)',
        }}>
          Start Free Today →
        </a>
      </div>
    </section>
  )
}

// ── Section 4: After Launch Comparison ───────────────────────────────────────
function AfterLaunchSection({ checkoutLoading, setCheckoutLoading }) {
  return (
    <section style={{ padding: '0 20px 72px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Heading */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{
            color:      C.white,
            fontSize:   'clamp(24px, 4vw, 36px)',
            fontWeight: 800,
            margin:     '0 0 10px',
            letterSpacing: '-0.5px',
          }}>
            When We Launch — Two Tiers
          </h2>
          <p style={{ color: C.text, fontSize: 15, margin: 0 }}>
            Both valuable. Both available forever.
          </p>
        </div>

        {/* Cards */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap:                 24,
        }}>
          {/* Free Tier Card */}
          <div style={{
            background:   C.card,
            border:       '1px solid rgba(34,211,238,0.2)',
            borderRadius: 16,
            padding:      '32px 28px',
            display:      'flex',
            flexDirection:'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 22 }}>🌿</span>
              <span style={{ color: C.white, fontWeight: 800, fontSize: 20 }}>Free Tier</span>
              <span style={{
                marginLeft:   'auto',
                background:   'rgba(16,185,129,0.15)',
                color:        C.green,
                borderRadius: 999,
                padding:      '3px 12px',
                fontSize:     12,
                fontWeight:   700,
                border:       '1px solid rgba(16,185,129,0.3)',
              }}>$0 / month forever</span>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 20, marginTop: 12, flexGrow: 1 }}>
              <CheckLine color={C.cyan}>Live tip detection</CheckLine>
              <CheckLine color={C.cyan}>Real-time alerts</CheckLine>
              <CheckLine color={C.cyan}>Basic session coaching</CheckLine>
              <CheckLine color={C.cyan}>Current-session analytics</CheckLine>
              <CheckLine color={C.cyan}>Extension download + use forever</CheckLine>
            </div>

            <p style={{ color: C.green, fontSize: 12, fontWeight: 700, margin: '20px 0 20px', fontStyle: 'italic' }}>
              Free tier will ALWAYS exist and be useful
            </p>

            <a href="/landing" style={{
              display:        'block',
              textAlign:      'center',
              padding:        '12px 0',
              borderRadius:   10,
              border:         `1px solid ${C.cyan}`,
              color:          C.cyan,
              fontWeight:     700,
              fontSize:       14,
              textDecoration: 'none',
              background:     'transparent',
            }}>
              Start with Free Tier →
            </a>
          </div>

          {/* Premium Tier Card */}
          <div style={{
            background:   C.card,
            border:       '1px solid rgba(168,85,247,0.3)',
            borderRadius: 16,
            padding:      '32px 28px',
            display:      'flex',
            flexDirection:'column',
            boxShadow:    '0 0 32px rgba(168,85,247,0.12)',
          }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 22 }}>💜</span>
                <span style={{ color: C.white, fontWeight: 800, fontSize: 20 }}>Standard Plan</span>
                <span style={{
                  marginLeft:   'auto',
                  background:   'rgba(168,85,247,0.15)',
                  color:        C.purple,
                  borderRadius: 999,
                  padding:      '3px 12px',
                  fontSize:     12,
                  fontWeight:   700,
                  border:       '1px solid rgba(168,85,247,0.3)',
                }}>$19.99 / month</span>
              </div>
              <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>or $199.99/year (2 months free)</p>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 20, marginTop: 12, flexGrow: 1 }}>
              <CheckLine color={C.purple}>Everything in Free tier, plus:</CheckLine>
              <CheckLine color={C.purple}>Save analytics history forever</CheckLine>
              <CheckLine color={C.purple}>AI learns your patterns</CheckLine>
              <CheckLine color={C.purple}>Performance trends &amp; insights</CheckLine>
              <CheckLine color={C.purple}>Multi-month tracking</CheckLine>
              <CheckLine color={C.purple}>Fan behavior analysis</CheckLine>
              <CheckLine color={C.purple}>Creator benchmarking</CheckLine>
              <CheckLine color={C.purple}>Predictive coaching</CheckLine>
              <CheckLine color={C.purple}>Long-term growth optimization</CheckLine>
            </div>

            <div style={{ marginTop: 20 }}>
              <button
                onClick={() => startCheckout('standard_monthly', setCheckoutLoading)}
                disabled={checkoutLoading !== null}
                style={{
                  display:      'block',
                  width:        '100%',
                  textAlign:    'center',
                  padding:      '12px 0',
                  borderRadius: 10,
                  background:   checkoutLoading === 'standard_monthly' ? 'rgba(168,85,247,0.5)' : `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
                  color:        '#fff',
                  fontWeight:   700,
                  fontSize:     14,
                  border:       'none',
                  cursor:       checkoutLoading !== null ? 'wait' : 'pointer',
                  boxSizing:    'border-box',
                }}
              >
                {checkoutLoading === 'standard_monthly' ? 'Redirecting…' : 'Get Standard Plan — $19.99/mo →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Section 5: Early Adopter ──────────────────────────────────────────────────
function EarlyAdopterSection({ checkoutLoading, setCheckoutLoading }) {
  return (
    <section id="early-adopter" style={{
      background:   'rgba(236,72,153,0.06)',
      borderTop:    '1px solid rgba(236,72,153,0.2)',
      borderBottom: '1px solid rgba(236,72,153,0.2)',
      padding:      '80px 20px',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <p style={{
          fontSize:      11,
          fontWeight:    800,
          letterSpacing: '2.5px',
          color:         C.pink,
          textTransform: 'uppercase',
          fontVariant:   'small-caps',
          margin:        '0 0 14px',
        }}>
          ⏰ Early Adopter Offer
        </p>
        <h2 style={{
          color:       C.white,
          fontSize:    'clamp(24px, 4vw, 38px)',
          fontWeight:  800,
          margin:      '0 0 14px',
          letterSpacing: '-0.5px',
        }}>
          Lock in lifetime pricing before we launch
        </h2>
        <p style={{ color: C.text, fontSize: 15, margin: '0 auto 24px', maxWidth: 540 }}>
          Limited to the first 100 users. You help us launch — we reward you forever.
        </p>
        <UserCounter variant="full" />
      </div>

      {/* Cards */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap:                 24,
        maxWidth:            800,
        margin:              '0 auto 32px',
      }}>
        {/* Monthly Card */}
        <div style={{
          border:       '2px solid rgba(236,72,153,0.4)',
          background:   'rgba(236,72,153,0.07)',
          borderRadius: 16,
          padding:      '36px 28px',
          display:      'flex',
          flexDirection:'column',
        }}>
          <p style={{
            fontSize:      10,
            fontWeight:    800,
            letterSpacing: '2px',
            color:         C.pink,
            textTransform: 'uppercase',
            fontVariant:   'small-caps',
            margin:        '0 0 16px',
          }}>Most Flexible</p>

          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 48, fontWeight: 900, color: C.white, letterSpacing: '-2px', lineHeight: 1 }}>$9.99</span>
            <span style={{ color: C.text, fontSize: 16, marginLeft: 4 }}>/month</span>
          </div>
          <p style={{ color: C.pink, fontWeight: 700, fontSize: 13, margin: '0 0 10px' }}>locked forever</p>
          <p style={{ color: C.muted, fontSize: 13, margin: '0 0 6px', textDecoration: 'line-through' }}>
            Regular price: $19.99/month
          </p>
          <p style={{ color: C.green, fontWeight: 700, fontSize: 13, margin: '0 0 24px' }}>
            You save $10/month = $120/year
          </p>

          <div style={{ flexGrow: 1, marginBottom: 24 }}>
            <CheckLine color={C.pink}>Lifetime locked rate — never increases</CheckLine>
            <CheckLine color={C.pink}>Cancel anytime</CheckLine>
            <CheckLine color={C.pink}>All premium features included</CheckLine>
            <CheckLine color={C.pink}>Upgrade/downgrade anytime</CheckLine>
          </div>

          <button
            onClick={() => startCheckout('early_adopter_monthly', setCheckoutLoading)}
            disabled={checkoutLoading !== null}
            style={{
              display:    'block',
              width:      '100%',
              textAlign:  'center',
              padding:    '14px 0',
              borderRadius: 10,
              background:  checkoutLoading === 'early_adopter_monthly' ? 'rgba(236,72,153,0.5)' : `linear-gradient(135deg, ${C.pink}, #f97316)`,
              color:      '#fff',
              fontWeight: 800,
              fontSize:   14,
              border:     'none',
              cursor:     checkoutLoading !== null ? 'wait' : 'pointer',
              boxShadow:  '0 0 20px rgba(236,72,153,0.3)',
              boxSizing:  'border-box',
            }}
          >
            {checkoutLoading === 'early_adopter_monthly' ? 'Redirecting…' : 'Claim Early Adopter Monthly — $9.99/mo'}
          </button>
        </div>

        {/* Annual Card */}
        <div style={{
          border:       '2px solid rgba(168,85,247,0.4)',
          background:   'rgba(168,85,247,0.08)',
          borderRadius: 16,
          padding:      '36px 28px',
          display:      'flex',
          flexDirection:'column',
        }}>
          <p style={{
            fontSize:      10,
            fontWeight:    800,
            letterSpacing: '2px',
            color:         C.purple,
            textTransform: 'uppercase',
            fontVariant:   'small-caps',
            margin:        '0 0 16px',
          }}>Best Value</p>

          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 48, fontWeight: 900, color: C.white, letterSpacing: '-2px', lineHeight: 1 }}>$99.99</span>
            <span style={{ color: C.text, fontSize: 16, marginLeft: 4 }}>/year</span>
          </div>
          <p style={{ color: C.purple, fontWeight: 700, fontSize: 13, margin: '0 0 4px' }}>locked forever</p>
          <p style={{ color: C.muted, fontSize: 13, margin: '0 0 6px' }}>$8.33/month equivalent</p>
          <p style={{ color: C.muted, fontSize: 13, margin: '0 0 6px', textDecoration: 'line-through' }}>
            Regular price: $199.99/year
          </p>
          <p style={{ color: C.green, fontWeight: 700, fontSize: 13, margin: '0 0 24px' }}>
            You save $100/year + 2 months free
          </p>

          <div style={{ flexGrow: 1, marginBottom: 24 }}>
            <CheckLine color={C.purple}>Lifetime locked rate — never increases</CheckLine>
            <CheckLine color={C.purple}>2 months free vs monthly</CheckLine>
            <CheckLine color={C.purple}>All premium features included</CheckLine>
            <CheckLine color={C.purple}>Auto-renews at same locked rate</CheckLine>
          </div>

          <button
            onClick={() => startCheckout('early_adopter_annual', setCheckoutLoading)}
            disabled={checkoutLoading !== null}
            style={{
              display:    'block',
              width:      '100%',
              textAlign:  'center',
              padding:    '14px 0',
              borderRadius: 10,
              background:  checkoutLoading === 'early_adopter_annual' ? 'rgba(168,85,247,0.5)' : `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
              color:      '#fff',
              fontWeight: 800,
              fontSize:   14,
              border:     'none',
              cursor:     checkoutLoading !== null ? 'wait' : 'pointer',
              boxShadow:  '0 0 20px rgba(168,85,247,0.3)',
              boxSizing:  'border-box',
            }}
          >
            {checkoutLoading === 'early_adopter_annual' ? 'Redirecting…' : 'Claim Early Adopter Annual — $99.99/yr'}
          </button>
        </div>
      </div>

      {/* Below cards note */}
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: C.muted, fontSize: 13, margin: '0 0 12px' }}>
          This offer expires when we reach 100 users. Early adopters keep their rate forever after that.
        </p>
        <UserCounter variant="compact" />
      </div>
    </section>
  )
}

// ── Section 6: Our Promise ────────────────────────────────────────────────────
function PromiseSection() {
  return (
    <section style={{ padding: '80px 20px' }}>
      <div style={{
        maxWidth:     760,
        margin:       '0 auto',
        background:   C.card,
        border:       `1px solid ${C.border}`,
        borderRadius: 20,
        padding:      '48px 40px',
      }}>
        <h2 style={{
          color:       C.white,
          fontSize:    'clamp(22px, 3.5vw, 32px)',
          fontWeight:  800,
          margin:      '0 0 32px',
          letterSpacing: '-0.4px',
        }}>
          Our Promise to You
        </h2>

        <div style={{ marginBottom: 36 }}>
          {[
            'Free tier will ALWAYS exist and be genuinely useful',
            'Premium adds history + AI learning — core features stay free',
            'No surprise feature locks after launch',
            '30 days notice before any changes',
            'Early adopter pricing locked forever — guaranteed',
            'Built by cam models, for cam models',
          ].map((promise) => (
            <div key={promise} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>✅</span>
              <span style={{ color: C.text, fontSize: 15, lineHeight: 1.55 }}>{promise}</span>
            </div>
          ))}
        </div>

        <div style={{
          borderTop:  '1px solid rgba(255,255,255,0.06)',
          paddingTop: 28,
        }}>
          <p style={{ color: C.purple, fontWeight: 700, fontSize: 14, margin: '0 0 10px' }}>
            Why we're doing this:
          </p>
          <p style={{ color: C.text, fontSize: 15, lineHeight: 1.65, margin: 0 }}>
            You help us launch. We reward you with lifetime savings. We get committed early users. Fair exchange for both.
          </p>
        </div>
      </div>
    </section>
  )
}

// ── Section 7: Feature Comparison Table ──────────────────────────────────────
function ComparisonTable() {
  const rows = [
    { feature: 'Live tip detection',      free: '✅', premium: '✅', early: '✅' },
    { feature: 'Real-time alerts',        free: '✅', premium: '✅', early: '✅' },
    { feature: 'Basic coaching',          free: '✅', premium: '✅', early: '✅' },
    { feature: 'Session analytics',       free: '✅', premium: '✅', early: '✅' },
    { feature: 'Save analytics history',  free: '❌', premium: '✅', early: '✅' },
    { feature: 'Performance trends',      free: '❌', premium: '✅', early: '✅' },
    { feature: 'AI learning',             free: '❌', premium: '✅', early: '✅' },
    { feature: 'Multi-month tracking',    free: '❌', premium: '✅', early: '✅' },
    { feature: 'Fan behavior analysis',   free: '❌', premium: '✅', early: '✅' },
    { feature: 'Creator benchmarking',    free: '❌', premium: '✅', early: '✅' },
    { feature: 'Predictive coaching',     free: '❌', premium: '✅', early: '✅' },
    { feature: 'Price',                   free: '$0', premium: '$19.99/mo', early: '$9.99/mo*' },
    { feature: 'Annual option',           free: '—', premium: '$199.99/yr', early: '$99.99/yr*' },
    { feature: 'Lifetime price lock',     free: '—', premium: '❌', early: '✅ FOREVER', earlySpecial: true },
    { feature: 'Availability',            free: 'Always', premium: 'After 100 users', early: 'First 100 only' },
  ]

  const thStyle = {
    padding:    '14px 16px',
    textAlign:  'left',
    fontSize:   13,
    fontWeight: 700,
    color:      C.muted,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  }

  const tdStyle = (isAlt) => ({
    padding:    '13px 16px',
    fontSize:   14,
    color:      C.text,
    background: isAlt ? 'rgba(255,255,255,0.02)' : 'transparent',
    borderTop:  '1px solid rgba(255,255,255,0.04)',
    whiteSpace: 'nowrap',
  })

  function CellContent({ value, special }) {
    if (special) {
      return <span style={{ color: C.pink, fontWeight: 800 }}>{value}</span>
    }
    if (value === '✅') return <span style={{ color: C.green }}>{value}</span>
    if (value === '❌') return <span style={{ color: C.muted }}>{value}</span>
    return <span>{value}</span>
  }

  return (
    <section style={{ padding: '0 20px 72px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{
          color:       C.white,
          fontSize:    'clamp(22px, 3.5vw, 32px)',
          fontWeight:  800,
          margin:      '0 0 32px',
          textAlign:   'center',
          letterSpacing: '-0.4px',
        }}>
          Full Feature Comparison
        </h2>

        <div style={{
          background:   C.card,
          border:       `1px solid ${C.border}`,
          borderRadius: 16,
          overflow:     'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width:           '100%',
              borderCollapse:  'collapse',
              minWidth:        520,
            }}>
              <thead>
                <tr style={{ background: C.card2 }}>
                  <th style={{ ...thStyle, color: C.white }}>Feature</th>
                  <th style={{ ...thStyle, color: C.cyan }}>Free ($0)</th>
                  <th style={{ ...thStyle, color: C.purple }}>Premium ($19.99/mo)</th>
                  <th style={{ ...thStyle, color: C.pink }}>Early Adopter ($9.99/mo)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.feature}>
                    <td style={{ ...tdStyle(i % 2 === 1), color: C.white, fontWeight: 500 }}>{row.feature}</td>
                    <td style={tdStyle(i % 2 === 1)}><CellContent value={row.free} /></td>
                    <td style={tdStyle(i % 2 === 1)}><CellContent value={row.premium} /></td>
                    <td style={tdStyle(i % 2 === 1)}><CellContent value={row.early} special={row.earlySpecial} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p style={{ color: C.muted, fontSize: 12, margin: '12px 0 0', fontStyle: 'italic' }}>
          * Early adopter pricing locked forever at sign-up rate
        </p>
      </div>
    </section>
  )
}

// ── Section 8: FAQ ────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: 'Will the free tier always be available?',
    a: 'Yes, absolutely. The free tier will always exist and always be genuinely useful. Live tip detection, real-time alerts, basic coaching, and session analytics are free forever. We built this for cam models and we mean it.',
  },
  {
    q: 'What happens to my early adopter pricing if I cancel and re-subscribe?',
    a: 'Your early adopter rate is locked to your account at sign-up. If you cancel and re-subscribe later, you keep the same locked rate. We\'re not trying to trick you — you earned that rate by helping us launch.',
  },
  {
    q: 'When does the early adopter offer close?',
    a: 'The early adopter offer closes automatically when we reach 100 registered users. After that, new users pay the standard rate. Current early adopters keep their locked rate forever.',
  },
  {
    q: 'Is there a free trial for premium?',
    a: 'During the launch phase, everything is completely free with no limits. Once we launch with paid tiers, we plan to offer a trial period for premium features. Details coming soon.',
  },
  {
    q: 'What platforms does CamCash support?',
    a: 'CamCash currently supports Chaturbate, BongaCams, MyFreeCams, and Stripchat. More platforms are on our roadmap based on user demand.',
  },
  {
    q: 'Is my data private?',
    a: 'Yes. Your analytics data is private to your account. We do not sell or share your data. The extension only reads your stream page — it does not access any payment or personal information beyond what you configure.',
  },
  {
    q: 'Can I upgrade or downgrade between monthly and annual?',
    a: 'Yes. Early adopter monthly users can switch to early adopter annual (and vice versa) at any time, keeping their locked rate. You\'re never locked into a billing cycle you don\'t want.',
  },
]

function FAQSection() {
  const [open, setOpen] = useState(null)

  return (
    <section style={{ padding: '0 20px 72px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h2 style={{
          color:       C.white,
          fontSize:    'clamp(22px, 3.5vw, 32px)',
          fontWeight:  800,
          margin:      '0 0 32px',
          textAlign:   'center',
          letterSpacing: '-0.4px',
        }}>
          Questions
        </h2>

        <div style={{
          background:   C.card,
          border:       `1px solid ${C.border}`,
          borderRadius: 16,
          overflow:     'hidden',
        }}>
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i
            return (
              <div key={i} style={{
                borderBottom: i < FAQ_ITEMS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  style={{
                    width:          '100%',
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'space-between',
                    gap:            16,
                    padding:        '20px 24px',
                    background:     'transparent',
                    border:         'none',
                    cursor:         'pointer',
                    textAlign:      'left',
                  }}
                >
                  <span style={{ color: C.white, fontWeight: 600, fontSize: 15, lineHeight: 1.4 }}>
                    {item.q}
                  </span>
                  <span style={{
                    color:      C.purple,
                    fontSize:   18,
                    flexShrink: 0,
                    transform:  isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                    lineHeight: 1,
                  }}>
                    ›
                  </span>
                </button>
                {isOpen && (
                  <div style={{ padding: '0 24px 20px' }}>
                    <p style={{ color: C.text, fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                      {item.a}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ── Section 9: Final CTA ──────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section style={{
      background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(168,85,247,0.2) 0%, rgba(4,8,18,0) 70%), #040812',
      padding:    '80px 20px',
      textAlign:  'center',
    }}>
      <h2 style={{
        color:       C.white,
        fontSize:    'clamp(26px, 5vw, 46px)',
        fontWeight:  800,
        margin:      '0 0 16px',
        letterSpacing: '-1px',
      }}>
        Start free. Grow forever.
      </h2>
      <p style={{ color: C.text, fontSize: 16, margin: '0 auto 36px', maxWidth: 480, lineHeight: 1.6 }}>
        Download the extension free or create a free account — no credit card.
      </p>

      <div style={{
        display:        'flex',
        flexWrap:       'wrap',
        gap:            14,
        justifyContent: 'center',
        marginBottom:   20,
      }}>
        <a href="/landing" style={{
          display:        'inline-flex',
          alignItems:     'center',
          gap:            6,
          padding:        '14px 28px',
          borderRadius:   10,
          background:     `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
          color:          '#fff',
          fontWeight:     800,
          fontSize:       15,
          textDecoration: 'none',
          boxShadow:      `0 0 24px rgba(168,85,247,0.4)`,
        }}>
          Create Free Account →
        </a>
        <a href="/extension" style={{
          display:        'inline-flex',
          alignItems:     'center',
          gap:            6,
          padding:        '14px 28px',
          borderRadius:   10,
          background:     'transparent',
          border:         `1px solid ${C.purple}`,
          color:          C.purple,
          fontWeight:     700,
          fontSize:       15,
          textDecoration: 'none',
        }}>
          View Extension →
        </a>
      </div>

      <div style={{ marginBottom: 24 }}>
        <UserCounter variant="pill" />
      </div>

      <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
        Free tier always available · No credit card for free account · 4 platforms supported
      </p>
    </section>
  )
}

// ── Root Component ────────────────────────────────────────────────────────────
export default function PricingClient() {
  const [checkoutLoading, setCheckoutLoading] = useState(null)
  return (
    <div style={{
      minHeight:       '100vh',
      background:      C.bg,
      color:           C.white,
      fontFamily:      "'DM Sans', system-ui, -apple-system, sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>
      <TopBar />

      <main>
        <HeroSection />
        <LaunchBanner />
        <AfterLaunchSection checkoutLoading={checkoutLoading} setCheckoutLoading={setCheckoutLoading} />
        <EarlyAdopterSection checkoutLoading={checkoutLoading} setCheckoutLoading={setCheckoutLoading} />
        <PromiseSection />
        <ComparisonTable />
        <FAQSection />
        <FinalCTA />
      </main>

      <SiteFooter />
    </div>
  )
}
