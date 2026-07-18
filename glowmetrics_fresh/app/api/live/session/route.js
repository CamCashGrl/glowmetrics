import { createClient } from '@supabase/supabase-js';
import { tokenRate } from '../../../../lib/constants';
import { computeCoachingOutcomeWindows, dedupeOutcomesByEventId } from '../../../../lib/sessionHub/coachingOutcome';
import { computeCoachingSummary } from '../../../../lib/sessionHub/coachingSummary';
import { computeSessionDuration } from '../../../../lib/sessionHub/sessionMath';
import { buildLiveSessionAnalysisContext } from '../../../../lib/sessionHub/analysisContext';
import { computeSessionDataQuality } from '../../../../lib/sessionHub/dataQuality';
import { resolveDurationConfidence } from '../../../../lib/sessionHub/sessionCorrection';
import { logFeatureUsageEvent } from '../../../../lib/sessionHub/featureUsage';

export const dynamic = 'force-dynamic';

// A heartbeat older than this is treated as "extension not actually open" —
// a little over 2x the extension's ~1 minute heartbeat alarm so one missed
// tick doesn't falsely flip a session to disconnected.
const HEARTBEAT_STALE_MS = 150_000;

// One authoritative Live Mode session-lifecycle implementation, shared by
// the web /live page and the Chrome extension — both call this route
// instead of writing to stream_sessions directly, so starting/pausing from
// either surface is always reflected on the other.

function corsHeaders(req) {
  const origin = req.headers.get('origin') || '';
  const allowed = origin.startsWith('chrome-extension://')
    ? origin
    : 'https://www.camcashgrl.com';
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

async function authenticate(req) {
  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const supabaseClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return { error: 'Missing authorization', status: 401 };
  const token = authHeader.substring(7);
  const { data: { user }, error } = await supabaseClient.auth.getUser(token);
  if (error || !user) return { error: 'Invalid or expired token', status: 401 };
  return { supabaseAdmin, user };
}

async function getOpenSession(supabaseAdmin, userId) {
  const { data } = await supabaseAdmin
    .from('stream_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('completed', false)
    .order('start_time', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

function lastOpenPauseIndex(pauseIntervals) {
  if (!Array.isArray(pauseIntervals)) return -1;
  for (let i = pauseIntervals.length - 1; i >= 0; i--) {
    if (!pauseIntervals[i].end) return i;
  }
  return -1;
}

async function handleStart(supabaseAdmin, user, { platform }) {
  const existing = await getOpenSession(supabaseAdmin, user.id);
  if (existing) return { session: existing, attached: true };

  const startTime = new Date();
  const { data: session, error } = await supabaseAdmin
    .from('stream_sessions')
    .insert({
      user_id: user.id,
      platform: platform || 'Chaturbate',
      start_time: startTime.toISOString(),
      end_time: startTime.toISOString(), // placeholder; updated on stop
      hours_streamed: 0,
    })
    .select()
    .single();
  if (error) throw error;

  await logFeatureUsageEvent(supabaseAdmin, {
    userId: user.id, sessionId: session.id, feature: 'live_mode',
    action: 'live_mode.session_started', metadata: { platform: platform || 'Chaturbate' },
  });
  return { session, attached: false };
}

async function handlePause(supabaseAdmin, user, { sessionId, reason }) {
  const { data: session } = await supabaseAdmin.from('stream_sessions').select('*').eq('id', sessionId).maybeSingle();
  if (!session || session.user_id !== user.id) return { error: 'Session not found', status: 404 };
  if (session.completed) return { session };

  const pauseIntervals = session.pause_intervals || [];
  if (lastOpenPauseIndex(pauseIntervals) !== -1) return { session }; // already paused — idempotent

  const updated = [...pauseIntervals, { start: new Date().toISOString(), end: null, reason: reason || 'user' }];
  const { data: saved } = await supabaseAdmin.from('stream_sessions').update({ pause_intervals: updated }).eq('id', sessionId).select().single();

  await logFeatureUsageEvent(supabaseAdmin, {
    userId: user.id, sessionId, feature: 'pause_resume', action: 'session.paused', metadata: { reason: reason || 'user' },
  });
  return { session: saved };
}

async function handleResume(supabaseAdmin, user, { sessionId }) {
  const { data: session } = await supabaseAdmin.from('stream_sessions').select('*').eq('id', sessionId).maybeSingle();
  if (!session || session.user_id !== user.id) return { error: 'Session not found', status: 404 };
  if (session.completed) return { session };

  const pauseIntervals = session.pause_intervals || [];
  const idx = lastOpenPauseIndex(pauseIntervals);
  if (idx === -1) return { session }; // not paused — idempotent

  const reason = pauseIntervals[idx].reason;
  const updated = pauseIntervals.map((p, i) => (i === idx ? { ...p, end: new Date().toISOString() } : p));
  const { data: saved } = await supabaseAdmin.from('stream_sessions').update({ pause_intervals: updated }).eq('id', sessionId).select().single();

  await logFeatureUsageEvent(supabaseAdmin, {
    userId: user.id, sessionId, feature: 'pause_resume', action: 'session.resumed', metadata: { reason },
  });
  return { session: saved };
}

async function handleStop(supabaseAdmin, user, { sessionId }) {
  const { data: session } = await supabaseAdmin.from('stream_sessions').select('*').eq('id', sessionId).maybeSingle();
  if (!session || session.user_id !== user.id) return { error: 'Session not found', status: 404 };
  if (session.completed) return { session };

  const endTime = new Date();
  const startedAt = new Date(session.start_time);
  const pauseIntervals = (session.pause_intervals || []).map(p => (p.end ? p : { ...p, end: endTime.toISOString() }));

  const { data: tips } = await supabaseAdmin
    .from('live_tips')
    .select('username, tokens, usd, received_at')
    .eq('user_id', user.id)
    .gte('received_at', session.start_time)
    .lte('received_at', endTime.toISOString())
    .order('received_at', { ascending: true });

  const normalizedTips = (tips || []).map(t => ({
    username: t.username,
    timestamp: t.received_at,
    usd: parseFloat(t.usd) > 0 ? parseFloat(t.usd) : (t.tokens || 0) * tokenRate(session.platform),
  }));
  const totalUsd = normalizedTips.reduce((sum, t) => sum + t.usd, 0);
  const totalTokens = (tips || []).reduce((sum, t) => sum + (t.tokens || 0), 0);
  const hoursStreamed = (endTime - startedAt) / 1000 / 60 / 60;

  const { data: saved } = await supabaseAdmin.from('stream_sessions').update({
    end_time: endTime.toISOString(),
    hours_streamed: parseFloat(hoursStreamed.toFixed(4)),
    usd: parseFloat(totalUsd.toFixed(2)),
    tokens: totalTokens,
    tip_count: normalizedTips.length,
    completed: true,
    pause_intervals: pauseIntervals,
    duration_confidence: 'verified',
  }).eq('id', sessionId).select().single();

  await finalizeLiveSession(supabaseAdmin, user, {
    sessionId, startedAt, endedAt: endTime, closedPauseIntervals: pauseIntervals,
    tips: normalizedTips, totalUsd, totalTokens, platform: session.platform,
  });

  return { session: saved };
}

// Same data-collection-only logic as the web page previously ran client
// side (see app/live/page.js) — moved here so it runs identically whether
// the session was stopped from the web page or the extension.
async function finalizeLiveSession(supabaseAdmin, user, { sessionId, startedAt, endedAt, closedPauseIntervals, tips, totalUsd, totalTokens, platform }) {
  const { data: eventRows } = await supabaseAdmin.from('coaching_events').select('*').eq('session_id', sessionId);
  const events = eventRows || [];

  const outcomes = events.map(ev => {
    const windows = computeCoachingOutcomeWindows({ promptShownAt: ev.shown_at, tips, relatedTipperName: ev.related_tipper_name });
    return {
      coachingEventId: ev.id, userId: user.id, sessionId, actionStatus: ev.action_status,
      ...windows, paceBeforePrompt: parseFloat((windows.earningsBefore5m / 5).toFixed(3)),
    };
  });

  for (const outcome of dedupeOutcomesByEventId(outcomes)) {
    await supabaseAdmin.from('coaching_prompt_outcomes').upsert({
      user_id: outcome.userId, coaching_event_id: outcome.coachingEventId, session_id: outcome.sessionId,
      action_status: outcome.actionStatus, prompt_shown_at: outcome.promptShownAt,
      earnings_before_5m: outcome.earningsBefore5m, earnings_after_5m: outcome.earningsAfter5m,
      earnings_after_10m: outcome.earningsAfter10m, earnings_after_20m: outcome.earningsAfter20m,
      tips_before_5m: outcome.tipsBefore5m, tips_after_5m: outcome.tipsAfter5m,
      tips_after_10m: outcome.tipsAfter10m, tips_after_20m: outcome.tipsAfter20m,
      unique_tippers_before_5m: outcome.uniqueTippersBefore5m, unique_tippers_after_5m: outcome.uniqueTippersAfter5m,
      unique_tippers_after_10m: outcome.uniqueTippersAfter10m, unique_tippers_after_20m: outcome.uniqueTippersAfter20m,
      related_supporter_tipped_again_5m: outcome.relatedSupporterTippedAgain5m,
      related_supporter_tipped_again_10m: outcome.relatedSupporterTippedAgain10m,
      pace_before_prompt: outcome.paceBeforePrompt, pace_after_10m: outcome.paceAfter10m,
    }, { onConflict: 'coaching_event_id' });
  }

  const summary = computeCoachingSummary(events.map(e => ({ category: e.category, actionStatus: e.action_status })));
  const duration = computeSessionDuration(startedAt, endedAt, closedPauseIntervals);
  const durationConfidence = resolveDurationConfidence({ hasUserCorrection: false, completed: true });

  const context = buildLiveSessionAnalysisContext({
    sessionId, platform, startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(),
    timezone: 'UTC', // server has no reliable local timezone for the user; corrected client-side if needed later
    activeDurationMinutes: duration.activeDurationMinutes, pausedDurationMinutes: duration.pausedDurationMinutes,
    totalEarningsUsd: totalUsd, totalTokens, tipCount: tips.length,
    uniqueTipperCount: new Set(tips.map(t => (t.username || '').toLowerCase())).size,
    coachingEnabled: true,
    promptCounts: { performed: summary.performedPromptCount, skipped: summary.skippedPromptCount, unmarked: summary.unmarkedPromptCount },
    durationConfidence,
  });
  await supabaseAdmin.from('live_session_analysis_context').upsert({
    session_id: context.sessionId, user_id: user.id, platform: context.platform,
    started_at: context.startedAt, ended_at: context.endedAt,
    day_of_week: context.dayOfWeek, start_hour_local: context.startHourLocal, timezone: context.timezone,
    active_duration_minutes: context.activeDurationMinutes, paused_duration_minutes: context.pausedDurationMinutes,
    total_earnings_usd: context.totalEarningsUsd, total_tokens: context.totalTokens,
    tip_count: context.tipCount, unique_tipper_count: context.uniqueTipperCount,
    actual_hourly_rate: context.actualHourlyRate, coaching_enabled: context.coachingEnabled,
    coaching_prompt_count: context.coachingPromptCount, performed_prompt_count: context.performedPromptCount,
    skipped_prompt_count: context.skippedPromptCount, unmarked_prompt_count: context.unmarkedPromptCount,
    goal_used: context.goalUsed, streaming_plan_window_id: context.streamingPlanWindowId,
    started_from_streaming_plan: context.startedFromStreamingPlan, started_inside_recommended_window: context.startedInsideRecommendedWindow,
    duration_confidence: context.durationConfidence,
  }, { onConflict: 'session_id' });

  const outcomeWindowsComplete = events.every(ev => endedAt.getTime() - new Date(ev.shown_at).getTime() >= 20 * 60_000);
  const quality = computeSessionDataQuality({
    duration: { activeDurationMinutes: duration.activeDurationMinutes, completed: true, hasEstimatedEnd: false },
    hasUserCorrection: false,
    containsPauseIntervals: closedPauseIntervals.length > 0,
    duplicateTipCount: 0,
    invalidTipCount: 0,
    coachingDataComplete: true,
    outcomeWindowsComplete,
  });
  await supabaseAdmin.from('session_data_quality').upsert({
    session_id: sessionId, user_id: user.id,
    has_verified_start: quality.hasVerifiedStart, has_verified_end: quality.hasVerifiedEnd,
    has_estimated_end: quality.hasEstimatedEnd, has_user_correction: quality.hasUserCorrection,
    contains_pause_intervals: quality.containsPauseIntervals, extension_connected_percent: quality.extensionConnectedPercent,
    duplicate_tip_count: quality.duplicateTipCount, invalid_tip_count: quality.invalidTipCount,
    coaching_data_complete: quality.coachingDataComplete, outcome_windows_complete: quality.outcomeWindowsComplete,
    eligible_for_future_impact_analysis: quality.eligibleForFutureImpactAnalysis,
    ineligibility_reasons: quality.ineligibilityReasons,
  }, { onConflict: 'session_id' });

  await logFeatureUsageEvent(supabaseAdmin, {
    userId: user.id, sessionId, feature: 'live_mode', action: 'live_mode.session_ended',
    metadata: { durationConfidence, coachingPromptCount: context.coachingPromptCount },
  });
}

async function handleHeartbeat(supabaseAdmin, user, { platform }) {
  await supabaseAdmin.from('extension_presence').upsert({
    user_id: user.id, platform: platform || null, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  const session = await getOpenSession(supabaseAdmin, user.id);
  return { session, ok: true };
}

export async function POST(req) {
  const cors = corsHeaders(req);
  try {
    const auth = await authenticate(req);
    if (auth.error) return Response.json({ error: auth.error }, { status: auth.status, headers: cors });
    const { supabaseAdmin, user } = auth;
    const body = await req.json();

    let result;
    switch (body.action) {
      case 'start':     result = await handleStart(supabaseAdmin, user, body); break;
      case 'pause':     result = await handlePause(supabaseAdmin, user, body); break;
      case 'resume':    result = await handleResume(supabaseAdmin, user, body); break;
      case 'stop':      result = await handleStop(supabaseAdmin, user, body); break;
      case 'heartbeat': result = await handleHeartbeat(supabaseAdmin, user, body); break;
      default: return Response.json({ error: 'Unknown action' }, { status: 400, headers: cors });
    }
    if (result.error) return Response.json({ error: result.error }, { status: result.status || 400, headers: cors });
    return Response.json(result, { headers: cors });
  } catch (err) {
    console.error('[live/session] error:', err);
    return Response.json({ error: 'Failed to update session' }, { status: 500, headers: cors });
  }
}

export async function GET(req) {
  const cors = corsHeaders(req);
  try {
    const auth = await authenticate(req);
    if (auth.error) return Response.json({ error: auth.error }, { status: auth.status, headers: cors });
    const { supabaseAdmin, user } = auth;

    const [session, { data: presence }] = await Promise.all([
      getOpenSession(supabaseAdmin, user.id),
      supabaseAdmin.from('extension_presence').select('*').eq('user_id', user.id).maybeSingle(),
    ]);
    const extensionActive = !!presence?.last_seen_at && (Date.now() - new Date(presence.last_seen_at).getTime()) < HEARTBEAT_STALE_MS;

    return Response.json({ session, presence, extensionActive }, { headers: cors });
  } catch (err) {
    console.error('[live/session] GET error:', err);
    return Response.json({ error: 'Failed to load session' }, { status: 500, headers: cors });
  }
}
