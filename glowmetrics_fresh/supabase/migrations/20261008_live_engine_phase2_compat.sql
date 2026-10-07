-- Phase 2 compatibility patch on top of production's Live Engine
-- (statuses starting/live/inactive_warning/ending/ended + live_substate).
-- The status machine is unchanged. Changes:
--   1. persist_extension_tip attaches to the running session in any of
--      starting/live/inactive_warning/ending (it searched 'active' and
--      'needs_resolution', which production's status rule does not allow,
--      so no extension tip could ever attach to a session).
--   2. persist_extension_tip takes the per-user advisory lock instead of the
--      per-(user, event) lock, so it serializes against finalization.
--   3. stop_live_session and _finalize_live_session_metrics take that same
--      lock. Every path that ends a session (Stop, resolve, both sweeps)
--      finalizes through _finalize_live_session_metrics.
--   4. Stop while paused closes the open live_session_pauses row (it checked
--      paused_at on the already-updated row, which is always null).
--   5. final_* snapshot + finalized_at, written by _finalize_live_session_metrics.
--   6. Delayed-tip reconciliation: a tip with no running session attaches to
--      the single session that ended within the last 30 minutes and whose
--      [started_at, ended_at] contains the tip's event time, then that
--      session is re-finalized. More than one match: the tip stays
--      unattributed and is recorded in unattributed_tips_log.
--   7. The one-running-session-per-user index covers starting/live/
--      inactive_warning/ending (it listed the previous vocabulary).

-- ── 5. final_* columns ───────────────────────────────────────────────────
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS final_total_usd numeric(10, 2),
  ADD COLUMN IF NOT EXISTS final_tokens integer,
  ADD COLUMN IF NOT EXISTS final_tip_count integer,
  ADD COLUMN IF NOT EXISTS final_unique_tippers integer,
  ADD COLUMN IF NOT EXISTS final_top_tipper_username text,
  ADD COLUMN IF NOT EXISTS final_top_tipper_usd numeric(10, 2),
  ADD COLUMN IF NOT EXISTS final_largest_tip_usd numeric(10, 2),
  ADD COLUMN IF NOT EXISTS final_avg_tip_usd numeric(10, 2),
  ADD COLUMN IF NOT EXISTS final_duration_seconds integer,
  ADD COLUMN IF NOT EXISTS final_usd_per_hour numeric(10, 2),
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz;

-- ── 6. ambiguity log ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.unattributed_tips_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text NOT NULL,
  usd numeric NOT NULL,
  event_at timestamptz NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.unattributed_tips_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'unattributed_tips_log'
      AND policyname = 'Users can see their own ambiguity logs'
  ) THEN
    CREATE POLICY "Users can see their own ambiguity logs"
      ON public.unattributed_tips_log FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_unattributed_tips_log_user_id
  ON public.unattributed_tips_log(user_id);

CREATE OR REPLACE FUNCTION public.log_unattributed_tip_ambiguity(
  p_user_id uuid,
  p_username text,
  p_usd numeric,
  p_event_at timestamptz,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required' USING ERRCODE = '22004';
  END IF;
  IF p_username IS NULL OR btrim(p_username) = '' THEN
    RAISE EXCEPTION 'username is required' USING ERRCODE = '22004';
  END IF;
  IF p_usd IS NULL OR p_usd < 0 THEN
    RAISE EXCEPTION 'usd must be >= 0' USING ERRCODE = '22003';
  END IF;
  IF p_event_at IS NULL THEN
    RAISE EXCEPTION 'event_at is required' USING ERRCODE = '22004';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason is required' USING ERRCODE = '22004';
  END IF;

  INSERT INTO public.unattributed_tips_log (user_id, username, usd, event_at, reason)
  VALUES (p_user_id, btrim(p_username), p_usd, p_event_at, btrim(p_reason))
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_unattributed_tip_ambiguity(uuid, text, numeric, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_unattributed_tip_ambiguity(uuid, text, numeric, timestamptz, text) TO service_role;

-- ── 3 + 5. finalizer: same per-user lock, writes final_* ────────────────
-- SECURITY INVOKER as before: called as the creator (Stop/resolve/own
-- sweep), live_sessions RLS limits it to the caller's own rows; called from
-- persist_extension_tip and sweep_all_stale_live_sessions it runs as their
-- owner. Legacy summary columns are still written exactly as before.
CREATE OR REPLACE FUNCTION public._finalize_live_session_metrics(p_session_id uuid)
 RETURNS live_sessions
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
  v_top_username   text;
  v_top_usd        numeric;
  v_duration       integer;
BEGIN
  SELECT * INTO v_row FROM public.live_sessions WHERE id = p_session_id;
  IF NOT FOUND OR v_row.ended_at IS NULL THEN
    RETURN v_row;
  END IF;

  -- Same lock as persist_extension_tip: a tip being saved for this creator
  -- either commits before this aggregate runs or waits until it is done.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_row.user_id::text, 0));

  v_active_secs := GREATEST(0,
    EXTRACT(EPOCH FROM (v_row.ended_at - v_row.started_at)) - v_row.total_paused_seconds
  );
  v_duration := GREATEST(0,
    EXTRACT(EPOCH FROM (v_row.ended_at - v_row.started_at))::integer - v_row.total_paused_seconds
  );

  SELECT
    COUNT(*), COUNT(DISTINCT lower(username)),
    COALESCE(SUM(usd), 0), COALESCE(SUM(tokens), 0),
    COALESCE(MAX(usd), 0), COALESCE(AVG(usd), 0)
    INTO v_tip_count, v_unique_tippers, v_earnings, v_tokens, v_largest_tip, v_avg_tip
    FROM public.live_tips
    WHERE live_session_id = p_session_id;

  SELECT min(username), SUM(usd)
    INTO v_top_username, v_top_usd
    FROM public.live_tips
    WHERE live_session_id = p_session_id
    GROUP BY lower(username)
    ORDER BY SUM(usd) DESC, lower(username)
    LIMIT 1;

  UPDATE public.live_sessions
    SET session_earnings_usd     = v_earnings,
        session_tokens           = v_tokens,
        tip_count                = v_tip_count,
        unique_tipper_count      = v_unique_tippers,
        largest_tip_usd          = v_largest_tip,
        average_tip_usd          = v_avg_tip,
        earnings_per_active_hour = CASE WHEN v_active_secs > 0 THEN round((v_earnings / (v_active_secs / 3600.0))::numeric, 2) ELSE 0 END,
        tips_per_active_hour     = CASE WHEN v_active_secs > 0 THEN round((v_tip_count / (v_active_secs / 3600.0))::numeric, 2) ELSE 0 END,
        final_total_usd           = v_earnings,
        final_tokens              = v_tokens,
        final_tip_count           = v_tip_count,
        final_unique_tippers      = v_unique_tippers,
        final_top_tipper_username = v_top_username,
        final_top_tipper_usd      = v_top_usd,
        final_largest_tip_usd     = v_largest_tip,
        final_avg_tip_usd         = round(v_avg_tip::numeric, 2),
        final_duration_seconds    = v_duration,
        final_usd_per_hour        = CASE WHEN v_duration > 0 THEN round((v_earnings / v_duration) * 3600, 2) ELSE NULL END,
        finalized_at              = COALESCE(finalized_at, ended_at)
    WHERE id = p_session_id
    RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

-- ── 3 + 4. Stop: per-user lock first; close the open pause row ──────────
CREATE OR REPLACE FUNCTION public.stop_live_session()
 RETURNS live_sessions
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_before public.live_sessions;
  v_result public.live_sessions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  SELECT * INTO v_before FROM public.live_sessions
    WHERE user_id = v_uid
      AND status IN ('starting','live','inactive_warning','ending')
    ORDER BY started_at DESC
    LIMIT 1
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;  -- nothing to stop; the API returns the last ended session
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
    WHERE id = v_before.id
    RETURNING * INTO v_result;

  -- v_before still has the open pause; v_result.paused_at is already null.
  IF v_before.paused_at IS NOT NULL THEN
    UPDATE public.live_session_pauses
      SET resumed_at = v_result.ended_at,
          pause_duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (v_result.ended_at - paused_at))::integer)
      WHERE session_id = v_result.id AND resumed_at IS NULL;
  END IF;

  RETURN public._finalize_live_session_metrics(v_result.id);
END;
$function$;

-- ── 1, 2, 6. tip persistence ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.persist_extension_tip(p_user_id uuid, p_client_event_id uuid, p_deduplication_key text, p_username text, p_tokens integer, p_usd numeric, p_platform text, p_event_at timestamp with time zone, p_queued_ms bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_live_id uuid;
  v_existing_session_id uuid;
  v_session_id uuid;
  v_session_ended boolean := false;
  v_matching_sessions integer;
  v_live_tip_id uuid;
  v_tip_id bigint;
  v_seq integer := 1;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required' USING ERRCODE = '22004';
  END IF;
  IF p_client_event_id IS NULL THEN
    RAISE EXCEPTION 'client_event_id is required' USING ERRCODE = '22004';
  END IF;
  IF p_username IS NULL OR btrim(p_username) = '' THEN
    RAISE EXCEPTION 'username is required' USING ERRCODE = '22004';
  END IF;
  IF p_tokens IS NULL OR p_tokens < 1 THEN
    RAISE EXCEPTION 'tokens must be > 0' USING ERRCODE = '22003';
  END IF;
  IF p_usd IS NULL OR p_usd < 0 THEN
    RAISE EXCEPTION 'usd must be >= 0' USING ERRCODE = '22003';
  END IF;
  IF p_event_at IS NULL THEN
    RAISE EXCEPTION 'event time is required' USING ERRCODE = '22004';
  END IF;
  IF p_queued_ms IS NOT NULL AND p_queued_ms < 0 THEN
    RAISE EXCEPTION 'queued_ms must be >= 0' USING ERRCODE = '22003';
  END IF;

  -- Per-user lock (also taken by stop_live_session and
  -- _finalize_live_session_metrics). It still serializes retries of the
  -- same event, which is what the previous per-event lock was for.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT id, live_session_id INTO v_existing_live_id, v_existing_session_id
  FROM public.live_tips
  WHERE user_id = p_user_id
    AND (client_event_id = p_client_event_id
         OR (p_deduplication_key IS NOT NULL AND deduplication_key = p_deduplication_key))
  LIMIT 1;

  IF v_existing_live_id IS NOT NULL THEN
    SELECT id INTO v_tip_id FROM public.tips
    WHERE user_id = p_user_id AND client_event_id = p_client_event_id
    LIMIT 1;
    RETURN jsonb_build_object(
      'success', true,
      'duplicate', true,
      'live_tip_id', v_existing_live_id,
      'tip_id', v_tip_id,
      'live_session_id', v_existing_session_id,
      'client_event_id', p_client_event_id
    );
  END IF;

  -- Running session, in production's vocabulary. Paused (live + paused
  -- substate) counts: the tip belongs to the session it happened in.
  SELECT id INTO v_session_id
  FROM public.live_sessions
  WHERE user_id = p_user_id
    AND status IN ('starting', 'live', 'inactive_warning', 'ending')
    AND (p_queued_ms IS NULL
         OR started_at <= now() - make_interval(secs => p_queued_ms / 1000.0) + interval '30 seconds')
  ORDER BY started_at DESC
  LIMIT 1;

  -- Delayed tip: no running session; look for exactly one session that
  -- ended in the last 30 minutes and covers the tip's event time.
  IF v_session_id IS NULL THEN
    SELECT COUNT(*) INTO v_matching_sessions
    FROM public.live_sessions
    WHERE user_id = p_user_id
      AND status = 'ended'
      AND started_at <= p_event_at
      AND p_event_at <= ended_at
      AND ended_at > now() - INTERVAL '30 minutes';

    IF v_matching_sessions = 1 THEN
      SELECT id INTO v_session_id
      FROM public.live_sessions
      WHERE user_id = p_user_id
        AND status = 'ended'
        AND started_at <= p_event_at
        AND p_event_at <= ended_at
        AND ended_at > now() - INTERVAL '30 minutes';
      v_session_ended := true;
    ELSIF v_matching_sessions > 1 THEN
      PERFORM public.log_unattributed_tip_ambiguity(
        p_user_id, p_username, p_usd, p_event_at, 'multiple_session_matches'
      );
    END IF;
  END IF;

  LOOP
    BEGIN
      INSERT INTO public.tips (
        user_id, date_time, platform, username, tip_type, tokens, usd,
        tip_note, tip_seq, client_event_id, source
      ) VALUES (
        p_user_id, p_event_at, lower(btrim(p_platform)), btrim(p_username), 'Live',
        p_tokens, p_usd, '', v_seq, p_client_event_id, 'extension'
      )
      RETURNING id INTO v_tip_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_seq := v_seq + 1;
      IF v_seq > 100 THEN
        RAISE;
      END IF;
    END;
  END LOOP;

  INSERT INTO public.live_tips (
    user_id, live_session_id, username, tokens, usd, platform, source,
    received_at, deduplication_key, client_event_id
  ) VALUES (
    p_user_id, v_session_id, btrim(p_username), p_tokens, p_usd,
    lower(btrim(p_platform)), 'extension', p_event_at, p_deduplication_key,
    p_client_event_id
  )
  RETURNING id INTO v_live_tip_id;

  IF v_session_ended THEN
    PERFORM public._finalize_live_session_metrics(v_session_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'duplicate', false,
    'live_tip_id', v_live_tip_id,
    'tip_id', v_tip_id,
    'live_session_id', v_session_id,
    'client_event_id', p_client_event_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.persist_extension_tip(uuid, uuid, text, text, integer, numeric, text, timestamptz, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persist_extension_tip(uuid, uuid, text, text, integer, numeric, text, timestamptz, bigint) TO service_role;

-- ── 7. one running session per user, in production's vocabulary ──────────
-- live_sessions_one_unresolved_per_user still listed the previous statuses
-- (starting/active/paused/stopping/needs_resolution), so only 'starting' was
-- actually covered and a creator could hold two live sessions. The new index
-- is built before the old one is dropped so uniqueness is never unenforced.
-- start_live_session's unique_violation fallback works with either name.
CREATE UNIQUE INDEX IF NOT EXISTS live_sessions_one_running_per_user
  ON public.live_sessions (user_id)
  WHERE status IN ('starting', 'live', 'inactive_warning', 'ending');
DROP INDEX IF EXISTS public.live_sessions_one_unresolved_per_user;
