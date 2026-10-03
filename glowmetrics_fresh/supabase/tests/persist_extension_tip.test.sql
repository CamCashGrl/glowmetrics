-- Real-database tests for persist_extension_tip (run by scripts/test-persist-extension-tip.sh).
-- Each case raises on failure; the script stops at the first error.
\set ON_ERROR_STOP on
SET client_min_messages = warning;

CREATE OR REPLACE FUNCTION pg_temp.eq(actual anyelement, expected anyelement, label text) RETURNS void AS $$
BEGIN
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'FAIL %: expected %, got %', label, expected, actual;
  END IF;
  RAISE NOTICE 'PASS %', label;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pg_temp.persist(u uuid, ev uuid, dk text, name text, tok int, usd numeric, plat text, at timestamptz, qms bigint DEFAULT NULL)
RETURNS jsonb AS $$
  SELECT public.persist_extension_tip(u, ev, dk, name, tok, usd, plat, at, qms);
$$ LANGUAGE sql;

SET client_min_messages = notice;

-- Users: free with an active session, pro, free near platform limit.
INSERT INTO profiles VALUES
  ('00000000-0000-0000-0000-00000000f001', 'free', NULL),
  ('00000000-0000-0000-0000-00000000f002', 'pro', NULL),
  ('00000000-0000-0000-0000-00000000f003', 'free', NULL),
  ('00000000-0000-0000-0000-00000000f004', 'free', NULL);
INSERT INTO live_sessions (id, user_id, status, started_at) VALUES
  ('00000000-0000-0000-0000-0000000005e1', '00000000-0000-0000-0000-00000000f001', 'active', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-0000000005e4', '00000000-0000-0000-0000-00000000f004', 'paused', now() - interval '1 hour');

DO $$
DECLARE
  free_u uuid := '00000000-0000-0000-0000-00000000f001';
  pro_u  uuid := '00000000-0000-0000-0000-00000000f002';
  lim_u  uuid := '00000000-0000-0000-0000-00000000f003';
  pau_u  uuid := '00000000-0000-0000-0000-00000000f004';
  t0 timestamptz := '2026-10-03 20:00:00.123+00';
  r jsonb; r2 jsonb;
BEGIN
  -- 1. New-extension event persists once to live_tips AND canonical tips, attributed to active session.
  r := pg_temp.persist(free_u, 'aaaaaaaa-0000-4000-8000-000000000001', NULL, 'Fan1', 100, 5.00, 'chaturbate', t0);
  PERFORM pg_temp.eq((r->>'duplicate')::bool, false, '1a new event not duplicate');
  PERFORM pg_temp.eq((SELECT count(*) FROM live_tips WHERE client_event_id = 'aaaaaaaa-0000-4000-8000-000000000001'), 1::bigint, '1b one live row');
  PERFORM pg_temp.eq((SELECT count(*) FROM tips WHERE client_event_id = 'aaaaaaaa-0000-4000-8000-000000000001'), 1::bigint, '1c one canonical row');
  PERFORM pg_temp.eq((r->>'live_session_id')::uuid, '00000000-0000-0000-0000-0000000005e1'::uuid, '1d attributed to active session');
  PERFORM pg_temp.eq((SELECT date_time FROM tips WHERE client_event_id = 'aaaaaaaa-0000-4000-8000-000000000001'), t0, '1e canonical keeps original event time');

  -- 2. Exact retry of the new event: no new rows, same ids returned.
  r2 := pg_temp.persist(free_u, 'aaaaaaaa-0000-4000-8000-000000000001', NULL, 'Fan1', 100, 5.00, 'chaturbate', t0 + interval '5 minutes');
  PERFORM pg_temp.eq((r2->>'duplicate')::bool, true, '2a retry flagged duplicate');
  PERFORM pg_temp.eq(r2->>'live_tip_id', r->>'live_tip_id', '2b retry returns same live_tip_id');
  PERFORM pg_temp.eq(r2->>'tip_id', r->>'tip_id', '2c retry returns same canonical tip id');
  PERFORM pg_temp.eq((SELECT count(*) FROM tips WHERE user_id = free_u), 1::bigint, '2d still one canonical row');

  -- 3. Legacy payload (no client_event_id): derived id + legacy key persists; exact retry persists once.
  r := pg_temp.persist(free_u, 'bbbbbbbb-0000-5000-8000-000000000001', 'k-legacy-1', 'Fan2', 50, 2.50, 'chaturbate', t0 + interval '1 second');
  PERFORM pg_temp.eq((r->>'duplicate')::bool, false, '3a legacy accepted');
  r2 := pg_temp.persist(free_u, 'bbbbbbbb-0000-5000-8000-000000000001', 'k-legacy-1', 'Fan2', 50, 2.50, 'chaturbate', t0 + interval '1 second');
  PERFORM pg_temp.eq((r2->>'duplicate')::bool, true, '3b legacy retry is duplicate');
  PERFORM pg_temp.eq((SELECT count(*) FROM live_tips WHERE deduplication_key = 'k-legacy-1'), 1::bigint, '3c legacy one live row');
  PERFORM pg_temp.eq((SELECT count(*) FROM tips WHERE client_event_id = 'bbbbbbbb-0000-5000-8000-000000000001'), 1::bigint, '3d legacy one canonical row');

  -- 4. Legacy retry of a tip the PRE-Phase-1 route already saved (row has deduplication_key, no client_event_id).
  INSERT INTO live_tips (user_id, username, tokens, usd, platform, source, received_at, deduplication_key)
  VALUES (free_u, 'Fan3', 20, 1.00, 'chaturbate', 'extension', t0 + interval '2 seconds', 'k-pre-deploy');
  r := pg_temp.persist(free_u, 'bbbbbbbb-0000-5000-8000-000000000002', 'k-pre-deploy', 'Fan3', 20, 1.00, 'chaturbate', t0 + interval '2 seconds');
  PERFORM pg_temp.eq((r->>'duplicate')::bool, true, '4a pre-deploy legacy retry is duplicate');
  PERFORM pg_temp.eq((SELECT count(*) FROM live_tips WHERE username = 'Fan3'), 1::bigint, '4b no second live row');
  PERFORM pg_temp.eq((SELECT count(*) FROM tips WHERE username = 'Fan3'), 0::bigint, '4c no late canonical row for already-processed tip');

  -- 5. Two legitimate identical legacy tips with different event timestamps both count.
  PERFORM pg_temp.persist(free_u, 'bbbbbbbb-0000-5000-8000-000000000003', 'k-same-a', 'Fan4', 25, 1.25, 'chaturbate', t0 + interval '10 seconds');
  PERFORM pg_temp.persist(free_u, 'bbbbbbbb-0000-5000-8000-000000000004', 'k-same-b', 'Fan4', 25, 1.25, 'chaturbate', t0 + interval '10.5 seconds');
  PERFORM pg_temp.eq((SELECT count(*) FROM live_tips WHERE username = 'Fan4'), 2::bigint, '5a two live rows');
  PERFORM pg_temp.eq((SELECT count(*) FROM tips WHERE username = 'Fan4'), 2::bigint, '5b two canonical rows');

  -- 6. Two distinct new events, identical fan/amount at the identical millisecond: both count (tip_seq 1, 2).
  PERFORM pg_temp.persist(free_u, 'aaaaaaaa-0000-4000-8000-000000000006', NULL, 'Fan5', 10, 0.50, 'chaturbate', t0 + interval '20 seconds');
  PERFORM pg_temp.persist(free_u, 'aaaaaaaa-0000-4000-8000-000000000007', NULL, 'Fan5', 10, 0.50, 'chaturbate', t0 + interval '20 seconds');
  PERFORM pg_temp.eq((SELECT count(*) FROM tips WHERE username = 'Fan5'), 2::bigint, '6a same-ms distinct events both in canonical');
  PERFORM pg_temp.eq((SELECT array_agg(tip_seq ORDER BY tip_seq) FROM tips WHERE username = 'Fan5'), ARRAY[1,2], '6b tip_seq 1 and 2');

  -- 7. Pro user: existing mirror trigger must NOT create a second canonical row.
  PERFORM pg_temp.persist(pro_u, 'aaaaaaaa-0000-4000-8000-000000000010', NULL, 'Whale', 400, 20.00, 'chaturbate', t0);
  PERFORM pg_temp.eq((SELECT count(*) FROM tips WHERE user_id = pro_u), 1::bigint, '7a pro: exactly one canonical row');
  PERFORM pg_temp.eq((SELECT count(*) FROM live_tips WHERE user_id = pro_u), 1::bigint, '7b pro: one live row');
  PERFORM pg_temp.persist(pro_u, 'aaaaaaaa-0000-4000-8000-000000000011', NULL, 'Whale', 400, 20.00, 'chaturbate', t0 + interval '1 second');
  PERFORM pg_temp.eq((SELECT count(*) FROM tips WHERE user_id = pro_u), 2::bigint, '7c pro: second identical tip 1s later counts once');
  PERFORM pg_temp.persist(pro_u, 'aaaaaaaa-0000-4000-8000-000000000011', NULL, 'Whale', 400, 20.00, 'chaturbate', t0 + interval '1 second');
  PERFORM pg_temp.eq((SELECT count(*) FROM tips WHERE user_id = pro_u), 2::bigint, '7d pro: retry adds nothing');

  -- 8. Paused session is not credited (matches pre-Phase-1 rule); tip is still saved.
  r := pg_temp.persist(pau_u, 'aaaaaaaa-0000-4000-8000-000000000020', NULL, 'Fan6', 10, 0.50, 'chaturbate', t0);
  PERFORM pg_temp.eq(r->>'live_session_id', NULL::text, '8a paused session not attributed');
  PERFORM pg_temp.eq((SELECT count(*) FROM tips WHERE user_id = pau_u), 1::bigint, '8b tip still saved');

  -- 9. Validation.
  BEGIN
    PERFORM pg_temp.persist(free_u, NULL, NULL, 'X', 10, 0.5, 'chaturbate', t0);
    RAISE EXCEPTION 'FAIL 9a: null client_event_id accepted';
  EXCEPTION WHEN SQLSTATE '22004' THEN RAISE NOTICE 'PASS 9a null client_event_id rejected'; END;
  BEGIN
    PERFORM pg_temp.persist(free_u, gen_random_uuid(), NULL, 'X', 0, 0, 'chaturbate', t0);
    RAISE EXCEPTION 'FAIL 9b: zero tokens accepted';
  EXCEPTION WHEN SQLSTATE '22003' THEN RAISE NOTICE 'PASS 9b zero tokens rejected'; END;
END $$;

-- 10. Atomicity: free-tier platform limit on the live insert must roll back the canonical insert too.
DO $$
DECLARE lim_u uuid := '00000000-0000-0000-0000-00000000f003';
BEGIN
  PERFORM pg_temp.persist(lim_u, gen_random_uuid(), NULL, 'A', 10, 0.5, 'chaturbate', now());
  PERFORM pg_temp.persist(lim_u, gen_random_uuid(), NULL, 'A', 10, 0.25, 'bongacams', now());
  PERFORM pg_temp.persist(lim_u, gen_random_uuid(), NULL, 'A', 10, 0.5, 'stripchat', now());
  BEGIN
    PERFORM pg_temp.persist(lim_u, gen_random_uuid(), NULL, 'A', 10, 0.5, 'camsoda', now());
    RAISE EXCEPTION 'FAIL 10a: 4th platform accepted for free user';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM NOT LIKE 'PLATFORM_LIMIT_REACHED%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS 10a platform limit enforced';
  END;
  PERFORM pg_temp.eq((SELECT count(*) FROM tips WHERE user_id = lim_u AND platform = 'camsoda'), 0::bigint, '10b no orphan canonical row');
  PERFORM pg_temp.eq((SELECT count(*) FROM live_tips WHERE user_id = lim_u AND platform = 'camsoda'), 0::bigint, '10c no orphan live row');
END $$;

-- 11. Controlled test: Alice $5, Bob $10, Alice $20 (Chaturbate 0.05/token).
DO $$
DECLARE u uuid := gen_random_uuid(); t timestamptz := '2026-10-03 21:00:00+00';
BEGIN
  INSERT INTO profiles VALUES (u, 'free', NULL);
  PERFORM pg_temp.persist(u, gen_random_uuid(), NULL, 'Alice', 100, 5.00,  'chaturbate', t);
  PERFORM pg_temp.persist(u, gen_random_uuid(), NULL, 'Bob',   200, 10.00, 'chaturbate', t + interval '1 minute');
  PERFORM pg_temp.persist(u, gen_random_uuid(), NULL, 'Alice', 400, 20.00, 'chaturbate', t + interval '2 minutes');
  PERFORM pg_temp.eq((SELECT sum(usd) FROM tips WHERE user_id = u), 35.00::numeric, '11a canonical total $35');
  PERFORM pg_temp.eq((SELECT sum(usd) FROM live_tips WHERE user_id = u), 35.00::numeric, '11b live total $35');
  PERFORM pg_temp.eq((SELECT count(*) FROM tips WHERE user_id = u), 3::bigint, '11c three tips');
END $$;

-- 12. Permissions: end users can never call it directly.
DO $$
BEGIN
  PERFORM pg_temp.eq(has_function_privilege('authenticated', 'public.persist_extension_tip(uuid,uuid,text,text,integer,numeric,text,timestamptz,bigint)', 'EXECUTE'), false, '12a authenticated cannot execute');
  PERFORM pg_temp.eq(has_function_privilege('anon', 'public.persist_extension_tip(uuid,uuid,text,text,integer,numeric,text,timestamptz,bigint)', 'EXECUTE'), false, '12b anon cannot execute');
  PERFORM pg_temp.eq(has_function_privilege('service_role', 'public.persist_extension_tip(uuid,uuid,text,text,integer,numeric,text,timestamptz,bigint)', 'EXECUTE'), true, '12c service_role can execute');
END $$;

-- 13. The same clientEventId sent 10 times in a row: exactly 1 live + 1 canonical row.
DO $$
DECLARE u uuid := gen_random_uuid(); ev uuid := gen_random_uuid(); i int;
BEGIN
  INSERT INTO profiles VALUES (u, 'free', NULL);
  FOR i IN 1..10 LOOP
    PERFORM pg_temp.persist(u, ev, NULL, 'Retry', 100, 5.00, 'chaturbate', '2026-10-03 23:00:00.5+00', (i * 1000)::bigint);
  END LOOP;
  PERFORM pg_temp.eq((SELECT count(*) FROM live_tips WHERE user_id = u), 1::bigint, '13a 10 sends -> 1 live row');
  PERFORM pg_temp.eq((SELECT count(*) FROM tips WHERE user_id = u), 1::bigint, '13b 10 sends -> 1 canonical row');
  PERFORM pg_temp.eq((SELECT date_time FROM tips WHERE user_id = u), '2026-10-03 23:00:00.5+00'::timestamptz, '13c retries keep the original detection time');
END $$;

-- 14. A tip delayed in the extension queue is never credited to a session that started after it happened.
DO $$
DECLARE u uuid := gen_random_uuid(); s uuid := gen_random_uuid(); r jsonb;
BEGIN
  INSERT INTO profiles VALUES (u, 'free', NULL);
  INSERT INTO live_sessions (id, user_id, status, started_at) VALUES (s, u, 'active', now() - interval '10 minutes');
  r := pg_temp.persist(u, gen_random_uuid(), NULL, 'Late', 10, 0.50, 'chaturbate', now() - interval '20 minutes', 20 * 60 * 1000);
  PERFORM pg_temp.eq(r->>'live_session_id', NULL::text, '14a tip queued 20 min (before a 10-min-old session) not credited to it');
  PERFORM pg_temp.eq((SELECT count(*) FROM tips WHERE user_id = u AND username = 'Late'), 1::bigint, '14b late tip still saved to history');
  r := pg_temp.persist(u, gen_random_uuid(), NULL, 'Recent', 10, 0.50, 'chaturbate', now() - interval '1 minute', 60 * 1000);
  PERFORM pg_temp.eq((r->>'live_session_id')::uuid, s, '14c tip queued 1 min (inside the session) is credited');
  r := pg_temp.persist(u, gen_random_uuid(), NULL, 'Now', 10, 0.50, 'chaturbate', now(), 0);
  PERFORM pg_temp.eq((r->>'live_session_id')::uuid, s, '14d immediate tip is credited');
  r := pg_temp.persist(u, gen_random_uuid(), 'k-legacy-attr', 'Old', 10, 0.50, 'chaturbate', now());
  PERFORM pg_temp.eq((r->>'live_session_id')::uuid, s, '14e legacy (no queued_ms) keeps the original rule');
  BEGIN
    PERFORM pg_temp.persist(u, gen_random_uuid(), NULL, 'Neg', 10, 0.50, 'chaturbate', now(), -1);
    RAISE EXCEPTION 'FAIL 14f: negative queued_ms accepted';
  EXCEPTION WHEN SQLSTATE '22003' THEN RAISE NOTICE 'PASS 14f negative queued_ms rejected'; END;
END $$;

-- 15. Requested scenario: Alice $5, Bob $10, Bob $10 again (separate real tip), Alice $20,
--     with an exact network retry of Bob's first tip and of Alice's last tip.
DO $$
DECLARE u uuid := gen_random_uuid(); s uuid := gen_random_uuid(); t timestamptz := now() - interval '3 minutes';
  e1 uuid := gen_random_uuid(); e2 uuid := gen_random_uuid(); e3 uuid := gen_random_uuid(); e4 uuid := gen_random_uuid();
BEGIN
  INSERT INTO profiles VALUES (u, 'free', NULL);
  INSERT INTO live_sessions (id, user_id, status, started_at) VALUES (s, u, 'active', now() - interval '10 minutes');
  PERFORM pg_temp.persist(u, e1, NULL, 'Alice', 100, 5.00,  'chaturbate', t, 0);
  PERFORM pg_temp.persist(u, e2, NULL, 'Bob',   200, 10.00, 'chaturbate', t + interval '30 seconds', 0);
  PERFORM pg_temp.persist(u, e2, NULL, 'Bob',   200, 10.00, 'chaturbate', t + interval '30 seconds', 5000);
  PERFORM pg_temp.persist(u, e3, NULL, 'Bob',   200, 10.00, 'chaturbate', t + interval '31 seconds', 0);
  PERFORM pg_temp.persist(u, e4, NULL, 'Alice', 400, 20.00, 'chaturbate', t + interval '60 seconds', 0);
  PERFORM pg_temp.persist(u, e4, NULL, 'Alice', 400, 20.00, 'chaturbate', t + interval '60 seconds', 2000);
  PERFORM pg_temp.eq((SELECT count(*) FROM tips WHERE user_id = u), 4::bigint, '15a 4 real tip events');
  PERFORM pg_temp.eq((SELECT sum(usd) FROM tips WHERE user_id = u), 45.00::numeric, '15b total $45');
  PERFORM pg_temp.eq((SELECT sum(usd) FROM tips WHERE user_id = u AND username = 'Alice'), 25.00::numeric, '15c Alice $25');
  PERFORM pg_temp.eq((SELECT sum(usd) FROM tips WHERE user_id = u AND username = 'Bob'), 20.00::numeric, '15d Bob $20 (both identical tips)');
  PERFORM pg_temp.eq((SELECT sum(usd) FROM live_tips WHERE user_id = u AND live_session_id = s), 45.00::numeric, '15e live session total $45');
END $$;

SELECT 'ALL PERSIST_EXTENSION_TIP SQL TESTS PASSED' AS result;
