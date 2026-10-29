-- Strict Private Mode: username + canonical platform, no guessing, no bypass.
--
-- WRITTEN, NOT APPLIED. Requires 20261029_live_mode_free_allowance.sql first.
--
--   * live_private_intervals.username (additive, nullable for legacy rows —
--     the table has 0 rows in production on 2026-10-28)
--   * NEW start_private_interval(rate, platform, username): platform must be
--     Chaturbate / BongaCams / MyFreeCams (case-insensitive input, canonical
--     output stored). Unknown or missing platform FAILS. No fallback to the
--     session's platform, to Chaturbate, and no lowercasing.
--   * The cap is enforced BEFORE a private interval can open.
--   * The legacy two-argument start_private_interval (no username, lowercases
--     the platform, falls back to the session platform) is REPLACED by a stub
--     that always raises, and EXECUTE is revoked from browser roles. Its only
--     caller (app/api/live/session/private/start/route.js) moves to the new
--     signature in the same release: deploy the app and apply this migration
--     together, otherwise Private start fails with a clear error in between.
--   * end_private_interval: production body + cap check first.
--   * Timing and earnings stay single-sourced: start/end timestamps are
--     written by the database, earnings are finalized only by
--     _close_private_intervals. Nothing here writes earnings.

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF to_regprocedure('public._enforce_free_live_cap(uuid)') IS NULL
     OR to_regprocedure('public.strict_canonical_platform(text)') IS NULL THEN
    RAISE EXCEPTION 'Apply 20261029_live_mode_free_allowance.sql first. Aborting.';
  END IF;
END $$;

ALTER TABLE public.live_private_intervals
  ADD COLUMN IF NOT EXISTS username text;

CREATE OR REPLACE FUNCTION public.start_private_interval(
  p_rate_per_minute numeric, p_platform text, p_username text)
 RETURNS public.live_private_intervals
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_session  public.live_sessions;
  v_row      public.live_private_intervals;
  v_platform text;
  v_username text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_rate_per_minute IS NULL OR p_rate_per_minute < 0 OR p_rate_per_minute > 1000 THEN
    RAISE EXCEPTION 'rate_per_minute must be between 0 and 1000' USING ERRCODE = '22023';
  END IF;

  v_platform := public.strict_canonical_platform(p_platform);
  IF v_platform IS NULL THEN
    RAISE EXCEPTION 'PLATFORM_REQUIRED: Private Mode needs Chaturbate, BongaCams or MyFreeCams. No platform is ever guessed.'
      USING ERRCODE = 'P0001';
  END IF;

  v_username := regexp_replace(btrim(coalesce(p_username, '')), '^@+', '');
  IF v_username = '' OR length(v_username) > 80 THEN
    RAISE EXCEPTION 'USERNAME_REQUIRED: the fan username is required (80 characters or fewer).'
      USING ERRCODE = 'P0001';
  END IF;

  -- A session already past its cap must not be able to open a private interval.
  PERFORM public._enforce_free_live_cap(v_uid);

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

  INSERT INTO public.live_private_intervals (user_id, live_session_id, platform, username, rate_per_minute)
  VALUES (v_uid, v_session.id, v_platform, v_username, p_rate_per_minute)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.start_private_interval(numeric, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.start_private_interval(numeric, text, text) TO authenticated, service_role;

-- Legacy two-argument form: cannot create any row, ever.
CREATE OR REPLACE FUNCTION public.start_private_interval(
  p_rate_per_minute numeric, p_platform text DEFAULT NULL::text)
 RETURNS public.live_private_intervals
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RAISE EXCEPTION 'PRIVATE_START_SIGNATURE_RETIRED: use start_private_interval(rate, platform, username).'
    USING ERRCODE = 'P0001';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.start_private_interval(numeric, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.start_private_interval(numeric, text) TO service_role;

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

  -- A session past its 35 active minutes is ended (and its private interval
  -- closed) at the exact cap instant before anything else happens.
  PERFORM public._enforce_free_live_cap(v_uid);

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

DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.start_private_interval(numeric, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'legacy start_private_interval must not be callable by authenticated';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.start_private_interval(numeric, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'strict start_private_interval must be callable by authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'end_private_interval' AND prosrc LIKE '%_enforce_free_live_cap%') THEN
    RAISE EXCEPTION 'end_private_interval does not enforce the Free cap';
  END IF;
END $$;

COMMIT;
