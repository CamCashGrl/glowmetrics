-- Fix based on direct user feedback: requiring the EXTENSION specifically
-- to flip STARTING -> LIVE meant anyone not running the extension got
-- permanently stuck in "Waiting for extension to connect..." with no
-- Pause/Resume/Stop and no timer, ever - the extension was designed as an
-- optional auto-tip-capture enhancement, not a requirement to go live at
-- all. The website's own heartbeat (fired immediately on Start Stream) is
-- now sufficient on its own to flip STARTING -> LIVE, exactly like the
-- extension's heartbeat already did. Whichever one shows up first wins;
-- if the extension does connect later, send_extension_heartbeat's own
-- CASE logic is a no-op once already 'live'.
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

  RETURN v_result;
END;
$function$;
