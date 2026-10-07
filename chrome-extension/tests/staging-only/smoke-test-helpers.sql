-- STAGING ONLY. Never apply to production.
--
-- Deliberately lives outside glowmetrics_fresh/supabase/migrations so it can
-- never ride along with a production migration. Applied to the staging
-- project ("Live Mode Testing", qqvflqcxglkmeuahubwv) by hand.
--
-- Lets staging-smoke-test.mjs read canonical `tips` rows without granting
-- service_role SELECT on public.tips. It refuses any user id other than the
-- fixed smoke-test user, so even if applied elsewhere it could not read a
-- real creator's data. EXECUTE is service_role only. Cleanup needs no helper:
-- tips.user_id is ON DELETE CASCADE, so deleting the fixed auth user removes
-- its tips rows.

CREATE OR REPLACE FUNCTION public.staging_smoke_list_tips(p_user_id uuid)
RETURNS TABLE (
  id bigint,
  client_event_id uuid,
  username text,
  platform text,
  tokens integer,
  usd numeric,
  source text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid THEN
    RAISE EXCEPTION 'staging_smoke_list_tips: only the fixed smoke-test user is allowed' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT t.id, t.client_event_id, t.username, t.platform, t.tokens, t.usd, t.source
  FROM public.tips t
  WHERE t.user_id = p_user_id
  ORDER BY t.id;
END;
$$;

REVOKE ALL ON FUNCTION public.staging_smoke_list_tips(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staging_smoke_list_tips(uuid) TO service_role;
