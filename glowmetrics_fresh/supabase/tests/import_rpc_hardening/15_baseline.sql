-- BEFORE the migration (production-identical functions): prove the holes exist.
-- Everything here is rolled back.
SELECT t.capture_money('before');

BEGIN;
SELECT set_config('request.jwt.claim.role', 'anon', true);
SET LOCAL ROLE anon;
SELECT public.insert_paid_sessions_dedup('[{"user_id":"00000000-0000-0000-0000-00000000000b","date_time":"2026-05-01T00:00:00Z","platform":"Chaturbate","username":"intruder","session_type":"Private Chat","tokens":500,"usd":25}]'::jsonb);
RESET ROLE;
SELECT t.ok((SELECT count(*) FROM public.paid_sessions WHERE username = 'intruder' AND user_id = '00000000-0000-0000-0000-00000000000b') = 1,
            'baseline: anon CAN insert private earnings into another account (vulnerability confirmed)');
ROLLBACK;

BEGIN;
SELECT set_config('request.jwt.claim.role', 'authenticated', true), set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE r AS SELECT public.insert_tips_dedup('[{"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-05-01T00:00:00Z","platform":"Chaturbate","username":"linkme","tokens":"5"}]'::jsonb,
                                                      '10000000-0000-0000-0000-0000000000b1') AS res;
RESET ROLE;
SELECT t.ok((SELECT upload_id FROM public.tips WHERE username = 'linkme') = '10000000-0000-0000-0000-0000000000b1',
            'baseline: a tip CAN be linked to another creator''s import (gap confirmed)');
ROLLBACK;

SELECT t.assert_history_unchanged('baseline');
