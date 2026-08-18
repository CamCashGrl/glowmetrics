-- Only SUPPORTED platforms consume a Free platform slot.
--
-- Both guards counted count(DISTINCT platform) across tips/live_tips/
-- paid_sessions with no notion of which platforms are real. The CSV parser
-- writes 'Unknown' for any row whose platform it could not detect, so that
-- bucket was spending one of the creator's three slots on unattributed data
-- — 13 tips out of 7,649 on the owner's account at the time of measurement.
--
-- The supported set mirrors lib/constants.js PLATFORM_TOKEN_RATES, which is
-- the application's canonical list (see also isSupportedPlatform()). Anything
-- outside it (including 'Unknown') is still stored and still analysable; it
-- simply does not occupy a slot.
--
-- Idempotent and non-destructive: this only widens who may insert.
DO $patch$
DECLARE
  v_def text;
  v_new text;
  v_proc text;
  v_procs text[] := ARRAY['check_free_tier_platform_limit', 'enforce_free_tier_platform_limit'];
  v_filter text := $f$ where platform in ('chaturbate','bongacams','myfreecams','stripchat','camsoda')$f$;
BEGIN
  FOREACH v_proc IN ARRAY v_procs LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_proc;

    IF v_def IS NULL THEN
      RAISE EXCEPTION 'Function public.% not found', v_proc;
    END IF;

    IF position('chaturbate' IN lower(v_def)) > 0 THEN
      CONTINUE;  -- already migrated
    END IF;

    IF position(') p;' IN v_def) = 0 THEN
      RAISE EXCEPTION 'Could not locate the platform subquery alias in %', v_proc;
    END IF;

    v_new := replace(v_def, ') p;', ') p' || v_filter || ';');
    EXECUTE v_new;
  END LOOP;
END
$patch$;
