-- ROOT CAUSE (confirmed by reading all four termination-path functions
-- directly against production, not from migration history):
--
-- Four functions can transition a live_sessions row to 'ended':
--   stop_live_session()              -- manual "End Stream"
--   sweep_stale_live_session()       -- self-scoped, called from heartbeats/GET
--   sweep_all_stale_live_sessions()  -- system-wide, called from pg_cron
--   resolve_live_session()           -- explicit user choice from inactive_warning
--
-- The first three each carry their own COPY of the exact same block:
-- aggregate live_tips (COUNT/SUM/AVG/MAX) into session_earnings_usd,
-- session_tokens, tip_count, unique_tipper_count, largest_tip_usd,
-- average_tip_usd, earnings_per_active_hour, tips_per_active_hour.
-- resolve_live_session() never had this block at all — for 4 of its 5
-- choices ('ended', 'end_at_last_heartbeat', 'choose_end_time',
-- 'mark_invalid') it sets status='ended'/ended_at and returns, leaving
-- every metric column at its true column default: NULL (not zero —
-- confirmed via information_schema; live_sessions never initializes these
-- at start_live_session() either).
--
-- Consumers treat that NULL as zero: app/dashboard/page.js's Live Mode
-- Sessions replay tab renders `$(s.session_earnings_usd || 0).toFixed(2)`
-- directly from the live_sessions row, so any session resolved through
-- resolve_live_session() shows $0.00 and "0 tips" in a user's own session
-- history regardless of what they actually earned. This is not a formula
-- bug — the underlying live_tips rows are correct and still attributed via
-- live_session_id — it's a finalization-path gap: three RPCs duplicate the
-- rollup, the fourth never got it.
--
-- FIX: extract the shared rollup into one internal function and have all
-- four termination paths call it, instead of duplicating (or omitting) the
-- calculation. No formula changes — this is the exact same SQL that
-- stop_live_session()/sweep_stale_live_session()/
-- sweep_all_stale_live_sessions() already ran, now run from one place.

-- ── _finalize_live_session_metrics: shared rollup, not directly exposed ────
-- Recomputes session_earnings_usd/session_tokens/tip_count/
-- unique_tipper_count/largest_tip_usd/average_tip_usd/
-- earnings_per_active_hour/tips_per_active_hour from live_tips for one
-- already-ended session. Idempotent: it's a deterministic SELECT ... SUM
-- over live_tips keyed by live_session_id, so calling it twice on the same
-- session produces the same numbers, never double-counts, and never
-- accumulates. Requires ended_at to already be set (every caller sets it
-- immediately before calling this) — if it's somehow still null, this is a
-- no-op that returns the row unchanged rather than computing a bogus
-- negative/undefined duration.
--
-- SECURITY INVOKER (not DEFINER): the UPDATE inside stays subject to the
-- existing "Users manage own live sessions" RLS policy
-- (auth.uid() = user_id), so even direct invocation by an authenticated
-- caller with someone else's session_id silently affects zero rows.
-- sweep_all_stale_live_sessions() (SECURITY DEFINER, cross-user, called
-- only from the pg_cron job and the CRON_SECRET-gated route) already runs
-- as the function owner when it calls this, so it keeps its existing
-- cross-user reach — unchanged from before this migration.
CREATE OR REPLACE FUNCTION public._finalize_live_session_metrics(p_session_id uuid)
 RETURNS public.live_sessions
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row            public.live_sessions;
  v_active_secs    numeric;
  v_tip_count      integer;
  v_unique_tippers integer;
  v_earnings       numeric;
  v_tokens         integer;
  v_largest_tip    numeric;
  v_avg_tip        numeric;
BEGIN
  SELECT * INTO v_row FROM public.live_sessions WHERE id = p_session_id;
  IF NOT FOUND OR v_row.ended_at IS NULL THEN
    RETURN v_row;
  END IF;

  v_active_secs := GREATEST(0,
    EXTRACT(EPOCH FROM (v_row.ended_at - v_row.started_at)) - v_row.total_paused_seconds
  );

  SELECT
    COUNT(*), COUNT(DISTINCT lower(username)),
    COALESCE(SUM(usd), 0), COALESCE(SUM(tokens), 0),
    COALESCE(MAX(usd), 0), COALESCE(AVG(usd), 0)
    INTO v_tip_count, v_unique_tippers, v_earnings, v_tokens, v_largest_tip, v_avg_tip
    FROM public.live_tips
    WHERE live_session_id = p_session_id;

  UPDATE public.live_sessions
    SET session_earnings_usd     = v_earnings,
        session_tokens           = v_tokens,
        tip_count                = v_tip_count,
        unique_tipper_count      = v_unique_tippers,
        largest_tip_usd          = v_largest_tip,
        average_tip_usd          = v_avg_tip,
        earnings_per_active_hour = CASE WHEN v_active_secs > 0 THEN round((v_earnings / (v_active_secs / 3600.0))::numeric, 2) ELSE 0 END,
        tips_per_active_hour     = CASE WHEN v_active_secs > 0 THEN round((v_tip_count / (v_active_secs / 3600.0))::numeric, 2) ELSE 0 END
    WHERE id = p_session_id
    RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public._finalize_live_session_metrics(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._finalize_live_session_metrics(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public._finalize_live_session_metrics(uuid) TO authenticated;

-- ── stop_live_session: now calls the shared helper ─────────────────────────
CREATE OR REPLACE FUNCTION public.stop_live_session()
 RETURNS public.live_sessions
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_result public.live_sessions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  UPDATE public.live_sessions
    SET status = 'ended',
        live_substate = null,
        is_active = false,
        ended_at = now(),
        last_heartbeat_at = now(),
        total_paused_seconds = total_paused_seconds
          + CASE WHEN paused_at IS NOT NULL
                 THEN GREATEST(0, EXTRACT(EPOCH FROM (now() - paused_at))::integer)
                 ELSE 0 END,
        paused_at = null,
        warning_started_at = null,
        status_before_resolution = null,
        session_resolution_type = 'normal_stop'
    WHERE user_id = v_uid
      AND status IN ('starting','live','inactive_warning','ending')
    RETURNING * INTO v_result;

  IF v_result IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_result.paused_at IS NOT NULL THEN
    UPDATE public.live_session_pauses
      SET resumed_at = v_result.ended_at,
          pause_duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (v_result.ended_at - paused_at))::integer)
      WHERE session_id = v_result.id AND resumed_at IS NULL;
  END IF;

  RETURN public._finalize_live_session_metrics(v_result.id);
END;
$function$;

-- ── sweep_stale_live_session: now calls the shared helper ──────────────────
CREATE OR REPLACE FUNCTION public.sweep_stale_live_session()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid               uuid := auth.uid();
  v_row               public.live_sessions;
  v_has_proof_of_life boolean;
  v_ended_at          timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_row FROM public.live_sessions
    WHERE user_id = v_uid AND status IN ('live', 'inactive_warning')
    ORDER BY started_at DESC
    LIMIT 1;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_row.status = 'live' AND now() - v_row.last_heartbeat_at >= interval '10 minutes' THEN
    UPDATE public.live_sessions
      SET status = 'inactive_warning',
          warning_started_at = v_row.last_heartbeat_at
      WHERE id = v_row.id;
    RETURN;
  END IF;

  IF v_row.status = 'inactive_warning'
     AND now() - v_row.last_heartbeat_at >= interval '20 minutes' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.live_tips
      WHERE user_id = v_uid AND received_at > v_row.last_heartbeat_at
    ) INTO v_has_proof_of_life;

    IF v_has_proof_of_life THEN
      UPDATE public.live_sessions
        SET status = 'live',
            warning_started_at = null,
            last_heartbeat_at = now()
        WHERE id = v_row.id;
      RETURN;
    END IF;

    v_ended_at := v_row.last_heartbeat_at;

    UPDATE public.live_sessions
      SET status = 'ended',
          live_substate = null,
          is_active = false,
          warning_started_at = null,
          ended_at = v_ended_at,
          total_paused_seconds = total_paused_seconds
            + CASE WHEN paused_at IS NOT NULL
                   THEN GREATEST(0, EXTRACT(EPOCH FROM (v_ended_at - paused_at))::integer)
                   ELSE 0 END,
          paused_at = null,
          last_heartbeat_at = now(),
          session_resolution_type = 'auto_ended_inactivity'
      WHERE id = v_row.id
      RETURNING * INTO v_row;

    PERFORM public._finalize_live_session_metrics(v_row.id);
  END IF;
END;
$function$;

-- ── sweep_all_stale_live_sessions: now calls the shared helper ─────────────
CREATE OR REPLACE FUNCTION public.sweep_all_stale_live_sessions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row               public.live_sessions;
  v_has_proof_of_life boolean;
  v_ended_at          timestamptz;
  v_swept             integer := 0;
BEGIN
  FOR v_row IN
    SELECT * FROM public.live_sessions
      WHERE status = 'live' AND now() - last_heartbeat_at >= interval '10 minutes'
      FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.live_sessions
      SET status = 'inactive_warning',
          warning_started_at = v_row.last_heartbeat_at
      WHERE id = v_row.id;
    v_swept := v_swept + 1;
  END LOOP;

  FOR v_row IN
    SELECT * FROM public.live_sessions
      WHERE status = 'inactive_warning' AND now() - last_heartbeat_at >= interval '20 minutes'
      FOR UPDATE SKIP LOCKED
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.live_tips
      WHERE user_id = v_row.user_id AND received_at > v_row.last_heartbeat_at
    ) INTO v_has_proof_of_life;

    IF v_has_proof_of_life THEN
      UPDATE public.live_sessions
        SET status = 'live', warning_started_at = null, last_heartbeat_at = now()
        WHERE id = v_row.id;
      v_swept := v_swept + 1;
      CONTINUE;
    END IF;

    v_ended_at := v_row.last_heartbeat_at;

    UPDATE public.live_sessions
      SET status = 'ended',
          live_substate = null,
          is_active = false,
          warning_started_at = null,
          ended_at = v_ended_at,
          total_paused_seconds = total_paused_seconds
            + CASE WHEN paused_at IS NOT NULL
                   THEN GREATEST(0, EXTRACT(EPOCH FROM (v_ended_at - paused_at))::integer)
                   ELSE 0 END,
          paused_at = null,
          last_heartbeat_at = now(),
          session_resolution_type = 'auto_ended_inactivity'
      WHERE id = v_row.id
      RETURNING * INTO v_row;

    PERFORM public._finalize_live_session_metrics(v_row.id);
    v_swept := v_swept + 1;
  END LOOP;

  RETURN v_swept;
END;
$function$;

-- ── resolve_live_session: now calls the shared helper for every ending
-- choice ('ended', 'end_at_last_heartbeat', 'choose_end_time',
-- 'mark_invalid') — this is the actual fix. 'still_live' is unaffected
-- (it never sets ended_at; it returns the session to 'live').
--
-- mark_invalid still gets real metrics computed: is_inaccurate=true is
-- what excludes a session from stats (per the existing FUTURE REQUIREMENT
-- note in app/api/live/session/resolve/route.js), not blank metric
-- columns. The live_tips rows attributed to this session_id are real
-- regardless of whether the user trusts the session's start/end
-- boundaries — leaving them uncomputed was never protecting anything, just
-- silently discarding real data the same way the other three paths' bug
-- did.
CREATE OR REPLACE FUNCTION public.resolve_live_session(p_choice text, p_end_time timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS public.live_sessions
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid               uuid := auth.uid();
  v_current           public.live_sessions;
  v_result            public.live_sessions;
  v_uncertainty_start timestamptz;
  v_end_time          timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_choice NOT IN ('still_live', 'ended', 'end_at_last_heartbeat', 'choose_end_time', 'mark_invalid') THEN
    RAISE EXCEPTION 'Invalid choice: %', p_choice USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_current FROM public.live_sessions
    WHERE user_id = v_uid AND status = 'inactive_warning';
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_uncertainty_start := COALESCE(v_current.warning_started_at, v_current.last_heartbeat_at);

  IF p_choice = 'still_live' THEN
    UPDATE public.live_sessions
      SET status = 'live',
          warning_started_at = null,
          total_paused_seconds = total_paused_seconds
            + CASE WHEN v_current.live_substate = 'active'
                   THEN GREATEST(0, EXTRACT(EPOCH FROM (now() - COALESCE(v_uncertainty_start, now())))::integer)
                   ELSE 0 END,
          extension_last_heartbeat_at = now(),
          broadcaster_page_missing_since = null,
          website_last_heartbeat_at = now(),
          last_heartbeat_at = now()
      WHERE id = v_current.id
      RETURNING * INTO v_result;
    RETURN v_result;
  END IF;

  IF p_choice = 'ended' THEN
    v_end_time := COALESCE(p_end_time, v_uncertainty_start, now());
  ELSIF p_choice = 'end_at_last_heartbeat' THEN
    v_end_time := COALESCE(v_current.extension_last_heartbeat_at, v_current.website_last_heartbeat_at, v_uncertainty_start, now());
  ELSIF p_choice = 'choose_end_time' THEN
    IF p_end_time IS NULL THEN
      RAISE EXCEPTION 'choose_end_time requires p_end_time' USING ERRCODE = '22023';
    END IF;
    v_end_time := p_end_time;
  ELSE -- mark_invalid
    v_end_time := COALESCE(v_uncertainty_start, now());
  END IF;

  UPDATE public.live_sessions
    SET status = 'ended',
        live_substate = null,
        is_active = false,
        warning_started_at = null,
        ended_at = v_end_time,
        total_paused_seconds = total_paused_seconds
          + CASE WHEN paused_at IS NOT NULL
                 THEN GREATEST(0, EXTRACT(EPOCH FROM (v_end_time - paused_at))::integer)
                 ELSE 0 END,
        paused_at = null,
        last_heartbeat_at = now(),
        session_resolution_type = CASE p_choice
          WHEN 'ended' THEN 'end_at_last_heartbeat'
          WHEN 'end_at_last_heartbeat' THEN 'end_at_last_heartbeat'
          WHEN 'choose_end_time' THEN 'chosen_end_time'
          ELSE 'marked_invalid'
        END,
        is_inaccurate = (p_choice = 'mark_invalid'),
        inaccuracy_reason = CASE WHEN p_choice = 'mark_invalid' THEN 'marked_invalid_by_user' ELSE inaccuracy_reason END
    WHERE id = v_current.id
    RETURNING * INTO v_result;

  RETURN public._finalize_live_session_metrics(v_result.id);
END;
$function$;
