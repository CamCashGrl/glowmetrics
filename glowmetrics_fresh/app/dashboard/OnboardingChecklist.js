"use client"
// A visible, dismissible "what to do next" checklist for new accounts —
// distinct from DashboardProgressCard (which tracks raw data VOLUME toward
// full-confidence insights). This tracks discrete ACTIONS: have you actually
// looked at the report, your fans, Live Mode? Completing it should feel like
// progress, not just quietly stop mattering once there's enough data.
import { useEffect, useState } from 'react'

const C = {
  cyan: '#22D3EE', pink: '#EC4899', purple: '#a855f7', green: '#10B981',
  white: '#F1F5F9', muted: '#94A3B8', gold: '#F59E0B',
}
const GRAD = 'linear-gradient(90deg,#22D3EE,#a855f7,#EC4899)'
const DISMISS_KEY = 'camcash_checklist_dismissed'

export default function OnboardingChecklist({ tips = [], isPro = false, visitedTabs = [], platformCount = 0, onNavigate, onUpgrade }) {
  const [dismissed, setDismissed] = useState(true) // default true until localStorage read, avoids a flash on load
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === '1') } catch (_) {}
    setHydrated(true)
  }, [])

  const items = [
    { id: 'account', label: 'Create your account', done: true, tab: null },
    { id: 'upload',  label: 'Import your first tips', done: tips.length > 0, tab: 'upload' },
    { id: 'report',  label: 'Check your Creator Report', done: visitedTabs.includes('report'), tab: 'report' },
    { id: 'whales',  label: 'See your Top Fans', done: visitedTabs.includes('whales'), tab: 'whales' },
    { id: 'live',    label: 'Try Live Mode', done: visitedTabs.includes('live'), tab: 'live' },
  ]
  const doneCount = items.filter(i => i.done).length
  const pct = Math.round((doneCount / items.length) * 100)
  const allDone = doneCount === items.length

  // Shown once the core checklist is complete, as the natural next action —
  // kept OUT of items/doneCount so a user who genuinely only has one
  // platform to track isn't stuck below 100% forever. Free tracks up to 2
  // platforms (20260811_raise_free_tier_csv_platform_limit_to_two.sql), so
  // this always routes straight to Import — the actual upsell moment lives
  // on the Platforms tab once 2 platforms' worth of data exists there.
  const platformStep = {
    id: 'platform2',
    label: 'Add a 2nd platform',
    done: platformCount > 1,
    tab: 'upload',
    upgrade: false,
  }

  const dismiss = () => {
    setDismissed(true)
    try { localStorage.setItem(DISMISS_KEY, '1') } catch (_) {}
  }
  const reopen = () => {
    setDismissed(false)
    try { localStorage.removeItem(DISMISS_KEY) } catch (_) {}
  }

  if (!hydrated) return null

  // Collapsed pill — always available to bring the checklist back, so
  // dismissing it doesn't mean losing it forever.
  if (dismissed) {
    return (
      <button onClick={reopen} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '8px 14px', borderRadius: 100, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
        <span style={{ width: 14, height: 14, borderRadius: '50%', background: allDone ? C.green : 'transparent', border: allDone ? 'none' : `2px solid ${C.cyan}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#06101A', fontWeight: 900 }}>
          {allDone ? '✓' : ''}
        </span>
        {allDone ? 'Getting started — complete' : `Getting started — ${doneCount}/${items.length}`}
      </button>
    )
  }

  return (
    <div className={!allDone ? 'ob-checklist-glow' : ''} style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(12,16,34,0.7)', backdropFilter: 'blur(20px)', padding: '14px 18px', marginBottom: 18, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: GRAD, opacity: 0.85 }} />
      <button onClick={dismiss} aria-label="Dismiss checklist" style={{ position: 'absolute', top: 12, right: 14, background: 'transparent', border: 'none', color: C.muted, fontSize: 14, cursor: 'pointer', lineHeight: 1 }}>✕</button>

      {allDone ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 20 }}>🎉</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.white, marginBottom: 1 }}>You're all set up!</div>
              <div style={{ fontSize: 11, color: C.muted }}>You've explored everything CamCash has to offer on the free plan.</div>
            </div>
          </div>
          {!platformStep.done && (
            <div
              onClick={() => platformStep.upgrade ? onUpgrade?.('multi_platform') : onNavigate?.(platformStep.tab)}
              style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
              <span className="ob-todo-dot" style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.4)' }} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: C.white }}>{platformStep.label} →</span>
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 10, paddingRight: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.white, textTransform: 'uppercase', letterSpacing: 0.5 }}>Getting started</div>
            <div style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>{doneCount} of {items.length} complete</div>
          </div>
          <div style={{ height: 4, borderRadius: 100, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 12 }}>
            <div className="ob-progress-fill" style={{ height: '100%', width: `${pct}%`, background: GRAD, borderRadius: 100 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map(item => (
              <div key={item.id}
                onClick={() => {
                  if (item.done) return
                  if (item.upgrade) onUpgrade?.('multi_platform')
                  else if (item.tab) onNavigate?.(item.tab)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: !item.done && (item.tab || item.upgrade) ? 'pointer' : 'default' }}>
                <span className={!item.done ? 'ob-todo-dot' : ''} style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, background: item.done ? C.green : 'rgba(34,211,238,0.08)', border: item.done ? 'none' : '1px solid rgba(34,211,238,0.4)', color: '#06101A' }}>
                  {item.done ? '✓' : ''}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: item.done ? 500 : 600, color: item.done ? C.muted : C.white, opacity: item.done ? 0.7 : 1, textDecoration: item.done ? 'line-through' : 'none' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {!isPro && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: C.muted }}>✦ Bonus: explore Creator Pro when you're ready for more platforms and deeper insights.</span>
          <button onClick={onUpgrade} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.1)', color: C.purple, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>See Creator Pro</button>
        </div>
      )}

      <style jsx>{`
        @keyframes obProgressGrow { from { width: 0; } }
        @keyframes obProgressShimmer {
          0%, 100% { box-shadow: 0 0 6px rgba(34,211,238,0.35), 0 0 3px rgba(236,72,153,0.25); }
          50% { box-shadow: 0 0 14px rgba(34,211,238,0.65), 0 0 8px rgba(236,72,153,0.45); }
        }
        .ob-progress-fill { animation: obProgressGrow 0.6s ease-out, obProgressShimmer 3s ease-in-out 0.6s infinite; }
        @keyframes obAmbientGlow {
          0%, 100% { box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 rgba(34,211,238,0); }
          50% { box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 0 22px rgba(34,211,238,0.16), 0 0 14px rgba(168,85,247,0.1); }
        }
        .ob-checklist-glow { animation: obAmbientGlow 3.6s ease-in-out infinite; }
        @keyframes obTodoPulse {
          0%, 100% { box-shadow: 0 0 0 rgba(34,211,238,0); }
          50% { box-shadow: 0 0 8px rgba(34,211,238,0.55), 0 0 3px rgba(34,211,238,0.4); }
        }
        .ob-todo-dot { animation: obTodoPulse 2.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ob-progress-fill { animation: none; }
          .ob-checklist-glow { animation: none; }
          .ob-todo-dot { animation: none; }
        }
      `}</style>
    </div>
  )
}
