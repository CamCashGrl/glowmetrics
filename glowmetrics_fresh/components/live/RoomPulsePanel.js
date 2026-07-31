"use client"
import { LM, labelStyle } from './theme'

function Bar({ label, pct, color }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: LM.textSecondary, marginBottom: 5 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color: LM.text }}>{pct}%</span>
      </div>
      <div style={{ height: 7, borderRadius: 6, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}
        role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 6, background: `linear-gradient(90deg, ${color}88, ${color})`,
          transformOrigin: 'left', animation: 'lm-bar-fill 0.8s cubic-bezier(0.16,1,0.3,1)',
          transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)',
        }} />
      </div>
    </div>
  )
}

// The centerpiece of Live Mode: one glanceable "is my room hot right now,
// and why" hero. Reuses computeRoomHealth()'s existing score/state/bars —
// no second, competing health number is computed here.
export default function RoomPulsePanel({ roomHealth, liveActive, hasSession }) {
  const offline = !liveActive
  const waiting = liveActive && !hasSession

  return (
    <div
      style={{
        marginBottom: 12, borderRadius: 16, padding: 22,
        background: `linear-gradient(135deg, ${roomHealth.bg || 'rgba(71,85,105,0.1)'} 0%, ${LM.panel} 65%)`,
        border: `1px solid ${hasSession ? roomHealth.border : LM.border}`,
        boxShadow: hasSession ? `0 0 32px ${roomHealth.bg}` : '0 8px 24px rgba(0,0,0,0.28)',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{ ...labelStyle, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: hasSession ? roomHealth.color : LM.textMuted,
          animation: hasSession ? 'lm-breathe 1.8s ease-in-out infinite' : 'none',
        }} />
        Room Pulse
      </div>

      {offline ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '6px 0' }}>
          <span style={{ fontSize: 32 }}>💤</span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: LM.text }}>Not watching a room yet</div>
            <div style={{ fontSize: 13, color: LM.textMuted, marginTop: 2 }}>Start Stream to have CamCash watch your room in real time and coach you as it moves.</div>
          </div>
        </div>
      ) : waiting ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '6px 0' }}>
          <span style={{ fontSize: 28, animation: 'lm-breathe 1.6s ease-in-out infinite' }}>👀</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: LM.text }}>Watching your room…</div>
            <div style={{ fontSize: 13, color: LM.textMuted, marginTop: 2 }}>Listening for tip events. Room Pulse lights up the moment activity starts.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 260px) 1fr', gap: 24, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 34 }}>{roomHealth.emoji}</span>
              <span style={{ fontSize: 26, fontWeight: 900, color: roomHealth.color, letterSpacing: -0.5, textTransform: 'uppercase' }}>{roomHealth.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <span style={{ fontSize: 12.5, color: LM.textSecondary }}>AI Confidence</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: LM.text }}>{roomHealth.confidence}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: roomHealth.directionColor }}>{roomHealth.directionLabel}</span>
            </div>
            <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(roomHealth.reasons || []).map((r, i) => (
                <li key={i} style={{ fontSize: 12, color: LM.textMuted, display: 'flex', gap: 6 }}>
                  <span style={{ color: roomHealth.color }}>•</span>{r}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Bar label="Tip Velocity" pct={roomHealth.bars?.velocity ?? 0} color={LM.cyan} />
            <Bar label="Whale Activity" pct={roomHealth.bars?.whale ?? 0} color={LM.magenta} />
            <Bar label="Momentum" pct={roomHealth.bars?.momentum ?? 0} color={LM.orange} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 2 }}>
              {(roomHealth.confidenceBreakdown || []).map((c) => (
                <span key={c.label} style={{ fontSize: 11, color: c.met ? LM.text : LM.textMuted }}>
                  {c.met ? '✔' : '·'} {c.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
