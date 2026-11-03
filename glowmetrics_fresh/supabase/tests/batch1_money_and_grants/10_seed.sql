-- Seed the production-shaped mirror with data that exercises Batch 1:
-- historical 2-decimal BongaCams rows (including the 'BC' alias and a row
-- priced at $0.05/token), Chaturbate/MFC rows, live_tips mirrored by the
-- sync_live_tip trigger, and bulk volume. Then snapshot every stored value
-- so later phases can prove nothing historical changed.

CREATE SCHEMA IF NOT EXISTS t;

CREATE OR REPLACE FUNCTION t.ok(cond boolean, name text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: %', name;
  END IF;
  RAISE NOTICE 'PASS: %', name;
END $$;
GRANT USAGE ON SCHEMA t TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION t.ok(boolean, text) TO anon, authenticated, service_role;

-- A = paid Pro, B = Free. Explicit creator timezone, never UTC by default.
INSERT INTO public.profiles (id, plan, timezone, subscription_status, stripe_subscription_id) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'pro',  'America/Los_Angeles', 'active', 'sub_test_a'),
  ('00000000-0000-0000-0000-0000000000b1', 'free', 'America/New_York',    'none',   NULL);

-- Historical rows exactly as production stores them today (2 decimals).
INSERT INTO public.tips (user_id, date_time, platform, username, tip_type, tokens, usd, tip_seq) VALUES
  ('00000000-0000-0000-0000-0000000000a1', '2026-09-01 20:00:00-07', 'BongaCams',  'hist_bc_1',  'Tip',  1, 0.03, 1),
  ('00000000-0000-0000-0000-0000000000a1', '2026-09-01 20:01:00-07', 'BongaCams',  'hist_bc_3',  'Tip',  3, 0.08, 1),
  ('00000000-0000-0000-0000-0000000000a1', '2026-09-01 20:02:00-07', 'BC',         'hist_alias', 'Tip', 10, 0.25, 1),
  ('00000000-0000-0000-0000-0000000000a1', '2026-09-01 20:03:00-07', 'BongaCams',  'hist_005',   'Tip',  8, 0.40, 1),
  ('00000000-0000-0000-0000-0000000000a1', '2026-09-01 20:04:00-07', 'Chaturbate', 'hist_cb',    'Tip', 100, 5.00, 1),
  ('00000000-0000-0000-0000-0000000000a1', '2026-09-01 20:05:00-07', 'MyFreeCams', 'hist_mfc',   'Tip', 100, 5.00, 1);

-- Bulk volume for user B (Chaturbate + BongaCams, 2-decimal storage).
INSERT INTO public.tips (user_id, date_time, platform, username, tip_type, tokens, usd, tip_seq)
SELECT '00000000-0000-0000-0000-0000000000b1',
       timestamptz '2026-08-01 00:00:00-04' + make_interval(mins => g),
       CASE WHEN g % 3 = 0 THEN 'BongaCams' ELSE 'Chaturbate' END,
       'bulk_' || (g % 97),
       'Tip',
       (g % 200) + 1,
       round(((g % 200) + 1) * CASE WHEN g % 3 = 0 THEN 0.025 ELSE 0.05 END, 2),
       1
FROM generate_series(1, 20000) g;

-- Historical live_tips for the Pro user; sync_live_tip mirrors them into tips.
INSERT INTO public.live_tips (user_id, username, tokens, usd, platform, source, received_at) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'hist_live_1', 25, 1.25, 'chaturbate', 'extension', '2026-09-02 21:00:00-07'),
  ('00000000-0000-0000-0000-0000000000a1', 'hist_live_2',  1, 0.03, 'bongacams',  'extension', '2026-09-02 21:01:00-07');

INSERT INTO public.coaching_events (session_id, user_id, type, category, dedupe_key, title, message, compact_message)
VALUES (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', 'test', 'retention', 'k', 't', 'm', 'c');

-- Snapshot of every stored value before any Batch 1 migration.
CREATE TABLE t.snap_tips AS SELECT id, usd, usd_rounded FROM public.tips;
CREATE TABLE t.snap_live AS SELECT id, usd FROM public.live_tips;
CREATE TABLE t.snap_totals AS
  SELECT (SELECT count(*) FROM public.tips)            AS tips_n,
         (SELECT sum(usd) FROM public.tips)            AS tips_sum,
         (SELECT count(*) FROM public.live_tips)       AS live_n,
         (SELECT sum(usd) FROM public.live_tips)       AS live_sum,
         (SELECT count(*) FROM public.coaching_events) AS coaching_n;

-- Value-preservation check reused by later phases.
CREATE OR REPLACE FUNCTION t.assert_history_unchanged(label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE s record;
BEGIN
  SELECT * INTO s FROM t.snap_totals;
  PERFORM t.ok((SELECT count(*) FROM t.snap_tips sn LEFT JOIN public.tips x ON x.id = sn.id
                WHERE x.id IS NULL OR x.usd <> sn.usd OR x.usd_rounded <> sn.usd_rounded) = 0,
               label || ': every pre-existing tips row keeps its exact usd and usd_rounded');
  PERFORM t.ok((SELECT count(*) FROM t.snap_live sn LEFT JOIN public.live_tips x ON x.id = sn.id
                WHERE x.id IS NULL OR x.usd <> sn.usd) = 0,
               label || ': every pre-existing live_tips row keeps its exact usd');
  PERFORM t.ok((SELECT sum(x.usd) FROM public.tips x JOIN t.snap_tips sn ON sn.id = x.id) = s.tips_sum,
               label || ': SUM(tips.usd) over pre-existing rows unchanged (' || s.tips_sum || ')');
  PERFORM t.ok((SELECT sum(x.usd) FROM public.live_tips x JOIN t.snap_live sn ON sn.id = x.id) = s.live_sum,
               label || ': SUM(live_tips.usd) over pre-existing rows unchanged (' || s.live_sum || ')');
  PERFORM t.ok((SELECT count(*) FROM public.coaching_events) = s.coaching_n,
               label || ': coaching_events row count unchanged');
END $$;

SELECT t.ok((SELECT tips_n FROM t.snap_totals) = 20008, 'seed: 20,008 tips rows (6 historical + 20,000 bulk + 2 mirrored by sync_live_tip)');
