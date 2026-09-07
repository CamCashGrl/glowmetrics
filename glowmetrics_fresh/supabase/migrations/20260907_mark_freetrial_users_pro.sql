-- Mark free trial users as pro (7-day trial)
-- These users signed up for free trial and should be marked as pro immediately
-- Migration date: 2026-09-07
--
-- Users to update:
-- - emmyfox2@proton.me (signed up Sep 5, 2026)
-- - gingerdivine3@gmail.com (signed up Aug 27, 2026)
-- - omgitslilith@proton.me (signed up Aug 25, 2026)
-- - updating1@camcashgrl.com (signed up Aug 21, 2026)
-- - venice.mert@dropoffs.org (signed up Aug 16, 2026)
-- - polefreaktrial@gmail.com (user account)

DO $$
DECLARE
  v_trial_end TIMESTAMPTZ := now() + interval '7 days';
  v_count INTEGER := 0;
BEGIN
  -- Update the 5 free trial users + the test account
  UPDATE public.profiles
  SET
    plan = 'pro',
    plan_expires_at = v_trial_end,
    plan_expiry_notified_at = NULL
  WHERE
    id IN (
      SELECT auth.users.id FROM auth.users
      WHERE email IN (
        'emmyfox2@proton.me',
        'gingerdivine3@gmail.com',
        'omgitslilith@proton.me',
        'updating1@camcashgrl.com',
        'venice.mert@dropoffs.org',
        'polefreaktrial@gmail.com'
      )
    )
    AND plan IS NULL OR plan = 'free';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RAISE NOTICE 'Marked % users as pro with 7-day trial ending at %', v_count, v_trial_end;
END $$;

-- Verify the update by querying the updated users
SELECT
  u.email,
  p.plan,
  p.plan_expires_at,
  age(p.plan_expires_at, now()) as trial_remaining
FROM
  auth.users u
  INNER JOIN public.profiles p ON u.id = p.id
WHERE
  u.email IN (
    'emmyfox2@proton.me',
    'gingerdivine3@gmail.com',
    'omgitslilith@proton.me',
    'updating1@camcashgrl.com',
    'venice.mert@dropoffs.org',
    'polefreaktrial@gmail.com'
  )
ORDER BY u.created_at DESC;
