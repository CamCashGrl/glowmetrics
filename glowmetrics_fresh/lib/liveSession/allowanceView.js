// DISPLAY helpers for the Free Live Mode allowance.
//
// The database (get_live_mode_allowance) is the only authority: it decides who
// may start, how many starts are used, how many active minutes are used, and
// when a stream ends. Nothing here decides any of that. These helpers only
// format the database's numbers and tick them forward between polls so the
// bar moves smoothly. The thresholds come FROM the database response
// (`limits`), never from constants in the browser, and when the ticked clock
// reaches the limit the caller re-fetches so the database finalizes the stream.

export function clock(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

// Minutes left, rounded up, as the creator would say it ("5 minutes").
export function minutesLeftLabel(remainingSeconds) {
  const m = Math.ceil(Math.max(0, remainingSeconds) / 60)
  return `${m} minute${m === 1 ? '' : 's'}`
}

export function levelFor(activeSeconds, limits) {
  if (!limits) return 'none'
  if (activeSeconds >= limits.stream_seconds) return 'limit'
  if (activeSeconds >= limits.strong_warn_seconds) return 'warn30'
  if (activeSeconds >= limits.warn_seconds) return 'warn25'
  return 'none'
}

// The running stream's numbers at `nowMs`, ticked forward from the moment the
// database produced them (`receivedAtMs`). Paused or not-yet-live sessions
// don't tick. Returns null when there is no counted stream to show.
export function tickCurrent(allowance, receivedAtMs, nowMs) {
  const cur = allowance?.current
  const limits = allowance?.limits
  if (!cur || !cur.counted || !limits || cur.active_seconds == null) return null
  const running = !cur.paused && ['live', 'inactive_warning', 'ending'].includes(cur.status)
  const elapsed = running ? Math.max(0, (nowMs - receivedAtMs) / 1000) : 0
  const activeSeconds = Math.floor(cur.active_seconds + elapsed)
  const remainingSeconds = Math.max(0, limits.stream_seconds - activeSeconds)
  return {
    activeSeconds,
    remainingSeconds,
    limitSeconds: limits.stream_seconds,
    level: levelFor(activeSeconds, limits),
    running,
    fraction: Math.min(1, activeSeconds / limits.stream_seconds),
  }
}

// "Mon 12:00 AM PDT" in the creator's allowance timezone (display only).
export function formatReset(isoEnd, timeZone) {
  if (!isoEnd || !timeZone) return null
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone, timeZoneName: 'short',
    }).format(new Date(isoEnd))
  } catch (_) {
    return null
  }
}

// What the bar should show. Pure function of the database response.
export function describeAllowance(allowance) {
  if (!allowance) return { kind: 'loading' }
  if (allowance.unlimited) return { kind: 'unlimited' }
  if (allowance.timezone?.required) {
    return { kind: 'timezone_required', source: allowance.timezone.source }
  }
  const week = allowance.week
  const limits = allowance.limits
  if (!week || !limits) return { kind: 'loading' }
  const base = {
    startsUsed: week.starts_used,
    startsLimit: limits.starts_per_week,
    startsRemaining: week.starts_remaining,
    resetsAt: week.end,
    timezone: allowance.timezone?.value,
  }
  const cur = allowance.current
  if (cur && !cur.counted) return { ...base, kind: 'connecting' }
  if (cur && cur.counted) return { ...base, kind: 'live' }
  if (allowance.lock_reason === 'FREE_LIVE_WEEKLY_LIMIT') return { ...base, kind: 'weekly_locked' }
  return { ...base, kind: 'ready', capEnded: allowance.latest_cap_ended || null }
}
