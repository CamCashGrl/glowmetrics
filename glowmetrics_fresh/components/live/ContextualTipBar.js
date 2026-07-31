"use client"
import { useState } from 'react'
import { LM } from './theme'

export default function ContextualTipBar({ text }) {
  const [dismissed, setDismissed] = useState(false);
  if (!text || dismissed) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 12, marginTop: 12,
      background: 'rgba(255,155,34,0.08)', border: `1px solid rgba(255,155,34,0.3)`,
    }}>
      <span style={{ fontSize: 15 }} aria-hidden="true">💡</span>
      <div style={{ fontSize: 13, color: LM.textSecondary, flex: 1 }}>
        <strong style={{ color: LM.orange }}>Pro Tip:</strong> {text}
      </div>
      <button onClick={() => setDismissed(true)} aria-label="Dismiss tip" style={{ background: 'none', border: 'none', color: LM.textMuted, cursor: 'pointer', fontSize: 14 }}>✕</button>
    </div>
  )
}
