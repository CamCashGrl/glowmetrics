-- CamCash Live Engine rewrite — Step 2: collapse the session state machine
-- down to exactly the states specified for the single canonical engine:
--
--   OFFLINE -> STARTING -> LIVE (active | paused) -> INACTIVE_WARNING -> ENDING -> OFFLINE
--
-- Persisted status values become: 'starting', 'live', 'inactive_warning',
-- 'ending', 'ended'. 'ended' is the durable archive marker for a resolved
-- past session (what Session Replay reads); "OFFLINE" for a user simply
-- means no row exists in ('starting','live','inactive_warning','ending')
-- for them, same lookup pattern every RPC here already uses.
--
-- Old status values ('active','paused','stopping','needs_resolution','error')
-- are retired. 'active'/'paused' become the new live_substate column
-- (meaningful only while status = 'live'). 'stopping' and 'error' were
-- already dead states (declared in the old CHECK, never set by any RPC) —
-- confirmed via full-codebase search before writing this migration.
-- 'needs_resolution' maps to 'inactive_warning'.
--
-- Heartbeat becomes the ONLY authority for staleness — the extension's
-- broadcaster-page-detection columns (broadcaster_page_detected,
-- broadcaster_page_missing_since) are no longer read by the sweep. They are
-- left in place (not dropped) since dropping columns is a separate,
-- higher-risk change not required by this rewrite; they simply go unused
-- from here on.
--
-- New thresholds (previously 5 min / 15 min total, off page-detection):
--   live, no heartbeat for 10 min            -> inactive_warning
--   inactive_warning, no heartbeat for 10 more (20 total), no tip since -> ended (auto)
-- A heartbeat arriving while inactive_warning immediately flips back to
-- live (heartbeat is the sole authority — no separate "still live?" click
-- is needed once the heartbeat itself resumes).

-- ── new columns ─────────────────────────────────────────────────────────────
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS live_substate     text,
  ADD COLUMN IF NOT EXISTS warning_started_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'live_sessions_live_substate_check'
  ) THEN
    ALTER TABLE public.live_sessions
      ADD CONSTRAINT live_sessions_live_substate_check
      CHECK (live_substate IS NULL OR live_substate IN ('active', 'paused'));
  END IF;
END $$;

-- ── migrate existing rows to the new status vocabulary ─────────────────────
UPDATE public.live_sessions SET live_substate = 'active' WHERE status = 'active';
UPDATE public.live_sessions SET live_substate = 'paused' WHERE status = 'paused';
UPDATE public.live_sessions SET status = 'live'    WHERE status IN ('active', 'paused');
UPDATE public.live_sessions
  SET status = 'inactive_warning',
      live_substate = COALESCE(NULLIF(status_before_resolution, ''), 'active'),
      warning_started_at = COALESCE(broadcaster_page_missing_since, last_heartbeat_at, now())
  WHERE status = 'needs_resolution';
UPDATE public.live_sessions SET status = 'ending' WHERE status = 'stopping';
UPDATE public.live_sessions
  SET status = 'ended', is_active = false, is_inaccurate = true,
      inaccuracy_reason = COALESCE(inaccuracy_reason, 'migrated_from_error_state'),
      ended_at = COALESCE(ended_at, last_heartbeat_at, now())
  WHERE status = 'error';

-- ── drop and replace the status CHECK constraint ────────────────────────────
ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS live_sessions_status_check;
ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_status_check
  CHECK (status IN ('starting', 'live', 'inactive_warning', 'ending', 'ended'));

-- ── start_live_session: creates in STARTING, not LIVE ───────────────────────
-- Status only becomes 'live' once the extension's first heartbeat lands
-- (see send_extension_heartbeat below) — matches "3. Notify extension.
-- 4. Extension connects. 5. Heartbeat begins" preceding the dashboard
-- actually entering LIVE.
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
      user_id, status, live_substate, is_active, started_at, ended_at,
      last_heartbeat_at, website_last_heartbeat_at, stream_platform
    ) VALUES (
      v_uid, 'starting', null, true, now(), null,
      now(), now(), v_platform
    )
    RETURNING * INTO v_result;
    RETURN v_result;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_result
      FROM public.live_sessions
      WHERE user_id = v_uid
        AND status IN ('starting','live','inactive_warning','ending')
      ORDER BY started_at DESC
      LIMIT 1;
    RETURN v_result;
  END;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.start_live_session(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.start_live_session(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.start_live_session(text) TO authenticated;

-- ── pause_live_session / resume_live_session: substate of LIVE only ────────
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
    SET live_substate = 'paused',
        paused_at = now(),
        last_heartbeat_at = now()
    WHERE user_id = v_uid AND status = 'live' AND live_substate = 'active'
    RETURNING * INTO v_result;

  IF v_result.id IS NOT NULL THEN
    INSERT INTO public.live_session_pauses (session_id, user_id, paused_at)
      VALUES (v_result.id, v_uid, v_result.paused_at);
  END IF;

  RETURN v_result; -- NULL if not currently live+active (repeated Pause = safe no-op)
END;
$function$;

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
    SET live_substate = 'active',
        total_paused_seconds = total_paused_seconds
          + GREATEST(0, EXTRACT(EPOCH FROM (now() - paused_at))::integer),
        paused_at = null,
        last_heartbeat_at = now()
    WHERE user_id = v_uid AND status = 'live' AND live_substate = 'paused'
    RETURNING * INTO v_result;

  IF v_result.id IS NOT NULL THEN
    UPDATE public.live_session_pauses
      SET resumed_at = now(),
          pause_duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (now() - paused_at))::integer)
      WHERE session_id = v_result.id AND resumed_at IS NULL;
  END IF;

  RETURN v_result; -- NULL if not currently live+paused (repeated Resume = safe no-op)
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.pause_live_session() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pause_live_session() FROM anon;
GRANT  EXECUTE ON FUNCTION public.pause_live_session() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.resume_live_session() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resume_live_session() FROM anon;
GRANT  EXECUTE ON FUNCTION public.resume_live_session() TO authenticated;

-- ── stop_live_session: manual "End Stream" from any unresolved state ───────
CREATE OR REPLACE FUNCTION public.stop_live_session()
RETURNS public.live_sessions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_uid           uuid := auth.uid();
  v_result        public.live_sessions;
  v_active_secs   numeric;
  v_tip_count     integer;
  v_unique_tippers integer;
  v_earnings      numeric;
  v_tokens        integer;
  v_largest_tip   numeric;
  v_avg_tip       numeric;
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

  v_active_secs := GREATEST(0,
    EXTRACT(EPOCH FROM (v_result.ended_at - v_result.started_at)) - v_result.total_paused_seconds
  );

  SELECT
    COUNT(*), COUNT(DISTINCT lower(username)),
    COALESCE(SUM(usd), 0), COALESCE(SUM(tokens), 0),
    COALESCE(MAX(usd), 0), COALESCE(AVG(usd), 0)
    INTO v_tip_count, v_unique_tippers, v_earnings, v_tokens, v_largest_tip, v_avg_tip
    FROM public.live_tips
    WHERE live_session_id = v_result.id;

  UPDATE public.live_sessions
    SET session_earnings_usd     = v_earnings,
        session_tokens           = v_tokens,
        tip_count                = v_tip_count,
        unique_tipper_count      = v_unique_tippers,
        largest_tip_usd          = v_largest_tip,
        average_tip_usd          = v_avg_tip,
        earnings_per_active_hour = CASE WHEN v_active_secs > 0 THEN round((v_earnings / (v_active_secs / 3600.0))::numeric, 2) ELSE 0 END,
        tips_per_active_hour     = CASE WHEN v_active_secs > 0 THEN round((v_tip_count / (v_active_secs / 3600.0))::numeric, 2) ELSE 0 END
    WHERE id = v_result.id
    RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.stop_live_session() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.stop_live_session() FROM anon;
GRANT  EXECUTE ON FUNCTION public.stop_live_session() TO authenticated;

-- ── resolve_live_session: explicit ack from INACTIVE_WARNING ───────────────
-- p_choice = 'still_live' -> back to LIVE, preserving live_substate.
-- Every other choice ends the session (unchanged option set/back-dating
-- rules from the previous resolution flow, just re-scoped to the new
-- status name and live_substate instead of status_before_resolution).
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

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.resolve_live_session(text, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_live_session(text, timestamptz) FROM anon;
GRANT  EXECUTE ON FUNCTION public.resolve_live_session(text, timestamptz) TO authenticated;

-- ── sweep_stale_live_session: self-scoped, called inline from heartbeats ───
-- Heartbeat (last_heartbeat_at) is the ONLY authority. No dependency on
-- broadcaster_page_detected/missing_since any more.
CREATE OR REPLACE FUNCTION public.sweep_stale_live_session()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_uid               uuid := auth.uid();
  v_row               public.live_sessions;
  v_deadline_start    timestamptz;
  v_has_proof_of_life boolean;
  v_active_secs       numeric;
  v_tip_count         integer;
  v_unique_tippers    integer;
  v_earnings          numeric;
  v_tokens            integer;
  v_largest_tip       numeric;
  v_avg_tip           numeric;
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
      -- A tip landed after the last heartbeat — genuine proof of life.
      -- Bring the session back to LIVE instead of ending it.
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

    v_active_secs := GREATEST(0,
      EXTRACT(EPOCH FROM (v_row.ended_at - v_row.started_at)) - v_row.total_paused_seconds
    );

    SELECT
      COUNT(*), COUNT(DISTINCT lower(username)),
      COALESCE(SUM(usd), 0), COALESCE(SUM(tokens), 0),
      COALESCE(MAX(usd), 0), COALESCE(AVG(usd), 0)
      INTO v_tip_count, v_unique_tippers, v_earnings, v_tokens, v_largest_tip, v_avg_tip
      FROM public.live_tips
      WHERE live_session_id = v_row.id;

    UPDATE public.live_sessions
      SET session_earnings_usd     = v_earnings,
          session_tokens           = v_tokens,
          tip_count                = v_tip_count,
          unique_tipper_count      = v_unique_tippers,
          largest_tip_usd          = v_largest_tip,
          average_tip_usd          = v_avg_tip,
          earnings_per_active_hour = CASE WHEN v_active_secs > 0 THEN round((v_earnings / (v_active_secs / 3600.0))::numeric, 2) ELSE 0 END,
          tips_per_active_hour     = CASE WHEN v_active_secs > 0 THEN round((v_tip_count / (v_active_secs / 3600.0))::numeric, 2) ELSE 0 END
      WHERE id = v_row.id;
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.sweep_stale_live_session() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sweep_stale_live_session() FROM anon;
GRANT  EXECUTE ON FUNCTION public.sweep_stale_live_session() TO authenticated;

-- ── sweep_all_stale_live_sessions: system-wide, for the cron job only ──────
-- SECURITY DEFINER because there is no auth.uid() context when called from
-- a scheduled job — it must see every unresolved session, not one user's.
-- Deliberately NOT granted to authenticated/anon: only the service-role
-- Supabase client used by app/api/cron/live-session-sweep/route.js may call
-- this, so a user can never force-expire another user's (or even their own)
-- session ahead of the real 10/20-minute schedule.
CREATE OR REPLACE FUNCTION public.sweep_all_stale_live_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_row               public.live_sessions;
  v_has_proof_of_life boolean;
  v_active_secs       numeric;
  v_tip_count         integer;
  v_unique_tippers    integer;
  v_earnings          numeric;
  v_tokens            integer;
  v_largest_tip       numeric;
  v_avg_tip           numeric;
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

    v_active_secs := GREATEST(0,
      EXTRACT(EPOCH FROM (v_row.ended_at - v_row.started_at)) - v_row.total_paused_seconds
    );

    SELECT
      COUNT(*), COUNT(DISTINCT lower(username)),
      COALESCE(SUM(usd), 0), COALESCE(SUM(tokens), 0),
      COALESCE(MAX(usd), 0), COALESCE(AVG(usd), 0)
      INTO v_tip_count, v_unique_tippers, v_earnings, v_tokens, v_largest_tip, v_avg_tip
      FROM public.live_tips
      WHERE live_session_id = v_row.id;

    UPDATE public.live_sessions
      SET session_earnings_usd     = v_earnings,
          session_tokens           = v_tokens,
          tip_count                = v_tip_count,
          unique_tipper_count      = v_unique_tippers,
          largest_tip_usd          = v_largest_tip,
          average_tip_usd          = v_avg_tip,
          earnings_per_active_hour = CASE WHEN v_active_secs > 0 THEN round((v_earnings / (v_active_secs / 3600.0))::numeric, 2) ELSE 0 END,
          tips_per_active_hour     = CASE WHEN v_active_secs > 0 THEN round((v_tip_count / (v_active_secs / 3600.0))::numeric, 2) ELSE 0 END
      WHERE id = v_row.id;

    v_swept := v_swept + 1;
  END LOOP;

  RETURN v_swept;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.sweep_all_stale_live_sessions() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sweep_all_stale_live_sessions() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sweep_all_stale_live_sessions() FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.sweep_all_stale_live_sessions() TO service_role;

-- ── send_website_heartbeat / send_extension_heartbeat ───────────────────────
-- Both: bump last_heartbeat_at; if currently STARTING, the extension
-- heartbeat is what flips it into LIVE (website heartbeat alone does not —
-- Live Mode isn't "live" until the extension has actually connected); if
-- currently INACTIVE_WARNING, any heartbeat immediately flips back to LIVE
-- (heartbeat is the sole authority, so its own resumption is enough — no
-- separate manual ack required). Sweep runs first so staleness already in
-- progress is applied before this same call's heartbeat could mask it.
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

  PERFORM public.sweep_stale_live_session();

  UPDATE public.live_sessions
    SET website_last_heartbeat_at = now(),
        last_heartbeat_at = now(),
        status = CASE WHEN status = 'inactive_warning' THEN 'live' ELSE status END,
        warning_started_at = CASE WHEN status = 'inactive_warning' THEN null ELSE warning_started_at END
    WHERE user_id = v_uid AND status IN ('live', 'inactive_warning')
    RETURNING * INTO v_result;

  IF v_result IS NULL THEN
    SELECT * INTO v_result FROM public.live_sessions
      WHERE user_id = v_uid AND status = 'starting';
  END IF;

  RETURN v_result;
END;
$function$;

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

  -- STARTING -> LIVE: this is the extension's first ack, matching the
  -- required flow ("Extension connects -> Heartbeat begins -> Dashboard
  -- timer starts"). live_substate begins at 'active'.
  UPDATE public.live_sessions
    SET extension_last_heartbeat_at = now(),
        extension_platform = p_platform,
        broadcaster_page_detected = p_broadcaster_page_detected,
        last_heartbeat_at = now(),
        status = CASE
          WHEN status = 'starting' THEN 'live'
          WHEN status = 'inactive_warning' THEN 'live'
          ELSE status
        END,
        live_substate = CASE
          WHEN status = 'starting' THEN 'active'
          ELSE live_substate
        END,
        warning_started_at = CASE WHEN status = 'inactive_warning' THEN null ELSE warning_started_at END
    WHERE user_id = v_uid AND status IN ('starting', 'live', 'inactive_warning')
    RETURNING * INTO v_result;

  PERFORM public.sweep_stale_live_session();

  IF v_result IS NULL THEN
    SELECT * INTO v_result FROM public.live_sessions
      WHERE user_id = v_uid AND status IN ('starting', 'inactive_warning', 'ending');
  END IF;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.send_website_heartbeat() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_website_heartbeat() FROM anon;
GRANT  EXECUTE ON FUNCTION public.send_website_heartbeat() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.send_extension_heartbeat(text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_extension_heartbeat(text, boolean) FROM anon;
GRANT  EXECUTE ON FUNCTION public.send_extension_heartbeat(text, boolean) TO authenticated;

-- ── clear_live_session_tips / coaching strategy / goal-tokens setters ──────
-- Just re-scoped to the new unresolved-status list.
CREATE OR REPLACE FUNCTION public.clear_live_session_tips()
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
    SET tips_cleared_at = now()
    WHERE user_id = v_uid
      AND status IN ('starting','live','inactive_warning','ending')
    RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.clear_live_session_tips() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.clear_live_session_tips() FROM anon;
GRANT  EXECUTE ON FUNCTION public.clear_live_session_tips() TO authenticated;

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
      AND status IN ('starting', 'live', 'inactive_warning', 'ending')
    RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_live_session_coaching_strategy(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_live_session_coaching_strategy(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.set_live_session_coaching_strategy(text) TO authenticated;

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
      AND status IN ('starting', 'live', 'inactive_warning', 'ending')
    RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_live_session_goal_tokens(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_live_session_goal_tokens(integer) FROM anon;
GRANT  EXECUTE ON FUNCTION public.set_live_session_goal_tokens(integer) TO authenticated;
