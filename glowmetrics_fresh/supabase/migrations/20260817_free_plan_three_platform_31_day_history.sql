-- Free plan: raise the server-side platform cap from 1 to 3.
--
-- WHY THIS EXISTS
-- The chat-gpt-conversion branch moved the Free tier to "up to 3 tracked
-- platforms, 31 days of history per platform". Every client-side surface was
-- updated (lib/planLimits.js FREE_MAX_PLATFORMS = 3, the upload route, the
-- dashboard, onboarding copy, pricing copy, the landing page) — but the
-- SERVER-SIDE enforcement was never changed. Both database guards still
-- rejected a second platform:
--
--   check_free_tier_platform_limit()    existing_platform_count >= 1
--   enforce_free_tier_platform_limit()  existing_platform_count >= 1
--
-- So a Free creator would be told "track up to 3 platforms", upload a second
-- one, and be rejected by the trigger with PLATFORM_LIMIT_REACHED. The branch's
-- own scripts/verify-free-plan-limits.mjs already expected this file by name
-- and errored on ENOENT, so that test had never passed.
--
-- The user-facing exception text is corrected in the same pass — it still said
-- "Free tier tracks 1 platform", which would have been shown verbatim to a
-- creator who hit the (now correct) 3-platform ceiling.
--
-- HOW
-- Applied as a targeted patch of the LIVE function definitions rather than a
-- hand-retyped body, so nothing else in either function can drift. Both the
-- cap literal and the message occur exactly once per function; the DO block
-- asserts that before executing and raises rather than guessing.
--
-- NOT DESTRUCTIVE: no data is deleted or altered. This only widens who is
-- allowed to insert. The 31-day history rule is a client-side analytics
-- boundary (lib/planLimits.js), deliberately NOT enforced here — older rows
-- must remain stored and readable so Pro can unlock them without a re-upload.

DO $patch$
DECLARE
  v_def text;
  v_new text;
  v_count int;
  v_proc text;
  v_procs text[] := ARRAY['check_free_tier_platform_limit', 'enforce_free_tier_platform_limit'];
BEGIN
  FOREACH v_proc IN ARRAY v_procs LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_proc;

    IF v_def IS NULL THEN
      RAISE EXCEPTION 'Function %.% not found', 'public', v_proc;
    END IF;

    -- Already migrated (idempotent re-run) — skip without failing.
    IF position('existing_platform_count >= 3' IN v_def) > 0 THEN
      CONTINUE;
    END IF;

    v_count := (length(v_def) - length(replace(v_def, 'existing_platform_count >= 1', '')))
               / length('existing_platform_count >= 1');
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'Expected exactly 1 cap literal in %, found %', v_proc, v_count;
    END IF;

    v_new := replace(v_def, 'existing_platform_count >= 1', 'existing_platform_count >= 3');

    -- Correct the creator-facing copy so it matches the enforced ceiling.
    v_new := replace(v_new,
      'Free tier tracks Live Mode on 1 platform.',
      'Free tier tracks Live Mode on up to 3 platforms.');
    v_new := replace(v_new,
      'Free tier tracks 1 platform.',
      'Free tier tracks up to 3 platforms.');

    EXECUTE v_new;
  END LOOP;
END
$patch$;
