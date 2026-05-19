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
