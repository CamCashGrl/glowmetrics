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
-- Staging-only verification: Inspect installed advisory lock expressions using pg_get_functiondef.
-- Exposes database internals for lock architecture validation.
-- Do not expose in production.

CREATE OR REPLACE FUNCTION public.verify_function_lock_expressions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_persist_def text;
  v_finalize_def text;
BEGIN
  -- Retrieve persist_extension_tip definition
  SELECT pg_get_functiondef(p.oid) INTO v_persist_def
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'persist_extension_tip';

  -- Retrieve finalize_live_session definition
  SELECT pg_get_functiondef(p.oid) INTO v_finalize_def
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'finalize_live_session';

  v_result := jsonb_build_object(
    'persist_extension_tip_defined', v_persist_def IS NOT NULL,
    'finalize_live_session_defined', v_finalize_def IS NOT NULL,
    'persist_has_user_lock', CASE
      WHEN v_persist_def IS NULL THEN NULL
      WHEN v_persist_def ILIKE '%hashtextextended(p_user_id::text, 0)%' THEN true
      ELSE false
    END,
    'finalize_has_user_lock', CASE
      WHEN v_finalize_def IS NULL THEN NULL
      WHEN v_finalize_def ILIKE '%hashtextextended(v_uid::text, 0)%' THEN true
      ELSE false
    END,
    'persist_has_composite_lock', CASE
      WHEN v_persist_def IS NULL THEN NULL
      WHEN v_persist_def LIKE '%p_user_id::text || '':'' || p_client_event_id%' THEN true
      ELSE false
    END
  );

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_function_lock_expressions() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_function_lock_expressions() FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_function_lock_expressions() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.verify_function_lock_expressions() TO service_role;
