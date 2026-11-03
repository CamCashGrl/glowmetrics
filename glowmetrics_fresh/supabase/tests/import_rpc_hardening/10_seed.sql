-- Seed: two Free creators (A, B), one Pro creator (P, money fixtures).
-- B already tracks 3 platforms, so a 4th must hit the Free platform limit.
INSERT INTO auth.users(id) VALUES
 ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b'),('00000000-0000-0000-0000-00000000000c');
INSERT INTO public.profiles(id, plan) VALUES
 ('00000000-0000-0000-0000-00000000000a','free'),('00000000-0000-0000-0000-00000000000b','free'),('00000000-0000-0000-0000-00000000000c','pro');
INSERT INTO public.csv_uploads(id, user_id, upload_ref, platform, file_name) VALUES
 ('10000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-00000000000a','ref-a1','Chaturbate','a1.csv'),
 ('10000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-00000000000a','ref-a2','Chaturbate','a2.csv'),
 ('10000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-00000000000b','ref-b1','Chaturbate','b1.csv');
-- Existing history (no upload link, like every production row today).
INSERT INTO public.tips(user_id, date_time, platform, username, tokens, usd, tip_seq)
SELECT '00000000-0000-0000-0000-00000000000a', '2026-01-01T00:00:00Z'::timestamptz + (g || ' minutes')::interval,
       'Chaturbate', 'fan' || (g % 17), (g % 90) + 1, round(((g % 90) + 1) * 0.05, 2), 1
FROM generate_series(1, 500) g;
INSERT INTO public.tips(user_id, date_time, platform, username, tokens, usd, tip_seq)
SELECT '00000000-0000-0000-0000-00000000000b', '2026-02-01T00:00:00Z'::timestamptz + (g || ' minutes')::interval,
       (ARRAY['Chaturbate','MyFreeCams','Stripchat'])[1 + g % 3], 'bfan' || g, 10 + g, round((10 + g) * 0.05, 2), 1
FROM generate_series(1, 30) g;
INSERT INTO public.paid_sessions(user_id, date_time, platform, username, session_type, tokens, usd)
SELECT '00000000-0000-0000-0000-00000000000a', '2026-03-01T00:00:00Z'::timestamptz + (g || ' hours')::interval,
       'Chaturbate', 'pfan' || g, 'Private Chat', 100 + g, round((100 + g) * 0.05, 4)
FROM generate_series(1, 40) g;

CREATE TABLE t.snap AS
SELECT (SELECT count(*) FROM public.tips) AS tips_n, (SELECT sum(usd) FROM public.tips) AS tips_usd,
       (SELECT count(*) FROM public.paid_sessions) AS paid_n, (SELECT sum(usd) FROM public.paid_sessions) AS paid_usd;
CREATE FUNCTION t.assert_history_unchanged(label text) RETURNS void LANGUAGE sql AS $f$
  SELECT t.ok((SELECT count(*) FROM public.tips) = s.tips_n AND (SELECT sum(usd) FROM public.tips) = s.tips_usd
          AND (SELECT count(*) FROM public.paid_sessions) = s.paid_n AND (SELECT sum(usd) FROM public.paid_sessions) = s.paid_usd,
          label || ': tip + private-earnings counts and USD totals unchanged') FROM t.snap s $f$;

-- Money fixtures, run through whichever insert_tips_dedup is installed, for
-- user P (Pro, so the platform limit never interferes). Results are copied to
-- t.money_<label> and P's rows are removed again.
CREATE FUNCTION t.capture_money(label text) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  PERFORM public.insert_tips_dedup($j$[
    {"user_id":"00000000-0000-0000-0000-00000000000c","date_time":"2026-04-01T10:00:00Z","platform":"BongaCams","username":"m1","tokens":"1"},
    {"user_id":"00000000-0000-0000-0000-00000000000c","date_time":"2026-04-01T10:01:00Z","platform":"BongaCams","username":"m2","tokens":"3"},
    {"user_id":"00000000-0000-0000-0000-00000000000c","date_time":"2026-04-01T10:02:00Z","platform":"BongaCams","username":"m3","usd":"0.025"},
    {"user_id":"00000000-0000-0000-0000-00000000000c","date_time":"2026-04-01T10:03:00Z","platform":"Chaturbate","username":"m4","tokens":"7"},
    {"user_id":"00000000-0000-0000-0000-00000000000c","date_time":"2026-04-01T10:04:00Z","platform":"Chaturbate","username":"m5","usd":"12.345"},
    {"user_id":"00000000-0000-0000-0000-00000000000c","date_time":"2026-04-01T10:05:00Z","platform":"MyFreeCams","username":"m6","tokens":"1999","usd":"99.95"},
    {"user_id":"00000000-0000-0000-0000-00000000000c","date_time":"2026-04-01T10:06:00Z","platform":"","username":"m7","tokens":"11"}
  ]$j$::jsonb);
  EXECUTE format('CREATE TABLE t.%I AS SELECT username, platform, tokens, usd, usd_rounded, tip_seq, date_time FROM public.tips WHERE user_id = %L',
                 'money_' || label, '00000000-0000-0000-0000-00000000000c');
  DELETE FROM public.tips WHERE user_id = '00000000-0000-0000-0000-00000000000c';
END $f$;
