-- AFTER 20261101_harden_dedup_rpc_grants.sql. Each scenario rolls back.
\set A '00000000-0000-0000-0000-00000000000a'
\set B '00000000-0000-0000-0000-00000000000b'

-- ── Grants ──────────────────────────────────────────────────────────────
SELECT t.ok(NOT has_function_privilege('anon', 'public.insert_paid_sessions_dedup(jsonb)', 'EXECUTE')
        AND NOT has_function_privilege('anon', 'public.insert_tips_dedup(jsonb, uuid)', 'EXECUTE'),
            'grants: anon has no EXECUTE on either import RPC');
SELECT t.ok(has_function_privilege('authenticated', 'public.insert_paid_sessions_dedup(jsonb)', 'EXECUTE')
        AND has_function_privilege('authenticated', 'public.insert_tips_dedup(jsonb, uuid)', 'EXECUTE')
        AND has_function_privilege('service_role', 'public.insert_paid_sessions_dedup(jsonb)', 'EXECUTE')
        AND has_function_privilege('service_role', 'public.insert_tips_dedup(jsonb, uuid)', 'EXECUTE'),
            'grants: authenticated and service_role keep EXECUTE');

-- ── Anonymous access ────────────────────────────────────────────────────
SELECT t.ok(t.sqlstate_as('anon', NULL,
  $q$SELECT public.insert_paid_sessions_dedup('[{"user_id":"00000000-0000-0000-0000-00000000000b","date_time":"2026-05-01T00:00:00Z","platform":"Chaturbate","username":"intruder","session_type":"Private Chat","tokens":500,"usd":25}]'::jsonb)$q$) = '42501',
  'anon: insert_paid_sessions_dedup is permission-denied');
SELECT t.ok(t.sqlstate_as('anon', NULL,
  $q$SELECT public.insert_tips_dedup('[{"user_id":"00000000-0000-0000-0000-00000000000b","date_time":"2026-05-01T00:00:00Z","platform":"Chaturbate","username":"intruder","tokens":"5"}]'::jsonb)$q$) = '42501',
  'anon: insert_tips_dedup is permission-denied');

-- ── Cross-account writes ────────────────────────────────────────────────
SELECT t.ok(t.sqlstate_as('authenticated', :'A',
  $q$SELECT public.insert_paid_sessions_dedup('[{"user_id":"00000000-0000-0000-0000-00000000000b","date_time":"2026-05-01T00:00:00Z","platform":"Chaturbate","username":"x","session_type":"Private Chat","tokens":5,"usd":0.25}]'::jsonb)$q$) = 'P0001',
  'cross-account: A cannot write private earnings for B');
SELECT t.ok(t.sqlstate_as('authenticated', :'A',
  $q$SELECT public.insert_paid_sessions_dedup('[{"date_time":"2026-05-01T00:00:00Z","platform":"Chaturbate","username":"x","session_type":"Private Chat","tokens":5,"usd":0.25}]'::jsonb)$q$) = 'P0001',
  'cross-account: a private-earnings row with no user_id is rejected');
BEGIN;
SELECT set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claim.sub',:'A',true);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE r AS SELECT public.insert_tips_dedup('[{"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-05-01T00:00:00Z","platform":"Chaturbate","username":"mine","tokens":"5"},{"user_id":"00000000-0000-0000-0000-00000000000b","date_time":"2026-05-01T00:00:00Z","platform":"Chaturbate","username":"theirs","tokens":"5"}]'::jsonb) AS res;
RESET ROLE;
SELECT t.ok((SELECT res ? 'error' FROM r) AND (SELECT count(*) FROM public.tips WHERE username IN ('mine','theirs')) = 0,
            'cross-account: a tips batch containing another user''s row is rejected whole (0 rows saved)');
ROLLBACK;

-- ── Legitimate imports + duplicate behaviour (unchanged) ────────────────
BEGIN;
SELECT set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claim.sub',:'A',true);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE r1 AS SELECT public.insert_tips_dedup('[
 {"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-05-02T00:00:00Z","platform":"Chaturbate","username":"Rep","tokens":"10","tip_seq":"1"},
 {"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-05-02T00:00:00Z","platform":"Chaturbate","username":"rep","tokens":"10","tip_seq":"2"},
 {"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-05-02T00:01:00Z","platform":"Chaturbate","username":"same","tokens":"4"},
 {"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-05-02T00:01:00Z","platform":"Chaturbate","username":"same","tokens":"4"},
 {"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-05-02T00:02:00Z","platform":"Chaturbate","username":"zero","tokens":"0"}
]'::jsonb, '10000000-0000-0000-0000-0000000000a1') AS res;
-- second "batch" of the same file: client tip_seq continues across batches
CREATE TEMP TABLE r2 AS SELECT public.insert_tips_dedup('[
 {"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-05-02T00:00:00Z","platform":"Chaturbate","username":"rep","tokens":"10","tip_seq":"3"}
]'::jsonb, '10000000-0000-0000-0000-0000000000a1') AS res;
-- re-upload of the whole file under A's second import
CREATE TEMP TABLE r3 AS SELECT public.insert_tips_dedup('[
 {"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-05-02T00:00:00Z","platform":"Chaturbate","username":"Rep","tokens":"10","tip_seq":"1"},
 {"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-05-02T00:00:00Z","platform":"Chaturbate","username":"rep","tokens":"10","tip_seq":"2"},
 {"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-05-02T00:00:00Z","platform":"Chaturbate","username":"rep","tokens":"10","tip_seq":"3"},
 {"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-05-02T00:01:00Z","platform":"Chaturbate","username":"same","tokens":"4"},
 {"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-05-02T00:01:00Z","platform":"Chaturbate","username":"same","tokens":"4"}
]'::jsonb, '10000000-0000-0000-0000-0000000000a2') AS res;
RESET ROLE;
SELECT t.ok((SELECT (res->>'inserted')::int = 4 AND (res->>'skipped')::int = 1 AND (res->>'total')::int = 5 FROM r1),
            'legit import: 4 inserted, the 0-token row counted in skipped (unchanged counting)');
SELECT t.ok((SELECT array_agg(tip_seq ORDER BY tip_seq) FROM public.tips WHERE username_lower = 'rep' AND user_id = :'A') = '{1,2,3}',
            'within-file repeats: same fan/amount/minute kept as tip_seq 1,2,3 across batches');
SELECT t.ok((SELECT array_agg(tip_seq ORDER BY tip_seq) FROM public.tips WHERE username = 'same' AND user_id = :'A') = '{1,2}',
            'within-batch repeats without client tip_seq: RPC numbers them 1,2');
SELECT t.ok((SELECT (res->>'inserted')::int = 0 AND (res->>'skipped')::int = 5 FROM r3),
            're-upload: every row skipped as duplicate');
SELECT t.ok((SELECT bool_and(upload_id = '10000000-0000-0000-0000-0000000000a1') FROM public.tips WHERE user_id = :'A' AND date_time >= '2026-05-02'),
            'provenance: re-upload under a second import does not overwrite the first upload_id');
ROLLBACK;

BEGIN;
SELECT set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claim.sub',:'A',true);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE p1 AS SELECT public.insert_paid_sessions_dedup('[
 {"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-05-03T00:00:00Z","platform":"BongaCams","username":"Pv","session_type":"Private Chat","tokens":40,"usd":1.0,"upload_id":"10000000-0000-0000-0000-0000000000a1"},
 {"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-05-03T00:00:00Z","platform":"BongaCams","username":"pv","session_type":"Private Chat","tokens":40,"usd":1.0},
 {"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-05-03T00:00:00Z","platform":"BongaCams","username":"pv","session_type":"Spy Mode","tokens":40,"usd":1.0}
]'::jsonb) AS res;
RESET ROLE;
SELECT t.ok((SELECT (res->>'inserted')::int = 2 AND (res->>'skipped')::int = 1 FROM p1),
            'private earnings: same key deduped, different session_type kept (unchanged)');
SELECT t.ok((SELECT upload_id FROM public.paid_sessions WHERE username = 'Pv') = '10000000-0000-0000-0000-0000000000a1'
        AND (SELECT usd FROM public.paid_sessions WHERE username = 'Pv') = 1.0000,
            'private earnings: own import link saved; 4-decimal usd kept');
ROLLBACK;

-- ── Import ownership (new) ──────────────────────────────────────────────
BEGIN;
SELECT set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claim.sub',:'A',true);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE o1 AS SELECT public.insert_tips_dedup('[{"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-05-04T00:00:00Z","platform":"Chaturbate","username":"o1","tokens":"5"}]'::jsonb, '10000000-0000-0000-0000-0000000000b1') AS res;
CREATE TEMP TABLE o2 AS SELECT public.insert_tips_dedup('[{"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-05-04T00:00:00Z","platform":"Chaturbate","username":"o2","tokens":"5"}]'::jsonb, '10000000-0000-0000-0000-0000000000ff') AS res;
RESET ROLE;
SELECT t.ok((SELECT res->>'error' LIKE 'Import ownership violation%' FROM o1) AND NOT EXISTS (SELECT 1 FROM public.tips WHERE username = 'o1'),
            'import ownership: tips cannot link to another creator''s import (nothing saved)');
SELECT t.ok((SELECT res->>'error' LIKE 'Import ownership violation%' FROM o2) AND NOT EXISTS (SELECT 1 FROM public.tips WHERE username = 'o2'),
            'import ownership: tips cannot link to a non-existent import');
ROLLBACK;
SELECT t.ok(t.sqlstate_as('authenticated', :'A',
  $q$SELECT public.insert_paid_sessions_dedup('[{"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-05-04T00:00:00Z","platform":"Chaturbate","username":"ok","session_type":"Private Chat","tokens":5,"usd":0.25},{"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-05-04T00:01:00Z","platform":"Chaturbate","username":"bad","session_type":"Private Chat","tokens":5,"usd":0.25,"upload_id":"10000000-0000-0000-0000-0000000000b1"}]'::jsonb)$q$) = 'P0001',
  'import ownership: private earnings cannot link to another creator''s import');
-- service_role (server-side, e.g. extension scan import) is held to the same link rule
BEGIN;
SELECT set_config('request.jwt.claim.role','service_role',true);
SET LOCAL ROLE service_role;
CREATE TEMP TABLE s1 AS SELECT public.insert_tips_dedup('[{"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-05-05T00:00:00Z","platform":"Chaturbate","username":"s1","tokens":"5"}]'::jsonb, '10000000-0000-0000-0000-0000000000a1') AS res;
CREATE TEMP TABLE s2 AS SELECT public.insert_tips_dedup('[{"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-05-05T00:00:00Z","platform":"Chaturbate","username":"s2","tokens":"5"}]'::jsonb, '10000000-0000-0000-0000-0000000000b1') AS res;
CREATE TEMP TABLE s3 AS SELECT public.insert_tips_dedup('[{"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-05-05T00:00:00Z","platform":"Chaturbate","username":"s3","tokens":"5"}]'::jsonb, NULL) AS res;
RESET ROLE;
SELECT t.ok((SELECT (res->>'inserted')::int = 1 FROM s1) AND (SELECT res->>'error' LIKE 'Import ownership violation%' FROM s2) AND (SELECT (res->>'inserted')::int = 1 FROM s3),
            'service_role: own-import link and unlinked writes work; foreign import rejected');
ROLLBACK;

-- ── Free/Pro platform limit still enforced ──────────────────────────────
BEGIN;
SELECT set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claim.sub',:'B',true);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE l1 AS SELECT public.insert_tips_dedup('[{"user_id":"00000000-0000-0000-0000-00000000000b","date_time":"2026-05-06T00:00:00Z","platform":"BongaCams","username":"fourth","tokens":"5"}]'::jsonb) AS res;
CREATE TEMP TABLE l2 AS SELECT public.insert_tips_dedup('[{"user_id":"00000000-0000-0000-0000-00000000000b","date_time":"2026-05-06T00:00:00Z","platform":"Stripchat","username":"known","tokens":"5"}]'::jsonb) AS res;
RESET ROLE;
SELECT t.ok((SELECT res->>'error' LIKE 'PLATFORM_LIMIT_REACHED%' FROM l1) AND (SELECT (res->>'inserted')::int = 1 FROM l2),
            'Free/Pro: 4th platform blocked for Free tips, existing platform allowed');
ROLLBACK;
SELECT t.ok(t.sqlstate_as('authenticated', :'B',
  $q$SELECT public.insert_paid_sessions_dedup('[{"user_id":"00000000-0000-0000-0000-00000000000b","date_time":"2026-05-06T00:00:00Z","platform":"BongaCams","username":"fourth","session_type":"Private Chat","tokens":5,"usd":0.125}]'::jsonb)$q$) = 'P0001',
  'Free/Pro: 4th platform blocked for Free private earnings');

-- ── Money: identical stored values before vs after ──────────────────────
SELECT t.capture_money('after');
SELECT t.ok(NOT EXISTS (SELECT * FROM t.money_before EXCEPT SELECT * FROM t.money_after)
        AND NOT EXISTS (SELECT * FROM t.money_after EXCEPT SELECT * FROM t.money_before)
        AND (SELECT count(*) FROM t.money_after) = 7,
            'money: every fixture (BongaCams 0.025, usd-only, tokens-only, blank platform) stores identical tokens/usd before and after');

SELECT t.assert_history_unchanged('after migration');
