-- Let signed-in users save their own timezone preference.
--
-- Bug: onboarding (Step 1) and the dashboard timezone picker write
-- profiles.timezone from the browser, but 20261010_lock_profile_entitlements
-- granted browsers no write access to it, so every save failed with 42501 and
-- onboarding showed "We could not save your platforms and timezone".
--
-- timezone is a user-owned display preference, not an entitlement. This grants
-- UPDATE only, on that one column. INSERT is not granted: onboarding now uses a
-- scoped UPDATE, and every profile row is created server-side by
-- handle_new_user. Nothing else changes. plan, subscription/Stripe fields,
-- trial fields, primary_pro_platform and id stay server-only.
--
-- RLS is unchanged: profiles_own_update (auth.uid() = id) still limits the
-- write to the caller's own row.

BEGIN;
SET LOCAL lock_timeout = '10s';

GRANT UPDATE (timezone) ON public.profiles TO authenticated;

COMMIT;
