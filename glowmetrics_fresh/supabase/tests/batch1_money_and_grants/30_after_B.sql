-- After migration B (20261029d): schema shape, historical values unchanged,
-- and the canonical money fixtures through the real Live Mode RPCs
-- (start_live_session -> persist_extension_tip -> stop_live_session ->
-- _finalize_live_session_metrics). p_usd is passed exactly as
-- tokens x canonical rate, which is what /api/live/tips sends after C.

-- 1. Shape.
SELECT t.ok(format_type(atttypid, atttypmod) = 'numeric(12,4)', 'B: tips.usd is numeric(12,4)')
  FROM pg_attribute WHERE attrelid = 'public.tips'::regclass AND attname = 'usd';
SELECT t.ok(format_type(atttypid, atttypmod) = 'numeric(12,4)', 'B: live_tips.usd is numeric(12,4)')
  FROM pg_attribute WHERE attrelid = 'public.live_tips'::regclass AND attname = 'usd';
SELECT t.ok(a.attgenerated = 's' AND format_type(a.atttypid, a.atttypmod) = 'numeric'
            AND pg_get_expr(d.adbin, d.adrelid) = 'round(usd, 2)',
            'B: tips.usd_rounded is still GENERATED ALWAYS AS (round(usd, 2)) STORED, type numeric')
  FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attrelid = 'public.tips'::regclass AND a.attname = 'usd_rounded';
SELECT t.ok(pg_get_indexdef('public.tips_dedup_unique'::regclass)
            = 'CREATE UNIQUE INDEX tips_dedup_unique ON public.tips USING btree (user_id, username_lower, tokens, usd_rounded, date_time, tip_seq)',
            'B: tips_dedup_unique restored with the identical definition');
SELECT t.ok((SELECT indisunique AND indisvalid FROM pg_index WHERE indexrelid = 'public.tips_dedup_unique'::regclass),
            'B: tips_dedup_unique is unique and valid');
SELECT t.ok((SELECT count(*) FROM public.tips) = (SELECT tips_n FROM t.snap_totals)
        AND (SELECT count(*) FROM public.live_tips) = (SELECT live_n FROM t.snap_totals),
            'B: row counts unchanged by the migration');
SELECT t.assert_history_unchanged('after B');

-- 2. BongaCams session: 40 x 1-token tips + token amounts 1..40.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SET ROLE authenticated;
SELECT t.ok((public.start_live_session('BongaCams')).status = 'starting', 'B: Pro creator starts a BongaCams session');
RESET ROLE;

SET ROLE service_role;
SELECT count(*) FROM (
  SELECT public.persist_extension_tip('00000000-0000-0000-0000-0000000000a1',
           CASE WHEN g = 1 THEN '11111111-1111-1111-1111-111111111111'::uuid ELSE gen_random_uuid() END,
           NULL, 'single', 1, 1 * 0.025, 'bongacams', now() + make_interval(secs => g), NULL)
  FROM generate_series(1, 40) g
) s;
SELECT count(*) FROM (
  SELECT public.persist_extension_tip('00000000-0000-0000-0000-0000000000a1', gen_random_uuid(),
           NULL, 'ramp', g, g * 0.025, 'bongacams', now() + make_interval(secs => 100 + g), NULL)
  FROM generate_series(1, 40) g
) s;
-- Replaying the same event must not change anything.
SELECT t.ok((public.persist_extension_tip('00000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111'::uuid,
           NULL, 'single', 1, 0.025, 'bongacams', now(), NULL) ->> 'duplicate')::boolean,
           'B: replayed client_event_id is reported as a duplicate');
RESET ROLE;

CREATE TEMP TABLE fx_session AS
  SELECT id FROM public.live_sessions
  WHERE user_id = '00000000-0000-0000-0000-0000000000a1' AND status = 'starting';

SELECT t.ok((SELECT usd::text FROM public.tips WHERE username = 'ramp' AND tokens = 1) = '0.0250', 'BC: 1 token = 0.0250 stored (not 0.03)');
SELECT t.ok((SELECT usd::text FROM public.tips WHERE username = 'ramp' AND tokens = 2) = '0.0500', 'BC: 2 tokens = 0.0500');
SELECT t.ok((SELECT usd::text FROM public.tips WHERE username = 'ramp' AND tokens = 3) = '0.0750', 'BC: 3 tokens = 0.0750');
SELECT t.ok((SELECT usd_rounded FROM public.tips WHERE username = 'ramp' AND tokens = 1) = 0.03, 'BC: usd_rounded (dedup key) of 1 token is still 0.03');
SELECT t.ok((SELECT sum(usd) FROM public.tips WHERE username = 'single') = 1.0000, 'BC: 40 x 1-token tips = 1.0000');
SELECT t.ok((SELECT sum(usd_rounded) FROM public.tips WHERE username = 'single') = 1.20, 'BC: the old per-tip cent rounding would have given 1.20 (drift documented)');
SELECT t.ok((SELECT sum(usd) FROM public.tips WHERE username = 'ramp') = 20.5000, 'BC: token amounts 1..40 = 20.5000');
SELECT t.ok((SELECT count(*) FROM public.tips WHERE username IN ('single', 'ramp')) = 80, 'B: exactly 80 tips rows (no sync_live_tip duplicates, replay not stored)');
SELECT t.ok((SELECT count(*) FROM public.live_tips WHERE username IN ('single', 'ramp')) = 80, 'B: exactly 80 live_tips rows');
SELECT t.ok((SELECT sum(usd) FROM public.live_tips WHERE live_session_id = (SELECT id FROM fx_session)) = 21.5000, 'B: live_tips for the session sum to 21.5000');

SET ROLE authenticated;
SELECT (public.stop_live_session()).id IS NOT NULL AS stopped;
RESET ROLE;

SELECT t.ok(session_earnings_usd = 21.5000, 'finalize: session_earnings_usd = 21.5000 (exact internal)')
  FROM public.live_sessions WHERE id = (SELECT id FROM fx_session);
SELECT t.ok(final_public_usd = 21.50 AND final_total_usd = 21.50, 'finalize: final_public_usd = final_total_usd = 21.50 (display)')
  FROM public.live_sessions WHERE id = (SELECT id FROM fx_session);
SELECT t.ok(final_tip_count = 80 AND final_tokens = 860, 'finalize: 80 tips, 860 tokens')
  FROM public.live_sessions WHERE id = (SELECT id FROM fx_session);
SELECT t.ok(session_resolution_type = 'normal_stop' AND status = 'ended', 'finalize: session ended normally')
  FROM public.live_sessions WHERE id = (SELECT id FROM fx_session);

-- 3. Chaturbate + MyFreeCams session: 100 tokens = 5.0000 each.
SET ROLE authenticated;
SELECT t.ok((public.start_live_session('Chaturbate')).status = 'starting', 'B: Pro creator starts a second session');
RESET ROLE;
SET ROLE service_role;
SELECT public.persist_extension_tip('00000000-0000-0000-0000-0000000000a1', gen_random_uuid(), NULL, 'cb_100', 100, 100 * 0.05, 'chaturbate', now() + interval '1 second', NULL);
SELECT public.persist_extension_tip('00000000-0000-0000-0000-0000000000a1', gen_random_uuid(), NULL, 'mfc_100', 100, 100 * 0.05, 'myfreecams', now() + interval '2 seconds', NULL);
RESET ROLE;
SELECT t.ok((SELECT usd::text FROM public.tips WHERE username = 'cb_100') = '5.0000', 'CB: 100 tokens = 5.0000');
SELECT t.ok((SELECT usd::text FROM public.tips WHERE username = 'mfc_100') = '5.0000', 'MFC: 100 tokens = 5.0000');
SET ROLE authenticated;
SELECT t.ok((public.stop_live_session()).final_total_usd = 10.00, 'finalize: CB + MFC session final_total_usd = 10.00');
RESET ROLE;

-- 4. CSV import RPC still dedups on the recreated index (service context, no creator claims).
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claim.role', '', false);
SELECT t.ok((public.insert_tips_dedup('[{"user_id":"00000000-0000-0000-0000-0000000000b1","date_time":"2026-10-01T10:00:00Z","platform":"Chaturbate","username":"csv_dup","tokens":"20"}]'::jsonb) ->> 'inserted')::int = 1,
            'import: insert_tips_dedup inserts a new row');
SELECT t.ok((public.insert_tips_dedup('[{"user_id":"00000000-0000-0000-0000-0000000000b1","date_time":"2026-10-01T10:00:00Z","platform":"Chaturbate","username":"csv_dup","tokens":"20"}]'::jsonb) ->> 'inserted')::int = 0,
            'import: insert_tips_dedup ON CONFLICT still skips the duplicate');

SELECT t.assert_history_unchanged('after B fixtures');
