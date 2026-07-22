-- CamCash Live Mode Coaching System — Phase 2: shared, persisted prompt
-- engine. Centralizes the website's 9 existing coaching triggers
-- (dead_air_critical, goal_push, dead_air_high, pace_below, stream_fatigue,
-- pace_above, goal_hit, whale_prox, whale_dep — see app/live/page.js's
-- former getAlerts(), now removed) into public.coaching_events so the
-- website and the Chrome extension read the exact same server-created
-- record instead of each computing (and disagreeing on) their own.
--
-- Exact existing priority numbers, cooldown durations, and dedupe-key
-- shapes are reused verbatim from getAlerts() — nothing here invents new
-- timing or reorders anything. Each trigger's existing cooldown value also
-- becomes its expires_at duration (one canonical number per trigger, not
-- two): an event stays "active" for exactly as long as it would have
-- blocked its own re-firing before.
--
-- Deliberately NOT built here (per phase scope): any of the ~11 remaining
-- named prompt categories from the larger spec, coaching_prompt_outcomes
-- population (5/10/20-min before/after snapshots), dashboard effectiveness
-- reporting, personalization.

-- ── live_sessions: persisted coaching strategy ─────────────────────────────
-- Previously browser-only React state on the website (the balanced/
-- aggressive/goal/whale/retention/engagement dropdown) — the extension had
-- no equivalent. Must be server-visible so both surfaces evaluate triggers
-- against the same strategy and get identical results. NOT NULL DEFAULT
-- means every existing row is safely 'balanced' the instant this runs, no
-- COALESCE needed anywhere downstream.
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS coaching_strategy text NOT NULL DEFAULT 'balanced';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'live_sessions_coaching_strategy_check'
  ) THEN
    ALTER TABLE public.live_sessions
      ADD CONSTRAINT live_sessions_coaching_strategy_check
      CHECK (coaching_strategy IN ('balanced', 'aggressive', 'retention', 'engagement', 'whale', 'goal'));
  END IF;
END $$;

-- Same reasoning as coaching_strategy above: goal_push/goal_hit need a
-- token-goal target, which was previously only the website's local
-- liveGoalTokens input state — not visible to the extension and not
-- server-computable. Distinct from public.user_goals (a monthly USD
-- earnings target, unrelated). 0 means "no goal set" (goalProgress stays 0,
-- matching the website's existing liveGoalTokens > 0 ? ... : 0 guard).
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS coaching_goal_tokens integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'live_sessions_coaching_goal_tokens_check'
  ) THEN
    ALTER TABLE public.live_sessions
      ADD CONSTRAINT live_sessions_coaching_goal_tokens_check
      CHECK (coaching_goal_tokens >= 0);
  END IF;
END $$;

-- Index to support the cooldown lookback query
-- (session_id + dedupe_key + shown_at range) that record_coaching_event_if_new
-- runs on every evaluation.
CREATE INDEX IF NOT EXISTS coaching_events_session_dedupe_shown_idx
  ON public.coaching_events(session_id, dedupe_key, shown_at DESC);

-- Index to support "current active prompt for this session" lookups
-- (action_status = 'unmarked' AND expires_at > now()).
CREATE INDEX IF NOT EXISTS coaching_events_session_active_idx
  ON public.coaching_events(session_id, action_status, expires_at);

-- ── set_live_session_coaching_strategy ──────────────────────────────────────
-- Never trusts a client-supplied session id — always targets the caller's
-- own current unresolved session, derived from auth.uid() alone, same
-- pattern as every other session RPC. Returns null (not an error) if the
-- caller has no unresolved session; callers treat that as a no-op.
CREATE OR REPLACE FUNCTION public.set_live_session_coaching_strategy(p_strategy text)
RETURNS public.live_sessions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_result public.live_sessions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_strategy NOT IN ('balanced', 'aggressive', 'retention', 'engagement', 'whale', 'goal') THEN
    RAISE EXCEPTION 'Invalid strategy: %', p_strategy USING ERRCODE = '22023';
  END IF;

  UPDATE public.live_sessions
    SET coaching_strategy = p_strategy
    WHERE user_id = v_uid
      AND status IN ('starting', 'active', 'paused', 'stopping', 'needs_resolution')
    RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_live_session_coaching_strategy(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_live_session_coaching_strategy(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.set_live_session_coaching_strategy(text) TO authenticated;

-- ── set_live_session_goal_tokens ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_live_session_goal_tokens(p_goal_tokens integer)
RETURNS public.live_sessions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_result public.live_sessions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_goal_tokens IS NULL OR p_goal_tokens < 0 THEN
    RAISE EXCEPTION 'Invalid goal_tokens: %', p_goal_tokens USING ERRCODE = '22023';
  END IF;

  UPDATE public.live_sessions
    SET coaching_goal_tokens = p_goal_tokens
    WHERE user_id = v_uid
      AND status IN ('starting', 'active', 'paused', 'stopping', 'needs_resolution')
    RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_live_session_goal_tokens(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_live_session_goal_tokens(integer) FROM anon;
GRANT  EXECUTE ON FUNCTION public.set_live_session_goal_tokens(integer) TO authenticated;

-- ── record_coaching_event_if_new ────────────────────────────────────────────
-- The single duplicate-prevention mechanism. A pg_advisory_xact_lock keyed
-- on session_id alone serializes ALL concurrent calls for a session —
-- regardless of which trigger each call is for — so the second caller's
-- check-then-insert always runs after the first has committed and sees the
-- just-created row instead of inserting a second one. Always returns
-- exactly one canonical row, whether newly created or pre-existing.
--
-- Verifies the session belongs to the caller before writing anything —
-- never trusts a client-supplied session_id to actually belong to them.
CREATE OR REPLACE FUNCTION public.record_coaching_event_if_new(
  p_session_id          uuid,
  p_dedupe_key          text,
  p_cooldown_seconds    integer,
  p_type                text,
  p_category            text,
  p_priority             integer,
  p_title               text,
  p_message             text,
  p_compact_message     text,
  p_related_tip_id      uuid DEFAULT NULL,
  p_related_tipper_id   text DEFAULT NULL,
  p_related_tipper_name text DEFAULT NULL,
  p_related_amount_usd  numeric DEFAULT NULL
)
RETURNS public.coaching_events
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_existing public.coaching_events;
  v_result   public.coaching_events;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  PERFORM 1 FROM public.live_sessions WHERE id = p_session_id AND user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = '22023';
  END IF;

  -- Locked on session_id alone (not session_id+dedupe_key) so that ALL
  -- concurrent calls for this session — regardless of which trigger each
  -- one is about — are fully serialized. This is what makes "only one
  -- active prompt per session" a real invariant instead of a best-effort
  -- check: two different triggers evaluating true in the same narrow race
  -- window (e.g. website and extension polling at the same instant) can no
  -- longer both slip through and create two different rows.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_session_id::text, 0));

  -- 1. Active-prompt blocking: ANY unresolved, unexpired event already
  -- showing for this session — regardless of dedupe_key — blocks creating
  -- a different one. This is the concept that "only one canonical prompt
  -- is ever active at a time" actually rests on.
  SELECT * INTO v_existing FROM public.coaching_events
    WHERE session_id = p_session_id
      AND action_status = 'unmarked'
      AND expires_at > now()
    ORDER BY priority ASC, shown_at ASC
    LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- 2. Trigger-specific cooldown: separate from (1) above. Even once the
  -- previous active prompt has expired OR been answered (performed/
  -- skipped), THIS exact dedupe_key still can't fire again until its own
  -- cooldown — anchored to the original shown_at, never to when it was
  -- answered — has elapsed. Answering a prompt early does not shorten its
  -- own cooldown window.
  SELECT * INTO v_existing FROM public.coaching_events
    WHERE session_id = p_session_id
      AND dedupe_key = p_dedupe_key
      AND shown_at > now() - (p_cooldown_seconds || ' seconds')::interval
    ORDER BY shown_at DESC
    LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.coaching_events (
    session_id, user_id, type, category, priority, dedupe_key,
    title, message, compact_message,
    related_tip_id, related_tipper_id, related_tipper_name, related_amount_usd,
    expires_at
  ) VALUES (
    p_session_id, v_uid, p_type, p_category, p_priority, p_dedupe_key,
    p_title, p_message, p_compact_message,
    p_related_tip_id, p_related_tipper_id, p_related_tipper_name, p_related_amount_usd,
    now() + (p_cooldown_seconds || ' seconds')::interval
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.record_coaching_event_if_new(uuid, text, integer, text, text, integer, text, text, text, uuid, text, text, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_coaching_event_if_new(uuid, text, integer, text, text, integer, text, text, text, uuid, text, text, numeric) FROM anon;
GRANT  EXECUTE ON FUNCTION public.record_coaching_event_if_new(uuid, text, integer, text, text, integer, text, text, text, uuid, text, text, numeric) TO authenticated;

-- ── respond_to_coaching_event ────────────────────────────────────────────────
-- Only 'performed'/'skipped' are accepted this phase — 'dismissed' is not
-- exposed until there's a real UI action and defined behavior for it.
-- Idempotent: resubmitting the same status is a no-op returning the
-- existing row. A conflicting second response (different status once
-- already terminal) also returns the existing row unchanged rather than
-- overwriting the audit trail. action_responded_at is always server-set.
CREATE OR REPLACE FUNCTION public.respond_to_coaching_event(
  p_event_id uuid,
  p_status   text
)
RETURNS public.coaching_events
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_uid     uuid := auth.uid();
  v_current public.coaching_events;
  v_result  public.coaching_events;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_status NOT IN ('performed', 'skipped') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_current FROM public.coaching_events
    WHERE id = p_event_id AND user_id = v_uid;
  IF v_current.id IS NULL THEN
    RAISE EXCEPTION 'Coaching event not found' USING ERRCODE = '22023';
  END IF;

  -- Same status resubmitted, or already a different terminal status —
  -- either way, the canonical stored state wins; never overwritten here.
  IF v_current.action_status IN ('performed', 'skipped') THEN
    RETURN v_current;
  END IF;

  UPDATE public.coaching_events
    SET action_status = p_status,
        action_responded_at = now()
    WHERE id = p_event_id
    RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.respond_to_coaching_event(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.respond_to_coaching_event(uuid, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.respond_to_coaching_event(uuid, text) TO authenticated;
