export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../../lib/liveSession/auth'
import { shapeLiveSession, sanitizedErrorResponse } from '../../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../../lib/liveSession/cors'
import { NEEDS_RESOLUTION_DB_STATUS } from '../../../../../lib/liveSession/status'

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

const VALID_CHOICES = ['still_live', 'ended', 'end_at_last_heartbeat', 'choose_end_time', 'mark_invalid']

// ── FUTURE REQUIREMENT — not yet implemented, tracked here on purpose ──────
// 'mark_invalid' sets live_sessions.is_inaccurate = true (see
// resolve_live_session() in supabase/migrations/20260720e_*.sql). No
// analytics currently aggregate live_sessions financial/duration data, but
// the moment any of the following is built, it MUST filter
// `is_inaccurate = false` (or exclude these rows equivalently):
//   - earnings per hour
//   - average session duration
//   - best streaming windows
//   - platform performance
//   - session comparisons
//   - coaching prompt outcome calculations (coaching_prompt_outcomes,
//     live_session_analysis_context, etc.)
// A marked-invalid session is never deleted — only excluded from stats —
// so it will otherwise silently poison any of the above the first time
// someone builds it without this filter.

// How far past "now" a chosen end time may be — a small allowance for
// clock skew between the browser and the server, not a real allowance for
// a future end time.
const FUTURE_BUFFER_MS = 5 * 60 * 1000

// Explicit, user-initiated recovery from needs_resolution. Never invoked
// automatically by any heartbeat.
export async function POST(req) {
  const cors = corsHeaders(req)
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  let choice = null
  let endTime = null
  try {
    const body = await req.json()
    choice = body?.choice ?? null
    endTime = body?.endTime ?? null
  } catch (_) {
    return NextResponse.json({ error: 'Missing choice' }, { status: 400, headers: cors })
  }

  if (!VALID_CHOICES.includes(choice)) {
    return NextResponse.json(
      { error: `choice must be one of: ${VALID_CHOICES.join(', ')}` },
      { status: 400, headers: cors }
    )
  }

  // p_end_time forwarded to the RPC. Only ever client-controlled for
  // 'ended' (unchanged from the original two-choice behavior, for backward
  // compatibility) and 'choose_end_time' (validated below). 'still_live',
  // 'end_at_last_heartbeat', and 'mark_invalid' never take a client end
  // time — the RPC computes theirs from server-stored timestamps
  // (extension/website heartbeat, broadcaster-missing-since) regardless of
  // what's forwarded, but this is forced to null anyway so there's no
  // ambiguity about a client-supplied time ever being used for those paths.
  let pEndTime = null

  if (choice === 'ended') {
    pEndTime = endTime ?? null
  } else if (choice === 'choose_end_time') {
    if (!endTime) {
      return NextResponse.json({ error: 'endTime is required for choose_end_time' }, { status: 400, headers: cors })
    }
    const parsed = new Date(endTime)
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'endTime must be a valid timestamp' }, { status: 400, headers: cors })
    }
    if (parsed.getTime() > Date.now() + FUTURE_BUFFER_MS) {
      return NextResponse.json({ error: 'endTime cannot be in the future' }, { status: 400, headers: cors })
    }

    // Only checkable against the session actually awaiting resolution. If
    // none is found (e.g. a duplicate submission that already lost the
    // race), skip straight to the RPC call below and let its own NOT FOUND
    // handling (returns null) be the final word, same as every other choice.
    const { data: current } = await supabase
      .from('live_sessions')
      .select('started_at')
      .eq('user_id', user.id)
      .eq('status', NEEDS_RESOLUTION_DB_STATUS)
      .maybeSingle()
    if (current && parsed.getTime() < new Date(current.started_at).getTime()) {
      return NextResponse.json({ error: 'endTime cannot be before the session started' }, { status: 400, headers: cors })
    }

    pEndTime = parsed.toISOString()
  }

  const { data, error } = await supabase.rpc('resolve_live_session', {
    p_choice: choice,
    p_end_time: pEndTime,
  })
  if (error) {
    const { status, body } = sanitizedErrorResponse(error)
    return NextResponse.json(body, { status, headers: cors })
  }

  return NextResponse.json({ session: shapeLiveSession(data), resolved: !!data }, { headers: cors })
}
