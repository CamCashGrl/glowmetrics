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

export default function OnboardingChecklist({ tips = [], isPro = false, visitedTabs = [], onNavigate, onUpgrade }) {
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
    <div style={{ borderRadius: 20, border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(12,16,34,0.78)', backdropFilter: 'blur(20px)', padding: '18px 22px', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: GRAD }} />
      <button onClick={dismiss} aria-label="Dismiss checklist" style={{ position: 'absolute', top: 14, right: 16, background: 'transparent', border: 'none', color: C.muted, fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>

      {allDone ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 26 }}>🎉</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 2 }}>You're all set up!</div>
            <div style={{ fontSize: 12, color: C.muted }}>You've explored everything CamCash has to offer on the free plan.</div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 14, paddingRight: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 2 }}>Getting started</div>
            <div style={{ fontSize: 11, color: C.muted }}>{doneCount} of {items.length} complete</div>
          </div>
          <div style={{ height: 5, borderRadius: 100, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: GRAD, borderRadius: 100, transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(item => (
              <div key={item.id}
                onClick={() => !item.done && item.tab && onNavigate?.(item.tab)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: !item.done && item.tab ? 'pointer' : 'default' }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, background: item.done ? C.green : 'rgba(255,255,255,0.06)', border: item.done ? 'none' : '1px solid rgba(255,255,255,0.15)', color: '#06101A' }}>
                  {item.done ? '✓' : ''}
                </span>
                <span style={{ fontSize: 13, color: item.done ? C.muted : C.white, textDecoration: item.done ? 'line-through' : 'none' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {!isPro && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: C.muted }}>✦ Bonus: explore Creator Pro when you're ready for more platforms and deeper insights.</span>
          <button onClick={onUpgrade} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.1)', color: C.purple, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>See Creator Pro</button>
        </div>
      )}
    </div>
  )
}
