'use client'

import { useEffect, useRef, useState } from 'react'
import TimezoneSelect from '../../../components/TimezoneSelect'
import { isValidTimeZone, timeZoneLabel } from '../../../lib/creatorTimezone'
import { clock, describeAllowance, formatReset, minutesLeftLabel, tickCurrent } from '../../../lib/liveSession/allowanceView'

// Shared by the Dashboard Live tab and /live. Shows the Free Live Mode
// allowance exactly as the DATABASE reports it (get_live_mode_allowance):
//   stream 1/2 or 2/2 for the creator-local week, active minutes used / 35,
//   minutes remaining, a warning at 25, a stronger warning at 30, and a
//   locked/ended state at 35. It decides nothing: when its ticking clock
//   reaches the limit it asks the parent to re-fetch so the database
//   finalizes the stream.
const C = {
  card: 'rgba(15,20,32,0.75)', border: 'rgba(255,255,255,0.08)', white: '#F8FAFC', muted: '#94A3B8',
  cyan: '#22d3ee', gold: '#f59e0b', orange: '#f97316', red: '#f87171', green: '#22c55e',
}
const LEVEL_STYLE = {
  none: { color: C.cyan, label: null },
  warn25: { color: C.gold, label: 'Heads up' },
  warn30: { color: C.orange, label: 'Almost out of time' },
  limit: { color: C.red, label: 'Limit reached' },
}

function Shell({ children, color = C.border, testId }) {
  return (
    <div data-testid={testId} style={{ borderRadius: 12, padding: '12px 14px', background: C.card, border: `1px solid ${color}`, color: C.white, fontSize: 12.5 }}>
      {children}
    </div>
  )
}

function TimezonePrompt({ source, onSaveTimezone, onRefresh }) {
  const [picked, setPicked] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const save = async () => {
    if (!picked || !isValidTimeZone(picked)) return
    setSaving(true)
    setError(null)
    try {
      const result = await onSaveTimezone(picked)
      if (result?.error) {
        setError('We couldn’t save that timezone. Please try again.')
        return
      }
      // The database re-validates. If it still doesn't accept the zone, say so
      // instead of looping silently.
      const next = await onRefresh?.()
      if (next?.timezone?.required) {
        setError('That timezone isn’t supported for the weekly allowance yet. Pick the nearest major city.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Shell color="rgba(245,158,11,0.45)" testId="allowance-timezone-required">
      <div style={{ fontWeight: 800, marginBottom: 4 }}>Choose your timezone to go live</div>
      <div style={{ color: C.muted, lineHeight: 1.5, marginBottom: 10 }}>
        Free Live Mode includes 2 streams per week, and your week starts Monday at 12:00 AM in <b>your</b> timezone.
        {source === 'invalid' ? ' The timezone saved on your account isn’t valid, so please choose it again.' : ' You only need to do this once; you can change it later.'}
      </div>
      <TimezoneSelect value={picked} onPick={setPicked} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        <button data-testid="allowance-timezone-save" disabled={!picked || saving} onClick={save}
          style={{ padding: '7px 16px', borderRadius: 8, border: 'none', fontWeight: 800, fontSize: 12, cursor: !picked || saving ? 'not-allowed' : 'pointer',
            background: picked ? 'linear-gradient(135deg, #10B981, #22D3EE)' : 'rgba(255,255,255,0.08)', color: picked ? '#fff' : C.muted }}>
          {saving ? 'Saving…' : picked ? `Use ${picked.replace(/_/g, ' ')}` : 'Select a timezone'}
        </button>
        {picked && <span style={{ color: C.muted }}>{timeZoneLabel(picked)}</span>}
      </div>
      {error && <div role="alert" style={{ marginTop: 8, color: C.red }}>{error}</div>}
    </Shell>
  )
}

export default function LiveModeAllowanceBar({ allowance, receivedAt, onSaveTimezone, onRefresh, upgradeHref = '/pricing' }) {
  const [now, setNow] = useState(() => Date.now())
  const askedRef = useRef(null)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const view = describeAllowance(allowance)
  const tick = view.kind === 'live' ? tickCurrent(allowance, receivedAt ?? now, now) : null

  // At the limit, ask for a fresh database read exactly once per session so
  // the database finalizes it; the bar never ends anything itself.
  const sessionId = allowance?.current?.session_id
  useEffect(() => {
    if (tick?.level === 'limit' && askedRef.current !== sessionId) {
      askedRef.current = sessionId
      onRefresh?.()
    }
  }, [tick?.level, sessionId, onRefresh])

  if (view.kind === 'loading') return null

  if (view.kind === 'unlimited') {
    return (
      <div data-testid="allowance-unlimited" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: C.green, fontSize: 11.5, fontWeight: 700 }}>
        Pro · Unlimited Live Mode
      </div>
    )
  }

  if (view.kind === 'timezone_required') {
    return <TimezonePrompt source={view.source} onSaveTimezone={onSaveTimezone} onRefresh={onRefresh} />
  }

  const reset = formatReset(view.resetsAt, view.timezone)
  const streamsLine = view.kind === 'live'
    ? `Stream ${view.startsUsed} of ${view.startsLimit} this week`
    : `${view.startsUsed} of ${view.startsLimit} Free streams used this week`

  if (view.kind === 'weekly_locked') {
    return (
      <Shell color="rgba(248,113,113,0.45)" testId="allowance-weekly-locked">
        <div style={{ fontWeight: 800, color: C.red }}>{streamsLine} — no streams left</div>
        <div style={{ color: C.muted, marginTop: 4, lineHeight: 1.5 }}>
          Your Free streams reset {reset ? <b>{reset}</b> : 'Monday'}{view.timezone ? ` (${view.timezone.replace(/_/g, ' ')})` : ''}.
          {' '}<a href={upgradeHref} style={{ color: C.cyan, fontWeight: 700 }}>Upgrade to Pro</a> for unlimited Live Mode.
        </div>
      </Shell>
    )
  }

  if (view.kind === 'connecting') {
    return (
      <Shell testId="allowance-connecting">
        <div style={{ fontWeight: 700 }}>{streamsLine}</div>
        <div style={{ color: C.muted, marginTop: 2 }}>Connecting… this stream isn’t counted until it goes live.</div>
      </Shell>
    )
  }

  if (view.kind === 'live' && tick) {
    const style = LEVEL_STYLE[tick.level]
    const note = tick.level === 'limit'
      ? 'The 35-minute Free limit has been reached. This stream is ending now.'
      : tick.level === 'warn30'
      ? `Only ${minutesLeftLabel(tick.remainingSeconds)} left — this stream will end automatically at 35:00. Wrap up your goals now.`
      : tick.level === 'warn25'
      ? `${minutesLeftLabel(tick.remainingSeconds)} left of your 35 active minutes.`
      : null
    return (
      <Shell color={tick.level === 'none' ? C.border : `${style.color}77`} testId="allowance-live">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 800 }}>{streamsLine}</span>
          <span style={{ color: style.color, fontWeight: 800, fontFamily: 'monospace' }} data-testid="allowance-minutes">
            {clock(tick.activeSeconds)} / {clock(tick.limitSeconds)} active
          </span>
        </div>
        <div role="progressbar" aria-label="Active Live Mode minutes used" aria-valuemin={0} aria-valuemax={tick.limitSeconds} aria-valuenow={tick.activeSeconds}
          style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.08)', margin: '8px 0 6px', overflow: 'hidden' }}>
          <div data-testid="allowance-fill" style={{ width: `${Math.round(tick.fraction * 100)}%`, height: '100%', background: style.color, transition: 'width 1s linear' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: C.muted, gap: 10, flexWrap: 'wrap' }}>
          <span data-testid="allowance-remaining">{clock(tick.remainingSeconds)} remaining{tick.running ? '' : ' (paused — pauses don’t use your time)'}</span>
          {reset && <span>Streams reset {reset}</span>}
        </div>
        {note && (
          <div role="status" aria-live="polite" data-testid={`allowance-note-${tick.level}`} style={{ marginTop: 6, color: style.color, fontWeight: 700 }}>
            {style.label ? `${style.label}: ` : ''}{note}
          </div>
        )}
      </Shell>
    )
  }

  // ready to start
  return (
    <Shell testId="allowance-ready">
      {view.capEnded && (
        <div role="status" data-testid="allowance-cap-ended" style={{ marginBottom: 6, color: C.gold, fontWeight: 700 }}>
          Your last stream ended automatically at the 35-minute Free limit.
        </div>
      )}
      <div style={{ fontWeight: 700 }}>{streamsLine} · 35 active minutes per stream</div>
      <div style={{ color: C.muted, marginTop: 2 }}>
        {view.startsRemaining} left{reset ? <> · resets <b>{reset}</b></> : null}
      </div>
    </Shell>
  )
}
