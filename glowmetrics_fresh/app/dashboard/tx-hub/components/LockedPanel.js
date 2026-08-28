"use client"
import { C, card } from '../theme'

export default function LockedPanel({ title, description, onUpgrade }) {
  return (
    <div style={{ ...card({ padding: 22 }), position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(circle at 100% 0%, rgba(168,85,247,0.10), transparent 55%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: 'rgba(168,85,247,0.14)',
          border: '1px solid rgba(168,85,247,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0,
        }}>✦</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.white }}>{title}</div>
            <span style={{ fontSize: 10, fontWeight: 800, color: C.purple, background: 'rgba(168,85,247,0.14)', border: '1px solid rgba(168,85,247,0.35)', padding: '2px 8px', borderRadius: 100 }}>PRO</span>
          </div>
          <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6, marginBottom: 12 }}>{description}</div>
          <button onClick={onUpgrade} style={{
            padding: '7px 16px', borderRadius: 100, border: '1px solid rgba(168,85,247,0.5)',
            background: 'rgba(168,85,247,0.14)', color: C.purple, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>Upgrade to Pro</button>
        </div>
      </div>
    </div>
  )
}
