-- AFTER the recovery script: security fixes stay, import-ownership checks are gone.
SELECT t.ok(NOT has_function_privilege('anon', 'public.insert_paid_sessions_dedup(jsonb)', 'EXECUTE')
        AND NOT has_function_privilege('anon', 'public.insert_tips_dedup(jsonb, uuid)', 'EXECUTE'),
            'recovery: anon still has no EXECUTE');
SELECT t.ok(t.sqlstate_as('authenticated', '00000000-0000-0000-0000-00000000000a',
  $q$SELECT public.insert_paid_sessions_dedup('[{"user_id":"00000000-0000-0000-0000-00000000000b","date_time":"2026-05-01T00:00:00Z","platform":"Chaturbate","username":"x","session_type":"Private Chat","tokens":5,"usd":0.25}]'::jsonb)$q$) = 'P0001',
  'recovery: cross-account private earnings still rejected');
SELECT t.ok((SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.insert_tips_dedup(jsonb, uuid)'::regprocedure) = '17eb475cd6ba94dba9bc46f5a3a119ab',
            'recovery: insert_tips_dedup is byte-identical to the live body');
SELECT t.assert_history_unchanged('after recovery');
