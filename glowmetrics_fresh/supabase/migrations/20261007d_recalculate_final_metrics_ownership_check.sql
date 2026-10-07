-- recalculate_session_final_metrics: ownership check + pinned search_path.
--
-- It is SECURITY DEFINER and must stay EXECUTE-able by `authenticated`
-- (finalize_live_session is SECURITY INVOKER and calls it as the user), but it
-- previously let any authenticated user recalculate any creator's session.
--
-- Allowed callers:
--   * service-role requests: persist_extension_tip (SECURITY DEFINER, EXECUTE
--     granted to service_role only) recomputes delayed tips on ended sessions;
--     auth.role() still reports the request's 'service_role' inside it.
--   * the session's owner (finalize_live_session as the user).
-- Everyone else gets the same error as a missing session, so other creators'
-- session ids are not confirmed to exist. Aggregation logic is unchanged.

CREATE OR REPLACE FUNCTION public.recalculate_session_final_metrics(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session public.live_sessions;
  v_total_usd numeric;
  v_total_tokens bigint;
  v_tip_count integer;
  v_unique_tippers integer;
  v_top_tipper_username text;
  v_top_tipper_usd numeric;
  v_largest_tip_usd numeric;
  v_avg_tip_usd numeric;
  v_usd_per_hour numeric;
BEGIN
  SELECT * INTO v_session FROM public.live_sessions
  WHERE id = p_session_id AND status IN ('ended', 'finalizing');

  IF NOT FOUND
     OR (coalesce(auth.role(), '') <> 'service_role'
         AND v_session.user_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'Session not found or not ended/finalizing' USING ERRCODE = '22023';
  END IF;

  WITH all_tips AS (
    SELECT username, usd, tokens
    FROM public.live_tips
    WHERE live_session_id = p_session_id
  ),
  tipper_totals AS (
    SELECT username, SUM(usd) as total_usd
    FROM all_tips
    GROUP BY username
  ),
  top_tipper AS (
    SELECT username, total_usd
    FROM tipper_totals
    ORDER BY total_usd DESC
    LIMIT 1
  )
  SELECT
    COALESCE(SUM(usd), 0::numeric),
    COALESCE(SUM(tokens), 0::bigint),
    COUNT(*),
    COUNT(DISTINCT username),
    (SELECT username FROM top_tipper LIMIT 1),
    (SELECT total_usd FROM top_tipper LIMIT 1),
    COALESCE(MAX(usd), 0::numeric),
    COALESCE(ROUND(AVG(usd)::numeric, 2), 0::numeric)
  INTO
    v_total_usd, v_total_tokens, v_tip_count, v_unique_tippers,
    v_top_tipper_username, v_top_tipper_usd, v_largest_tip_usd, v_avg_tip_usd
  FROM all_tips;

  v_usd_per_hour := CASE
    WHEN v_session.final_duration_seconds > 0
    THEN ROUND(
      (v_total_usd / v_session.final_duration_seconds) * 3600,
      2
    )
    ELSE NULL
  END;

  UPDATE public.live_sessions
  SET
    final_total_usd = v_total_usd,
    final_tokens = v_total_tokens,
    final_tip_count = v_tip_count,
    final_unique_tippers = v_unique_tippers,
    final_top_tipper_username = v_top_tipper_username,
    final_top_tipper_usd = v_top_tipper_usd,
    final_largest_tip_usd = v_largest_tip_usd,
    final_avg_tip_usd = v_avg_tip_usd,
    final_usd_per_hour = v_usd_per_hour,
    last_heartbeat_at = now()
  WHERE id = p_session_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recalculate_session_final_metrics(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalculate_session_final_metrics(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.recalculate_session_final_metrics(uuid) TO authenticated;
