-- After migration A (20261029c). Every write attempt runs inside a
-- transaction that is rolled back.

-- 1. Catalog: the exact grants the migration promises.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT t, p
    FROM unnest(ARRAY['public.tips', 'public.live_tips', 'public.coaching_events']) t,
         unnest(ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p
  LOOP
    PERFORM t.ok(NOT has_table_privilege('anon', r.t, r.p), format('A: anon has no %s on %s', r.p, r.t));
    PERFORM t.ok(has_table_privilege('authenticated', r.t, r.p), format('A: authenticated keeps %s on %s', r.p, r.t));
    PERFORM t.ok(has_table_privilege('service_role', r.t, r.p), format('A: service_role keeps %s on %s', r.p, r.t));
  END LOOP;
  -- Out of scope for A, deliberately unchanged (#711 follow-ups).
  PERFORM t.ok(has_table_privilege('anon', 'public.tips', 'SELECT'), 'A: anon SELECT on tips left unchanged (out of scope)');
  PERFORM t.ok(has_table_privilege('anon', 'public.tips', 'REFERENCES'), 'A: anon REFERENCES on tips left unchanged (follow-up)');
  PERFORM t.ok(has_table_privilege('anon', 'public.tips', 'TRIGGER'), 'A: anon TRIGGER on tips left unchanged (follow-up)');
  PERFORM t.ok(has_table_privilege('anon', 'public.paid_sessions', 'TRUNCATE'), 'A: paid_sessions not touched (follow-up in #711)');
END $$;

-- 2. Real denial attempts as anon (local mirror only).
BEGIN;
SET LOCAL ROLE anon;
DO $$
DECLARE
  tbl text;
  stmt text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['tips', 'live_tips', 'coaching_events'] LOOP
    FOREACH stmt IN ARRAY ARRAY[
      format('TRUNCATE public.%I', tbl),
      format('DELETE FROM public.%I WHERE false', tbl),
      format('UPDATE public.%I SET user_id = user_id WHERE false', tbl),
      CASE tbl
        WHEN 'tips' THEN $q$INSERT INTO public.tips (user_id, date_time, platform, username, tokens, usd) VALUES ('00000000-0000-0000-0000-0000000000a1', now(), 'Chaturbate', 'x', 1, 0.05)$q$
        WHEN 'live_tips' THEN $q$INSERT INTO public.live_tips (user_id, username, tokens, usd) VALUES ('00000000-0000-0000-0000-0000000000a1', 'x', 1, 0.05)$q$
        ELSE $q$INSERT INTO public.coaching_events (session_id, user_id, type, category, dedupe_key, title, message, compact_message) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', 'x', 'retention', 'k', 't', 'm', 'c')$q$
      END
    ] LOOP
      BEGIN
        EXECUTE stmt;
        RAISE EXCEPTION 'FAIL: anon was allowed: %', stmt;
      EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'PASS: anon denied: %', split_part(stmt, ' WHERE', 1);
      END;
    END LOOP;
  END LOOP;
END $$;
ROLLBACK;

-- 3. Signed-in creators keep their existing behavior (own rows only).
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
INSERT INTO public.tips (user_id, date_time, platform, username, tokens, usd)
  VALUES ('00000000-0000-0000-0000-0000000000a1', now(), 'Chaturbate', 'auth_ok', 2, 0.10);
SELECT t.ok((SELECT count(*) FROM public.tips WHERE username = 'auth_ok') = 1, 'A: authenticated creator can still insert own tip');
DELETE FROM public.tips WHERE username = 'auth_ok';
SELECT t.ok((SELECT count(*) FROM public.tips WHERE username = 'auth_ok') = 0, 'A: authenticated creator can still delete own tip');
SELECT t.ok((SELECT count(*) FROM public.tips WHERE user_id = '00000000-0000-0000-0000-0000000000b1') = 0, 'A: creator A cannot see creator B tips (RLS)');
DO $$
BEGIN
  INSERT INTO public.tips (user_id, date_time, platform, username, tokens, usd)
    VALUES ('00000000-0000-0000-0000-0000000000b1', now(), 'Chaturbate', 'cross', 1, 0.05);
  RAISE EXCEPTION 'FAIL: creator A inserted a tip for creator B';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: A: creator A cannot insert a tip for creator B (RLS)';
END $$;
ROLLBACK;

-- 4. Server ingestion path (service role -> persist_extension_tip) still works.
BEGIN;
SET LOCAL ROLE service_role;
SELECT t.ok((public.persist_extension_tip(
  '00000000-0000-0000-0000-0000000000a1', gen_random_uuid(), NULL, 'svc_ok', 4, 0.20, 'chaturbate', now(), NULL
) ->> 'success')::boolean, 'A: service_role persist_extension_tip still succeeds');
ROLLBACK;

SELECT t.assert_history_unchanged('after A');
