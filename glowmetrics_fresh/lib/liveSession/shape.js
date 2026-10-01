import { toApiStatus } from './status'

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
    // Clients (website + extension) read the API status names; the raw DB
    // value stays available as db_status. See lib/liveSession/status.js.
    status: toApiStatus(row),
    db_status: row.status,
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
  return { status: 500, body: { error: 'Something went wrong. Please try again.' } }
}
