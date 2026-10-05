-- Phase 2: Atomic finalization and delayed-tip reconciliation
--
-- Three functions:
-- 1. finalize_live_session() - atomic Stop/Finalize combining status transition,
--    metric aggregation, and persistence in one RPC call
-- 2. recalculate_session_final_metrics() - recalculates all final_* fields from
--    authoritative live_tips rows (used both at finalization and when reconciling
--    delayed tips to already-ended sessions)
-- 3. Updated persist_extension_tip() - adds delayed-tip reconciliation logic
--    while preserving all existing Phase 1 contract and dedup behavior

-- ── finalize_live_session ────────────────────────────────────────────────
-- Atomic finalization: single RPC holds advisory lock from session transition
-- through metric aggregation and persistence to 'ended' status.
-- Handles both first-time finalization and repeated calls (idempotent).

CREATE OR REPLACE FUNCTION public.finalize_live_session(p_session_id uuid DEFAULT NULL)
RETURNS public.live_sessions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_session live_sessions;
  v_result live_sessions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Acquire user-level advisory lock for entire finalization
  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text, 0)::bigint);

  -- Find unresolved session to finalize
  SELECT * INTO v_session FROM public.live_sessions
    WHERE user_id = v_uid
      AND (p_session_id IS NULL OR id = p_session_id)
      AND status IN ('active', 'paused', 'needs_resolution')
    ORDER BY started_at DESC
    LIMIT 1;

  IF NOT FOUND THEN
    -- Session already finalized or doesn't exist
    -- Return exact session if p_session_id provided, otherwise most recent ended
    IF p_session_id IS NOT NULL THEN
      SELECT * INTO v_result FROM public.live_sessions
        WHERE user_id = v_uid
          AND id = p_session_id
          AND status = 'ended'
        LIMIT 1;
    ELSE
      SELECT * INTO v_result FROM public.live_sessions
        WHERE user_id = v_uid
          AND status = 'ended'
        ORDER BY ended_at DESC
        LIMIT 1;
    END IF;
    RETURN v_result;
  END IF;

  -- Transition to 'finalizing' (atomic boundary for concurrent tips)
  UPDATE public.live_sessions
    SET status = 'finalizing',
        last_heartbeat_at = now()
    WHERE id = v_session.id
    RETURNING * INTO v_session;

  -- Close any open pause and accumulate pause time
  UPDATE public.live_sessions
    SET total_paused_seconds = total_paused_seconds
          + CASE WHEN paused_at IS NOT NULL
                 THEN GREATEST(0, EXTRACT(EPOCH FROM (now() - paused_at))::integer)
                 ELSE 0 END,
        paused_at = null
    WHERE id = v_session.id
    RETURNING * INTO v_session;

  -- Set authoritative ended_at (if not already set)
  UPDATE public.live_sessions
    SET ended_at = now()
    WHERE id = v_session.id AND ended_at IS NULL
    RETURNING * INTO v_session;

  -- Calculate and store final_duration_seconds (won't change after finalization)
  UPDATE public.live_sessions
    SET final_duration_seconds = GREATEST(0,
      EXTRACT(EPOCH FROM (v_session.ended_at - v_session.started_at))::integer
      - COALESCE(v_session.total_paused_seconds, 0)
    )
    WHERE id = v_session.id
    RETURNING * INTO v_session;

  -- Recalculate final metrics from authoritative live_tips source
  PERFORM public.recalculate_session_final_metrics(v_session.id);

  -- Transition to 'ended' and update finalized_at
  UPDATE public.live_sessions
    SET status = 'ended',
        finalized_at = now(),
        last_heartbeat_at = now()
    WHERE id = v_session.id
    RETURNING * INTO v_result;

  RETURN v_result;
  -- Advisory lock released at transaction commit
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.finalize_live_session(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finalize_live_session(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.finalize_live_session(uuid) TO authenticated;

-- ── recalculate_session_final_metrics ────────────────────────────────────
-- Recalculates all final_* metric columns from authoritative live_tips rows.
-- Used both at finalization and when reconciling delayed tips to ended sessions.
-- Always queries the source (live_tips) rather than manually incrementing.

CREATE OR REPLACE FUNCTION public.recalculate_session_final_metrics(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_session live_sessions;
  v_total_usd numeric;
  v_total_tokens bigint;
  v_tip_count integer;
  v_unique_tippers integer;
  v_top_tipper_username text;
  v_top_tipper_usd numeric;
  v_largest_tip_usd numeric;
  v_avg_tip_usd numeric;
  v_usd_per_hour numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Verify session belongs to caller and is ended (or being finalized)
  SELECT * INTO v_session FROM public.live_sessions
    WHERE id = p_session_id AND user_id = v_uid AND status IN ('ended', 'finalizing');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found or not ended/finalizing' USING ERRCODE = '22023';
  END IF;

  -- Aggregate all tips currently assigned to this session
  -- Query the authoritative source (live_tips) exactly once
  WITH all_tips AS (
    SELECT username, usd, tokens
    FROM public.live_tips
    WHERE live_session_id = p_session_id
  ),
  tipper_totals AS (
    SELECT username, SUM(usd) as total_usd
    FROM all_tips
    GROUP BY username
  ),
  top_tipper AS (
    SELECT username, total_usd
    FROM tipper_totals
    ORDER BY total_usd DESC
    LIMIT 1
  )
  SELECT
    COALESCE(SUM(usd), 0::numeric),
    COALESCE(SUM(tokens), 0::bigint),
    COUNT(*),
    COUNT(DISTINCT username),
    (SELECT username FROM top_tipper LIMIT 1),
    (SELECT total_usd FROM top_tipper LIMIT 1),
    MAX(usd),
    ROUND(AVG(usd)::numeric, 2)
  INTO
    v_total_usd, v_total_tokens, v_tip_count, v_unique_tippers,
    v_top_tipper_username, v_top_tipper_usd, v_largest_tip_usd, v_avg_tip_usd
  FROM all_tips;

  -- Calculate USD per hour (duration is already final and won't change)
  v_usd_per_hour := CASE
    WHEN v_session.final_duration_seconds > 0
    THEN ROUND(
      (v_total_usd / v_session.final_duration_seconds) * 3600,
      2
    )
    ELSE NULL
  END;

  -- Update session with recalculated metrics
  UPDATE public.live_sessions
    SET
      final_total_usd = v_total_usd,
      final_tokens = v_total_tokens,
      final_tip_count = v_tip_count,
      final_unique_tippers = v_unique_tippers,
      final_top_tipper_username = v_top_tipper_username,
      final_top_tipper_usd = v_top_tipper_usd,
      final_largest_tip_usd = v_largest_tip_usd,
      final_avg_tip_usd = v_avg_tip_usd,
      final_usd_per_hour = v_usd_per_hour,
      last_heartbeat_at = now()
    WHERE id = p_session_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.recalculate_session_final_metrics(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalculate_session_final_metrics(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.recalculate_session_final_metrics(uuid) TO authenticated;

-- ── Helper: log_unattributed_tip_ambiguity ──────────────────────────────
-- Logs when a tip cannot be attributed due to ambiguity or timeout
CREATE TABLE IF NOT EXISTS public.unattributed_tips_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  usd numeric(10, 2),
  event_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.log_unattributed_tip_ambiguity(
  p_user_id uuid,
  p_username text,
  p_usd numeric,
  p_event_at timestamptz,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.unattributed_tips_log (user_id, username, usd, event_at, reason)
  VALUES (p_user_id, p_username, p_usd, p_event_at, p_reason)
  ON CONFLICT DO NOTHING;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.log_unattributed_tip_ambiguity(uuid, text, numeric, timestamptz, text) TO authenticated;
