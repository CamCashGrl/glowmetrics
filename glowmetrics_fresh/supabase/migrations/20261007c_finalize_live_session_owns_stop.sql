-- Phase 2: finalize_live_session becomes the single Stop path.
--
-- /api/live/session/stop now calls finalize_live_session instead of the legacy
-- stop_live_session. This body is the version verified 17/17 on staging (one
-- authoritative v_ended_at, finalized_at = v_ended_at, idempotent ended-row
-- return), plus the lifecycle bookkeeping stop_live_session performed so no
-- behavior is lost by the switch:
--   * is_active = false
--   * status_before_resolution = null
--   * session_resolution_type = 'normal_stop'
--   * last_heartbeat_at = now()
--   * the open live_session_pauses row (if paused at Stop) is closed at v_ended_at
-- Legacy summary columns (session_earnings_usd, tip_count, ...) are not
-- written; nothing reads them, and final_* is the canonical snapshot.

CREATE OR REPLACE FUNCTION public.finalize_live_session(p_session_id uuid DEFAULT NULL)
RETURNS public.live_sessions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_session public.live_sessions;
  v_ended_at timestamptz;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'must be authenticated' USING ERRCODE = '42501';
  END IF;

  -- Same user-level lock as persist_extension_tip.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text, 0)::bigint);

  SELECT * INTO v_session
  FROM public.live_sessions
  WHERE user_id = v_uid
    AND (p_session_id IS NULL OR id = p_session_id)
    AND status IN ('active', 'paused', 'needs_resolution')
  ORDER BY started_at DESC
  LIMIT 1;

  -- Already ended: return it unchanged (repeated Stop is idempotent).
  IF v_session IS NULL THEN
    SELECT * INTO v_session
    FROM public.live_sessions
    WHERE user_id = v_uid
      AND (p_session_id IS NULL OR id = p_session_id)
      AND status = 'ended'
    ORDER BY started_at DESC
    LIMIT 1;
    RETURN v_session;
  END IF;

  v_ended_at := COALESCE(v_session.ended_at, now());

  UPDATE public.live_sessions
  SET status = 'finalizing'
  WHERE id = v_session.id;

  UPDATE public.live_sessions
  SET
    total_paused_seconds = total_paused_seconds +
      CASE
        WHEN paused_at IS NOT NULL
        THEN GREATEST(0, EXTRACT(EPOCH FROM (v_ended_at - paused_at))::integer)
        ELSE 0
      END,
    paused_at = NULL,
    ended_at = v_ended_at,
    final_duration_seconds =
      GREATEST(0,
        EXTRACT(EPOCH FROM (v_ended_at - started_at))::integer -
        (total_paused_seconds +
          CASE
            WHEN paused_at IS NOT NULL
            THEN GREATEST(0, EXTRACT(EPOCH FROM (v_ended_at - paused_at))::integer)
            ELSE 0
          END
        )
      ),
    is_active = false,
    status_before_resolution = NULL,
    session_resolution_type = 'normal_stop',
    last_heartbeat_at = now()
  WHERE id = v_session.id;

  -- v_session is the pre-update snapshot, so paused_at reflects the open pause.
  IF v_session.paused_at IS NOT NULL THEN
    UPDATE public.live_session_pauses
    SET resumed_at = v_ended_at,
        pause_duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (v_ended_at - paused_at))::integer)
    WHERE session_id = v_session.id
      AND resumed_at IS NULL;
  END IF;

  PERFORM public.recalculate_session_final_metrics(v_session.id);

  UPDATE public.live_sessions
  SET
    status = 'ended',
    finalized_at = v_ended_at
  WHERE id = v_session.id
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_live_session(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finalize_live_session(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.finalize_live_session(uuid) TO authenticated;
