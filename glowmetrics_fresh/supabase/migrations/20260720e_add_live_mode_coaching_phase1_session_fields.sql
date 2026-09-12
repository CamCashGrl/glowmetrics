-- CamCash Live Mode Coaching System — Phase 1: session lifecycle extensions.
--
-- Adds the earnings/token/summary fields and the per-pause log the fuller
-- coaching system needs, plus a richer set of session-resolution outcomes
-- beyond the current binary Still Live / Ended.
--
-- Session totals (session_earnings_usd, session_tokens, tip_count,
-- unique_tipper_count, etc.) are computed at Stop time by aggregating
-- public.live_tips directly via live_session_id — NOT via a
-- starting/ending cumulative-total snapshot subtraction. Direct
-- aggregation is the already-proven, robust mechanism this engine uses
-- everywhere else (tip-session attribution has worked this way since
-- Phase 1C); a snapshot/delta approach would be fragile against
-- concurrent activity or historical CSV imports landing in the same
-- window. starting_earnings_usd/ending_earnings_usd/starting_tokens/
-- ending_tokens are kept as nullable columns for optional future use but
-- are not populated by this migration's RPCs.
--
-- Entirely additive: no existing table is altered destructively, no
-- existing column is renamed or removed, no existing RPC's core behavior
-- changes for the paths this doesn't touch.

-- ── live_sessions: earnings/token/summary fields ──────────────────────────
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS starting_earnings_usd     numeric,
  ADD COLUMN IF NOT EXISTS ending_earnings_usd        numeric,
  ADD COLUMN IF NOT EXISTS session_earnings_usd       numeric,
  ADD COLUMN IF NOT EXISTS starting_tokens            integer,
  ADD COLUMN IF NOT EXISTS ending_tokens              integer,
  ADD COLUMN IF NOT EXISTS session_tokens             integer,
  ADD COLUMN IF NOT EXISTS tip_count                  integer,
  ADD COLUMN IF NOT EXISTS unique_tipper_count        integer,
  ADD COLUMN IF NOT EXISTS new_tipper_count            integer,
  ADD COLUMN IF NOT EXISTS returning_tipper_count      integer,
  ADD COLUMN IF NOT EXISTS whale_tip_count            integer,
  ADD COLUMN IF NOT EXISTS largest_tip_usd            numeric,
  ADD COLUMN IF NOT EXISTS average_tip_usd            numeric,
  ADD COLUMN IF NOT EXISTS earnings_per_active_hour    numeric,
  ADD COLUMN IF NOT EXISTS tips_per_active_hour       numeric,
  ADD COLUMN IF NOT EXISTS platform_detected_automatically boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS session_resolution_type    text,
  ADD COLUMN IF NOT EXISTS is_inaccurate              boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inaccuracy_reason           text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'live_sessions_resolution_type_check'
  ) THEN
    ALTER TABLE public.live_sessions
      ADD CONSTRAINT live_sessions_resolution_type_check
      CHECK (session_resolution_type IS NULL OR session_resolution_type IN (
        'normal_stop', 'still_live', 'end_at_last_heartbeat',
        'chosen_end_time', 'marked_invalid'
      ));
  END IF;
END $$;

-- ── live_session_pauses ────────────────────────────────────────────────────
-- One row per pause/resume cycle. pause_live_session (below) inserts a new
-- open row (resumed_at NULL); resume_live_session closes the most recent
-- open row for that session. This is the per-interval log the correction
-- tool and session-detail timeline read from — total_paused_seconds on
-- live_sessions itself remains the fast running total used everywhere else
-- and is not replaced by this table.
CREATE TABLE IF NOT EXISTS public.live_session_pauses (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id             uuid NOT NULL REFERENCES public.live_sessions(id),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paused_at              timestamptz NOT NULL,
  resumed_at             timestamptz,
  pause_duration_seconds integer,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS live_session_pauses_session_id_idx
  ON public.live_session_pauses(session_id);

ALTER TABLE public.live_session_pauses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS live_session_pauses_select_own ON public.live_session_pauses;
CREATE POLICY live_session_pauses_select_own ON public.live_session_pauses
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT/UPDATE are required here even though only pause_live_session() and
-- resume_live_session() ever write to this table — both are SECURITY
-- INVOKER, so they run with the calling (authenticated) user's own
-- privileges, not elevated ones. Missing this grant was caught directly:
-- a superuser-context test call succeeded regardless, but re-testing under
-- the actual `authenticated` role showed the write silently failing.
DROP POLICY IF EXISTS live_session_pauses_insert_own ON public.live_session_pauses;
CREATE POLICY live_session_pauses_insert_own ON public.live_session_pauses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS live_session_pauses_update_own ON public.live_session_pauses;
CREATE POLICY live_session_pauses_update_own ON public.live_session_pauses
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.live_session_pauses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_session_pauses TO service_role;

-- ── pause_live_session: also opens a live_session_pauses row ──────────────
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

  -- Must test v_result.id, not the whole row: live_sessions has many
  -- nullable columns, and "row IS NOT NULL" is only true when EVERY field
  -- is non-null — a real, matched row still reads as "not not-null" here
  -- and would silently skip the insert below.
  IF v_result.id IS NOT NULL THEN
    INSERT INTO public.live_session_pauses (session_id, user_id, paused_at)
      VALUES (v_result.id, v_uid, v_result.paused_at);
  END IF;

  RETURN v_result;
END;
$function$;

-- ── resume_live_session: closes the open live_session_pauses row ──────────
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

  -- See pause_live_session() above: must test v_result.id, not the whole row.
  IF v_result.id IS NOT NULL THEN
    UPDATE public.live_session_pauses
      SET resumed_at = now(),
          pause_duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (now() - paused_at))::integer)
      WHERE session_id = v_result.id AND resumed_at IS NULL;
  END IF;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.pause_live_session() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pause_live_session() FROM anon;
GRANT  EXECUTE ON FUNCTION public.pause_live_session() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.resume_live_session() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resume_live_session() FROM anon;
GRANT  EXECUTE ON FUNCTION public.resume_live_session() TO authenticated;

-- ── stop_live_session: computes real session totals from live_tips ────────
-- Never calculates earnings-per-hour using paused time — divides by
-- active_duration_seconds only, which already excludes total_paused_seconds.
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
        is_active = false,
        ended_at = now(),
        last_heartbeat_at = now(),
        total_paused_seconds = total_paused_seconds
          + CASE WHEN paused_at IS NOT NULL
                 THEN GREATEST(0, EXTRACT(EPOCH FROM (now() - paused_at))::integer)
                 ELSE 0 END,
        paused_at = null,
        status_before_resolution = null,
        session_resolution_type = 'normal_stop'
    WHERE user_id = v_uid
      AND status IN ('active','paused','needs_resolution')
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

-- ── resolve_live_session: richer resolution outcomes ───────────────────────
-- Extends the existing 'still_live' / 'ended' choices with three more,
-- matching the resolution card's fuller option set. 'still_live' and
-- 'ended' behave exactly as before (nothing existing changes for those
-- paths) — the new choices are additive branches.
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
    WHERE user_id = v_uid AND status = 'needs_resolution';
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_uncertainty_start := COALESCE(v_current.broadcaster_page_missing_since, v_current.extension_last_heartbeat_at);

  IF p_choice = 'still_live' THEN
    IF v_current.status_before_resolution = 'active' THEN
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
    ELSE
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
    RETURN v_result;
  END IF;

  -- Every remaining choice ends the session, differing only in which
  -- ended_at is used and whether it's flagged inaccurate.
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
        is_active = false,
        status_before_resolution = null,
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
