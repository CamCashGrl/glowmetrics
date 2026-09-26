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
  { id: 'privacy', label: '🔒 Privacy concerns', icon: '🔒' },
  { id: 'other', label: '❓ Other reason', icon: '❓' },
]

export default function DeleteAccountPopup({ isOpen, onConfirm, onCancel, isLoading }) {
  const [step, setStep] = useState('warning') // 'warning' | 'survey'
  const [selectedReason, setSelectedReason] = useState(null)
  const [details, setDetails] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState(null)

  if (!isOpen) return null

  const handleProceedToSurvey = () => {
    setStep('survey')
    setError(null)
  }

  const handleSubmitSurvey = () => {
    if (!selectedReason) {
      setError('Please select a reason')
      return
    }
    if (confirmText !== 'DELETE MY ACCOUNT') {
      setError('Please type "DELETE MY ACCOUNT" to confirm')
      return
    }
    onConfirm({ reason: selectedReason, details })
  }

  // WARNING STEP
  if (step === 'warning') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: C.card, borderRadius: 16, border: `2px solid ${C.red}`,
          padding: '40px', maxWidth: '480px',
          boxShadow: `0 0 30px rgba(248,113,113,0.2), 0 20px 60px rgba(0,0,0,0.5)`,
          animation: 'scaleIn 0.3s ease-out'
        }}>
          <style>{`
            @keyframes scaleIn {
              from { transform: scale(0.9); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
          `}</style>

          {/* Icon & Title */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: C.red, margin: 0, marginBottom: 8 }}>
              Delete Your Account?
            </h2>
            <p style={{ fontSize: 13, color: C.text, margin: 0, lineHeight: 1.6 }}>
              This action is permanent. We'll preserve your data for compliance purposes, but you'll lose access to:
            </p>
          </div>

          {/* Warning List */}
          <div style={{
            background: 'rgba(248,113,113,0.08)', border: `1px solid rgba(248,113,113,0.3)`,
            borderRadius: 10, padding: 16, marginBottom: 24
          }}>
            <div style={{ fontSize: 12, color: C.text, lineHeight: 1.8 }}>
              <div>❌ Access to your analytics dashboard</div>
              <div>❌ Your Pro subscription (if active)</div>
              <div>❌ All saved data and preferences</div>
              <div>❌ Ability to re-enable your account</div>
              <div style={{ color: C.green, marginTop: 8, borderTop: `1px solid rgba(255,255,255,0.1)`, paddingTop: 8 }}>
                ✓ Your data will be preserved for accounting & legal compliance
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={onCancel}
              disabled={isLoading}
              style={{
                flex: 1, padding: '12px 20px', borderRadius: 10,
                background: 'transparent', border: `2px solid ${C.border}`,
                color: C.text, fontSize: 13, fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleProceedToSurvey}
              disabled={isLoading}
              style={{
                flex: 1, padding: '12px 20px', borderRadius: 10,
                background: C.red, color: C.white, border: 'none',
                fontSize: 13, fontWeight: 700,
                cursor: isLoading ? 'not-allowed' : 'pointer'
              }}
              onMouseEnter={e => !isLoading && (e.target.style.background = '#dc2626')}
              onMouseLeave={e => !isLoading && (e.target.style.background = C.red)}
            >
              Continue with Deletion
            </button>
          </div>
        </div>
      </div>
    )
  }

  // SURVEY STEP
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
        animation: 'slideIn 0.3s ease-out'
      }}>
        <style>{`
          @keyframes slideIn {
            from { transform: translateX(20px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>

        {/* Header */}
        <h2 style={{ fontSize: 20, fontWeight: 800, color: C.white, margin: 0, marginBottom: 8 }}>
          Help us understand
        </h2>
        <p style={{ fontSize: 13, color: C.text, margin: 0, marginBottom: 24 }}>
          Your feedback helps us improve. This is required to proceed with deletion.
        </p>

        {/* Reasons */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', display: 'block', marginBottom: 12 }}>
            Why are you deleting your account? *
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {REASONS.map(reason => (
              <button
                key={reason.id}
                onClick={() => setSelectedReason(reason.id)}
                style={{
                  padding: '12px 16px', borderRadius: 10,
                  border: selectedReason === reason.id
                    ? `2px solid ${C.red}`
                    : `1px solid ${C.border}`,
                  background: selectedReason === reason.id
                    ? 'rgba(248,113,113,0.1)'
                    : 'transparent',
                  color: C.white, fontSize: 13, fontWeight: selectedReason === reason.id ? 700 : 600,
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s'
                }}
              >
                {reason.label}
              </button>
            ))}
          </div>
        </div>

        {/* Optional details */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            Any additional feedback? (Optional)
          </label>
          <textarea
            value={details}
            onChange={e => setDetails(e.target.value)}
            placeholder="Help us improve..."
            style={{
              width: '100%', padding: '12px', borderRadius: 8,
              border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)',
              color: C.white, fontSize: 12, fontFamily: 'inherit',
              resize: 'vertical', minHeight: '70px', boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Confirmation text */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.red, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            Type "DELETE MY ACCOUNT" to confirm *
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value.toUpperCase())}
            placeholder="DELETE MY ACCOUNT"
            style={{
              width: '100%', padding: '12px', borderRadius: 8,
              border: `1px solid ${confirmText === 'DELETE MY ACCOUNT' ? C.green : C.red}`,
              background: 'rgba(255,255,255,0.03)', color: C.white,
              fontSize: 12, boxSizing: 'border-box'
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
            onClick={() => setStep('warning')}
            disabled={isLoading}
            style={{
              flex: 1, padding: '12px 20px', borderRadius: 10,
              background: 'transparent', border: `1px solid ${C.border}`,
              color: C.text, fontSize: 13, fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            Back
          </button>
          <button
            onClick={handleSubmitSurvey}
            disabled={isLoading || confirmText !== 'DELETE MY ACCOUNT'}
            style={{
              flex: 1, padding: '12px 20px', borderRadius: 10,
              background: confirmText === 'DELETE MY ACCOUNT' ? C.red : 'rgba(248,113,113,0.3)',
              color: C.white, border: 'none', fontSize: 13, fontWeight: 700,
              cursor: isLoading || confirmText !== 'DELETE MY ACCOUNT' ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1
            }}
          >
            {isLoading ? '⏳ Deleting...' : '🗑️ Delete Account'}
          </button>
        </div>
      </div>
    </div>
  )
}
