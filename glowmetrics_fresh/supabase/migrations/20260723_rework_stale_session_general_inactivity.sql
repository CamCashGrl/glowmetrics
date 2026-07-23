-- Reworks the "are you still live?" auto-resolve flow to match the actual
-- spec: fire on 5 minutes of genuine inactivity (not specifically "camera
-- page not detected"), wait 10 more minutes for an explicit response, then
-- auto-end — backdating the full 15-minute window out of counted time
-- either way (auto-end or a late "Still Live" click both exclude it).
--
-- The old mechanism keyed entirely off broadcaster_page_missing_since, a
-- signal only the extension ever sets. Two real gaps followed from that:
--   1. It never covered "the website tab AND the extension are both fully
--      closed" — if the extension isn't running at all, it can never report
--      anything, so broadcaster_page_missing_since just stays null forever
--      and the session sits "active" with no backstop.
--   2. It never covered "both are open, tips just stopped" — a browser tab
--      polling normally isn't proof anyone is still actually broadcasting.
--
-- Replaced with two independent triggers, either one enough to start the
-- clock (inactivity_since is set to whichever one actually fired):
--   (a) no heartbeat from EITHER surface in 5 minutes -- covers full
--       closure, since no heartbeat can arrive at all once both are gone.
--   (b) heartbeats still arriving (something's open) but no tip has landed
--       in 5 minutes -- covers "open, but nothing's actually happening."
-- A tip landing after inactivity_since is still proof of life and blocks
-- the auto-end, same invariant as before.

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS inactivity_since timestamptz;

CREATE OR REPLACE FUNCTION public.sweep_stale_live_session()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_uid               uuid := auth.uid();
  v_row               public.live_sessions;
  v_last_tip_at       timestamptz;
  v_stale_since       timestamptz;
  v_has_proof_of_life boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_row FROM public.live_sessions
    WHERE user_id = v_uid AND status IN ('active', 'paused', 'needs_resolution')
    ORDER BY started_at DESC
    LIMIT 1;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_row.status IN ('active', 'paused') THEN
    SELECT MAX(received_at) INTO v_last_tip_at
      FROM public.live_tips WHERE live_session_id = v_row.id;
    IF v_last_tip_at IS NULL THEN
      v_last_tip_at := v_row.started_at;
    END IF;

    v_stale_since := NULL;
    IF now() - v_row.last_heartbeat_at >= interval '5 minutes' THEN
      v_stale_since := v_row.last_heartbeat_at;
    ELSIF now() - v_last_tip_at >= interval '5 minutes' THEN
      v_stale_since := v_last_tip_at;
    END IF;

    IF v_stale_since IS NOT NULL THEN
      UPDATE public.live_sessions
        SET status = 'needs_resolution',
            status_before_resolution = v_row.status,
            inactivity_since = v_stale_since
        WHERE id = v_row.id;
    END IF;
    RETURN;
  END IF;

  IF v_row.status = 'needs_resolution'
     AND v_row.inactivity_since IS NOT NULL
     AND now() - v_row.inactivity_since >= interval '15 minutes' THEN

    SELECT EXISTS (
      SELECT 1 FROM public.live_tips
      WHERE live_session_id = v_row.id AND received_at > v_row.inactivity_since
    ) INTO v_has_proof_of_life;

    IF NOT v_has_proof_of_life THEN
      UPDATE public.live_sessions
        SET status = 'ended',
            is_active = false,
            status_before_resolution = null,
            inactivity_since = null,
            ended_at = v_row.inactivity_since,
            total_paused_seconds = total_paused_seconds
              + CASE WHEN paused_at IS NOT NULL
                     THEN GREATEST(0, EXTRACT(EPOCH FROM (v_row.inactivity_since - paused_at))::integer)
                     ELSE 0 END,
            paused_at = null,
            last_heartbeat_at = now()
        WHERE id = v_row.id;
    END IF;
  END IF;
END;
$function$;

-- resolve_live_session now anchors on inactivity_since instead of
-- COALESCE(broadcaster_page_missing_since, extension_last_heartbeat_at) --
-- same backdating behavior (the uncertain window is added to
-- total_paused_seconds even on a late "Still Live" click, or used as the
-- default end time), just keyed to the general signal above.
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

  v_uncertainty_start := v_current.inactivity_since;

  IF p_choice = 'still_live' THEN
    IF v_current.status_before_resolution = 'active' THEN
      UPDATE public.live_sessions
        SET status = 'active',
            status_before_resolution = null,
            inactivity_since = null,
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
            inactivity_since = null,
            extension_last_heartbeat_at = now(),
            broadcaster_page_missing_since = null,
            website_last_heartbeat_at = now(),
            last_heartbeat_at = now()
        WHERE id = v_current.id
        RETURNING * INTO v_result;
    END IF;
    RETURN v_result;
  END IF;

  IF p_choice = 'ended' THEN
    v_end_time := COALESCE(p_end_time, v_uncertainty_start, now());
  ELSIF p_choice = 'end_at_last_heartbeat' THEN
    v_end_time := COALESCE(v_uncertainty_start, v_current.extension_last_heartbeat_at, v_current.website_last_heartbeat_at, now());
  ELSIF p_choice = 'choose_end_time' THEN
    IF p_end_time IS NULL THEN
      RAISE EXCEPTION 'choose_end_time requires p_end_time' USING ERRCODE = '22023';
    END IF;
    v_end_time := p_end_time;
  ELSE
    v_end_time := COALESCE(v_uncertainty_start, now());
  END IF;

  UPDATE public.live_sessions
    SET status = 'ended',
        is_active = false,
        status_before_resolution = null,
        inactivity_since = null,
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

REVOKE EXECUTE ON FUNCTION public.sweep_stale_live_session() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sweep_stale_live_session() FROM anon;
GRANT  EXECUTE ON FUNCTION public.sweep_stale_live_session() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.resolve_live_session(text, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_live_session(text, timestamptz) FROM anon;
GRANT  EXECUTE ON FUNCTION public.resolve_live_session(text, timestamptz) TO authenticated;
