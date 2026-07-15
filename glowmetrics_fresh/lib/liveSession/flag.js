import { get } from '@vercel/edge-config'

const FLAG_KEY = 'live-session-engine-v2'

// Pure decision logic, deliberately separated from the Edge Config read
// itself so it can be tested directly with plain values — no mocking of
// @vercel/edge-config required.
//
// Expected shape of flagValue: { enabled: boolean, allowedUserIds?: string[] }
// An empty/absent allowedUserIds means "enabled for everyone"; a non-empty
// list restricts to exactly those user ids.
export function evaluateEngineFlag(flagValue, userId) {
  if (!flagValue || flagValue.enabled !== true) return false
  if (Array.isArray(flagValue.allowedUserIds) && flagValue.allowedUserIds.length > 0) {
    return flagValue.allowedUserIds.includes(userId)
  }
  return true
}

// Whether a NEW V2 Live Mode session is allowed to be started for this user.
//
// This function governs new-session creation ONLY. It must never be
// consulted to decide whether an already-existing live_sessions row should
// be shown, continued, or abandoned — that decision is made independently,
// before this is ever called (see app/api/live/session/start/route.js and
// app/api/live/session/route.js).
//
// Fails closed: no Edge Config store connected, a network error, a missing
// key, or a malformed value all resolve to false — the new engine is simply
// unavailable for new sessions, with no distinction made between those
// cases. This is not a fallback path bolted on after the fact; it is the
// only path in an environment where Edge Config has never been provisioned.
export async function isEngineV2AllowedForUser(userId) {
  try {
    const flagValue = await get(FLAG_KEY)
    return evaluateEngineFlag(flagValue, userId)
  } catch (_) {
    return false
  }
}
