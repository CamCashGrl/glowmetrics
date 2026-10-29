// Single shared computation of effective paused time and active duration
// for a live_sessions row, used by every route that returns session data —
// never reimplemented per-route.
//
// effective_paused_seconds = total_paused_seconds (finalized checkpoint)
//   + the currently-open pause's elapsed time, if any.
// active_duration_seconds  = (ended_at or now) - started_at - effective_paused_seconds
export function shapeLiveSession(row) {
  if (!row) return null

  const now = Date.now()
  const startedAtMs = new Date(row.started_at).getTime()
  const endedAtMs = row.ended_at ? new Date(row.ended_at).getTime() : null
  const pausedAtMs = row.paused_at ? new Date(row.paused_at).getTime() : null

  const openPauseSeconds = pausedAtMs ? Math.max(0, (now - pausedAtMs) / 1000) : 0
  const effectivePausedSeconds = (row.total_paused_seconds || 0) + openPauseSeconds

  const referenceEndMs = endedAtMs ?? now
  const activeDurationSeconds = Math.max(
    0,
    (referenceEndMs - startedAtMs) / 1000 - effectivePausedSeconds
  )

  return {
    ...row,
    effective_paused_seconds: Math.round(effectivePausedSeconds),
    active_duration_seconds: Math.round(activeDurationSeconds),
  }
}

// Sanitized error shaping — never returns a raw DB error string to the client.
export function sanitizedErrorResponse(error) {
  console.error('[live-session]', error)
  if (error?.code === '22023') {
    return { status: 400, body: { error: 'Unrecognized value.' } }
  }
  if (error?.code === '28000') {
    return { status: 401, body: { error: 'Unauthorized' } }
  }
  // The Pro start gate (check_live_mode_pro_entitlement) raises P0001 with
  // this prefix. Surface it so the user sees why Start did nothing; the gate
  // itself is unchanged.
  if (error?.code === 'P0001' && String(error?.message || '').startsWith('LIVE_MODE_REQUIRES_PRO')) {
    return {
      status: 403,
      body: { error: 'Live Mode is a Pro feature. Upgrade to Pro to start a live session.', code: 'LIVE_MODE_REQUIRES_PRO' },
    }
  }
  // Free Live Mode allowance. The database decides; these are fixed,
  // user-facing strings keyed by the code prefix it raises. Raw database text
  // is never returned.
  if (error?.code === 'P0001') {
    const msg = String(error?.message || '')
    for (const [code, known] of Object.entries(ALLOWANCE_ERRORS)) {
      if (msg.startsWith(code)) return { status: known.status, body: { error: known.error, code } }
    }
  }
  return { status: 500, body: { error: 'Something went wrong. Please try again.' } }
}

export const ALLOWANCE_ERRORS = {
  FREE_LIVE_WEEKLY_LIMIT: {
    status: 403,
    error: 'You’ve used both Free Live Mode streams for this week. Upgrade to Pro for unlimited Live Mode.',
  },
  TIMEZONE_REQUIRED: {
    status: 403,
    error: 'Choose your timezone to start Live Mode. Your weekly Free allowance resets on Monday in your timezone.',
  },
  PLATFORM_REQUIRED: {
    status: 400,
    error: 'Choose Chaturbate, BongaCams or MyFreeCams. CamCash never guesses your platform.',
  },
  USERNAME_REQUIRED: {
    status: 400,
    error: 'Enter the fan’s username to start a private show.',
  },
}

// Codes after which the client needs the allowance state to explain the lock.
export const ALLOWANCE_LOCK_CODES = ['FREE_LIVE_WEEKLY_LIMIT', 'TIMEZONE_REQUIRED']
