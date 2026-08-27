'use client'
// ═══════════════════════════════════════════════════════════════════════════
// CONVERSION LOOP + UNLOCK ANNOUNCEMENTS — the Command Center's live band.
//
// Two things share this strip, in strict priority:
//
//   1. AN UNLOCK, when one just happened. "We just uncovered ..." — this is
//      the moment the Creator Report has been counting down to, and it is
//      announced HERE because an unlocked insight is an insight, and insights
//      live in the Command Center. It also disappears from the report the
//      moment it lands.
//   2. Otherwise, one rotating conversion prompt, each conditional on
//      something already true in her data (see lib/conversionLoop.js).
//
// The rotation advances off the clock rather than a timer, so it is stable
// across re-renders and cannot flicker. One line at a time, 45 seconds each —
// present, not nagging. Dismissing the loop silences it for the session.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { C, GRADIENT } from './theme'

const ROTATE_MS = 45000

export default function ConversionLoop({
  prompts = [],
  unlocked = [],
  onUpgrade,
  onDismiss,
}) {
  const [tick, setTick] = useState(0)
  const [hidden, setHidden] = useState(false)

  // Re-render on the rotation boundary. The prompt itself is chosen from the
  // clock, so this interval only nudges React — it holds no state of its own.
  useEffect(() => {
    if (!prompts.length) return undefined
    const t = setInterval(() => setTick(n => n + 1), ROTATE_MS)
    return () => clearInterval(t)
  }, [prompts.length])

  if (hidden) return null

  // An unlock outranks any prompt — it is news, not an offer.
  if (unlocked.length) {
    const u = unlocked[0]
    const more = unlocked.length - 1
    return (
      <div style={{ ...band, borderColor: 'rgba(16,185,129,0.45)', boxShadow: '0 0 30px rgba(16,185,129,0.14)' }}>
        <span style={{ fontSize: 16, flexShrink: 0 }} aria-hidden="true">🔓</span>
        <div style={{ flex: '1 1 260px', minWidth: 0, fontSize: 13, color: C.white, lineHeight: 1.6 }}>
          <strong style={{ color: C.green }}>Just uncovered:</strong> {u.title.toLowerCase()} — your last import carried it over the line.
          {more > 0 && <span style={{ color: C.muted }}> {more} more unlocked too.</span>}
        </div>
      </div>
    )
  }

  if (!prompts.length) return null
  const p = prompts[Math.floor(Date.now() / ROTATE_MS) % prompts.length]
  if (!p) return null

  return (
    <div key={p.id} style={band}>
      <span style={{ fontSize: 15, flexShrink: 0 }} aria-hidden="true">🔎</span>

      <div style={{ flex: '1 1 280px', minWidth: 0, fontSize: 13, color: C.text, lineHeight: 1.6 }}>
        {p.line}
      </div>

      <button onClick={() => onUpgrade?.(p.source)} style={{
        flexShrink: 0, padding: '8px 16px', borderRadius: 100, border: 'none', cursor: 'pointer',
        background: GRADIENT, color: '#06101A', fontSize: 12, fontWeight: 850,
      }}>{p.cta} →</button>

      <button
        onClick={() => { setHidden(true); onDismiss?.() }}
        aria-label="Hide these prompts"
        style={{
          flexShrink: 0, width: 26, height: 26, borderRadius: '50%', cursor: 'pointer',
          background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
          color: C.muted, fontSize: 13, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>

      {/* Which of the rotating lines is showing. Orientation, not decoration. */}
      {prompts.length > 1 && (
        <div style={{ display: 'flex', gap: 4, flexBasis: '100%', paddingTop: 2 }} aria-hidden="true">
          {prompts.map(x => (
            <span key={x.id} style={{
              height: 2, flex: 1, borderRadius: 2,
              background: x.id === p.id ? C.cyan : 'rgba(255,255,255,0.10)',
            }} />
          ))}
        </div>
      )}
    </div>
  )
}

const band = {
  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
  padding: '12px 14px', borderRadius: 14, marginBottom: 14,
  background: 'rgba(15,20,32,0.75)', backdropFilter: 'blur(20px)',
  border: '1px solid rgba(124,92,255,0.30)',
  boxShadow: '0 0 30px rgba(124,92,255,0.10)',
}
