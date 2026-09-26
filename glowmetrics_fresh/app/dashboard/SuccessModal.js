'use client'
import { useEffect } from 'react'

const C = {
  bg: "#05070f", card: "#0d1322", border: "#1e2d45",
  cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B",
  green: "#10B981", white: "#F1F5F9", muted: "#475569", text: "#94A3B8",
  purple: "#a855f7", red: "#F87171"
}

export default function SuccessModal({ message, icon = '✓', isOpen, onClose, autoCloseMs = 5000 }) {
  useEffect(() => {
    if (!isOpen || !autoCloseMs) return
    const timer = setTimeout(onClose, autoCloseMs)
    return () => clearTimeout(timer)
  }, [isOpen, autoCloseMs, onClose])

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .success-modal {
          animation: slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>

      <div className="success-modal" style={{
        background: C.card, borderRadius: 16,
        padding: '40px', maxWidth: '400px',
        textAlign: 'center',
        border: `2px solid ${C.green}`,
        boxShadow: `0 0 30px rgba(16,185,129,0.3), 0 20px 60px rgba(0,0,0,0.5)`
      }}>
        {/* Icon */}
        <div style={{
          fontSize: 56, marginBottom: 20,
          animation: 'bounce 0.6s ease-out'
        }}>
          {icon}
        </div>

        {/* Message */}
        <h2 style={{
          fontSize: 20, fontWeight: 800, color: C.white,
          margin: 0, marginBottom: 12
        }}>
          Success!
        </h2>

        <p style={{
          fontSize: 14, color: C.text, margin: 0, lineHeight: 1.5
        }}>
          {message}
        </p>

        {/* Progress indicator */}
        {autoCloseMs && (
          <div style={{
            height: 3, background: 'rgba(255,255,255,0.1)',
            borderRadius: 2, marginTop: 20, overflow: 'hidden'
          }}>
            <div style={{
              height: '100%', background: C.green,
              animation: `shrink ${autoCloseMs}ms linear forwards`
            }} />
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            marginTop: 20, padding: '10px 24px', borderRadius: 8,
            background: 'rgba(16,185,129,0.15)', border: `1px solid ${C.green}`,
            color: C.green, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.2s'
          }}
          onMouseEnter={e => e.target.style.background = 'rgba(16,185,129,0.25)'}
          onMouseLeave={e => e.target.style.background = 'rgba(16,185,129,0.15)'}
        >
          Got it
        </button>

        <style>{`
          @keyframes bounce {
            0% { transform: scale(0) rotate(-45deg); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
          @keyframes shrink {
            from { width: 100%; }
            to { width: 0%; }
          }
        `}</style>
      </div>
    </div>
  )
}
