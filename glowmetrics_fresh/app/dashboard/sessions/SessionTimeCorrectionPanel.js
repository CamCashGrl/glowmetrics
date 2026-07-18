"use client"
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { previewCorrectedSession, formatDurationMinutes } from '../../../lib/sessionHub/sessionMath'
import { buildSessionTimeCorrection } from '../../../lib/sessionHub/sessionCorrection'
import { logFeatureUsageEvent } from '../../../lib/sessionHub/featureUsage'

const C = { cyan: '#22D3EE', pink: '#EC4899', green: '#10B981', white: '#F1F5F9', muted: '#94a3b8' }
const PLATFORMS = ['Chaturbate', 'BongaCams', 'MyFreeCams', 'Stripchat', 'CamSoda']

function toLocalInputValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// "Correct session time" — a subtle, optional action on every Live Mode
// session report. Never overwrites or deletes the originally recorded
// timestamps; every save appends a new session_time_corrections row and
// only updates the "current" corrected_* mirror columns on the session.
export default function SessionTimeCorrectionPanel({ userId, session, totalUsd, onSaved, onCancel }) {
  const [startedAt, setStartedAt] = useState(toLocalInputValue(session.correctedStartedAt || session.startedAt))
  const [endedAt, setEndedAt] = useState(toLocalInputValue(session.correctedEndedAt || session.endedAt))
  const [platform, setPlatform] = useState(session.correctedPlatform || session.platform)
  const [completed, setCompleted] = useState(session.correctedCompleted ?? session.completed ?? true)
  const [pauseIntervals, setPauseIntervals] = useState(session.correctedPauseIntervals || session.pauseIntervals || [])
  const [saving, setSaving] = useState(false)

  const startedIso = startedAt ? new Date(startedAt).toISOString() : null
  const endedIso = endedAt ? new Date(endedAt).toISOString() : null

  const preview = startedIso && endedIso
    ? previewCorrectedSession({ startedAt: startedIso, endedAt: endedIso, pauseIntervals, totalUsd })
    : null

  const addPause = () => setPauseIntervals(prev => [...prev, { start: startedAt, end: startedAt }])
  const updatePause = (i, field, value) => setPauseIntervals(prev =>
    prev.map((p, idx) => idx === i ? { ...p, [field]: value ? new Date(value).toISOString() : null } : p))
  const removePause = (i) => setPauseIntervals(prev => prev.filter((_, idx) => idx !== i))

  const save = async () => {
    if (!startedIso || !endedIso) return
    setSaving(true)
    const correction = buildSessionTimeCorrection(
      { id: session.id, startedAt: session.startedAt, endedAt: session.endedAt },
      { startedAt: startedIso, endedAt: endedIso, pauseIntervals, platform, completed }
    )
    await supabase.from('session_time_corrections').insert({
      user_id: userId,
      session_id: session.id,
      original_started_at: correction.originalStartedAt,
      original_ended_at: correction.originalEndedAt,
      corrected_started_at: correction.correctedStartedAt,
      corrected_ended_at: correction.correctedEndedAt,
      corrected_pause_intervals: correction.correctedPauseIntervals,
      corrected_platform: correction.correctedPlatform,
      corrected_completed: correction.correctedCompleted,
      corrected_by_user: true,
    })
    await supabase.from('stream_sessions').update({
      corrected_started_at: correction.correctedStartedAt,
      corrected_ended_at: correction.correctedEndedAt,
      corrected_pause_intervals: correction.correctedPauseIntervals,
      corrected_platform: correction.correctedPlatform,
      corrected_completed: correction.correctedCompleted,
      duration_confidence: 'user_confirmed',
    }).eq('id', session.id)
    await logFeatureUsageEvent(supabase, {
      userId, sessionId: session.id, feature: 'session_correction', action: 'session.time_corrected',
      metadata: { hadPauseIntervals: pauseIntervals.length > 0 },
    })
    setSaving(false)
    onSaved({ ...correction, durationConfidence: 'user_confirmed' })
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)', color: C.white, fontSize: 13,
  }
  const labelStyle = { fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, display: 'block' }

  return (
    <div style={{ padding: 18, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.white, marginBottom: 4 }}>Correct session time</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
        The original recorded times are always kept — this only adds a correction on top.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Start time</label>
          <input type="datetime-local" style={inputStyle} value={startedAt} onChange={e => setStartedAt(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>End time</label>
          <input type="datetime-local" style={inputStyle} value={endedAt} onChange={e => setEndedAt(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Platform</label>
          <select style={inputStyle} value={platform} onChange={e => setPlatform(e.target.value)}>
            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Session completed?</label>
          <select style={inputStyle} value={completed ? 'yes' : 'no'} onChange={e => setCompleted(e.target.value === 'yes')}>
            <option value="yes">Yes, this session finished</option>
            <option value="no">No, it was cut off / incomplete</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Pause intervals</label>
          <button type="button" onClick={addPause} style={{ fontSize: 11, color: C.cyan, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>+ Add pause</button>
        </div>
        {pauseIntervals.length === 0 && <div style={{ fontSize: 12, color: C.muted }}>No pauses recorded.</div>}
        {pauseIntervals.map((p, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input type="datetime-local" style={inputStyle} value={toLocalInputValue(p.start)} onChange={e => updatePause(i, 'start', e.target.value)} />
            <input type="datetime-local" style={inputStyle} value={toLocalInputValue(p.end)} onChange={e => updatePause(i, 'end', e.target.value)} />
            <button type="button" onClick={() => removePause(i)} style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
        ))}
      </div>

      {preview && (
        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: C.green, fontWeight: 700, marginBottom: 4 }}>
            Updated active duration: {formatDurationMinutes(preview.activeDurationMinutes)}
          </div>
          <div style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>
            Updated Actual $/Hour: {preview.actualHourlyRate !== null ? `$${preview.actualHourlyRate.toFixed(2)}` : 'Not enough data yet'}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={save} disabled={saving || !startedIso || !endedIso}
          style={{ padding: '10px 20px', borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer',
            background: `linear-gradient(90deg, ${C.cyan}, ${C.pink})`, color: '#04101a', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : 'Save correction'}
        </button>
        <button type="button" onClick={onCancel}
          style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: C.muted, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
