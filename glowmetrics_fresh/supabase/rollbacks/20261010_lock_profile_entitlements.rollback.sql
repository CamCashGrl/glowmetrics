-- Rollback for 20261010_lock_profile_entitlements.sql.
-- Restores the previous (vulnerable) grants exactly as they were in
-- production on 2026-10-08: table-wide ALL to anon/authenticated on
-- profiles, subscriptions, promo_codes and promo_code_redemptions; removes the
-- primary-platform guard. Only use if the fix breaks something critical.

BEGIN;

DROP TRIGGER IF EXISTS zz_guard_profiles_primary_platform ON public.profiles;
DROP FUNCTION IF EXISTS public.guard_profiles_primary_platform();

GRANT ALL ON public.profiles TO anon, authenticated;
GRANT ALL ON public.subscriptions TO anon, authenticated;
GRANT ALL ON public.promo_codes TO anon, authenticated;
GRANT ALL ON public.promo_code_redemptions TO anon, authenticated;

COMMIT;
