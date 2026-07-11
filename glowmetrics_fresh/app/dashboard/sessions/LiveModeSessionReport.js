"use client"
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { mapCoachingEventRow } from '../../../lib/sessionHub/mapRows'
import { effectiveSessionTiming } from '../../../lib/sessionHub/sessionCorrection'
import { computeSessionDuration, computeActualHourlyRate, formatDurationMinutes } from '../../../lib/sessionHub/sessionMath'
import { computeCoachingSummary } from '../../../lib/sessionHub/coachingSummary'
import SessionTimeCorrectionPanel from './SessionTimeCorrectionPanel'
import CoachingHistoryPanel from './CoachingHistoryPanel'

const C = { cyan: '#22D3EE', pink: '#EC4899', green: '#10B981', gold: '#F59E0B', white: '#F1F5F9', muted: '#94a3b8', dim: '#475569' }

const CONFIDENCE_LABEL = {
  verified: 'Verified Live Mode Session',
  user_confirmed: 'User-Corrected Session',
  estimated: 'Estimated End Time',
}

const glassCard = { background: 'rgba(15,20,32,0.75)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20 }

function StatRow({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 14 }}>
      {items.map(({ label, value, color }) => (
        <div key={label}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: color || C.white }}>{value}</div>
        </div>
      ))}
    </div>
  )
}

export default function LiveModeSessionReport({ userId, session, onBack, onSessionUpdated, coachingActionsVisible }) {
  const [tips, setTips] = useState([])
  const [coachingEvents, setCoachingEvents] = useState([])
  const [correcting, setCorrecting] = useState(false)
  const [loading, setLoading] = useState(true)
  const timing = effectiveSessionTiming(session)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const end = timing.endedAt || new Date().toISOString()
    Promise.all([
      supabase.from('live_tips').select('username, tokens, usd, received_at')
        .eq('user_id', userId).gte('received_at', timing.startedAt).lte('received_at', end)
        .order('received_at', { ascending: true }),
      supabase.from('coaching_events').select('*').eq('session_id', session.id).order('shown_at', { ascending: true }),
    ]).then(([tipsRes, eventsRes]) => {
      if (cancelled) return
      setTips((tipsRes.data || []).map(t => ({ username: t.username, usd: parseFloat(t.usd) || 0, timestamp: t.received_at })))
      setCoachingEvents((eventsRes.data || []).map(mapCoachingEventRow))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [session.id, timing.startedAt, timing.endedAt, userId])

  const duration = computeSessionDuration(timing.startedAt, timing.endedAt, timing.pauseIntervals)
  const actualHourlyRate = computeActualHourlyRate(session.usd, duration.activeDurationMinutes)

  const activity = useMemo(() => {
    const tipperMap = {}
    tips.forEach(t => { tipperMap[t.username] = (tipperMap[t.username] || 0) + t.usd })
    const top = Object.entries(tipperMap).sort((a, b) => b[1] - a[1])[0]
    const largest = [...tips].sort((a, b) => b.usd - a.usd)[0]
    const uniqueSupporters = Object.keys(tipperMap).length

    // Best activity window: highest-earning 5-minute bucket.
    let bestWindow = null
    if (tips.length > 0) {
      const startMs = new Date(timing.startedAt).getTime()
      const buckets = {}
      tips.forEach(t => {
        const idx = Math.floor((new Date(t.timestamp).getTime() - startMs) / (5 * 60000))
        buckets[idx] = (buckets[idx] || 0) + t.usd
      })
      const [bestIdx, bestUsd] = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0]
      const windowStart = new Date(startMs + Number(bestIdx) * 5 * 60000)
      bestWindow = { time: windowStart, usd: bestUsd }
    }

    return { topSupporter: top ? { username: top[0], usd: top[1] } : null, largestTip: largest, uniqueSupporters, bestWindow }
  }, [tips, timing.startedAt])

  const coachingSummary = computeCoachingSummary(coachingEvents)

  return (
    <div>
      <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', color: C.cyan, fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 14 }}>
        ← Back to Live Mode Sessions
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.white, marginBottom: 4 }}>
            {new Date(timing.startedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} · {timing.platform}
          </h1>
          <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
            background: session.durationConfidence === 'estimated' ? 'rgba(245,158,11,0.14)' : 'rgba(16,185,129,0.14)',
            color: session.durationConfidence === 'estimated' ? C.gold : C.green }}>
            {CONFIDENCE_LABEL[session.durationConfidence] || CONFIDENCE_LABEL.estimated}
          </span>
        </div>
      </div>

      {/* ── SESSION SUMMARY ─────────────────────────────────────── */}
      <div style={{ ...glassCard, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>Session Summary</div>
        <StatRow items={[
          { label: 'Earnings', value: `$${session.usd.toFixed(2)}`, color: C.green },
          { label: 'Actual $/Hour', value: actualHourlyRate !== null ? `$${actualHourlyRate.toFixed(2)}` : 'Not enough data yet' },
          { label: 'Active Duration', value: formatDurationMinutes(duration.activeDurationMinutes) },
          { label: 'Paused Duration', value: formatDurationMinutes(duration.pausedDurationMinutes) },
          { label: 'Tips', value: session.tipCount },
          { label: 'Supporters', value: activity.uniqueSupporters },
        ]} />
      </div>

      {/* ── SESSION ACTIVITY ─────────────────────────────────────── */}
      <div style={{ ...glassCard, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>Session Activity</div>
        {loading ? <div style={{ fontSize: 12, color: C.muted }}>Loading…</div> : (
          <StatRow items={[
            { label: 'Top Supporter', value: activity.topSupporter ? `${activity.topSupporter.username} ($${activity.topSupporter.usd.toFixed(2)})` : 'Not enough data yet' },
            { label: 'Largest Tip', value: activity.largestTip ? `$${activity.largestTip.usd.toFixed(2)}` : 'Not enough data yet' },
            { label: 'Best Activity Window', value: activity.bestWindow ? activity.bestWindow.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not enough data yet' },
          ]} />
        )}
      </div>

      {/* ── COACHING ACTIVITY ────────────────────────────────────── */}
      <div style={{ ...glassCard, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>Coaching Activity</div>
        <StatRow items={[
          { label: 'Prompts Shown', value: coachingSummary.promptsShown },
          { label: 'Performed', value: coachingSummary.performedPromptCount, color: C.green },
          { label: 'Skipped', value: coachingSummary.skippedPromptCount },
          { label: 'Unmarked', value: coachingSummary.unmarkedPromptCount },
        ]} />
        {coachingSummary.followThroughRate !== null && (
          <div style={{ fontSize: 12, color: C.muted, marginTop: 12 }}>
            Follow-through: <strong style={{ color: C.white }}>{Math.round(coachingSummary.followThroughRate * 100)}%</strong> — based on {coachingSummary.markedPromptCount} prompts you chose to mark. This is a behavior summary, not a measure of earnings performance.
          </div>
        )}
        <div style={{ marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.white, marginBottom: 10 }}>Coaching History</div>
          <CoachingHistoryPanel
            userId={userId}
            sessionId={session.id}
            events={coachingEvents}
            onEventsChange={setCoachingEvents}
            actionsVisible={coachingActionsVisible}
          />
        </div>
      </div>

      {/* ── SESSION ACCURACY ─────────────────────────────────────── */}
      <div style={{ ...glassCard }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>Session Accuracy</div>
        <div style={{ fontSize: 13, color: C.white, marginBottom: 12 }}>
          Duration confidence: <strong>{CONFIDENCE_LABEL[session.durationConfidence] || CONFIDENCE_LABEL.estimated}</strong>
        </div>
        {!correcting ? (
          <button type="button" onClick={() => setCorrecting(true)}
            style={{ fontSize: 12, color: C.muted, background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
            Correct session time
          </button>
        ) : (
          <SessionTimeCorrectionPanel
            userId={userId}
            session={session}
            totalUsd={session.usd}
            onCancel={() => setCorrecting(false)}
            onSaved={(correction) => {
              setCorrecting(false)
              onSessionUpdated({
                ...session,
                correctedStartedAt: correction.correctedStartedAt,
                correctedEndedAt: correction.correctedEndedAt,
                correctedPauseIntervals: correction.correctedPauseIntervals,
                correctedPlatform: correction.correctedPlatform,
                correctedCompleted: correction.correctedCompleted,
                durationConfidence: 'user_confirmed',
              })
            }}
          />
        )}
      </div>
    </div>
  )
}
