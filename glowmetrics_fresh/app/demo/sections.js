'use client'

import { useState } from 'react'
import SiteFooter from '../components/SiteFooter'

// ─── ExtensionPreviewSection ───────────────────────────────────────────────

export function ExtensionPreviewSection() {
  const steps = [
    {
      icon: '🧩',
      title: 'Install',
      desc: 'Add the CamCash extension to Chrome in 60 seconds. Works immediately — no account required.',
    },
    {
      icon: '🎬',
      title: 'Go Live',
      desc: 'Start streaming on Chaturbate, BongaCams, MyFreeCams, or Stripchat. The extension detects your session automatically.',
    },
    {
      icon: '📊',
      title: 'Get Insights',
      desc: 'Real-time tip tracking, viewer analytics, and AI coaching appear instantly — on your dashboard and as smart overlays.',
    },
  ]

  const platforms = [
    'Chaturbate ✓',
    'BongaCams ✓',
    'MyFreeCams ✓',
    'Stripchat ✓',
  ]

  return (
    <section
      style={{
        background: '#060e1e',
        borderTop: '1px solid rgba(168,85,247,0.1)',
        borderBottom: '1px solid rgba(168,85,247,0.1)',
        padding: '80px 32px',
      }}
    >
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <h2
          style={{
            fontSize: 'clamp(24px, 4vw, 36px)',
            fontWeight: '700',
            color: '#f1f5f9',
            margin: '0 0 12px',
            letterSpacing: '-0.02em',
          }}
        >
          The extension that works while you stream
        </h2>
        <p
          style={{
            fontSize: '16px',
            color: '#94a3b8',
            maxWidth: '520px',
            margin: '0 auto',
            lineHeight: '1.6',
          }}
        >
          Install once. It runs silently in the background and sends real-time data to your dashboard.
        </p>
      </div>

      {/* 3-step workflow */}
      <div
        style={{
          maxWidth: '860px',
          margin: '56px auto 0',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: '0',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {steps.map((step, i) => (
          <div
            key={step.title}
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'flex-start',
              flex: '1 1 220px',
              minWidth: '180px',
              maxWidth: '280px',
            }}
          >
            {/* Step card */}
            <div
              style={{
                flex: 1,
                background: '#0d1424',
                border: '1px solid rgba(168,85,247,0.15)',
                borderRadius: '16px',
                padding: '28px 22px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>{step.icon}</div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#a855f7',
                  marginBottom: '8px',
                }}
              >
                Step {i + 1}
              </div>
              <h3
                style={{
                  fontSize: '17px',
                  fontWeight: '700',
                  color: '#f1f5f9',
                  margin: '0 0 10px',
                }}
              >
                {step.title}
              </h3>
              <p
                style={{
                  fontSize: '13px',
                  color: '#94a3b8',
                  lineHeight: '1.6',
                  margin: 0,
                }}
              >
                {step.desc}
              </p>
            </div>

            {/* Arrow between steps */}
            {i < steps.length - 1 && (
              <div
                style={{
                  alignSelf: 'center',
                  padding: '0 10px',
                  fontSize: '20px',
                  color: 'rgba(168,85,247,0.4)',
                  flexShrink: 0,
                }}
              >
                →
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Extension popup mockup */}
      <div style={{ textAlign: 'center', margin: '60px auto 0' }}>
        <div
          style={{
            display: 'inline-block',
            maxWidth: '320px',
            width: '100%',
            background: '#0d1424',
            border: '1px solid rgba(168,85,247,0.35)',
            borderRadius: '14px',
            overflow: 'hidden',
            boxShadow: '0 0 40px rgba(168,85,247,0.22), 0 8px 32px rgba(0,0,0,0.6)',
            textAlign: 'left',
          }}
        >
          {/* Popup header */}
          <div
            style={{
              background: 'rgba(168,85,247,0.12)',
              borderBottom: '1px solid rgba(168,85,247,0.2)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#f1f5f9' }}>
              CamCash Live
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: '700',
                letterSpacing: '0.08em',
                background: 'rgba(239,68,68,0.18)',
                color: '#f87171',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '4px',
                padding: '2px 7px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              🔴 LIVE
            </span>
          </div>

          {/* Stats */}
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div
                style={{
                  flex: 1,
                  minWidth: '80px',
                  background: 'rgba(34,211,238,0.07)',
                  border: '1px solid rgba(34,211,238,0.18)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                }}
              >
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>👁️ Viewers</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#22d3ee' }}>94</div>
              </div>
              <div
                style={{
                  flex: 1,
                  minWidth: '80px',
                  background: 'rgba(16,185,129,0.07)',
                  border: '1px solid rgba(16,185,129,0.18)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                }}
              >
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>💰 Earned</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#10b981' }}>$12.50</div>
              </div>
              <div
                style={{
                  flex: 1,
                  minWidth: '80px',
                  background: 'rgba(245,158,11,0.07)',
                  border: '1px solid rgba(245,158,11,0.18)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                }}
              >
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>⚡ Trend</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#f59e0b' }}>Rising</div>
              </div>
            </div>

            {/* AI tip */}
            <div
              style={{
                background: 'rgba(168,85,247,0.1)',
                border: '1px solid rgba(168,85,247,0.25)',
                borderRadius: '8px',
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: '12px', color: '#d8b4fe', lineHeight: '1.5' }}>
                💡 <strong>xDarkMatter3</strong> is active — high tip probability
              </div>
            </div>

            {/* CTA button */}
            <a
              href="/dashboard"
              style={{
                display: 'block',
                background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                color: '#fff',
                fontSize: '13px',
                fontWeight: '600',
                textAlign: 'center',
                padding: '10px 16px',
                borderRadius: '8px',
                textDecoration: 'none',
                marginTop: '2px',
              }}
            >
              Open Dashboard →
            </a>

            {/* Session info */}
            <div style={{ fontSize: '11px', color: '#475569', textAlign: 'center', paddingBottom: '2px' }}>
              Chaturbate · Session 52:18
            </div>
          </div>
        </div>
      </div>

      {/* Platform badges */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '10px',
          marginTop: '36px',
        }}
      >
        {platforms.map((p) => (
          <span
            key={p}
            style={{
              fontSize: '13px',
              fontWeight: '600',
              color: '#22d3ee',
              background: 'rgba(34,211,238,0.07)',
              border: '1px solid rgba(34,211,238,0.2)',
              borderRadius: '20px',
              padding: '5px 14px',
            }}
          >
            {p}
          </span>
        ))}
      </div>

      {/* CTA */}
      <div style={{ textAlign: 'center', marginTop: '40px' }}>
        <a
          href="/extension"
          style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #a855f7, #ec4899)',
            color: '#fff',
            fontSize: '15px',
            fontWeight: '700',
            padding: '14px 32px',
            borderRadius: '10px',
            textDecoration: 'none',
            boxShadow: '0 4px 24px rgba(168,85,247,0.35)',
            letterSpacing: '0.01em',
          }}
        >
          Install Extension Free →
        </a>
      </div>
    </section>
  )
}

// ─── ComparisonSection ─────────────────────────────────────────────────────

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
    <section style={{ background: '#040812', padding: '80px 32px' }}>
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h2
          style={{
            fontSize: 'clamp(24px, 4vw, 36px)',
            fontWeight: '700',
            color: '#f1f5f9',
            margin: '0 0 12px',
            letterSpacing: '-0.02em',
          }}
        >
          Useful immediately. Powerful when connected.
        </h2>
        <p
          style={{
            fontSize: '16px',
            color: '#94a3b8',
            maxWidth: '500px',
            margin: '0 auto',
            lineHeight: '1.6',
          }}
        >
          The extension works the moment you install it. Your account is what makes it learn.
        </p>
      </div>

      {/* Cards */}
      <div
        style={{
          maxWidth: '820px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px',
        }}
      >
        {/* Free card */}
        <div
          style={{
            background: '#0d1424',
            border: '1px solid rgba(34,211,238,0.2)',
            borderRadius: '18px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              background: 'rgba(34,211,238,0.06)',
              borderBottom: '1px solid rgba(34,211,238,0.2)',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '16px', fontWeight: '700', color: '#f1f5f9' }}>
              🧩 Extension Only
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '700',
                background: 'rgba(16,185,129,0.15)',
                color: '#10b981',
                border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: '20px',
                padding: '3px 10px',
                letterSpacing: '0.04em',
              }}
            >
              Free · No account needed
            </span>
          </div>

          <div style={{ padding: '24px' }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {freeFeatures.map((f) => (
                <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span style={{ color: '#22d3ee', fontWeight: '700', flexShrink: 0, marginTop: '1px' }}>✓</span>
                  <span style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: '1.4' }}>{f}</span>
                </li>
              ))}
            </ul>

            <div style={{ marginTop: '28px' }}>
              <a
                href="/extension"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  border: '1px solid rgba(34,211,238,0.4)',
                  color: '#22d3ee',
                  fontSize: '14px',
                  fontWeight: '600',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  background: 'rgba(34,211,238,0.05)',
                  transition: 'background 0.2s',
                }}
              >
                Get the extension →
              </a>
            </div>
          </div>
        </div>

        {/* Account card */}
        <div
          style={{
            background: '#0d1424',
            border: '1px solid rgba(168,85,247,0.35)',
            borderRadius: '18px',
            overflow: 'hidden',
            boxShadow: '0 0 32px rgba(168,85,247,0.12)',
          }}
        >
          <div
            style={{
              background: 'rgba(168,85,247,0.1)',
              borderBottom: '1px solid rgba(168,85,247,0.35)',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '16px', fontWeight: '700', color: '#f1f5f9' }}>
              💜 CamCash Account
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '700',
                background: 'rgba(168,85,247,0.18)',
                color: '#d8b4fe',
                border: '1px solid rgba(168,85,247,0.35)',
                borderRadius: '20px',
                padding: '3px 10px',
                letterSpacing: '0.04em',
              }}
            >
              Free · Unlock everything
            </span>
          </div>

          <div style={{ padding: '24px' }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {accountFeatures.map((f) => (
                <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span style={{ color: '#a855f7', fontWeight: '700', flexShrink: 0, marginTop: '1px' }}>✓</span>
                  <span style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: '1.4' }}>{f}</span>
                </li>
              ))}
            </ul>

            <div style={{ marginTop: '28px' }}>
              <a
                href="/signup"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '700',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  boxShadow: '0 4px 20px rgba(168,85,247,0.3)',
                }}
              >
                Create Free Account →
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Note */}
      <p
        style={{
          textAlign: 'center',
          marginTop: '28px',
          fontSize: '13px',
          color: '#475569',
        }}
      >
        Both are free. The account just makes the extension smarter over time.
      </p>
    </section>
  )
}

// ─── LockedFeaturesSection ─────────────────────────────────────────────────

const barHeights = [40, 65, 35, 80, 55, 90, 70, 85, 60, 95]

const dotColors = ['#a855f7', '#22d3ee', '#ec4899', '#f59e0b', '#10b981', '#a855f7']

function FakeBarChart() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '5px',
        height: '80px',
        padding: '0 4px',
      }}
    >
      {barHeights.map((h, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${h}%`,
            background: `linear-gradient(to top, #a855f7, #22d3ee)`,
            borderRadius: '3px 3px 0 0',
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  )
}

function FakeDotGrid() {
  const rows = 4
  const cols = 6
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: '8px',
        padding: '8px',
      }}
    >
      {Array.from({ length: rows * cols }).map((_, i) => (
        <div
          key={i}
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: dotColors[i % dotColors.length],
            opacity: 0.55 + (i % 3) * 0.15,
            justifySelf: 'center',
          }}
        />
      ))}
    </div>
  )
}

function FakeRing() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px',
      }}
    >
      <div
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          border: '8px solid rgba(168,85,247,0.2)',
          boxShadow: 'inset 0 0 0 8px #a855f7, 0 0 24px rgba(168,85,247,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <span
          style={{
            fontSize: '22px',
            fontWeight: '800',
            color: '#f1f5f9',
          }}
        >
          87
        </span>
      </div>
    </div>
  )
}

function FakeAreaChart() {
  // Simulate an upward trend using divs of increasing height as columns with a gradient top edge
  const areaHeights = [20, 28, 22, 35, 40, 38, 52, 58, 62, 75]
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '3px',
        height: '80px',
        padding: '0 4px',
        position: 'relative',
      }}
    >
      {areaHeights.map((h, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${h}%`,
            background: `linear-gradient(to top, rgba(16,185,129,0.6), rgba(34,211,238,0.3))`,
            borderRadius: '2px 2px 0 0',
          }}
        />
      ))}
    </div>
  )
}

function LockedCard({ title, desc, children }) {
  return (
    <div
      style={{
        background: '#0d1424',
        border: '1px solid rgba(168,85,247,0.15)',
        borderRadius: '16px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Card title */}
      <div
        style={{
          padding: '16px 18px 10px',
          borderBottom: '1px solid rgba(168,85,247,0.1)',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.02em' }}>
          {title}
        </span>
      </div>

      {/* Blurred content area */}
      <div style={{ position: 'relative', minHeight: '110px' }}>
        {/* Blurred visual */}
        <div
          style={{
            filter: 'blur(5px)',
            padding: '12px',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          {children}
        </div>

        {/* Lock overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(4,8,18,0.45)',
          }}
        >
          <span
            style={{
              fontSize: '12px',
              fontWeight: '700',
              background: 'rgba(168,85,247,0.2)',
              border: '1px solid rgba(168,85,247,0.4)',
              color: '#d8b4fe',
              borderRadius: '20px',
              padding: '5px 14px',
              letterSpacing: '0.03em',
              backdropFilter: 'blur(4px)',
            }}
          >
            🔒 Unlock with free account
          </span>
        </div>
      </div>

      {/* Description */}
      <div
        style={{
          padding: '12px 18px 18px',
          borderTop: '1px solid rgba(168,85,247,0.08)',
        }}
      >
        <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: '1.5' }}>{desc}</p>
      </div>
    </div>
  )
}

export function LockedFeaturesSection() {
  return (
    <section style={{ background: '#040812', padding: '80px 32px' }}>
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h2
          style={{
            fontSize: 'clamp(24px, 4vw, 36px)',
            fontWeight: '700',
            color: '#f1f5f9',
            margin: '0 0 12px',
            letterSpacing: '-0.02em',
          }}
        >
          What your data looks like after 30 days
        </h2>
        <p
          style={{
            fontSize: '16px',
            color: '#94a3b8',
            maxWidth: '480px',
            margin: '0 auto',
            lineHeight: '1.6',
          }}
        >
          Create a free account and your extension starts building this automatically.
        </p>
      </div>

      {/* 2×2 grid */}
      <div
        style={{
          maxWidth: '780px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
        }}
      >
        <LockedCard
          title="Session Performance Timeline"
          desc="See earnings, viewers, and engagement across every session"
        >
          <FakeBarChart />
        </LockedCard>

        <LockedCard
          title="Fan Behavior Matrix"
          desc="Know which fans tip, when they're active, and how to re-engage them"
        >
          <FakeDotGrid />
        </LockedCard>

        <LockedCard
          title="AI Performance Score"
          desc="Your personalized creator score based on engagement, retention, and revenue patterns"
        >
          <FakeRing />
        </LockedCard>

        <LockedCard
          title="Revenue Trend Analysis"
          desc="Track whether your income is growing, plateauing, or at risk — with specific actions"
        >
          <FakeAreaChart />
        </LockedCard>
      </div>

      {/* CTA banner */}
      <div
        style={{
          maxWidth: '780px',
          margin: '36px auto 0',
          background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(236,72,153,0.08))',
          border: '1px solid rgba(168,85,247,0.25)',
          borderRadius: '18px',
          padding: '36px 32px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: '16px',
            color: '#cbd5e1',
            margin: '0 0 24px',
            lineHeight: '1.6',
            maxWidth: '540px',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          All of this builds automatically from your streams. Start today, unlock everything in your first session.
        </p>
        <a
          href="/signup"
          style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #a855f7, #ec4899)',
            color: '#fff',
            fontSize: '16px',
            fontWeight: '700',
            padding: '15px 36px',
            borderRadius: '12px',
            textDecoration: 'none',
            boxShadow: '0 4px 28px rgba(168,85,247,0.4)',
            letterSpacing: '0.01em',
          }}
        >
          Create Free Account — It&apos;s Free →
        </a>
      </div>
    </section>
  )
}

// ─── FinalCTASection ───────────────────────────────────────────────────────

const pills = [
  'No credit card',
  'Free forever',
  'Works in 60 seconds',
  '4 platforms supported',
]

export function FinalCTASection() {
  return (
    <>
      <section
        style={{
          width: '100%',
          padding: '100px 32px',
          textAlign: 'center',
          background: 'radial-gradient(ellipse at center, rgba(168,85,247,0.12) 0%, #040812 70%)',
          backgroundImage: `
            radial-gradient(ellipse at center, rgba(168,85,247,0.12) 0%, #040812 70%),
            repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(168,85,247,0.04) 39px, rgba(168,85,247,0.04) 40px),
            repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(168,85,247,0.04) 39px, rgba(168,85,247,0.04) 40px)
          `,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            maxWidth: '640px',
            margin: '0 auto',
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#a855f7',
              marginBottom: '16px',
            }}
          >
            Get Started Free
          </div>

          {/* H2 */}
          <h2
            style={{
              fontSize: 'clamp(28px, 5vw, 48px)',
              fontWeight: '800',
              margin: '0 0 20px',
              letterSpacing: '-0.03em',
              lineHeight: '1.15',
              background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Start understanding your stream tonight
          </h2>

          {/* Body */}
          <p
            style={{
              fontSize: '17px',
              color: '#94a3b8',
              lineHeight: '1.65',
              margin: '0 0 36px',
            }}
          >
            Install the extension, go live, and CamCash starts working immediately. Create a free account to unlock the analytics that make you grow.
          </p>

          {/* Feature pills */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '10px',
              marginBottom: '40px',
            }}
          >
            {pills.map((pill) => (
              <span
                key={pill}
                style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#22d3ee',
                  background: 'rgba(34,211,238,0.07)',
                  border: '1px solid rgba(34,211,238,0.2)',
                  borderRadius: '20px',
                  padding: '5px 14px',
                }}
              >
                {pill}
              </span>
            ))}
          </div>

          {/* Buttons */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '14px',
              marginBottom: '40px',
            }}
          >
            <a
              href="/signup"
              style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                color: '#fff',
                fontSize: '16px',
                fontWeight: '700',
                padding: '15px 36px',
                borderRadius: '12px',
                textDecoration: 'none',
                boxShadow: '0 4px 28px rgba(168,85,247,0.4)',
                letterSpacing: '0.01em',
              }}
            >
              Create Free Account →
            </a>
            <a
              href="#"
              style={{
                display: 'inline-block',
                border: '1px solid rgba(168,85,247,0.35)',
                color: '#d8b4fe',
                fontSize: '16px',
                fontWeight: '600',
                padding: '15px 36px',
                borderRadius: '12px',
                textDecoration: 'none',
                background: 'rgba(168,85,247,0.06)',
              }}
            >
              Try the Demo Again ↑
            </a>
          </div>

          {/* Trust line */}
          <p
            style={{
              fontSize: '13px',
              color: '#475569',
              margin: 0,
            }}
          >
            Used by cam models on Chaturbate, BongaCams, MyFreeCams, and Stripchat
          </p>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}

// ─── Color constants (shared) ─────────────────────────────────────────────────
const C = {
  bg:     '#040812',
  card:   '#0d1424',
  purple: '#a855f7',
  pink:   '#ec4899',
  cyan:   '#22d3ee',
  green:  '#10b981',
  gold:   '#f59e0b',
  white:  '#f1f5f9',
  muted:  '#94a3b8',
  dim:    '#475569',
  red:    '#ef4444',
  orange: '#f97316',
}

// ─── CSVImportSection ─────────────────────────────────────────────────────────
export function CSVImportSection() {
  const [active, setActive] = useState('chaturbate')

  const platforms = {
    chaturbate: {
      label: 'Chaturbate',
      color: C.orange,
      steps: [
        { step: '1', text: 'Go to chaturbate.com and log into your model account' },
        { step: '2', text: 'Click your username (top right) → My Profile' },
        { step: '3', text: 'Scroll down to "Stats & Tokens" → click "Token History"' },
        { step: '4', text: 'Set the date range (up to 12 months) and click "Export CSV"' },
        { step: '5', text: 'Upload the downloaded .csv file to CamCash below' },
      ],
      note: 'Chaturbate exports tip history with timestamps, token amounts, and viewer usernames — everything CamCash needs.',
    },
    bongacams: {
      label: 'BongaCams',
      color: C.pink,
      steps: [
        { step: '1', text: 'Log into your BongaCams model account' },
        { step: '2', text: 'Go to Statistics in the top navigation menu' },
        { step: '3', text: 'Select "Earnings" or "Token History" from the submenu' },
        { step: '4', text: 'Choose your date range and click "Export" or "Download CSV"' },
        { step: '5', text: 'Upload the file to CamCash — analysis runs instantly' },
      ],
      note: 'BongaCams CSVs include tip amounts, dates, and viewer IDs — fully compatible with CamCash.',
    },
    myfreecams: {
      label: 'MyFreeCams',
      color: C.cyan,
      steps: [
        { step: '1', text: 'Log into your MyFreeCams model account' },
        { step: '2', text: 'Go to Account → Transaction History' },
        { step: '3', text: 'Select "Tip & Token History" from the dropdown' },
        { step: '4', text: 'Set date range → click "Export to CSV"' },
        { step: '5', text: 'Upload the .csv to CamCash for instant fan insights' },
      ],
      note: 'MFC exports include tipper usernames, amounts, and timestamps — CamCash maps these to fan profiles automatically.',
    },
  }

  const p = platforms[active]

  return (
    <section style={{ padding: '80px 20px', background: 'rgba(4,8,18,0.98)' }}>
      <div style={{ maxWidth: '820px', margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            display: 'inline-block', fontSize: '11px', fontWeight: 800,
            letterSpacing: '2px', color: C.purple, textTransform: 'uppercase',
            background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)',
            borderRadius: '20px', padding: '4px 14px', marginBottom: '14px',
          }}>How to get your CSV</div>
          <h2 style={{ fontSize: 'clamp(22px,4vw,30px)', fontWeight: 800, color: C.white, margin: '0 0 10px', letterSpacing: '-0.5px' }}>
            Import your earnings in 2 minutes
          </h2>
          <p style={{ fontSize: '15px', color: C.muted, maxWidth: '520px', margin: '0 auto' }}>
            CamCash reads your platform's tip history CSV. Here's exactly where to find it for each platform.
          </p>
        </div>

        {/* Platform tabs */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '28px', flexWrap: 'wrap' }}>
          {Object.entries(platforms).map(([key, val]) => (
            <button key={key} onClick={() => setActive(key)} style={{
              padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
              cursor: 'pointer', border: '1px solid',
              background: active === key ? 'rgba(168,85,247,0.12)' : 'transparent',
              borderColor: active === key ? val.color : 'rgba(255,255,255,0.1)',
              color: active === key ? val.color : C.muted,
              transition: 'all 0.15s',
            }}>
              {val.label}
            </button>
          ))}
        </div>

        {/* Steps card */}
        <div style={{
          background: C.card, borderRadius: '14px',
          border: `1px solid ${p.color}33`, overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 20px', background: 'rgba(0,0,0,0.25)',
            borderBottom: `1px solid ${p.color}22`,
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: C.white }}>
              {p.label} — Step-by-step export guide
            </span>
          </div>

          <div style={{ padding: '20px' }}>
            {p.steps.map(({ step, text }) => (
              <div key={step} style={{ display: 'flex', gap: '14px', marginBottom: '14px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '6px', flexShrink: 0,
                  background: `${p.color}22`, border: `1px solid ${p.color}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 800, color: p.color,
                }}>{step}</div>
                <span style={{ fontSize: '14px', color: C.muted, lineHeight: 1.6, paddingTop: '2px' }}>{text}</span>
              </div>
            ))}

            <div style={{
              marginTop: '16px', padding: '12px 14px', borderRadius: '8px',
              background: `${p.color}08`, border: `1px solid ${p.color}22`,
              fontSize: '13px', color: C.muted, lineHeight: 1.6,
            }}>
              <span style={{ color: p.color, fontWeight: 700 }}>Note: </span>{p.note}
            </div>
          </div>
        </div>

        {/* Upload CTA */}
        <div style={{ textAlign: 'center', marginTop: '28px' }}>
          <a href="/landing" style={{
            display: 'inline-block', padding: '12px 32px', borderRadius: '10px',
            background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`,
            color: '#fff', fontWeight: 700, fontSize: '15px', textDecoration: 'none',
            boxShadow: '0 0 24px rgba(168,85,247,0.3)',
          }}>
            Upload your CSV free →
          </a>
          <p style={{ fontSize: '12px', color: C.dim, marginTop: '10px' }}>
            No account required to try · Instant analysis · Free forever
          </p>
        </div>
      </div>
    </section>
  )
}

// ─── FanProfilesSection ───────────────────────────────────────────────────────
const FAN_DATA = [
  { name: 'PurpleRain99',    lifetime: 2840, sessions: 34, avg: 83.5,  lastTip: '2h ago',   interval: '2.1 days', risk: 'low',    riskColor: C.green  },
  { name: 'xDarkMatter3',    lifetime: 1320, sessions: 21, avg: 62.9,  lastTip: '5h ago',   interval: '3.4 days', risk: 'low',    riskColor: C.green  },
  { name: 'euro_titan88',    lifetime:  960, sessions: 18, avg: 53.3,  lastTip: '1d ago',   interval: '4.1 days', risk: 'medium', riskColor: C.gold   },
  { name: 'kingwolf99',      lifetime:  750, sessions: 9,  avg: 83.3,  lastTip: '3d ago',   interval: '5.2 days', risk: 'medium', riskColor: C.gold   },
  { name: 'shadow_wolf_x',   lifetime:  480, sessions: 14, avg: 34.3,  lastTip: '6d ago',   interval: '3.8 days', risk: 'high',   riskColor: C.red    },
  { name: 'vaultmaster',     lifetime:  380, sessions: 11, avg: 34.5,  lastTip: '8d ago',   interval: '5.0 days', risk: 'high',   riskColor: C.red    },
  { name: 'nightcrawler_k',  lifetime:  240, sessions: 8,  avg: 30.0,  lastTip: '12d ago',  interval: '6.1 days', risk: 'high',   riskColor: C.red    },
  { name: 'redstar_tx',      lifetime:  195, sessions: 7,  avg: 27.9,  lastTip: '4d ago',   interval: '4.5 days', risk: 'medium', riskColor: C.gold   },
]

export function FanProfilesSection() {
  const [sort, setSort] = useState('lifetime')
  const sorted = [...FAN_DATA].sort((a, b) => b[sort] - a[sort])

  return (
    <section style={{ padding: '80px 20px', background: C.bg }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            display: 'inline-block', fontSize: '11px', fontWeight: 800,
            letterSpacing: '2px', color: C.cyan, textTransform: 'uppercase',
            background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)',
            borderRadius: '20px', padding: '4px 14px', marginBottom: '14px',
          }}>Fan Intelligence</div>
          <h2 style={{ fontSize: 'clamp(22px,4vw,30px)', fontWeight: 800, color: C.white, margin: '0 0 10px', letterSpacing: '-0.5px' }}>
            Know every fan who matters
          </h2>
          <p style={{ fontSize: '15px', color: C.muted, maxWidth: '520px', margin: '0 auto' }}>
            CamCash ranks your viewers by lifetime spend, tip frequency, and churn risk — so you know exactly who to focus on.
          </p>
        </div>

        {/* Sort controls */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {[['lifetime', 'Lifetime $'], ['sessions', 'Sessions'], ['avg', 'Avg/session']].map(([key, label]) => (
            <button key={key} onClick={() => setSort(key)} style={{
              padding: '6px 16px', borderRadius: '7px', fontSize: '12px', fontWeight: 700,
              cursor: 'pointer', border: '1px solid',
              background: sort === key ? 'rgba(34,211,238,0.1)' : 'transparent',
              borderColor: sort === key ? C.cyan : 'rgba(255,255,255,0.1)',
              color: sort === key ? C.cyan : C.muted,
              transition: 'all 0.15s',
            }}>{label}</button>
          ))}
        </div>

        {/* Fan table */}
        <div style={{ background: C.card, borderRadius: '14px', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 80px 70px 80px 90px 70px',
            padding: '10px 16px', background: 'rgba(0,0,0,0.3)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            fontSize: '10px', fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '1px',
            gap: '8px',
          }}>
            <span>Fan</span>
            <span style={{ textAlign: 'right' }}>Lifetime</span>
            <span style={{ textAlign: 'right' }}>Sessions</span>
            <span style={{ textAlign: 'right' }}>Avg/session</span>
            <span style={{ textAlign: 'right' }}>Last tip</span>
            <span style={{ textAlign: 'right' }}>Risk</span>
          </div>

          {sorted.map((fan, i) => (
            <div key={fan.name} style={{
              display: 'grid', gridTemplateColumns: '1fr 80px 70px 80px 90px 70px',
              padding: '12px 16px', gap: '8px', alignItems: 'center',
              borderBottom: i < sorted.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: C.white }}>{fan.name}</div>
                <div style={{ fontSize: '11px', color: C.dim }}>every {fan.interval}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: 700, color: C.green }}>${fan.lifetime.toLocaleString()}</div>
              <div style={{ textAlign: 'right', fontSize: '13px', color: C.muted }}>{fan.sessions}</div>
              <div style={{ textAlign: 'right', fontSize: '13px', color: C.muted }}>${fan.avg.toFixed(0)}</div>
              <div style={{ textAlign: 'right', fontSize: '12px', color: C.muted }}>{fan.lastTip}</div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  fontSize: '11px', fontWeight: 700, color: fan.riskColor,
                  background: `${fan.riskColor}18`, border: `1px solid ${fan.riskColor}33`,
                  borderRadius: '5px', padding: '2px 7px', textTransform: 'capitalize',
                }}>{fan.risk}</span>
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '12px', color: C.dim, textAlign: 'center', marginTop: '14px' }}>
          Demo data · Your real fan list populates after CSV upload
        </p>
      </div>
    </section>
  )
}

// ─── FanReEngagementSection ───────────────────────────────────────────────────
const AT_RISK = [
  {
    name: 'shadow_wolf_x',
    lifetime: 480,
    lastTip: '6 days ago',
    interval: '3.8 days',
    overdue: '2.2 days overdue',
    message: "Hey shadow_wolf_x 👋 haven't seen you in a bit — I've been doing something new this week that I think you'd love. Come check it out tonight 💜",
  },
  {
    name: 'vaultmaster',
    lifetime: 380,
    lastTip: '8 days ago',
    interval: '5.0 days',
    overdue: '3.0 days overdue',
    message: "vaultmaster — you've been one of my best recently and I miss you 😊 Streaming tonight at 10PM, reserved you a spot in my VIP list. Hope to see you 💜",
  },
  {
    name: 'nightcrawler_k',
    lifetime: 240,
    lastTip: '12 days ago',
    interval: '6.1 days',
    overdue: '5.9 days overdue',
    message: "nightcrawler_k — it's been way too long! I'm going live tonight with something special planned. First tip gets to pick what happens next 👀",
  },
]

export function FanReEngagementSection() {
  const [copied, setCopied] = useState(null)

  function handleCopy(name, msg) {
    navigator.clipboard.writeText(msg).catch(() => {})
    setCopied(name)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <section style={{ padding: '80px 20px', background: 'rgba(4,8,18,0.97)' }}>
      <div style={{ maxWidth: '820px', margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            display: 'inline-block', fontSize: '11px', fontWeight: 800,
            letterSpacing: '2px', color: C.red, textTransform: 'uppercase',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '20px', padding: '4px 14px', marginBottom: '14px',
          }}>Re-Engagement Alerts</div>
          <h2 style={{ fontSize: 'clamp(22px,4vw,30px)', fontWeight: 800, color: C.white, margin: '0 0 10px', letterSpacing: '-0.5px' }}>
            Catch whales before they disappear
          </h2>
          <p style={{ fontSize: '15px', color: C.muted, maxWidth: '540px', margin: '0 auto' }}>
            CamCash tracks tip intervals and flags fans who are overdue. Each alert includes a ready-to-send re-engagement message.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {AT_RISK.map((fan) => (
            <div key={fan.name} style={{
              background: C.card, borderRadius: '12px',
              border: '1px solid rgba(239,68,68,0.2)', overflow: 'hidden',
            }}>
              {/* Fan header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: 'rgba(239,68,68,0.04)',
                borderBottom: '1px solid rgba(239,68,68,0.12)', flexWrap: 'wrap', gap: '8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '8px',
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px',
                  }}>⚠️</div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: C.white }}>{fan.name}</div>
                    <div style={{ fontSize: '12px', color: C.dim }}>
                      Last tip: {fan.lastTip} · Usual interval: {fan.interval}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: C.dim }}>Lifetime value</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: C.green }}>${fan.lifetime}</div>
                  </div>
                  <div style={{
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                    borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, color: C.red,
                    display: 'flex', alignItems: 'center',
                  }}>{fan.overdue}</div>
                </div>
              </div>

              {/* Re-engagement message */}
              <div style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                  AI-generated re-engagement message
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '8px', padding: '12px 14px',
                  fontSize: '13px', color: C.muted, lineHeight: 1.65, marginBottom: '12px',
                }}>
                  "{fan.message}"
                </div>
                <button onClick={() => handleCopy(fan.name, fan.message)} style={{
                  padding: '7px 18px', borderRadius: '7px', fontSize: '12px', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid',
                  background: copied === fan.name ? 'rgba(16,185,129,0.12)' : 'rgba(168,85,247,0.08)',
                  borderColor: copied === fan.name ? C.green : 'rgba(168,85,247,0.3)',
                  color: copied === fan.name ? C.green : C.purple,
                  transition: 'all 0.2s',
                }}>
                  {copied === fan.name ? '✓ Copied!' : 'Copy message'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '12px', color: C.dim, textAlign: 'center', marginTop: '20px' }}>
          Demo data · Real alerts use your actual tip history and intervals
        </p>
      </div>
    </section>
  )
}

// ─── RoomTitleSection ─────────────────────────────────────────────────────────
const TITLE_SETS = {
  'chill-chat': {
    none:   'New model 💜 | come chat with me | getting comfortable tonight',
    small:  '💜 chill + chat | say hi — I\'ll say hi back | relaxed vibes only',
    big:    '💜 big goal tonight: 500 tokens = [special show] | tipping = instant attention | chat with me first',
    urgent: '⏳ LAST HOUR streaming tonight | 💜 big goal active — 500 to go | jump in NOW',
  },
  'interactive': {
    none:   '🎮 Lush is ON | control me with tips | tip menu in bio',
    small:  '🎮 Lush + tip control | every tip = reaction | tip menu active 💜',
    big:    '🎮 Lush ACTIVE 🔥 | tip to control me | Goal: 500 = I lose control 😈',
    urgent: '🎮 LAST SESSION TONIGHT | Lush on max sensitivity | 500 tokens left — hit goal before I go ⏳',
  },
  'naughty': {
    none:   '😈 naughty mode | tip menu open | come play 💜',
    small:  '😈 Feeling naughty | tip = pick what happens next | goal active 💜',
    big:    '🔥 Naughty Blonde | Goal: Oil Show @ 500 | Tip Menu Active 💦 | come watch',
    urgent: '🔥 LAST 45 MIN | oil show at 500 tokens — 120 away | tip NOW and I\'ll say your name 😈',
  },
  'goal-grind': {
    none:   '🎯 Token goal: unlock surprise show | tip to move the bar | tip menu open',
    small:  '🎯 Goal: 300 = [reward] | 120 tokens left | every tip counts 💜',
    big:    '🎯 BIG goal night: 1000 tokens = [full show] | tip fast — top tipper gets VIP treatment',
    urgent: '⏳ GOAL ENDS IN 30 MIN | 1000 tokens or it resets | 200 left — almost there 🔥',
  },
}

export function RoomTitleSection() {
  const [vibe, setVibe] = useState('chill-chat')
  const [goal, setGoal] = useState('small')
  const [copied, setCopied] = useState(false)

  const title = TITLE_SETS[vibe]?.[goal] ?? ''

  function handleCopy() {
    navigator.clipboard.writeText(title).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const vibeOptions = [
    { key: 'chill-chat',  label: 'Chill & Chat' },
    { key: 'interactive', label: 'Interactive Toy' },
    { key: 'naughty',     label: 'Naughty' },
    { key: 'goal-grind',  label: 'Goal Grind' },
  ]

  const goalOptions = [
    { key: 'none',   label: 'No goal' },
    { key: 'small',  label: 'Small goal' },
    { key: 'big',    label: 'Big goal' },
    { key: 'urgent', label: 'Urgent / ending soon' },
  ]

  return (
    <section style={{ padding: '80px 20px', background: C.bg }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            display: 'inline-block', fontSize: '11px', fontWeight: 800,
            letterSpacing: '2px', color: C.gold, textTransform: 'uppercase',
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: '20px', padding: '4px 14px', marginBottom: '14px',
          }}>Room Title Generator</div>
          <h2 style={{ fontSize: 'clamp(22px,4vw,30px)', fontWeight: 800, color: C.white, margin: '0 0 10px', letterSpacing: '-0.5px' }}>
            High-converting titles in seconds
          </h2>
          <p style={{ fontSize: '15px', color: C.muted, maxWidth: '500px', margin: '0 auto' }}>
            Pick your vibe and goal type — get a proven room title that hooks viewers and drives tips.
          </p>
        </div>

        {/* Vibe selector */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
            Your vibe
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {vibeOptions.map(({ key, label }) => (
              <button key={key} onClick={() => setVibe(key)} style={{
                padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', border: '1px solid',
                background: vibe === key ? 'rgba(245,158,11,0.12)' : 'transparent',
                borderColor: vibe === key ? C.gold : 'rgba(255,255,255,0.1)',
                color: vibe === key ? C.gold : C.muted,
                transition: 'all 0.15s',
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Goal selector */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
            Goal type
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {goalOptions.map(({ key, label }) => (
              <button key={key} onClick={() => setGoal(key)} style={{
                padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', border: '1px solid',
                background: goal === key ? 'rgba(245,158,11,0.12)' : 'transparent',
                borderColor: goal === key ? C.gold : 'rgba(255,255,255,0.1)',
                color: goal === key ? C.gold : C.muted,
                transition: 'all 0.15s',
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Generated title */}
        <div style={{
          background: C.card, borderRadius: '12px',
          border: `1px solid rgba(245,158,11,0.25)`, overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 16px', background: 'rgba(245,158,11,0.05)',
            borderBottom: '1px solid rgba(245,158,11,0.12)',
            fontSize: '10px', fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: '1px',
          }}>Generated title</div>
          <div style={{ padding: '18px 18px 14px' }}>
            <div style={{
              fontSize: '15px', color: C.white, lineHeight: 1.55,
              fontWeight: 600, marginBottom: '16px', minHeight: '46px',
            }}>
              {title}
            </div>
            <button onClick={handleCopy} style={{
              padding: '8px 22px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
              cursor: 'pointer', border: '1px solid',
              background: copied ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.1)',
              borderColor: copied ? C.green : 'rgba(245,158,11,0.3)',
              color: copied ? C.green : C.gold,
              transition: 'all 0.2s',
            }}>
              {copied ? '✓ Copied to clipboard!' : 'Copy this title'}
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <a href="/guides/chaturbate-room-title-generator" style={{
            fontSize: '13px', color: C.purple, textDecoration: 'none', fontWeight: 600,
          }}>
            → Open full Room Title Generator tool
          </a>
        </div>
      </div>
    </section>
  )
}
