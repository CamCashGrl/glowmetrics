'use client'
import { useState } from 'react'

const C = {
  bg: "#05070f", card: "#0d1322", border: "#1e2d45",
  cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B",
  green: "#10B981", white: "#F1F5F9", muted: "#475569", text: "#94A3B8",
  purple: "#a855f7", red: "#F87171"
}

const REASONS = [
  { id: 'too_expensive', label: '💰 Too expensive', icon: '💰' },
  { id: 'not_using', label: "🚫 I'm not using it", icon: '🚫' },
  { id: 'switching', label: '🔄 Using competitor platform', icon: '🔄' },
  { id: 'features', label: '🎯 Missing features I need', icon: '🎯' },
  { id: 'support', label: '📞 Poor support experience', icon: '📞' },
  { id: 'business_closed', label: '⛔ No longer streaming', icon: '⛔' },
  { id: 'other', label: '❓ Other reason', icon: '❓' },
]

export default function ExitSurveyPopup({ onSubmit, isOpen, isLoading, surveyType = 'subscription_cancel' }) {
  const [selectedReason, setSelectedReason] = useState(null)
  const [details, setDetails] = useState('')
  const [error, setError] = useState(null)

  if (!isOpen) return null

  const handleSubmit = () => {
    if (!selectedReason) {
      setError('Please select a reason')
      return
    }
    onSubmit({ reason: selectedReason, details })
  }

  const title = surveyType === 'account_deletion'
    ? 'Before you go...'
    : 'Help us improve'

  const subtitle = surveyType === 'account_deletion'
    ? 'We\'d love to know why you\'re deleting your account'
    : 'Tell us why you\'re canceling so we can improve'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: C.card, borderRadius: 16, border: `1px solid ${C.border}`,
        padding: '40px', maxWidth: '520px', maxHeight: '80vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        animation: 'scaleIn 0.3s ease-out'
      }}>
        <style>{`
          @keyframes scaleIn {
            from { transform: scale(0.9); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        `}</style>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: C.white, margin: 0, marginBottom: 8 }}>
            {title}
          </h2>
          <p style={{ fontSize: 13, color: C.text, margin: 0 }}>
            {subtitle} (Required to proceed)
          </p>
        </div>

        {/* Reasons Grid */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', display: 'block', marginBottom: 12 }}>
            What's the main reason? *
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {REASONS.map(reason => (
              <button
                key={reason.id}
                onClick={() => { setSelectedReason(reason.id); setError(null) }}
                style={{
                  padding: '12px 16px', borderRadius: 10,
                  border: selectedReason === reason.id
                    ? `2px solid ${C.purple}`
                    : `1px solid ${C.border}`,
                  background: selectedReason === reason.id
                    ? 'rgba(168,85,247,0.15)'
                    : 'transparent',
                  color: C.white, fontSize: 13, fontWeight: selectedReason === reason.id ? 700 : 600,
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.target.style.borderColor = C.purple}
                onMouseLeave={e => !selectedReason !== reason.id && (e.target.style.borderColor = C.border)}
              >
                {reason.label}
              </button>
            ))}
          </div>
        </div>

        {/* Optional Details */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            Any additional context? (Optional)
          </label>
          <textarea
            value={details}
            onChange={e => setDetails(e.target.value)}
            placeholder="Help us understand how we can improve..."
            style={{
              width: '100%', padding: '12px', borderRadius: 8,
              border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)',
              color: C.white, fontSize: 12, fontFamily: 'inherit',
              resize: 'vertical', minHeight: '80px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            fontSize: 12, color: C.red, background: 'rgba(248,113,113,0.15)',
            padding: '10px 12px', borderRadius: 6, marginBottom: 16
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            style={{
              flex: 1, padding: '12px 20px', borderRadius: 10,
              background: C.purple, color: C.white, border: 'none',
              fontSize: 13, fontWeight: 700, cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', opacity: isLoading ? 0.7 : 1
            }}
            onMouseEnter={e => !isLoading && (e.target.style.transform = 'scale(1.02)')}
            onMouseLeave={e => !isLoading && (e.target.style.transform = 'scale(1)')}
          >
            {isLoading ? '⏳ Processing...' : '✓ Submit'}
          </button>
        </div>

        <div style={{
          fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 12
        }}>
          This feedback helps us serve you better
        </div>
      </div>
    </div>
  )
}
