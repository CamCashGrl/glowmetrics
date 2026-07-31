"use client"
import { LM } from './theme'

export default function LiveHeader({ isLive, onSettings, onEndSession, onPauseResume, isPaused, canEndSession }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          padding: '3px 10px', borderRadius: 999, border: `1px solid ${LM.green}`, color: LM.green,
          fontSize: 11, fontWeight: 800, letterSpacing: 0.6,
        }}>
          {isLive ? 'LIVE' : 'OFFLINE'}
        </span>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: LM.text, margin: 0 }}>Live Mode</h1>
        <span style={{ color: LM.textMuted }}>·</span>
        <span style={{ fontSize: 13, color: LM.textMuted }}>Real-time coaching &amp; insights</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {canEndSession && (
          <button onClick={onPauseResume} style={{
            padding: '8px 14px', borderRadius: 9, background: LM.card, border: `1px solid ${LM.border}`,
            color: LM.textSecondary, fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
          }}>
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>
        )}
        <button onClick={onSettings} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9,
          background: LM.card, border: `1px solid ${LM.border}`, color: LM.textSecondary, fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
        }}>
          ⚙ Settings
        </button>
        {canEndSession && (
          <button onClick={onEndSession} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9,
            background: 'rgba(255,77,94,0.08)', border: `1px solid ${LM.red}`, color: LM.red, fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
          }}>
            ⏻ End Session
          </button>
        )}
      </div>
    </div>
  )
}
