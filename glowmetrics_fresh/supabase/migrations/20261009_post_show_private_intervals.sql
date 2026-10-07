-- Post-show reconciliation + private intervals, on production's Live Engine.
--
--   * tips.live_session_id links each canonical tip to the live session it
--     belongs to (tips.session_id already means upload_sessions). Written by
--     persist_extension_tip in the same transaction as live_tips.
--   * live_private_intervals: any number of private periods inside one live
--     session. Starting private does not pause or end the session; ending
--     the session closes an open interval at the session's ended_at.
--   * Finalized session accounting, all from persisted data:
--       public  = canonical tips with this live_session_id
--       private = sum of closed private interval earnings
--       total   = public + private
--     with the public revenue also kept per platform.
--   * dashboard_seen_at: per-account acknowledgement of a finalized session
--     (NULL = new / just ended), stored in the database so it clears on
--     every device.

-- ── canonical tip -> live session link ──────────────────────────────────
ALTER TABLE public.tips
  ADD COLUMN IF NOT EXISTS live_session_id uuid REFERENCES public.live_sessions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tips_live_session_id
  ON public.tips (live_session_id) WHERE live_session_id IS NOT NULL;

-- ── finalized show summary columns ──────────────────────────────────────
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS final_public_usd numeric(10, 2),
  ADD COLUMN IF NOT EXISTS final_private_usd numeric(10, 2),
  ADD COLUMN IF NOT EXISTS final_private_seconds integer,
  ADD COLUMN IF NOT EXISTS final_platform_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS dashboard_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_live_sessions_user_finalized
  ON public.live_sessions (user_id, ended_at DESC) WHERE finalized_at IS NOT NULL;

-- ── private intervals ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_private_intervals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  live_session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  platform text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  rate_per_minute numeric(10, 2) NOT NULL CHECK (rate_per_minute >= 0),
  estimated_earnings_usd numeric(10, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_private_intervals_end_after_start CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS live_private_intervals_one_open_per_session
  ON public.live_private_intervals (live_session_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_live_private_intervals_session
  ON public.live_private_intervals (live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_private_intervals_user
  ON public.live_private_intervals (user_id);

-- Read own rows; every write goes through the functions below.
ALTER TABLE public.live_private_intervals ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'live_private_intervals'
      AND policyname = 'live_private_intervals_select_own'
  ) THEN
    CREATE POLICY live_private_intervals_select_own
      ON public.live_private_intervals FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Closes the open interval of a session at p_at (never before it started).
-- Called by _finalize_live_session_metrics, which runs as the creator for
-- Stop/resolve and as the owner for the sweeps and delayed-tip path, so it
-- checks ownership itself: a signed-in caller may only close their own.
CREATE OR REPLACE FUNCTION public._close_private_intervals(p_session_id uuid, p_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.live_sessions WHERE id = p_session_id AND user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  UPDATE public.live_private_intervals
     SET ended_at = GREATEST(started_at, p_at),
         estimated_earnings_usd = round(
           rate_per_minute * EXTRACT(EPOCH FROM (GREATEST(started_at, p_at) - started_at)) / 60.0, 2)
   WHERE live_session_id = p_session_id AND ended_at IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public._close_private_intervals(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._close_private_intervals(uuid, timestamptz) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.start_private_interval(p_rate_per_minute numeric, p_platform text DEFAULT NULL)
RETURNS public.live_private_intervals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_session public.live_sessions;
  v_row public.live_private_intervals;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_rate_per_minute IS NULL OR p_rate_per_minute < 0 THEN
    RAISE EXCEPTION 'rate_per_minute must be >= 0' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  SELECT * INTO v_session FROM public.live_sessions
    WHERE user_id = v_uid AND status IN ('live', 'inactive_warning')
    ORDER BY started_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_LIVE_SESSION: start private only while live' USING ERRCODE = '22023';
  END IF;

  -- Already private: return the open interval (repeated Start is a no-op).
  SELECT * INTO v_row FROM public.live_private_intervals
    WHERE live_session_id = v_session.id AND ended_at IS NULL;
  IF FOUND THEN
    RETURN v_row;
  END IF;

  INSERT INTO public.live_private_intervals (user_id, live_session_id, platform, rate_per_minute)
  VALUES (v_uid, v_session.id,
          lower(COALESCE(NULLIF(btrim(p_platform), ''), v_session.stream_platform)),
          p_rate_per_minute)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_private_interval()
RETURNS public.live_private_intervals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.live_private_intervals;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  SELECT * INTO v_row FROM public.live_private_intervals
    WHERE user_id = v_uid AND ended_at IS NULL
    ORDER BY started_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;  -- not private (repeated End is a no-op)
  END IF;

  PERFORM public._close_private_intervals(v_row.live_session_id, now());
  SELECT * INTO v_row FROM public.live_private_intervals WHERE id = v_row.id;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.start_private_interval(numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.end_private_interval() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_private_interval(numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_private_interval() TO authenticated;

-- ── acknowledgement (per account, all devices) ──────────────────────────
CREATE OR REPLACE FUNCTION public.acknowledge_live_session(p_session_id uuid)
RETURNS public.live_sessions
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_row public.live_sessions;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  UPDATE public.live_sessions
     SET dashboard_seen_at = COALESCE(dashboard_seen_at, now())
   WHERE id = p_session_id AND user_id = auth.uid() AND finalized_at IS NOT NULL
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.acknowledge_live_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_live_session(uuid) TO authenticated;

-- ── tip persistence: link the canonical tip to its session ──────────────
-- Identical to 20261008 except tips.live_session_id is written.
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

  SELECT id INTO v_session_id
  FROM public.live_sessions
  WHERE user_id = p_user_id
    AND status IN ('starting', 'live', 'inactive_warning', 'ending')
    AND (p_queued_ms IS NULL
         OR started_at <= now() - make_interval(secs => p_queued_ms / 1000.0) + interval '30 seconds')
  ORDER BY started_at DESC
  LIMIT 1;

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
        tip_note, tip_seq, client_event_id, source, live_session_id
      ) VALUES (
        p_user_id, p_event_at, lower(btrim(p_platform)), btrim(p_username), 'Live',
        p_tokens, p_usd, '', v_seq, p_client_event_id, 'extension', v_session_id
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

-- ── finalizer: closes private, computes from canonical tips + intervals ──
-- Legacy summary columns keep their previous live_tips-based meaning; the
-- final_* snapshot is the canonical, persisted show summary.
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
  v_pub_count      integer;
  v_pub_unique     integer;
  v_pub_usd        numeric;
  v_pub_tokens     integer;
  v_pub_largest    numeric;
  v_pub_avg        numeric;
  v_top_username   text;
  v_top_usd        numeric;
  v_private_usd    numeric;
  v_private_secs   integer;
  v_breakdown      jsonb;
  v_duration       integer;
BEGIN
  SELECT * INTO v_row FROM public.live_sessions WHERE id = p_session_id;
  IF NOT FOUND OR v_row.ended_at IS NULL THEN
    RETURN v_row;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_row.user_id::text, 0));

  -- A private interval still open when the show ended closes at the show's end.
  PERFORM public._close_private_intervals(p_session_id, v_row.ended_at);

  v_active_secs := GREATEST(0,
    EXTRACT(EPOCH FROM (v_row.ended_at - v_row.started_at)) - v_row.total_paused_seconds
  );
  v_duration := GREATEST(0,
    EXTRACT(EPOCH FROM (v_row.ended_at - v_row.started_at))::integer - v_row.total_paused_seconds
  );

  -- Legacy live summary columns (unchanged meaning).
  SELECT
    COUNT(*), COUNT(DISTINCT lower(username)),
    COALESCE(SUM(usd), 0), COALESCE(SUM(tokens), 0),
    COALESCE(MAX(usd), 0), COALESCE(AVG(usd), 0)
    INTO v_tip_count, v_unique_tippers, v_earnings, v_tokens, v_largest_tip, v_avg_tip
    FROM public.live_tips
    WHERE live_session_id = p_session_id;

  -- Canonical public earnings: tips rows belonging to this session.
  SELECT
    COUNT(*), COUNT(DISTINCT lower(username)),
    COALESCE(SUM(usd), 0), COALESCE(SUM(tokens), 0),
    COALESCE(MAX(usd), 0), COALESCE(AVG(usd), 0)
    INTO v_pub_count, v_pub_unique, v_pub_usd, v_pub_tokens, v_pub_largest, v_pub_avg
    FROM public.tips
    WHERE live_session_id = p_session_id;

  SELECT min(username), SUM(usd)
    INTO v_top_username, v_top_usd
    FROM public.tips
    WHERE live_session_id = p_session_id
    GROUP BY lower(username)
    ORDER BY SUM(usd) DESC, lower(username)
    LIMIT 1;

  SELECT COALESCE(jsonb_object_agg(platform, jsonb_build_object('usd', usd, 'tips', n)), '{}'::jsonb)
    INTO v_breakdown
    FROM (
      SELECT COALESCE(platform, 'unknown') AS platform, round(SUM(usd), 2) AS usd, COUNT(*) AS n
      FROM public.tips WHERE live_session_id = p_session_id
      GROUP BY 1
    ) b;

  SELECT COALESCE(SUM(estimated_earnings_usd), 0),
         COALESCE(SUM(EXTRACT(EPOCH FROM (ended_at - started_at))::integer), 0)
    INTO v_private_usd, v_private_secs
    FROM public.live_private_intervals
    WHERE live_session_id = p_session_id AND ended_at IS NOT NULL;

  UPDATE public.live_sessions
    SET session_earnings_usd     = v_earnings,
        session_tokens           = v_tokens,
        tip_count                = v_tip_count,
        unique_tipper_count      = v_unique_tippers,
        largest_tip_usd          = v_largest_tip,
        average_tip_usd          = v_avg_tip,
        earnings_per_active_hour = CASE WHEN v_active_secs > 0 THEN round((v_earnings / (v_active_secs / 3600.0))::numeric, 2) ELSE 0 END,
        tips_per_active_hour     = CASE WHEN v_active_secs > 0 THEN round((v_tip_count / (v_active_secs / 3600.0))::numeric, 2) ELSE 0 END,
        final_public_usd          = round(v_pub_usd, 2),
        final_private_usd         = round(v_private_usd, 2),
        final_private_seconds     = v_private_secs,
        final_platform_breakdown  = v_breakdown,
        final_total_usd           = round(v_pub_usd + v_private_usd, 2),
        final_tokens              = v_pub_tokens,
        final_tip_count           = v_pub_count,
        final_unique_tippers      = v_pub_unique,
        final_top_tipper_username = v_top_username,
        final_top_tipper_usd      = v_top_usd,
        final_largest_tip_usd     = v_pub_largest,
        final_avg_tip_usd         = round(v_pub_avg::numeric, 2),
        final_duration_seconds    = v_duration,
        final_usd_per_hour        = CASE WHEN v_duration > 0 THEN round(((v_pub_usd + v_private_usd) / v_duration) * 3600, 2) ELSE NULL END,
        finalized_at              = COALESCE(finalized_at, ended_at)
    WHERE id = p_session_id
    RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;
