-- Drop CamSoda from the Free platform-cap supported-platform filter.
--
-- WHY THIS EXISTS
-- 20260817c_free_platform_cap_counts_supported_only.sql narrowed both Free-tier
-- platform guards to count only SUPPORTED platforms, and derived that list from
-- lib/constants.js PLATFORM_TOKEN_RATES. That rate table carries CamSoda — but
-- as an industry token rate quoted by the public Token Calculator and the
-- /guides content, NOT as a platform CamCash can ingest. CamSoda's import path
-- is not shipped, so it is out of the current release scope.
--
-- The application side is fixed by making SUPPORTED_PLATFORMS an explicit list
-- (lib/constants.js) rather than Object.keys(PLATFORM_TOKEN_RATES). This brings
-- the database guards in line so the two cannot disagree about what spends one
-- of a Free creator's three platform slots.
--
-- WHY A NEW FILE RATHER THAN AN EDIT TO 20260817c
-- 20260817c is already applied to production. Editing it would leave the live
-- database on the old filter while a freshly-provisioned one got the new
-- literal — the two would silently diverge. Appending this migration converges
-- both on the same definition.
--
-- HOW
-- Patches the LIVE function definitions via pg_get_functiondef() rather than
-- retyping either body, so no unrelated logic can drift. The filter literal is
-- asserted present before rewriting; a definition that does not contain it is
-- either already migrated (skipped) or unexpected (raises rather than guessing).
--
-- NOT DESTRUCTIVE: no data is read, deleted, or altered. Rows already stored
-- with platform 'camsoda' stay stored and stay analysable — they simply stop
-- occupying a Free platform slot, exactly as 'Unknown' does.

DO $patch$
DECLARE
  v_def text;
  v_new text;
  v_count int;
  v_proc text;
  v_procs text[] := ARRAY['check_free_tier_platform_limit', 'enforce_free_tier_platform_limit'];
  v_old text := $f$('chaturbate','bongacams','myfreecams','stripchat','camsoda')$f$;
  v_new_list text := $f$('chaturbate','bongacams','myfreecams','stripchat')$f$;
BEGIN
  FOREACH v_proc IN ARRAY v_procs LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_proc;

    IF v_def IS NULL THEN
      RAISE EXCEPTION 'Function public.% not found', v_proc;
    END IF;

    -- Already migrated (idempotent re-run) — skip without failing.
    IF position('camsoda' IN lower(v_def)) = 0 THEN
      CONTINUE;
    END IF;

    v_count := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
    IF v_count < 1 THEN
      RAISE EXCEPTION 'Expected the supported-platform filter in %, found none', v_proc;
    END IF;

    v_new := replace(v_def, v_old, v_new_list);

    IF position('camsoda' IN lower(v_new)) > 0 THEN
      RAISE EXCEPTION 'camsoda still present in % after rewrite', v_proc;
    END IF;

    EXECUTE v_new;
  END LOOP;
END
$patch$;
