'use client'
import { useState } from 'react'

const C = {
  bg: '#12131a',
  card: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.10)',
  cyan: '#22D3EE',
  pink: '#EC4899',
  indigo: '#7C5CFF',
  white: '#F1F5F9',
  text: '#94A3B8',
  muted: '#475569',
  grad: 'linear-gradient(90deg,#22D3EE,#7C5CFF,#EC4899)',
}

const primaryBtn = (extra = {}) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 100,
  border: 'none',
  cursor: 'pointer',
  background: 'linear-gradient(90deg,#22D3EE,#a855f7,#EC4899)',
  color: '#000',
  fontWeight: 700,
  fontSize: 13,
  padding: '11px 22px',
  boxShadow: '0 0 30px rgba(255,61,196,0.35)',
  transition: 'transform 0.15s, box-shadow 0.15s',
  whiteSpace: 'nowrap',
  ...extra,
})

const secondaryBtn = (extra = {}) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 100,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.06)',
  color: C.white,
  fontWeight: 600,
  fontSize: 13,
  padding: '11px 22px',
  cursor: 'pointer',
  transition: 'background 0.15s',
  whiteSpace: 'nowrap',
  ...extra,
})

export function GettingStartedModal({
  bestHour = null,
  hourlyRate = null,
  onDismiss,
  onUpgrade,
  isTrialActive = false
}) {
  const [step, setStep] = useState(0)

  const steps = [
    {
      emoji: '📊',
      title: 'Your Best Hours',
      subtitle: bestHour ? `You earn most on ${bestHour.day}s around ${bestHour.hour}` : 'Loading your data...',
      description: bestHour
        ? `That's when your viewers are most generous. Schedule more time then for predictable income.`
        : 'We\'re analyzing your tips to find your peak earning times.',
      cta: 'See Full Analytics',
      icon: '📈'
    },
    {
      emoji: '💰',
      title: 'Your Hourly Rate',
      subtitle: hourlyRate ? `You earn ${hourlyRate}/hour on average` : 'Calculating...',
      description: hourlyRate
        ? `Based on your streaming time and tips. Pro users can track historical trends to improve this.`
        : 'We\'re calculating your earnings across all sessions.',
      cta: 'View Performance',
      icon: '💵'
    },
    {
      emoji: '🚀',
      title: isTrialActive ? 'Try Pro Features' : 'Unlock Pro',
      subtitle: isTrialActive ? 'Your 7-day trial is active' : 'See what pro unlocks',
      description: isTrialActive
        ? 'Get access to 90-day trends, cross-platform comparison, and advanced analytics during your trial.'
        : 'Pro users get 90-day historical data, cross-platform insights, and forecasting tools.',
      cta: isTrialActive ? 'Explore Pro Features' : 'Upgrade Now',
      icon: '✨'
    }
  ]

  const currentStep = steps[step]
  const progress = ((step + 1) / steps.length) * 100

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      zIndex: 1000,
    }}>
      <div style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 24,
        padding: 40,
        maxWidth: 480,
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background glow */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at top right, ${C.pink}22, transparent 50%)`,
          pointerEvents: 'none'
        }} />

        {/* Close button */}
        <button
          onClick={onDismiss}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '50%',
            width: 32,
            height: 32,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: C.text,
            fontSize: 18,
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.15)'}
          onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
        >
          ✕
        </button>

        {/* Progress */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            height: 2,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 1,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              background: C.grad,
              width: `${progress}%`,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{
            fontSize: 11,
            color: C.muted,
            marginTop: 8,
            textAlign: 'right'
          }}>
            {step + 1} of {steps.length}
          </div>
        </div>

        {/* Content */}
        <div style={{ textAlign: 'center', marginBottom: 32, position: 'relative', zIndex: 1 }}>
          <div style={{
            fontSize: 48,
            marginBottom: 16,
            display: 'inline-block'
          }}>
            {currentStep.emoji}
          </div>

          <h2 style={{
            fontSize: 22,
            fontWeight: 800,
            color: C.white,
            marginBottom: 4,
            letterSpacing: '-0.025em'
          }}>
            {currentStep.title}
          </h2>

          <p style={{
            fontSize: 13,
            color: C.cyan,
            fontWeight: 600,
            marginBottom: 12,
            letterSpacing: '0.05em'
          }}>
            {currentStep.subtitle}
          </p>

          <p style={{
            fontSize: 13,
            color: C.text,
            lineHeight: 1.6,
            marginBottom: 24,
            maxWidth: 400,
            margin: '0 auto 24px',
          }}>
            {currentStep.description}
          </p>
        </div>

        {/* CTA */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          gap: 12,
          marginBottom: 16,
        }}>
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              style={secondaryBtn({ flex: 1 })}
            >
              ← Back
            </button>
          )}
          <button
            onClick={() => {
              if (step === steps.length - 1) {
                onUpgrade()
              } else {
                setStep(step + 1)
              }
            }}
            style={primaryBtn({ flex: 1 })}
          >
            {currentStep.cta} →
          </button>
        </div>

        {/* Skip option */}
        <button
          onClick={onDismiss}
          style={{
            position: 'relative',
            zIndex: 1,
            background: 'none',
            border: 'none',
            color: C.muted,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            width: '100%',
            padding: '8px 0',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => e.target.style.color = C.text}
          onMouseLeave={(e) => e.target.style.color = C.muted}
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
