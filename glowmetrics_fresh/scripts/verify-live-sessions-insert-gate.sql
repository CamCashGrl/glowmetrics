-- Behavioural proof that the DATABASE ITSELF refuses the Live Mode bypass.
--
-- verify-live-sessions-insert-gate.mjs pins the SHAPE of the migration from
-- source. This file proves the effect, by impersonating an authenticated
-- PostgREST caller (role `authenticated` + a request.jwt.claims sub) and
-- attempting the exact INSERT a Free creator would send to
-- /rest/v1/live_sessions with nothing but the public anon key.
--
-- HOW TO RUN
--   Supabase SQL editor, or the Supabase MCP execute_sql tool, against the
--   project. Substitute :uid / :other for two accounts you are willing to
--   have written and rolled back — use TEST accounts only.
--
-- SAFETY
--   Everything runs inside one DO block that ends in RAISE EXCEPTION. The
--   raise is not a failure: it is what ABORTS the transaction, so every plan
--   change and every inserted/deleted live_sessions row is rolled back. The
--   accumulated report is carried out in the exception message. Nothing is
--   ever committed. Confirm afterwards that the accounts' plan, plan_expires_at
--   and live_sessions rows are exactly as they were.
--
-- EXPECTED OUTPUT (recorded 2026-08-21 against the production project, using
-- two of the project's existing test accounts):
--
--   1. free                     -> INSERT REJECTED [P0001] LIVE_MODE_REQUIRES_PRO...
--   2. plan = NULL              -> INSERT REJECTED [P0001] LIVE_MODE_REQUIRES_PRO...
--   3. pro, EXPIRED             -> INSERT REJECTED [P0001] LIVE_MODE_REQUIRES_PRO...
--   4. pro, active              -> INSERT ALLOWED
--   5. pro, active TRIAL        -> INSERT ALLOWED
--   6. unlimited                -> INSERT ALLOWED
--   7. free WITH open session   -> INSERT ALLOWED      (reconnect exemption)
--      UPDATE as free           -> 2 row(s)            (UPDATE not blocked)
--      DELETE as free           -> 2 row(s)            (DELETE not blocked)
--   8. INSERT for other user    -> INSERT REJECTED [42501] row-level security
--
-- Line 8 matters as much as line 1: the trigger must NOT be what refuses a
-- row belonging to someone else. That stays the RLS policy's job, so the
-- trigger never reads a plan for a client-supplied id and cannot be used as
-- an oracle for whether another creator is Pro.

DO $t$
DECLARE
  v_uid   uuid := :'uid';    -- a TEST account
  v_other uuid := :'other';  -- a second TEST account, never written to
  v_admin text := current_user;
  v_log   text := E'\n=== DIRECT live_sessions INSERT ENTITLEMENT (all rolled back) ===\n';
  v_res   text;
  v_n     int;
BEGIN
  EXECUTE $f$create function pg_temp.try_ins(p_uid uuid) returns text language plpgsql as $b$
    begin
      insert into public.live_sessions(user_id, status) values (p_uid, 'starting');
      return 'INSERT ALLOWED';
    exception when others then
      return 'INSERT REJECTED [' || SQLSTATE || '] ' || left(SQLERRM, 80);
    end $b$;$f$;

  -- 1-6: every plan shape, attempted as the authenticated user with no
  -- unresolved session, i.e. the real bypass a Free creator would try.
  FOR v_n IN 1..6 LOOP
    EXECUTE format('set local role %I', v_admin);
    PERFORM set_config('request.jwt.claims', '', true);
    UPDATE profiles SET plan = CASE v_n
        WHEN 1 THEN 'free' WHEN 2 THEN null WHEN 3 THEN 'pro'
        WHEN 4 THEN 'pro'  WHEN 5 THEN 'pro' WHEN 6 THEN 'unlimited' END,
      plan_expires_at = CASE v_n
        WHEN 3 THEN now() - interval '1 day'
        WHEN 5 THEN now() + interval '7 days'
        ELSE null END
      WHERE id = v_uid;
    DELETE FROM live_sessions WHERE user_id = v_uid;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
    EXECUTE 'set local role authenticated';
    v_res := pg_temp.try_ins(v_uid);
    EXECUTE format('set local role %I', v_admin);
    PERFORM set_config('request.jwt.claims', '', true);

    v_log := v_log || format('%s. %-24s -> %s%s', v_n,
      CASE v_n WHEN 1 THEN 'free' WHEN 2 THEN 'plan = NULL' WHEN 3 THEN 'pro, EXPIRED'
               WHEN 4 THEN 'pro, active' WHEN 5 THEN 'pro, active TRIAL' WHEN 6 THEN 'unlimited' END,
      v_res, E'\n');
  END LOOP;

  -- 7: the reconnect exemption. A creator who downgraded mid-stream must
  -- still be able to reach, update and end the session already running.
  UPDATE profiles SET plan = 'free', plan_expires_at = null WHERE id = v_uid;
  DELETE FROM live_sessions WHERE user_id = v_uid;
  INSERT INTO live_sessions(user_id, status) VALUES (v_uid, 'live');

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  EXECUTE 'set local role authenticated';
  v_res := pg_temp.try_ins(v_uid);
  v_log := v_log || format('7. %-24s -> %s%s', 'free WITH open session', v_res, E'\n');
  UPDATE live_sessions SET total_tokens = 5 WHERE user_id = v_uid;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_log := v_log || format('   %-24s -> %s row(s)%s', 'UPDATE as free', v_n, E'\n');
  DELETE FROM live_sessions WHERE user_id = v_uid;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_log := v_log || format('   %-24s -> %s row(s)%s', 'DELETE as free', v_n, E'\n');

  -- 8: somebody else's row stays the RLS policy's refusal, not the trigger's.
  v_res := pg_temp.try_ins(v_other);
  v_log := v_log || format('8. %-24s -> %s%s', 'INSERT for other user', v_res, E'\n');

  EXECUTE format('set local role %I', v_admin);
  PERFORM set_config('request.jwt.claims', '', true);

  -- Carries the report out AND rolls the whole transaction back.
  RAISE EXCEPTION '%', v_log;
END $t$;
