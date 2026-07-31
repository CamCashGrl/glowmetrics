"use client"
import { LM, labelStyle } from './theme'
import { TRIGGER_ICON, promptConfidence, promptImpact } from '../../lib/coaching/triggers'

const outerStyle = {
  border: `1.5px solid ${LM.magenta}`,
  borderRadius: 16,
  padding: 26,
  marginBottom: 12,
  background: `linear-gradient(135deg, rgba(139,92,246,0.16), rgba(232,42,184,0.1))`,
  boxShadow: '0 0 36px rgba(232,42,184,0.18)',
};

// Splits triggers.js's combined "context — action" message back into its
// two halves for display — never a second copy of the trigger's copy, just
// a display-time split of the one string the server already sends.
function splitReason(prompt) {
  const sep = ' — ';
  const idx = prompt.message?.indexOf(sep);
  if (idx == null || idx === -1) return { reason: prompt.title, action: prompt.message };
  return { reason: prompt.message.slice(0, idx), action: prompt.message.slice(idx + sep.length) };
}

// One canonical active prompt at a time (server-enforced — see
// coaching_events dedup). promptsPaused is a client-only Quick Actions
// toggle: it stops polling for/showing new prompts without touching the
// underlying session or its coaching history.
export default function CoachingPromptCard({ prompt, promptsPaused, goal, onPerform, onSkip, busy }) {
  return (
    <div style={outerStyle} aria-live="polite">
      <div style={{ ...labelStyle, marginBottom: 16, fontSize: 12, color: LM.text }}>🤖 Current AI Coach</div>

      {promptsPaused ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: LM.textSecondary, fontSize: 14 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: LM.textMuted }} />
          Coaching prompts are paused. Resume from Quick Actions to see new recommendations.
        </div>
      ) : !prompt ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: LM.green, animation: 'lm-breathe 1.6s ease-in-out infinite' }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: LM.text }}>Coaching is active</div>
            <div style={{ fontSize: 13, color: LM.textMuted, marginTop: 2 }}>Your next recommendation will appear as activity is detected.</div>
          </div>
        </div>
      ) : (
        <div key={prompt.id} style={{ display: 'grid', gridTemplateColumns: goal ? '1fr 200px' : '1fr', gap: 20, alignItems: 'center', animation: 'lm-fade-in 0.35s ease' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999,
                background: 'rgba(255,155,34,0.15)', border: '1px solid rgba(255,155,34,0.35)', color: LM.orange,
                fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase',
              }}>
                {TRIGGER_ICON[prompt.type] || '💡'} {(prompt.category || prompt.type || 'coaching').replace(/_/g, ' ')}
              </span>
              {prompt.priority === 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: LM.magenta }}>● High Priority</span>
              )}
              <span style={{ fontSize: 11, fontWeight: 700, color: LM.cyan }}>AI Confidence {promptConfidence(prompt.type)}%</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: LM.green }}>Impact: {promptImpact(prompt.type)}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: LM.text, letterSpacing: -0.3 }}>{prompt.title}</div>
            {(() => {
              const { reason, action } = splitReason(prompt);
              return (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: LM.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12 }}>Why</div>
                  <div style={{ fontSize: 14, color: LM.textSecondary, marginTop: 2 }}>{reason}</div>
                  {action !== reason && (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: LM.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10 }}>Do this now</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: LM.text, marginTop: 2 }}>{action}</div>
                    </>
                  )}
                </>
              );
            })()}
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button
                onClick={onPerform}
                disabled={busy}
                aria-label="Mark this coaching prompt as performed"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '13px 24px', borderRadius: 12, border: 'none',
                  background: LM.magenta, color: '#fff', fontWeight: 800, fontSize: 14, cursor: busy ? 'default' : 'pointer',
                  opacity: busy ? 0.6 : 1, boxShadow: '0 0 20px rgba(232,42,184,0.4)',
                }}
              >
                ✓ Mark as Performed
              </button>
              <button
                onClick={onSkip}
                disabled={busy}
                aria-label="Skip this coaching prompt"
                style={{
                  padding: '13px 22px', borderRadius: 12, background: LM.surface, border: `1px solid ${LM.borderStrong}`,
                  color: LM.textSecondary, fontWeight: 700, fontSize: 14, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
                }}
              >
                Skip
              </button>
            </div>
          </div>
          {goal && (
            <div style={{ textAlign: 'center', padding: '14px 10px', borderRadius: 12, background: 'rgba(0,0,0,0.2)', border: `1px solid ${LM.border}` }}>
              <div style={{ position: 'relative', width: 84, height: 84, margin: '0 auto' }}>
                <svg viewBox="0 0 84 84" width={84} height={84}>
                  <circle cx="42" cy="42" r="36" fill="none" stroke={LM.border} strokeWidth="8" />
                  <circle cx="42" cy="42" r="36" fill="none" stroke={LM.orange} strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 36}`} strokeDashoffset={`${2 * Math.PI * 36 * (1 - Math.min(1, goal.pct / 100))}`}
                    transform="rotate(-90 42 42)" style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1)' }} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, color: LM.text }}>
                  {Math.round(goal.pct)}%
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: LM.text, marginTop: 8 }}>{goal.currentLabel} / {goal.targetLabel}</div>
              <div style={{ fontSize: 11, color: LM.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{goal.name}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
