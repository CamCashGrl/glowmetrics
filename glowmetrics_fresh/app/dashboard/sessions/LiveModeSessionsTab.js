"use client"
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { mapStreamSessionRow } from '../../../lib/sessionHub/mapRows'
import { effectiveSessionTiming } from '../../../lib/sessionHub/sessionCorrection'
import { computeSessionDuration, computeActualHourlyRate, formatDurationMinutes } from '../../../lib/sessionHub/sessionMath'
import LiveModeSessionReport from './LiveModeSessionReport'

const C = { cyan: '#22D3EE', pink: '#EC4899', green: '#10B981', gold: '#F59E0B', white: '#F1F5F9', muted: '#94a3b8', dim: '#475569' }
const glassCard = { background: 'rgba(15,20,32,0.75)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 18 }

const CONFIDENCE_BADGE = {
  verified: { label: 'Verified', color: C.green },
  user_confirmed: { label: 'User-Corrected', color: C.cyan },
  estimated: { label: 'Estimated', color: C.gold },
}

function SessionCard({ session, coachingCount, performedCount, onOpen }) {
  const timing = effectiveSessionTiming(session)
  const duration = computeSessionDuration(timing.startedAt, timing.endedAt, timing.pauseIntervals)
  const rate = computeActualHourlyRate(session.usd, duration.activeDurationMinutes)
  const badge = CONFIDENCE_BADGE[session.durationConfidence] || CONFIDENCE_BADGE.estimated

  return (
    <div onClick={onOpen} style={{ ...glassCard, cursor: 'pointer', transition: 'border-color 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(34,211,238,0.35)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.white }}>
            {new Date(timing.startedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>{timing.platform}</div>
        </div>
        <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 800, background: `${badge.color}22`, color: badge.color }}>
          {badge.label}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 18, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>${session.usd.toFixed(2)}</div>
          <div style={{ fontSize: 10, color: C.muted }}>{rate !== null ? `$${rate.toFixed(2)}/hr` : 'rate n/a'}</div>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.white }}>{formatDurationMinutes(duration.activeDurationMinutes)}</div>
          <div style={{ fontSize: 10, color: C.muted }}>active</div>
        </div>
      </div>
      {coachingCount > 0 && (
        <div style={{ fontSize: 11, color: C.muted }}>
          {coachingCount} coaching prompt{coachingCount === 1 ? '' : 's'} · {performedCount} marked performed
        </div>
      )}
    </div>
  )
}

function CoachingPrivacySettings({ userId, actionsVisible, onToggle }) {
  const [clearing, setClearing] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const clearResponses = async () => {
    setClearing(true)
    await supabase.from('coaching_events')
      .update({ action_status: 'unmarked', action_responded_at: null, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    setClearing(false)
    setConfirming(false)
  }

  return (
    <div style={{ ...glassCard, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: C.white }}>
        <input type="checkbox" checked={actionsVisible} onChange={e => onToggle(e.target.checked)} style={{ accentColor: C.cyan }} />
        Show Performed and Skip buttons on coaching cards
      </label>
      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} style={{ fontSize: 12, color: C.muted, background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
          Clear my coaching responses
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.muted }}>This resets Performed/Skipped marks back to unmarked. Earnings, tips, and reports are unaffected.</span>
          <button type="button" onClick={clearResponses} disabled={clearing} style={{ fontSize: 12, color: '#f87171', background: 'none', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
            {clearing ? 'Clearing…' : 'Confirm clear'}
          </button>
          <button type="button" onClick={() => setConfirming(false)} style={{ fontSize: 12, color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
        </div>
      )}
    </div>
  )
}

export default function LiveModeSessionsTab({ user }) {
  const [sessions, setSessions] = useState([])
  const [coachingCounts, setCoachingCounts] = useState({})
  const [actionsVisible, setActionsVisible] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    let cancelled = false
    Promise.all([
      supabase.from('stream_sessions').select('*').eq('user_id', user.id).order('start_time', { ascending: false }).limit(100),
      supabase.from('profiles').select('coaching_actions_visible').eq('id', user.id).maybeSingle(),
    ]).then(async ([sessionsRes, profileRes]) => {
      if (cancelled) return
      const mapped = (sessionsRes.data || []).map(mapStreamSessionRow)
      setSessions(mapped)
      setActionsVisible(profileRes.data?.coaching_actions_visible !== false)

      if (mapped.length > 0) {
        const { data: events } = await supabase.from('coaching_events')
          .select('session_id, action_status').in('session_id', mapped.map(s => s.id))
        if (cancelled) return
        const counts = {}
        ;(events || []).forEach(e => {
          if (!counts[e.session_id]) counts[e.session_id] = { total: 0, performed: 0 }
          counts[e.session_id].total += 1
          if (e.action_status === 'performed') counts[e.session_id].performed += 1
        })
        setCoachingCounts(counts)
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [user])

  const toggleActionsVisible = async (next) => {
    setActionsVisible(next)
    if (user) await supabase.from('profiles').update({ coaching_actions_visible: next }).eq('id', user.id)
  }

  if (!user) {
    return <div style={{ fontSize: 13, color: C.muted }}>Sign in to view your Live Mode sessions.</div>
  }

  const selected = sessions.find(s => s.id === selectedId)
  if (selected) {
    return (
      <LiveModeSessionReport
        userId={user.id}
        session={selected}
        coachingActionsVisible={actionsVisible}
        onBack={() => setSelectedId(null)}
        onSessionUpdated={(updated) => setSessions(prev => prev.map(s => s.id === updated.id ? updated : s))}
      />
    )
  }

  return (
    <div>
      <CoachingPrivacySettings userId={user.id} actionsVisible={actionsVisible} onToggle={toggleActionsVisible} />

      {loading && <div style={{ fontSize: 13, color: C.muted }}>Loading Live Mode sessions…</div>}

      {!loading && sessions.length === 0 && (
        <div style={{ ...glassCard, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.white, marginBottom: 6 }}>No Live Mode sessions yet</div>
          <div style={{ fontSize: 13, color: C.muted }}>Start a session from Live Mode and it will show up here with a full, verified report.</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {sessions.map(session => (
          <SessionCard
            key={session.id}
            session={session}
            coachingCount={coachingCounts[session.id]?.total || 0}
            performedCount={coachingCounts[session.id]?.performed || 0}
            onOpen={() => setSelectedId(session.id)}
          />
        ))}
      </div>
    </div>
  )
}
