"use client"
import { useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { setCoachingActionStatus } from '../../../lib/sessionHub/coachingActions'
import { logFeatureUsageEvent } from '../../../lib/sessionHub/featureUsage'
import CoachingActionButtons from './CoachingActionButtons'

const C = { cyan: '#22D3EE', pink: '#EC4899', green: '#10B981', gold: '#F59E0B', white: '#F1F5F9', muted: '#94a3b8', dim: '#475569' }

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unmarked', label: 'Unmarked' },
  { id: 'performed', label: 'Performed' },
  { id: 'skipped', label: 'Skipped' },
]

// Every coaching prompt shown during the session, regardless of session
// status — history must remain fully available after the session ends,
// and nothing here ever feeds back into "live" coaching (this is a
// read/annotate view only; there is no path from history back to an
// active alert).
export default function CoachingHistoryPanel({ userId, sessionId, events, onEventsChange, actionsVisible }) {
  const [filter, setFilter] = useState('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return events
    return events.filter(e => e.actionStatus === filter)
  }, [events, filter])

  const updateStatus = async (event, nextStatus) => {
    const patch = setCoachingActionStatus(nextStatus)
    onEventsChange(events.map(e => (e.id === event.id ? { ...e, ...patch } : e)))
    await supabase.from('coaching_events').update({
      action_status: patch.actionStatus,
      action_responded_at: patch.actionRespondedAt,
      updated_at: patch.updatedAt,
    }).eq('id', event.id)
    await logFeatureUsageEvent(supabase, {
      userId, sessionId, feature: 'coaching_action',
      action: nextStatus === 'unmarked' ? 'coaching.prompt_unmarked'
        : nextStatus === 'performed' ? 'coaching.prompt_performed' : 'coaching.prompt_skipped',
      metadata: { coachingEventId: event.id, category: event.category },
    })
  }

  if (events.length === 0) {
    return <div style={{ fontSize: 13, color: C.muted, padding: '12px 0' }}>No coaching prompts were shown during this session.</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f.id} type="button" onClick={() => setFilter(f.id)}
            style={{
              padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.1)',
              background: filter === f.id ? 'rgba(34,211,238,0.14)' : 'rgba(255,255,255,0.03)',
              color: filter === f.id ? C.cyan : C.muted,
            }}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>No prompts match this filter.</div>}
        {filtered.map(ev => (
          <div key={ev.id} style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 220 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 }}>
                  {new Date(ev.shownAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {ev.category.replace(/_/g, ' ')}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 2 }}>{ev.title}</div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{ev.message}</div>
                {(ev.relatedTipperName || ev.relatedAmountUsd) && (
                  <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>
                    {ev.relatedTipperName ? `Supporter: ${ev.relatedTipperName}` : ''}
                    {ev.relatedTipperName && ev.relatedAmountUsd ? ' · ' : ''}
                    {ev.relatedAmountUsd ? `$${ev.relatedAmountUsd.toFixed(2)}` : ''}
                  </div>
                )}
              </div>
              <CoachingActionButtons
                status={ev.actionStatus}
                visible={actionsVisible}
                size="compact"
                onSetStatus={(next) => updateStatus(ev, next)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
