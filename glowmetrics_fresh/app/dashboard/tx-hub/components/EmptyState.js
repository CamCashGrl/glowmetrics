"use client"
import { C, card } from '../theme'

export default function EmptyState({ onUpload }) {
  return (
    <div style={{
      ...card({ padding: '64px 32px' }),
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(circle at 50% 0%, ${C.cyanSoft}, transparent 60%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        width: 64, height: 64, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(56,213,232,0.1)', border: `1px solid ${C.border}`, fontSize: 28, marginBottom: 20,
      }}>🧾</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.white, marginBottom: 8 }}>
        Your earnings hub is waiting for your data
      </div>
      <div style={{ fontSize: 14, color: C.muted, maxWidth: 440, lineHeight: 1.6, marginBottom: 28 }}>
        Upload your earnings CSV to start tracking transactions, tips, and revenue in one place.
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={onUpload} style={{
          padding: '12px 24px', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: `linear-gradient(90deg, ${C.cyan}, ${C.blue})`, color: '#06131a', fontWeight: 800, fontSize: 14,
          boxShadow: `0 0 24px rgba(56,213,232,0.25)`,
        }}>
          Upload Earnings Data
        </button>
        <a href="/dashboard?tab=help" style={{
          padding: '12px 24px', borderRadius: 12, border: `1px solid ${C.border}`, cursor: 'pointer',
          background: 'rgba(255,255,255,0.03)', color: C.text, fontWeight: 700, fontSize: 14, textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center',
        }}>
          Learn How It Works
        </a>
      </div>
    </div>
  )
}
