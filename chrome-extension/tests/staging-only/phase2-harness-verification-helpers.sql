-- STAGING/TEST ONLY - Do not promote to production
--
-- Diagnostic and verification helper RPCs for Phase 2 staging test harness.
-- These helpers bypass RLS and expose database internals for test validation only.
--
-- Do NOT include in production migrations. These exist only to enable strict
-- contract verification in staging/testing environments.

-- ── Helper: verify_ambiguity_logs_for_user ────────────────────────────────
-- Staging-only verification: Count unattributed_tips_log rows for a user by reason.
-- Uses SECURITY DEFINER to bypass RLS for testing.
-- Do not expose in production.

CREATE OR REPLACE FUNCTION public.verify_ambiguity_logs_for_user(
  p_user_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS TABLE(
  reason text,
  count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    unattributed_tips_log.reason,
    COUNT(*) as count
  FROM public.unattributed_tips_log
  WHERE user_id = p_user_id
    AND (p_reason IS NULL OR unattributed_tips_log.reason = p_reason)
  GROUP BY unattributed_tips_log.reason;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_ambiguity_logs_for_user(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_ambiguity_logs_for_user(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_ambiguity_logs_for_user(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.verify_ambiguity_logs_for_user(uuid, text) TO service_role;

-- ── Helper: verify_function_lock_expressions ────────────────────────────────
-- Staging-only verification: confirm persist_extension_tip, stop_live_session and
-- _finalize_live_session_metrics all take the same per-user advisory lock.
-- Exposes database internals for lock architecture validation.
-- Do not expose in production.

CREATE OR REPLACE FUNCTION public.verify_function_lock_expressions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_persist_def text;
  v_stop_def text;
  v_finalizer_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_persist_def
  FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'persist_extension_tip';

  SELECT pg_get_functiondef(p.oid) INTO v_stop_def
  FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'stop_live_session';

  SELECT pg_get_functiondef(p.oid) INTO v_finalizer_def
  FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = '_finalize_live_session_metrics';

  RETURN jsonb_build_object(
    'persist_extension_tip_defined', v_persist_def IS NOT NULL,
    'stop_live_session_defined', v_stop_def IS NOT NULL,
    'finalizer_defined', v_finalizer_def IS NOT NULL,
    'persist_has_user_lock', v_persist_def ILIKE '%pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0))%',
    'stop_has_user_lock', v_stop_def ILIKE '%pg_advisory_xact_lock(hashtextextended(v_uid::text, 0))%',
    'finalizer_has_user_lock', v_finalizer_def ILIKE '%pg_advisory_xact_lock(hashtextextended(v_row.user_id::text, 0))%',
    'persist_has_composite_lock', v_persist_def LIKE '%p_user_id::text || '':'' || p_client_event_id%'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_function_lock_expressions() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_function_lock_expressions() FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_function_lock_expressions() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.verify_function_lock_expressions() TO service_role;
