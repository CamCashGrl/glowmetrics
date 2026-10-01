// Single source of truth for live_sessions status values.
//
// The database lifecycle (live_sessions_status_check, and every RPC:
// start_live_session, pause/resume_live_session, sweep_stale_live_session,
// resolve_live_session, stop_live_session, clear_live_session_tips) uses:
//
//   status        : 'starting' | 'live' | 'inactive_warning' | 'ending' | 'ended'
//   live_substate : 'active' | 'paused' | null   (only meaningful while 'live')
//
// That vocabulary was introduced in production by the
// collapse_live_engine_state_machine migration (2026-08-02). The API routes
// were never updated and kept filtering on the older names ('active',
// 'paused', 'stopping', 'needs_resolution'), none of which can exist in the
// table — so every session lookup came back empty and no live tip was ever
// attributed to a session.
//
// Server-side queries must use the DB values below. Clients (website +
// Chrome extension) still read the older API names, so shapeLiveSession()
// translates on the way out via toApiStatus() — the client contract is
// unchanged.

// Every non-terminal DB status: a session in any of these still needs to be
// shown, resumed, or resolved.
export const UNRESOLVED_DB_STATUSES = ['starting', 'live', 'inactive_warning', 'ending']

// DB statuses during which an incoming tip may count toward the session.
// 'live' is further narrowed to the active substate by isTipAttributable().
// 'inactive_warning' is included because a tip arriving then is proof the
// stream never stopped (sweep_stale_live_session() uses the same signal to
// return the session to 'live').
export const TIP_ATTRIBUTABLE_DB_STATUSES = ['live', 'inactive_warning']

// The DB status a session is in while awaiting the user's resolution choice.
export const NEEDS_RESOLUTION_DB_STATUS = 'inactive_warning'

// Whether a tip arriving now should be attributed to this session row.
// A paused session never receives attribution — the tip is still saved,
// just not counted toward that session.
export function isTipAttributable(row) {
  if (!row) return false
  if (row.status === 'inactive_warning') return true
  if (row.status === 'live') return row.live_substate !== 'paused'
  return false
}

// DB status (+ substate) -> the status name the clients already understand.
export function toApiStatus(row) {
  if (!row) return null
  switch (row.status) {
    case 'live':
      return row.live_substate === 'paused' ? 'paused' : 'active'
    case 'inactive_warning':
      return 'needs_resolution'
    case 'ending':
      return 'stopping'
    default:
      // 'starting', 'ended', and anything unrecognised pass through as-is.
      return row.status
  }
}
