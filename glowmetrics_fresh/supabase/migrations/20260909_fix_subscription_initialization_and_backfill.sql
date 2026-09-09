-- ═══════════════════════════════════════════════════════════════════════════════
-- CRITICAL FIX: Subscription Initialization and User Backfill
--
-- Issue: New users are not receiving subscription records after signup
-- Root Cause: handle_new_user() function in setup.sql was outdated and missing plan='free'
--
-- This migration:
-- 1. Ensures handle_new_user() is correctly defined with plan='free'
-- 2. Recreates the trigger to guarantee it fires
-- 3. Backfills all users who don't have a subscription record
-- 4. Verifies data integrity
-- ═══════════════════════════════════════════════════════════════════════════════

-- PHASE 1: Fix the handle_new_user() function to ensure it sets plan='free'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, plan, trial_days)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', new.email),
    'free',  -- All new users start on free plan
    7        -- Default trial period (set when user upgrades)
  );
  RETURN new;
EXCEPTION WHEN unique_violation THEN
  -- If profile already exists, just return new
  -- This can happen if function is called multiple times
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PHASE 2: Recreate the trigger to ensure it exists and fires correctly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

-- PHASE 3: Verify trigger function has correct permissions
-- This ensures the function can execute regardless of who calls it
REVOKE ALL PRIVILEGES ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, anon;

-- PHASE 4: Backfill all auth.users who don't have a profile record
-- This fixes the 8+ users who signed up without profiles
INSERT INTO public.profiles (id, display_name, plan, trial_days, created_at)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'display_name', u.email),
  'free',
  7,
  u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
  AND u.deleted_at IS NULL  -- Only active users
  AND u.email_confirmed_at IS NOT NULL  -- Only verified users
ON CONFLICT (id) DO NOTHING;  -- Safety: don't overwrite if somehow duplicate

-- PHASE 5: Verify backfill integrity
-- Log the results
DO $$
DECLARE
  v_backfilled_count INTEGER;
  v_total_auth_users INTEGER;
  v_total_profiles INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_auth_users FROM auth.users WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO v_total_profiles FROM public.profiles;

  RAISE NOTICE '✓ Migration 20260909 Complete';
  RAISE NOTICE '  Auth users (active): %', v_total_auth_users;
  RAISE NOTICE '  Profiles (total): %', v_total_profiles;

  IF v_total_profiles = v_total_auth_users THEN
    RAISE NOTICE '  ✓ All active users have profiles';
  ELSE
    RAISE WARNING '  ⚠ Mismatch: % users without profiles', (v_total_auth_users - v_total_profiles);
  END IF;
END $$;

-- PHASE 6: Ensure all profiles have correct default values
UPDATE public.profiles
SET plan = 'free'
WHERE plan IS NULL;

UPDATE public.profiles
SET trial_days = 7
WHERE trial_days IS NULL;

UPDATE public.profiles
SET subscription_status = 'none'
WHERE subscription_status IS NULL;
