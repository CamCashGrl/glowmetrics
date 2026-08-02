export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getLiveSessionCaller } from '../../../../lib/liveSession/auth'
import { sanitizedErrorResponse } from '../../../../lib/liveSession/shape'
import { corsHeaders } from '../../../../lib/liveSession/cors'
import { computeCoachingState, evaluateCoachingTriggers, selectPrimaryTrigger, TRIGGER_META } from '../../../../lib/coaching/triggers'

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

const UNRESOLVED_STATUSES = ['starting', 'active', 'paused', 'stopping', 'needs_resolution']

// Presentation label only — priority stays an integer in the DB (it's what
// ORDER BY priority uses for tie-breaking in record_coaching_event_if_new),
// this just maps it for clients that want a human label instead of a number.
const PRIORITY_LABEL = { 1: 'high', 2: 'high', 3: 'medium', 4: 'low' }

// The single typed payload every consumer (live dashboard, extension,
// Session Replay) renders as-is — none of them recompute coaching, they
// only render this object. session_timestamp lets Session Replay show
// "N minutes into the session" without re-deriving it from shown_at.
function shapeCoachingEvent(row, sessionStartedAt) {
  if (!row) return null
  return {
    id: row.id,
    type: row.type,
    category: row.category,
    priority: PRIORITY_LABEL[row.priority] || 'medium',
    priority_rank: row.priority,
    title: row.title,
    message: row.message,
    compact_message: row.compact_message,
    bullets: row.bullets || [],
    recommended_action: row.recommended_action,
    estimated_impact: row.estimated_impact,
    reason: row.reason,
    confidence: row.confidence,
    created_at: row.created_at,
    shown_at: row.shown_at,
    expires_at: row.expires_at,
    completion_state: row.action_status,
    acted_on: row.action_status !== 'unmarked',
    session_timestamp: sessionStartedAt
      ? Math.max(0, Math.round((new Date(row.shown_at) - new Date(sessionStartedAt)) / 1000))
      : null,
    related_tipper_id: row.related_tipper_id,
    related_tipper_name: row.related_tipper_name,
    related_amount_usd: row.related_amount_usd,
  }
}

// Single shared entry point for both the website and the Chrome extension —
// neither surface computes or persists its own coaching prompts anymore.
// Called (a) right after a tip is detected/synced by either surface, for
// near-instant tip-reactive triggers, and (b) on the existing
// heartbeat/poll cadence, for time-based triggers like dead air. Never
// pushed — both surfaces reconcile by polling, same pattern already used
// for live_sessions status.
export async function GET(req) {
  const cors = corsHeaders(req)
  const { supabase, user } = await getLiveSessionCaller(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  const { data: session, error: sessionError } = await supabase
    .from('live_sessions')
    .select('id, started_at, coaching_strategy, coaching_goal_tokens')
    .eq('user_id', user.id)
    .in('status', UNRESOLVED_STATUSES)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (sessionError) {
    const { status, body } = sanitizedErrorResponse(sessionError)
    return NextResponse.json(body, { status, headers: cors })
  }

  // No active Live Mode session — safe idle response, both surfaces no-op.
  if (!session) {
    return NextResponse.json({ session: null, prompt: null }, { headers: { 'Cache-Control': 'no-store', ...cors } })
  }

  // An already-active, unexpired, unanswered prompt takes priority over
  // re-evaluating — this is what makes "same event on both surfaces" work:
  // whichever call created it, every subsequent call just reads it back
  // until it's answered or its window (== its own cooldown) elapses.
  const { data: active, error: activeError } = await supabase
    .from('coaching_events')
    .select('*')
    .eq('session_id', session.id)
    .eq('action_status', 'unmarked')
    .gt('expires_at', new Date().toISOString())
    .order('priority', { ascending: true })
    .order('shown_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (activeError) {
    const { status, body } = sanitizedErrorResponse(activeError)
    return NextResponse.json(body, { status, headers: cors })
  }

  if (active) {
    return NextResponse.json(
      { session: { id: session.id }, prompt: shapeCoachingEvent(active, session.started_at) },
      { headers: { 'Cache-Control': 'no-store', ...cors } }
    )
  }

  // No active prompt — evaluate fresh, bounded to this session's own tips
  // only (never client-supplied totals, never full account history).
  const { data: tips, error: tipsError } = await supabase
    .from('live_tips')
    .select('username, usd, tokens, received_at')
    .eq('live_session_id', session.id)
    .order('received_at', { ascending: true })

  if (tipsError) {
    const { status, body } = sanitizedErrorResponse(tipsError)
    return NextResponse.json(body, { status, headers: cors })
  }

  const state = computeCoachingState({
    tips: tips || [],
    startedAt: session.started_at,
    goalTokens: session.coaching_goal_tokens,
  })
  const fired = evaluateCoachingTriggers({ state, tips: tips || [], strategy: session.coaching_strategy })
  const winner = selectPrimaryTrigger(fired)

  if (!winner) {
    return NextResponse.json(
      { session: { id: session.id }, prompt: null },
      { headers: { 'Cache-Control': 'no-store', ...cors } }
    )
  }

  const meta = TRIGGER_META[winner.type]
  const { data: created, error: rpcError } = await supabase.rpc('record_coaching_event_if_new', {
    p_session_id: session.id,
    p_dedupe_key: winner.dedupeKey,
    p_cooldown_seconds: meta.cooldownSeconds,
    p_type: winner.type,
    p_category: meta.category,
    p_priority: winner.priority,
    p_title: winner.title,
    p_message: winner.message,
    p_compact_message: winner.compactMessage,
    p_related_tip_id: null,
    p_related_tipper_id: winner.relatedTipperId || null,
    p_related_tipper_name: winner.relatedTipperName || null,
    p_related_amount_usd: winner.relatedAmountUsd ?? null,
    p_bullets: winner.bullets || [],
    p_recommended_action: winner.recommendedAction || null,
    p_estimated_impact: winner.estimatedImpact || null,
    p_reason: winner.reason || null,
    p_confidence: winner.confidence ?? null,
  })

  if (rpcError) {
    const { status, body } = sanitizedErrorResponse(rpcError)
    return NextResponse.json(body, { status, headers: cors })
  }

  return NextResponse.json(
    { session: { id: session.id }, prompt: shapeCoachingEvent(created, session.started_at) },
    { headers: { 'Cache-Control': 'no-store', ...cors } }
  )
}
