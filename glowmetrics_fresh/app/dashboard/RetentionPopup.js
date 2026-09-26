'use client'
import { useState } from 'react'

const C = {
  bg: "#05070f", card: "#0d1322", border: "#1e2d45",
  cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B",
  green: "#10B981", white: "#F1F5F9", muted: "#475569", text: "#94A3B8",
  purple: "#a855f7", red: "#F87171"
}

export default function RetentionPopup({ onAccept, onDecline, isOpen, isLoading }) {
  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: C.card, borderRadius: 16, border: `2px solid ${C.gold}`,
        padding: '40px', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        animation: 'scaleIn 0.3s ease-out'
      }}>
        <style>{`
          @keyframes scaleIn {
            from { transform: scale(0.9); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        `}</style>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💰</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: C.white, margin: 0, marginBottom: 8 }}>
            Wait! We have a special offer
          </h2>
          <p style={{ fontSize: 14, color: C.text, margin: 0 }}>
            Don't want to cancel? Try Pro at 50% off
          </p>
        </div>

        {/* Offer Details */}
        <div style={{
          background: 'rgba(168,85,247,0.1)', border: `1px solid ${C.purple}`,
          borderRadius: 12, padding: 20, marginBottom: 24
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: C.cyan, marginBottom: 8 }}>
              50% OFF
            </div>
            <div style={{ fontSize: 13, color: C.text, marginBottom: 12 }}>
              First month for new subscribers
            </div>
            <div style={{
              fontSize: 12, color: C.muted, background: 'rgba(255,255,255,0.04)',
              padding: '8px 12px', borderRadius: 6
            }}>
              ✓ Full Pro features access
              ✓ Unlimited platforms & historical data
              ✓ Advanced analytics & insights
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={onAccept}
            disabled={isLoading}
            style={{
              flex: 1, padding: '14px 24px', borderRadius: 10,
              background: C.gold, color: '#05070f', border: 'none',
              fontSize: 14, fontWeight: 700, cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', opacity: isLoading ? 0.7 : 1
            }}
            onMouseEnter={e => !isLoading && (e.target.style.transform = 'scale(1.02)')}
            onMouseLeave={e => !isLoading && (e.target.style.transform = 'scale(1)')}
          >
            {isLoading ? '⏳ Processing...' : '🎉 Claim 50% Off'}
          </button>
          <button
            onClick={onDecline}
            disabled={isLoading}
            style={{
              flex: 1, padding: '14px 24px', borderRadius: 10,
              background: 'transparent', border: `2px solid ${C.border}`,
              color: C.text, fontSize: 14, fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => !isLoading && (e.target.style.borderColor = C.text)}
            onMouseLeave={e => !isLoading && (e.target.style.borderColor = C.border)}
          >
            Cancel Anyway
          </button>
        </div>

        {/* Disclaimer */}
        <div style={{
          fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 16,
          borderTop: `1px solid ${C.border}`, paddingTop: 16
        }}>
          This offer is valid for first-time subscribers. You can cancel anytime with no penalty.
        </div>
      </div>
    </div>
  )
}
