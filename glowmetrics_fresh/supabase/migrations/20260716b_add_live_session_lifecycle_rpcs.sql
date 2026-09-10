-- Phase 1B (batch 2): the official Live Mode lifecycle RPCs.
--
-- Depends on batch 1 (20260716_add_live_session_pause_and_heartbeat_fields.sql)
-- already being applied. All seven functions are SECURITY INVOKER, not
-- DEFINER — the `authenticated` role already has direct grants on
-- public.live_sessions, and the table's existing RLS policy is real,
-- enforced protection under INVOKER. None of these functions ever need to
-- see or touch any row but the calling user's own, so DEFINER would only
-- remove that protection for no benefit.
--
-- Every function: derives the caller strictly from auth.uid() (never a
-- user_id parameter), rejects NULL auth.uid() explicitly, fixes
-- search_path, schema-qualifies every reference, and has EXECUTE revoked
-- from PUBLIC/anon and granted only to authenticated.
--
-- Does not touch live_tips, does not touch stream_sessions, does not
-- activate any cron sweep, does not touch application code.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'live_sessions'
      AND column_name = 'broadcaster_page_missing_since'
  ) THEN
    RAISE EXCEPTION 'Phase 1B batch 2 requires batch 1 (pause/heartbeat fields) to be applied first. Aborting.';
  END IF;
END $$;

-- ── start_live_session ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.start_live_session(p_platform text DEFAULT NULL)
RETURNS public.live_sessions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_platform text;
  v_result   public.live_sessions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  v_platform := COALESCE(NULLIF(trim(p_platform), ''), 'Chaturbate');
  IF v_platform NOT IN ('Chaturbate','BongaCams','MyFreeCams','Stripchat','CamSoda') THEN
    RAISE EXCEPTION 'Unrecognized platform: %', v_platform USING ERRCODE = '22023';
  END IF;

  BEGIN
    INSERT INTO public.live_sessions (
      user_id, status, is_active, started_at, ended_at,
      last_heartbeat_at, website_last_heartbeat_at, stream_platform
    ) VALUES (
      v_uid, 'active', true, now(), null,
      now(), now(), v_platform
    )
    RETURNING * INTO v_result;
    RETURN v_result;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_result
      FROM public.live_sessions
      WHERE user_id = v_uid
        AND status IN ('starting','active','paused','stopping','needs_resolution')
      ORDER BY started_at DESC
      LIMIT 1;
    RETURN v_result;
  END;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.start_live_session(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.start_live_session(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.start_live_session(text) TO authenticated;

-- ── pause_live_session ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pause_live_session()
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

  UPDATE public.live_sessions
    SET status = 'paused',
        paused_at = now(),
        last_heartbeat_at = now()
    WHERE user_id = v_uid AND status = 'active'
    RETURNING * INTO v_result;

  RETURN v_result; -- NULL if not currently active (repeated Pause = safe no-op)
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.pause_live_session() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pause_live_session() FROM anon;
GRANT  EXECUTE ON FUNCTION public.pause_live_session() TO authenticated;

-- ── resume_live_session ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resume_live_session()
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

  UPDATE public.live_sessions
    SET status = 'active',
        total_paused_seconds = total_paused_seconds
          + GREATEST(0, EXTRACT(EPOCH FROM (now() - paused_at))::integer),
        paused_at = null,
        last_heartbeat_at = now()
    WHERE user_id = v_uid AND status = 'paused'
    RETURNING * INTO v_result;

  RETURN v_result; -- NULL if not currently paused (repeated Resume = safe no-op)
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.resume_live_session() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resume_live_session() FROM anon;
GRANT  EXECUTE ON FUNCTION public.resume_live_session() TO authenticated;

-- ── stop_live_session ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.stop_live_session()
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

  UPDATE public.live_sessions
    SET status = 'ended',
        is_active = false,
        ended_at = now(),
        last_heartbeat_at = now(),
        total_paused_seconds = total_paused_seconds
          + CASE WHEN paused_at IS NOT NULL
                 THEN GREATEST(0, EXTRACT(EPOCH FROM (now() - paused_at))::integer)
                 ELSE 0 END,
        paused_at = null,
        status_before_resolution = null
    WHERE user_id = v_uid
      AND status IN ('active','paused','needs_resolution')
    RETURNING * INTO v_result;

  RETURN v_result; -- NULL if nothing unresolved existed (repeated Stop = safe no-op)
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.stop_live_session() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.stop_live_session() FROM anon;
GRANT  EXECUTE ON FUNCTION public.stop_live_session() TO authenticated;

-- ── send_website_heartbeat ──────────────────────────────────────────────────
-- Proves only that the CamCash Live Mode page is connected. Never touches
-- any extension field. Never revives needs_resolution.
CREATE OR REPLACE FUNCTION public.send_website_heartbeat()
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

  UPDATE public.live_sessions
    SET website_last_heartbeat_at = now(),
        last_heartbeat_at = now()
    WHERE user_id = v_uid AND status IN ('active','paused')
    RETURNING * INTO v_result;

  RETURN v_result; -- NULL if no unresolved session exists
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.send_website_heartbeat() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_website_heartbeat() FROM anon;
GRANT  EXECUTE ON FUNCTION public.send_website_heartbeat() TO authenticated;

-- ── send_extension_heartbeat ────────────────────────────────────────────────
-- Proves the extension is active on a supported broadcaster page. Never
-- revives needs_resolution. broadcaster_page_missing_since is set only on
-- the FIRST false detection and preserved on every subsequent false
-- detection, so the grace period measured off it never silently restarts.
CREATE OR REPLACE FUNCTION public.send_extension_heartbeat(
  p_platform text,
  p_broadcaster_page_detected boolean
)
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

  UPDATE public.live_sessions
    SET extension_last_heartbeat_at = now(),
        extension_platform = p_platform,
        broadcaster_page_detected = p_broadcaster_page_detected,
        broadcaster_page_missing_since = CASE
          WHEN p_broadcaster_page_detected THEN null
          WHEN broadcaster_page_missing_since IS NULL THEN now()
          ELSE broadcaster_page_missing_since
        END,
        last_heartbeat_at = now()
    WHERE user_id = v_uid AND status IN ('active','paused')
    RETURNING * INTO v_result;

  RETURN v_result; -- NULL if no unresolved session exists
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.send_extension_heartbeat(text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_extension_heartbeat(text, boolean) FROM anon;
GRANT  EXECUTE ON FUNCTION public.send_extension_heartbeat(text, boolean) TO authenticated;

-- ── resolve_live_session ────────────────────────────────────────────────────
-- Explicit, user-initiated recovery from needs_resolution. Never invoked
-- automatically by any heartbeat or sweep.
CREATE OR REPLACE FUNCTION public.resolve_live_session(
  p_choice text,
  p_end_time timestamptz DEFAULT NULL
)
RETURNS public.live_sessions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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
  IF p_choice NOT IN ('still_live', 'ended') THEN
    RAISE EXCEPTION 'Invalid choice: %', p_choice USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_current FROM public.live_sessions
    WHERE user_id = v_uid AND status = 'needs_resolution';
  IF NOT FOUND THEN
    RETURN NULL; -- nothing to resolve
  END IF;

  v_uncertainty_start := COALESCE(v_current.broadcaster_page_missing_since, v_current.extension_last_heartbeat_at);

  IF p_choice = 'still_live' THEN
    IF v_current.status_before_resolution = 'active' THEN
      -- No open pause exists; the whole uncertain gap was nominally active
      -- time with no proof. Exclude it, exactly once, by folding it into
      -- total_paused_seconds.
      UPDATE public.live_sessions
        SET status = 'active',
            status_before_resolution = null,
            total_paused_seconds = total_paused_seconds
              + GREATEST(0, EXTRACT(EPOCH FROM (now() - COALESCE(v_uncertainty_start, now())))::integer),
            extension_last_heartbeat_at = now(),
            broadcaster_page_missing_since = null,
            website_last_heartbeat_at = now(),
            last_heartbeat_at = now()
        WHERE id = v_current.id
        RETURNING * INTO v_result;
    ELSE -- status_before_resolution = 'paused'
      -- paused_at was never touched; it already spans the whole gap. Fold
      -- nothing here — that would double-count against the eventual Resume,
      -- which naturally covers this same span exactly once on its own.
      UPDATE public.live_sessions
        SET status = 'paused',
            status_before_resolution = null,
            extension_last_heartbeat_at = now(),
            broadcaster_page_missing_since = null,
            website_last_heartbeat_at = now(),
            last_heartbeat_at = now()
        WHERE id = v_current.id
        RETURNING * INTO v_result;
    END IF;
  ELSE -- p_choice = 'ended'
    v_end_time := COALESCE(p_end_time, v_uncertainty_start, now());
    UPDATE public.live_sessions
      SET status = 'ended',
          is_active = false,
          status_before_resolution = null,
          ended_at = v_end_time,
          total_paused_seconds = total_paused_seconds
            + CASE WHEN paused_at IS NOT NULL
                   THEN GREATEST(0, EXTRACT(EPOCH FROM (v_end_time - paused_at))::integer)
                   ELSE 0 END,
          paused_at = null,
          last_heartbeat_at = now()
      WHERE id = v_current.id
      RETURNING * INTO v_result;
  END IF;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.resolve_live_session(text, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_live_session(text, timestamptz) FROM anon;
GRANT  EXECUTE ON FUNCTION public.resolve_live_session(text, timestamptz) TO authenticated;
