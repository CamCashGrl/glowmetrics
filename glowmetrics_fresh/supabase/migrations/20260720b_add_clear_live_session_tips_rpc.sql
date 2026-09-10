-- ── clear_live_session_tips ──────────────────────────────────────────────────
-- Sets tips_cleared_at on the caller's current unresolved live_sessions row.
-- Never touches live_tips itself — no row is deleted or updated. Scoped to
-- exactly one row via auth.uid(), matching every other RPC in this file.
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
      AND status IN ('starting','active','paused','stopping','needs_resolution')
    RETURNING * INTO v_result;

  RETURN v_result; -- NULL if no unresolved session exists (safe no-op)
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.clear_live_session_tips() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.clear_live_session_tips() FROM anon;
GRANT  EXECUTE ON FUNCTION public.clear_live_session_tips() TO authenticated;
