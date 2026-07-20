-- Automatic missed-heartbeat handling, previously deferred. Two stages, both
-- driven off broadcaster_page_missing_since (already tracked, never reset
-- while the broadcaster page stays undetected):
--
--   1. active/paused, camera undetected for 5+ minutes -> needs_resolution.
--      The existing "Still Live? / End" prompt (already built in the UI)
--      then shows the next time any surface checks in.
--   2. needs_resolution, camera still undetected 10 more minutes (15 total)
--      AND no tip has landed since entering needs_resolution -> auto-ended.
--      Uses the exact same backdating already used by the manual "End"
--      choice in resolve_live_session: ended_at is set back to the moment
--      the camera was first lost, so the whole uncertain window is excluded
--      from the session's counted time, never added to it.
--
-- A tip landing during needs_resolution counts as proof of life and blocks
-- the auto-end (see the companion change to app/api/live/tips/route.js
-- allowing attribution during needs_resolution, not just active).
--
-- Called from the read/heartbeat paths that already run regularly regardless
-- of which surface (website tab or extension) is active — no cron job
-- required. A no-op whenever there's nothing unresolved for the caller.
CREATE OR REPLACE FUNCTION public.sweep_stale_live_session()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_uid                  uuid := auth.uid();
  v_row                  public.live_sessions;
  v_needs_resolution_at  timestamptz;
  v_has_proof_of_life    boolean;
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

  IF v_row.status IN ('active', 'paused')
     AND v_row.broadcaster_page_missing_since IS NOT NULL
     AND now() - v_row.broadcaster_page_missing_since >= interval '5 minutes' THEN
    UPDATE public.live_sessions
      SET status = 'needs_resolution',
          status_before_resolution = v_row.status
      WHERE id = v_row.id;
    RETURN;
  END IF;

  IF v_row.status = 'needs_resolution'
     AND v_row.broadcaster_page_missing_since IS NOT NULL
     AND now() - v_row.broadcaster_page_missing_since >= interval '15 minutes' THEN
    v_needs_resolution_at := v_row.broadcaster_page_missing_since + interval '5 minutes';

    SELECT EXISTS (
      SELECT 1 FROM public.live_tips
      WHERE user_id = v_uid AND received_at > v_needs_resolution_at
    ) INTO v_has_proof_of_life;

    IF NOT v_has_proof_of_life THEN
      UPDATE public.live_sessions
        SET status = 'ended',
            is_active = false,
            status_before_resolution = null,
            ended_at = v_row.broadcaster_page_missing_since,
            total_paused_seconds = total_paused_seconds
              + CASE WHEN paused_at IS NOT NULL
                     THEN GREATEST(0, EXTRACT(EPOCH FROM (v_row.broadcaster_page_missing_since - paused_at))::integer)
                     ELSE 0 END,
            paused_at = null,
            last_heartbeat_at = now()
        WHERE id = v_row.id;
    END IF;
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.sweep_stale_live_session() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sweep_stale_live_session() FROM anon;
GRANT  EXECUTE ON FUNCTION public.sweep_stale_live_session() TO authenticated;

-- Both heartbeat paths call the sweep first, so staleness is caught
-- regardless of which surface (website tab or extension) is checking in.
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
        last_heartbeat_at = now()
    WHERE user_id = v_uid AND status IN ('active','paused')
    RETURNING * INTO v_result;

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

  -- Runs after the update above so a page that just came back into view
  -- (broadcaster_page_missing_since cleared this same call) is never
  -- immediately re-flagged by stale data from before this heartbeat.
  PERFORM public.sweep_stale_live_session();

  IF v_result IS NULL THEN
    SELECT * INTO v_result FROM public.live_sessions
      WHERE user_id = v_uid AND status = 'needs_resolution';
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
