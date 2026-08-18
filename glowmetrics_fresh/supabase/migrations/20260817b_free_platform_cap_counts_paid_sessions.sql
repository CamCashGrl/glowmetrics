-- Count paid_sessions when enforcing the Free platform cap.
--
-- Both guards counted DISTINCT platform across tips UNION live_tips only.
-- paid_sessions (BongaCams Private / Full-Private / Group / Spy imports) has
-- its own user_id + platform columns and was invisible to the cap, so a
-- platform present ONLY in paid_sessions did not count toward the 3-platform
-- ceiling — the cap could be under-counted and silently exceeded.
--
-- Counting only. No blocking trigger is added to paid_sessions itself; this
-- makes the existing ceiling accurate rather than introducing a new rejection
-- path on a table that never had one. Idempotent and non-destructive.
DO $patch$
DECLARE
  v_def text;
  v_new text;
  v_proc text;
  v_procs text[] := ARRAY['check_free_tier_platform_limit', 'enforce_free_tier_platform_limit'];
  v_needle_p text := 'select lower(platform) as platform from live_tips where user_id = p_user_id';
  v_needle_n text := 'SELECT lower(platform) AS platform FROM live_tips WHERE user_id = new.user_id';
BEGIN
  FOREACH v_proc IN ARRAY v_procs LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_proc;

    IF v_def IS NULL THEN
      RAISE EXCEPTION 'Function public.% not found', v_proc;
    END IF;

    IF position('paid_sessions' IN v_def) > 0 THEN
      CONTINUE;  -- already migrated
    END IF;

    v_new := v_def;

    IF position(v_needle_p IN v_new) > 0 THEN
      v_new := replace(v_new, v_needle_p,
        v_needle_p || E'\n    union\n    select lower(platform) as platform from paid_sessions where user_id = p_user_id');
    ELSIF position(v_needle_n IN v_new) > 0 THEN
      v_new := replace(v_new, v_needle_n,
        v_needle_n || E'\n    UNION\n    SELECT lower(platform) AS platform FROM paid_sessions WHERE user_id = new.user_id');
    ELSE
      RAISE EXCEPTION 'Could not locate the live_tips UNION arm in %', v_proc;
    END IF;

    EXECUTE v_new;
  END LOOP;
END
$patch$;
