-- CRITICAL FIX: Restore subscription creation on user signup
-- Issue: New users were not getting subscription records, breaking payment gating
-- Root cause: Trigger function only created profiles, not subscriptions
-- Impact: 8 recent signups had no subscriptions; free tier limits could not be enforced

-- Drop and recreate the trigger function to create BOTH profiles AND subscriptions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

CREATE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Create profile record
  INSERT INTO public.profiles (id, display_name, plan, trial_days)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', new.email),
    'free',
    7
  );

  -- CREATE SUBSCRIPTION RECORD (CRITICAL FIX)
  -- This was missing and caused all new signups to lack subscription data
  INSERT INTO public.subscriptions (
    id,
    user_id,
    plan_type,
    billing_cycle,
    is_lifetime_locked,
    current_period_start,
    current_period_end,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    new.id,
    'free',
    NULL,
    false,
    NOW(),
    NOW() + INTERVAL '30 days',
    NOW(),
    NOW()
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Backfill subscription records for users who were created before this fix
INSERT INTO public.subscriptions (
  id,
  user_id,
  plan_type,
  billing_cycle,
  is_lifetime_locked,
  current_period_start,
  current_period_end,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  u.id,
  'free',
  NULL,
  false,
  NOW(),
  NOW() + INTERVAL '30 days',
  NOW(),
  NOW()
FROM auth.users u
WHERE u.id NOT IN (SELECT DISTINCT user_id FROM public.subscriptions WHERE user_id IS NOT NULL)
ON CONFLICT DO NOTHING;
