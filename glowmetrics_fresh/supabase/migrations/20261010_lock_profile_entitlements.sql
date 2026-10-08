-- Lock paid-entitlement columns and make the primary platform permanent.
--
-- Vulnerability (production, found 2026-10-08): profiles_own_update allowed a
-- signed-in user to update ANY column of their own profile, and the
-- authenticated role held table-wide UPDATE. A Free user could run
--   supabase.from('profiles').update({ plan: 'pro' })
-- from the browser and receive Pro. subscriptions was equally writable.
--
-- Fix (defense in depth):
--  1. Column privileges: browsers (authenticated/anon) lose all write access
--     to profiles, then get INSERT/UPDATE back ONLY on the columns the app
--     writes from the browser (inventory: landing signup attribution,
--     onboarding platform selection + Chaturbate username, Chaturbate
--     onboarding broadcaster_type, the one-time primary-platform route).
--     plan, trial, Stripe and every other column become server-only
--     (service_role / SECURITY DEFINER functions only).
--  2. Trigger: once primary_pro_platform is set, ordinary users can never
--     change it (server role can repair). A first write of only
--     streaming_platforms materializes its first entry as the primary, and
--     streaming_platforms is kept primary-first, so the compatibility
--     fallback cannot be used to switch platforms later.
--  3. subscriptions / promo tables: browser write privileges revoked (they
--     are written only by the Stripe webhook and SECURITY DEFINER
--     functions).
-- SECURITY DEFINER functions (handle_new_user, redeem_promo_code,
-- send_live_mode_guide_batch) run as their owner and are unaffected.

BEGIN;

-- 1. profiles: column allowlist ------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.profiles FROM anon, authenticated;

GRANT INSERT (
  id,
  chaturbate_username, broadcaster_type,
  streaming_platforms, primary_pro_platform,
  utm_source, utm_medium, utm_campaign, utm_content, utm_term,
  referrer, attributed_landing_page, attributed_at
) ON public.profiles TO authenticated;

-- id is included because PostgREST upserts (onboarding) emit
-- "ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id, ..."; the update policy
-- (auth.uid() = id) still pins it to the caller's own id.
GRANT UPDATE (
  id,
  chaturbate_username, broadcaster_type,
  streaming_platforms, primary_pro_platform,
  utm_source, utm_medium, utm_campaign, utm_content, utm_term,
  referrer, attributed_landing_page, attributed_at
) ON public.profiles TO authenticated;

-- 2. permanent primary platform -------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profiles_primary_platform()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Trusted server roles (service_role, postgres, SECURITY DEFINER owners)
  -- may repair the value; only end users are restricted.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.primary_pro_platform IS NOT NULL
     AND NEW.primary_pro_platform IS DISTINCT FROM OLD.primary_pro_platform THEN
    RAISE EXCEPTION 'primary_pro_platform is permanent once chosen'
      USING ERRCODE = '42501';
  END IF;

  -- The compatibility fallback (streaming_platforms[1]) becomes the stored
  -- primary on first write, so it can never be used to change it later.
  IF NEW.primary_pro_platform IS NULL
     AND NEW.streaming_platforms IS NOT NULL
     AND array_length(NEW.streaming_platforms, 1) > 0 THEN
    NEW.primary_pro_platform := NEW.streaming_platforms[1];
  END IF;

  -- Keep the roster primary-first (index 1 always equals the primary).
  IF NEW.primary_pro_platform IS NOT NULL AND NEW.streaming_platforms IS NOT NULL THEN
    NEW.streaming_platforms := array_prepend(
      NEW.primary_pro_platform,
      array_remove(NEW.streaming_platforms, NEW.primary_pro_platform)
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_profiles_primary_platform() FROM PUBLIC, anon, authenticated;

-- Named zz_ so it fires after normalize_primary_pro_platform_trg /
-- normalize_streaming_platforms_trg (BEFORE triggers run alphabetically) and
-- compares canonical values ('Chaturbate', not 'chaturbate').
DROP TRIGGER IF EXISTS zz_guard_profiles_primary_platform ON public.profiles;
CREATE TRIGGER zz_guard_profiles_primary_platform
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profiles_primary_platform();

-- 3. billing / promo tables: no browser writes -----------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.subscriptions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.promo_codes FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.promo_code_redemptions FROM anon, authenticated;

COMMIT;
