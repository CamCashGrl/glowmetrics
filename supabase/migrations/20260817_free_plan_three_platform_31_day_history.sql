-- SUPERSEDED — DO NOT APPLY. This file is intentionally inert.
--
-- Its original contents (commit d670c381, "Add platform limit enforcement for
-- free-tier users") are preserved in git history:
--
--   git show d670c381:supabase/migrations/20260817_free_plan_three_platform_31_day_history.sql
--
-- WHY IT WAS NEUTRALISED
-- This file lived at the REPO ROOT, while the application and every other
-- migration live under glowmetrics_fresh/. A same-named file exists there:
--
--   glowmetrics_fresh/supabase/migrations/20260817_free_plan_three_platform_31_day_history.sql
--
-- The two are not variants of each other. This one redefined BOTH free-tier
-- platform guards from scratch, and applying it today would silently revert
-- three separate fixes that are live in production:
--
--   1. 'Unknown' would consume a Free platform slot again.
--      Its counting subquery ends at a bare `) p;` with no
--      `where platform in (...)` filter, so the CSV parser's
--      undetected-platform bucket counts as a tracked platform.
--      (Reverts 20260817c.)
--
--   2. CamSoda would consume a Free platform slot again.
--      Same missing filter. (Reverts 20260818.)
--
--   3. check_free_tier_platform_limit would lose its self-restriction.
--      THIS IS THE SERIOUS ONE. That function is SECURITY DEFINER. The live
--      definition opens with:
--
--        if p_user_id is distinct from auth.uid() then return; end if;
--
--      added by 20260806b_restrict_check_free_tier_platform_limit_to_self.
--      The version in this file has no such guard — it goes straight to the
--      null check on p_platform. Without the guard, any authenticated caller
--      can pass an arbitrary p_user_id and learn from whether the call raises
--      whether that user is at the platform cap: a cross-account oracle over
--      someone else's data. (Reverts 20260806b.)
--
-- Verified against production before writing this: check_free_tier_platform_limit
-- currently HAS the auth.uid() self-restriction and BOTH functions HAVE the
-- supported-platform filter. This file would take all of that away.
--
-- The root-level supabase/ directory is vestigial — it has no config.toml, no
-- CI wiring, and nothing in the repo references it. The live migration path is
-- glowmetrics_fresh/supabase/migrations/. Deleting this file outright would
-- leave nothing to explain why it vanished, so it is kept and made to fail
-- loudly instead: anyone who runs it gets a message rather than a silent
-- production regression.
--
-- If the Free-tier platform guards need to change, add a new migration under
-- glowmetrics_fresh/supabase/migrations/ that patches the LIVE definitions via
-- pg_get_functiondef(), the way 20260817, 20260817b, 20260817c and 20260818 do.
-- Do not retype either function body.

DO $superseded$
BEGIN
  RAISE EXCEPTION USING
    errcode = 'P0001',
    message = 'SUPERSEDED MIGRATION — not applied.',
    detail  = 'supabase/migrations/20260817_free_plan_three_platform_31_day_history.sql '
              || 'would revert three live fixes: the Unknown-platform slot exclusion '
              || '(20260817c), the CamSoda slot exclusion (20260818), and the auth.uid() '
              || 'self-restriction on check_free_tier_platform_limit (20260806b).',
    hint    = 'The live migration path is glowmetrics_fresh/supabase/migrations/. '
              || 'See the comment block at the top of this file.';
END
$superseded$;
