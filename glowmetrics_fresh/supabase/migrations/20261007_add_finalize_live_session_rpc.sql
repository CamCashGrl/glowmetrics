-- Phase 2: Atomic finalization with user-level advisory lock
--
-- finalize_live_session() - atomic Stop/Finalize combining status transition,
-- metric aggregation, and persistence in one RPC call
--
-- Must use same user-level advisory lock as persist_extension_tip to prevent
-- races between persistence and finalization. The lock ensures that:
--   1. Session selection, tip reconciliation, and metric aggregation are atomic
--   2. Delayed tips arriving after finalization but within 30-min window can safely
--      recalculate final_* metrics inside the same lock boundary
--
-- S10 Canonical Contract: Zero-tip sessions should have final_largest_tip_usd=0
-- and final_avg_tip_usd=0 (not NULL), consistent with final_total_usd=0.
-- This makes persisted snapshots simpler and safer for UI/reporting.

CREATE OR REPLACE FUNCTION public.finalize_live_session(p_session_id uuid DEFAULT NULL)
RETURNS public.live_sessions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_session live_sessions;
  v_result live_sessions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Acquire user-level advisory lock matching persist_extension_tip.
  -- This serializes finalization against any concurrent persistence or reconciliation
  -- attempts for the same user, ensuring session state and metrics remain consistent.
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
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_live_session(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finalize_live_session(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.finalize_live_session(uuid) TO authenticated;

-- ── recalculate_session_final_metrics ────────────────────────────────────
-- Recalculates all final_* metric columns from authoritative live_tips rows.
-- Used both at finalization and when reconciling delayed tips to ended sessions.
-- Always queries the source (live_tips) rather than manually incrementing.
--
-- S10: Zero-tip sessions return 0 for largest and average (not NULL).

CREATE OR REPLACE FUNCTION public.recalculate_session_final_metrics(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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
    COALESCE(MAX(usd), 0::numeric),
    COALESCE(ROUND(AVG(usd)::numeric, 2), 0::numeric)
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
$$;

REVOKE EXECUTE ON FUNCTION public.recalculate_session_final_metrics(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalculate_session_final_metrics(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.recalculate_session_final_metrics(uuid) TO authenticated;
