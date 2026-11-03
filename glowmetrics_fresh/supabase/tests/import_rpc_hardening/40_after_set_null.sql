-- AFTER 20261102_import_links_on_delete_set_null.sql
SELECT t.ok((SELECT confdeltype FROM pg_constraint WHERE conname = 'tips_upload_id_fkey') = 'n'
        AND (SELECT confdeltype FROM pg_constraint WHERE conname = 'paid_sessions_upload_id_fkey') = 'n'
        AND (SELECT bool_and(convalidated) FROM pg_constraint WHERE conname IN ('tips_upload_id_fkey','paid_sessions_upload_id_fkey')),
            'set-null: both upload_id foreign keys are ON DELETE SET NULL and validated');

-- Link earnings to A's import a1 (as A), then A deletes the import record.
BEGIN;
SELECT set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',true);
SET LOCAL ROLE authenticated;
SELECT public.insert_tips_dedup('[{"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-07-01T00:00:00Z","platform":"Chaturbate","username":"keepme","tokens":"25"}]'::jsonb, '10000000-0000-0000-0000-0000000000a1');
SELECT public.insert_paid_sessions_dedup('[{"user_id":"00000000-0000-0000-0000-00000000000a","date_time":"2026-07-01T00:00:00Z","platform":"Chaturbate","username":"keeppv","session_type":"Private Chat","tokens":60,"usd":3,"upload_id":"10000000-0000-0000-0000-0000000000a1"}]'::jsonb);
DELETE FROM public.csv_uploads WHERE id = '10000000-0000-0000-0000-0000000000a1';
RESET ROLE;
SELECT t.ok((SELECT count(*) FROM public.csv_uploads WHERE id = '10000000-0000-0000-0000-0000000000a1') = 0,
            'set-null: the creator can delete their own import record');
SELECT t.ok((SELECT usd FROM public.tips WHERE username = 'keepme') = 1.25 AND (SELECT upload_id FROM public.tips WHERE username = 'keepme') IS NULL,
            'set-null: deleting the import keeps the tip (amount intact) and clears its link');
SELECT t.ok((SELECT usd FROM public.paid_sessions WHERE username = 'keeppv') = 3 AND (SELECT upload_id FROM public.paid_sessions WHERE username = 'keeppv') IS NULL,
            'set-null: deleting the import keeps the private earning and clears its link');
ROLLBACK;

-- A dangling private-earnings link can no longer be created, even by service_role.
SELECT t.ok(t.sqlstate_as('service_role', NULL,
  $q$INSERT INTO public.paid_sessions(user_id, date_time, platform, username, session_type, tokens, usd, upload_id) VALUES ('00000000-0000-0000-0000-00000000000a', now(), 'Chaturbate', 'dangling', 'Private Chat', 1, 0.05, '10000000-0000-0000-0000-0000000000ff')$q$) IN ('23503','42501'),
  'set-null: private earnings cannot reference a missing import');
SELECT t.assert_history_unchanged('after set-null migration');
