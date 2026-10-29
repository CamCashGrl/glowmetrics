-- Rollback for 20261029b_private_interval_strict.sql — NON-DESTRUCTIVE BY DESIGN.
--
-- Keeps live_private_intervals.username and the strict three-argument function
-- (dropping them would destroy collected data and is a manual decision).
-- Restores ONLY the production end_private_interval body and the legacy
-- two-argument start_private_interval.
--
-- WARNING: the restored legacy start_private_interval lowercases the platform,
-- takes no username and falls back to the live session's platform. It is an
-- UNSAFE path for financial data. Prefer rolling forward. If you must run
-- this, also stop shipping the app version that calls the strict signature.

BEGIN;
SET LOCAL lock_timeout = '10s';

CREATE OR REPLACE FUNCTION public.end_private_interval()
 RETURNS public.live_private_intervals
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    RETURN NULL;
  END IF;

  PERFORM public._close_private_intervals(v_row.live_session_id, now());
  SELECT * INTO v_row FROM public.live_private_intervals WHERE id = v_row.id;
  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_private_interval(
  p_rate_per_minute numeric, p_platform text DEFAULT NULL::text)
 RETURNS public.live_private_intervals
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION public.start_private_interval(numeric, text) TO authenticated, service_role;

COMMIT;
