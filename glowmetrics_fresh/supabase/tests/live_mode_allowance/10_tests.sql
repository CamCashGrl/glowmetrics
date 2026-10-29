-- LOCAL / STAGING ONLY. Never run against production.
--
-- SQL suite for 20261029_live_mode_free_allowance.sql and
-- 20261029b_private_interval_strict.sql, run by run.sh against a disposable
-- Postgres that has 00_mirror.sql + both migrations applied.
--
-- One transaction, ends in ROLLBACK. Every check RAISEs on failure; a clean
-- run ends with the NOTICE 'LIVE MODE ALLOWANCE TESTS: ALL PASSED (n checks)'.
-- Must run as a superuser/owner so it can impersonate API roles the way
-- PostgREST does (SET ROLE + request.jwt.claims).
--
-- now() is fixed inside a transaction, so every timeline is built by
-- back-dating timestamps relative to now() as the owner role first.

BEGIN;

CREATE SCHEMA allow_t;
CREATE TABLE allow_t.passes (n integer NOT NULL);
INSERT INTO allow_t.passes VALUES (0);

CREATE FUNCTION allow_t.ok(p_cond boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', p_msg; END IF;
  UPDATE allow_t.passes SET n = n + 1;
END $$;

-- Assertions must work while impersonating a browser role.
ALTER FUNCTION allow_t.ok(boolean, text) SECURITY DEFINER;
GRANT USAGE ON SCHEMA allow_t TO PUBLIC;

CREATE FUNCTION allow_t.as_user(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END $$;
CREATE FUNCTION allow_t.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  PERFORM set_config('role', 'anon', true);
END $$;
CREATE FUNCTION allow_t.as_owner() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- Runs p_sql as p_uid (NULL = anon) and requires an error whose message matches p_pat.
CREATE FUNCTION allow_t.raises(p_uid uuid, p_sql text, p_pat text, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_err text;
BEGIN
  IF p_uid IS NULL THEN PERFORM allow_t.as_anon(); ELSE PERFORM allow_t.as_user(p_uid); END IF;
  BEGIN
    EXECUTE p_sql;
    v_err := NULL;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;
  RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  IF v_err IS NULL THEN RAISE EXCEPTION 'FAILED (no error raised): %', p_msg; END IF;
  IF v_err NOT LIKE p_pat THEN RAISE EXCEPTION 'FAILED (wrong error "%"): %', v_err, p_msg; END IF;
  UPDATE allow_t.passes SET n = n + 1;
END $$;

CREATE FUNCTION allow_t.mk_user(p_label text, p_plan text, p_status text, p_stripe text, p_tz text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users VALUES (v, p_label || '@test.invalid');
  INSERT INTO public.profiles (id, plan, subscription_status, stripe_subscription_id, timezone)
  VALUES (v, p_plan, p_status, p_stripe, p_tz);
  RETURN v;
END $$;
CREATE FUNCTION allow_t.capped(p_label text, p_tz text DEFAULT 'America/New_York') RETURNS uuid LANGUAGE sql AS $$
  SELECT allow_t.mk_user(p_label, 'free', 'none', NULL, p_tz) $$;
CREATE FUNCTION allow_t.unlimited(p_label text, p_tz text DEFAULT NULL) RETURNS uuid LANGUAGE sql AS $$
  SELECT allow_t.mk_user(p_label, 'pro', 'active', 'sub_' || p_label, p_tz) $$;

-- Owner-inserted running session, timeline relative to now().
-- p_counted_ago NULL => never counted (still 'starting' / legacy).
CREATE FUNCTION allow_t.mk_session(
  p_uid uuid, p_started_ago interval, p_counted_ago interval, p_status text DEFAULT 'live',
  p_substate text DEFAULT 'active', p_last_hb_ago interval DEFAULT interval '0',
  p_paused_total integer DEFAULT 0, p_platform text DEFAULT 'Chaturbate') RETURNS public.live_sessions
LANGUAGE plpgsql AS $$
DECLARE w record; r public.live_sessions;
BEGIN
  SELECT * INTO w FROM public._allowance_window(p_uid, now() - coalesce(p_counted_ago, interval '0'));
  INSERT INTO public.live_sessions (
    user_id, status, live_substate, is_active, started_at, last_heartbeat_at, website_last_heartbeat_at,
    stream_platform, counted_at, allowance_timezone, allowance_week_start, allowance_week_end,
    total_paused_seconds
  ) VALUES (
    p_uid, p_status, CASE WHEN p_status = 'starting' THEN NULL ELSE p_substate END, true,
    now() - p_started_ago, now() - p_last_hb_ago, now() - p_last_hb_ago, p_platform,
    CASE WHEN p_counted_ago IS NULL THEN NULL ELSE now() - p_counted_ago END,
    CASE WHEN p_counted_ago IS NULL THEN NULL ELSE w.tz END,
    CASE WHEN p_counted_ago IS NULL THEN NULL ELSE w.week_start END,
    CASE WHEN p_counted_ago IS NULL THEN NULL ELSE w.week_end END,
    p_paused_total
  ) RETURNING * INTO r;
  RETURN r;
END $$;

CREATE FUNCTION allow_t.sess(p_id uuid) RETURNS public.live_sessions LANGUAGE sql AS $$
  SELECT * FROM public.live_sessions WHERE id = p_id $$;

-- ═══ T1  entitlement mapping (the ONE definition) ═══════════════════════
CREATE FUNCTION allow_t.ent(p_label text, p_plan text, p_status text, p_stripe text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE u uuid := allow_t.mk_user(p_label, p_plan, p_status, p_stripe, NULL); r text;
BEGIN
  SELECT public.live_mode_entitlement(u) INTO r;   -- separate statement: sees the new row
  RETURN r;
END $$;
DO $$
BEGIN
  PERFORM allow_t.ok(allow_t.ent('t1_unl', 'pro', 'active', 'sub_1') = 'unlimited', 'pro+active+stripe id = unlimited');
  PERFORM allow_t.ok(allow_t.ent('t1_trial', 'pro', 'trialing', 'sub_2') = 'capped', 'trialing stays capped');
  PERFORM allow_t.ok(allow_t.ent('t1_promo', 'pro', 'none', NULL) = 'capped', 'pro with status none (promo/goodwill/expired) is capped');
  PERFORM allow_t.ok(allow_t.ent('t1_nostripe', 'pro', 'active', NULL) = 'capped', 'active without a Stripe subscription id is capped');
  PERFORM allow_t.ok(allow_t.ent('t1_free', 'free', 'none', NULL) = 'capped', 'free is capped');
  PERFORM allow_t.ok(allow_t.ent('t1_cancel', 'free', 'canceled', 'sub_3') = 'capped', 'canceled is capped');
  PERFORM allow_t.ok(allow_t.ent('t1_legacy', 'unlimited', 'none', NULL) = 'capped', 'plan=unlimited is not silently unlimited');
  PERFORM allow_t.ok(public.live_mode_entitlement(gen_random_uuid()) = 'capped', 'unknown user is capped');
END $$;

-- ═══ T2  strict platform at Start — never guess ═════════════════════════
DO $$
DECLARE u uuid := allow_t.capped('t2'); a public.live_sessions; b public.live_sessions;
BEGIN
  PERFORM allow_t.raises(u, 'SELECT public.start_live_session(NULL)', 'PLATFORM_REQUIRED%', 'NULL platform fails');
  PERFORM allow_t.raises(u, $q$SELECT public.start_live_session('')$q$, 'PLATFORM_REQUIRED%', 'empty platform fails');
  PERFORM allow_t.raises(u, $q$SELECT public.start_live_session('Stripchat')$q$, 'PLATFORM_REQUIRED%', 'unsupported platform fails');
  PERFORM allow_t.raises(u, $q$SELECT public.start_live_session('chaturbat')$q$, 'PLATFORM_REQUIRED%', 'near-miss platform fails');
  PERFORM allow_t.ok((SELECT count(*) FROM public.live_sessions WHERE user_id = u) = 0, 'failed starts insert nothing');
  PERFORM allow_t.as_user(u);
  a := public.start_live_session('  bongacams ');
  b := public.start_live_session('Chaturbate');
  RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  PERFORM allow_t.ok(a.stream_platform = 'BongaCams', 'canonical casing stored');
  PERFORM allow_t.ok(a.status = 'starting' AND a.counted_at IS NULL, 'a new row is starting and uncounted');
  PERFORM allow_t.ok(a.id = b.id AND (SELECT count(*) FROM public.live_sessions WHERE user_id = u) = 1, 'repeated Start returns the same session');
END $$;

-- ═══ T3  timezone: capped needs a valid one, unlimited does not ═════════
DO $$
DECLARE u_no uuid := allow_t.capped('t3_none', NULL); u_bad uuid := allow_t.capped('t3_bad', 'Mars/Phobos');
        u_empty uuid := allow_t.capped('t3_empty', ''); u_unl uuid := allow_t.unlimited('t3_unl', NULL);
        r jsonb; s public.live_sessions;
BEGIN
  PERFORM allow_t.raises(u_no, $q$SELECT public.start_live_session('Chaturbate')$q$, 'TIMEZONE_REQUIRED%', 'missing timezone refuses Start');
  PERFORM allow_t.raises(u_bad, $q$SELECT public.start_live_session('Chaturbate')$q$, 'TIMEZONE_REQUIRED%', 'invalid timezone refuses Start (controlled error)');
  PERFORM allow_t.raises(u_empty, $q$SELECT public.start_live_session('Chaturbate')$q$, 'TIMEZONE_REQUIRED%', 'empty timezone refuses Start');
  PERFORM allow_t.as_user(u_no); r := public.get_live_mode_allowance(); RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  PERFORM allow_t.ok(r->>'lock_reason' = 'TIMEZONE_REQUIRED' AND (r->'timezone'->>'required')::boolean AND NOT (r->>'can_start')::boolean, 'allowance state reports TIMEZONE_REQUIRED');
  PERFORM allow_t.as_user(u_bad); r := public.get_live_mode_allowance(); RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  PERFORM allow_t.ok(r->'timezone'->>'source' = 'invalid', 'invalid source reported');
  PERFORM allow_t.as_user(u_unl); s := public.start_live_session('MyFreeCams'); RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  PERFORM allow_t.ok(s.status = 'starting', 'unlimited user starts without any timezone');
  UPDATE public.profiles SET timezone = 'America/Chicago' WHERE id = u_no;
  PERFORM allow_t.as_user(u_no); s := public.start_live_session('Chaturbate'); RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  PERFORM allow_t.ok(s.status = 'starting', 'saving a valid timezone unblocks Start');
END $$;

-- ═══ T4  a weekly start is consumed when the session first goes live ═════
DO $$
DECLARE u uuid := allow_t.capped('t4', 'America/Los_Angeles'); u_unl uuid := allow_t.unlimited('t4_unl');
        a public.live_sessions; b public.live_sessions; r jsonb; i int;
BEGIN
  PERFORM allow_t.as_user(u);
  a := public.start_live_session('Chaturbate');
  r := public.get_live_mode_allowance();
  PERFORM allow_t.ok((r->'week'->>'starts_used')::int = 0, 'a starting session consumes nothing');
  b := public.start_live_session('Chaturbate');  -- second tab / refresh
  PERFORM allow_t.ok(a.id = b.id, 'second Start returns the pending session');
  PERFORM public.send_website_heartbeat();
  RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  a := allow_t.sess(a.id);
  PERFORM allow_t.ok(a.status = 'live' AND a.counted_at IS NOT NULL, 'first heartbeat makes it live and stamps counted_at');
  PERFORM allow_t.ok(a.allowance_timezone = 'America/Los_Angeles' AND a.allowance_week_start IS NOT NULL AND a.allowance_week_end IS NOT NULL, 'allowance timezone and week snapshotted on counting');
  PERFORM allow_t.as_user(u);
  PERFORM public.send_website_heartbeat(); PERFORM public.send_website_heartbeat();
  b := public.start_live_session('Chaturbate');  -- reconnect during the live stream
  r := public.get_live_mode_allowance();
  RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  PERFORM allow_t.ok(b.id = a.id AND (SELECT counted_at FROM public.live_sessions WHERE id = a.id) = a.counted_at, 'reconnect returns the same session and never re-stamps counted_at');
  PERFORM allow_t.ok((r->'week'->>'starts_used')::int = 1, 'one start consumed');
  PERFORM allow_t.as_user(u); PERFORM public.stop_live_session(); RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  PERFORM allow_t.as_user(u); r := public.get_live_mode_allowance(); RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  PERFORM allow_t.ok((r->'week'->>'starts_used')::int = 1, 'a start stays consumed after an immediate End');
  -- second stream
  PERFORM allow_t.as_user(u); b := public.start_live_session('Chaturbate'); PERFORM public.send_website_heartbeat(); PERFORM public.stop_live_session(); RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  PERFORM allow_t.raises(u, $q$SELECT public.start_live_session('Chaturbate')$q$, 'FREE_LIVE_WEEKLY_LIMIT%', 'third start in the week is refused');
  PERFORM allow_t.as_user(u); r := public.get_live_mode_allowance(); RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  PERFORM allow_t.ok(NOT (r->>'can_start')::boolean AND r->>'lock_reason' = 'FREE_LIVE_WEEKLY_LIMIT' AND (r->'week'->>'starts_remaining')::int = 0, 'state reports the weekly lock');
  -- paid unlimited
  FOR i IN 1..4 LOOP
    PERFORM allow_t.as_user(u_unl); PERFORM public.start_live_session('Chaturbate'); PERFORM public.send_website_heartbeat(); PERFORM public.stop_live_session(); RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  END LOOP;
  PERFORM allow_t.ok((SELECT count(*) FROM public.live_sessions WHERE user_id = u_unl) = 4, 'unlimited Pro is never weekly-limited');
END $$;

-- ═══ T5  never-connected sessions close and consume nothing ═════════════
DO $$
DECLARE u uuid := allow_t.capped('t5'); a public.live_sessions; b public.live_sessions; r jsonb; v public.live_sessions;
BEGIN
  PERFORM allow_t.as_user(u); a := public.start_live_session('Chaturbate'); RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.live_sessions SET last_heartbeat_at = now() - interval '19 minutes' WHERE id = a.id;
  PERFORM allow_t.as_user(u); b := public.start_live_session('Chaturbate'); RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  PERFORM allow_t.ok(b.id = a.id, 'a 19-minute-old pending session is still the current one');
  UPDATE public.live_sessions SET last_heartbeat_at = now() - interval '21 minutes' WHERE id = a.id;
  PERFORM allow_t.as_user(u); r := public.get_live_mode_allowance(); RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  v := allow_t.sess(a.id);
  PERFORM allow_t.ok(v.status = 'ended' AND v.session_resolution_type = 'never_connected' AND v.counted_at IS NULL, 'a stale pending session closes as never_connected, uncounted');
  PERFORM allow_t.ok(v.finalized_at IS NULL AND v.is_inaccurate, 'never_connected is not finalized into a show and is flagged');
  PERFORM allow_t.ok((r->'week'->>'starts_used')::int = 0 AND (r->>'can_start')::boolean, 'it consumed no weekly start');
  PERFORM allow_t.as_user(u); b := public.start_live_session('Chaturbate'); RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  PERFORM allow_t.ok(b.id <> a.id AND b.status = 'starting', 'a fresh Start creates a new row');
END $$;

-- ═══ T6  creator-local week, DST-correct, never UTC ═════════════════════
DO $$
DECLARE u uuid := allow_t.capped('t6'); w record;
BEGIN
  UPDATE public.profiles SET timezone = 'America/New_York' WHERE id = u;
  SELECT * INTO w FROM public._allowance_window(u, '2026-03-05 12:00:00+00');
  PERFORM allow_t.ok(w.week_start = '2026-03-02 05:00:00+00' AND w.week_end = '2026-03-09 04:00:00+00' AND w.week_end - w.week_start = interval '167 hours', 'New York week containing spring-forward is 167h (Mon 00:00 local to Mon 00:00 local)');
  SELECT * INTO w FROM public._allowance_window(u, '2026-03-10 12:00:00+00');
  PERFORM allow_t.ok(w.week_start = '2026-03-09 04:00:00+00' AND w.week_end = '2026-03-16 04:00:00+00', 'New York week after spring-forward');
  SELECT * INTO w FROM public._allowance_window(u, '2026-11-02 12:00:00+00');
  PERFORM allow_t.ok(w.week_end - w.week_start = interval '168 hours', 'a normal New York week is 168h');
  SELECT * INTO w FROM public._allowance_window(u, '2026-11-01 12:00:00+00');
  PERFORM allow_t.ok(w.week_end - w.week_start = interval '169 hours', 'New York week containing fall-back is 169h');
  UPDATE public.profiles SET timezone = 'America/Los_Angeles' WHERE id = u;
  SELECT * INTO w FROM public._allowance_window(u, '2026-03-09 03:00:00+00');  -- Monday in UTC, still Sunday evening in LA
  PERFORM allow_t.ok(w.week_start = '2026-03-02 08:00:00+00' AND w.week_end = '2026-03-09 07:00:00+00', 'Sunday-evening LA belongs to the PREVIOUS local week even though UTC says Monday');
  UPDATE public.profiles SET timezone = 'Pacific/Auckland' WHERE id = u;
  SELECT * INTO w FROM public._allowance_window(u, '2026-06-14 13:00:00+00');  -- Monday 01:00 NZST
  PERFORM allow_t.ok(w.week_start = '2026-06-14 12:00:00+00' AND w.week_end = '2026-06-21 12:00:00+00', 'Auckland week starts Monday 00:00 NZST (Sunday 12:00 UTC)');
  PERFORM allow_t.ok(w.tz = 'Pacific/Auckland' AND w.source = 'profile', 'window reports the timezone it used');
END $$;

-- ═══ T7  timezone change mid-week cannot restore starts ═════════════════
DO $$
DECLARE u uuid := allow_t.capped('t7', 'Pacific/Auckland'); a public.live_sessions; w record; w2 record; i int; r jsonb;
BEGIN
  FOR i IN 1..2 LOOP
    PERFORM allow_t.as_user(u); PERFORM public.start_live_session('Chaturbate'); PERFORM public.send_website_heartbeat(); PERFORM public.stop_live_session(); RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  END LOOP;
  SELECT * INTO w FROM public._allowance_window(u, now());
  PERFORM allow_t.ok(w.source = 'snapshot' AND w.tz = 'Pacific/Auckland', 'open week is read from the snapshot');
  UPDATE public.profiles SET timezone = 'Pacific/Kiritimati' WHERE id = u;   -- UTC+14: shifts Monday by up to a day
  SELECT * INTO w2 FROM public._allowance_window(u, now());
  PERFORM allow_t.ok(w2.source = 'snapshot' AND w2.tz = 'Pacific/Auckland' AND w2.week_start = w.week_start AND w2.week_end = w.week_end, 'changing profiles.timezone does not move an in-progress allowance week');
  PERFORM allow_t.raises(u, $q$SELECT public.start_live_session('Chaturbate')$q$, 'FREE_LIVE_WEEKLY_LIMIT%', 'changing timezone does not restore a start');
  SELECT * INTO w2 FROM public._allowance_window(u, w.week_end + interval '1 hour');
  PERFORM allow_t.ok(w2.source = 'profile' AND w2.tz = 'Pacific/Kiritimati', 'after the week ends the new timezone is authoritative');
  PERFORM allow_t.ok(w2.week_start >= w.week_end AND w2.week_end > w.week_end + interval '1 hour', 'the new week never overlaps the snapshotted one');
END $$;

-- ═══ T8  resume: same session, no new start, clock not reset ════════════
DO $$
DECLARE u uuid := allow_t.capped('t8'); s public.live_sessions; b public.live_sessions; r jsonb;
BEGIN
  s := allow_t.mk_session(u, interval '34 minutes', interval '34 minutes');
  PERFORM allow_t.as_user(u);
  b := public.start_live_session('Chaturbate');      -- refresh / reconnect / second tab
  PERFORM public.send_website_heartbeat();
  r := public.get_live_mode_allowance();
  RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  PERFORM allow_t.ok(b.id = s.id AND (SELECT count(*) FROM public.live_sessions WHERE user_id = u) = 1, 'reconnect resumes the SAME canonical session');
  PERFORM allow_t.ok((SELECT counted_at FROM public.live_sessions WHERE id = s.id) = s.counted_at, 'counted_at is not reset');
  PERFORM allow_t.ok((r->'week'->>'starts_used')::int <= 1, 'no second weekly start consumed');
  PERFORM allow_t.ok((r->'current'->>'active_seconds')::int = 2040 AND (r->'current'->>'remaining_seconds')::int = 60, '34 minutes used leaves 1 minute (60 s)');
  PERFORM allow_t.ok(r->'current'->>'warning_level' = 'warn30', 'warning level at 34 minutes is the strong warning');
  PERFORM allow_t.ok((allow_t.sess(s.id)).status = 'live', 'not capped yet');
END $$;

-- ═══ T9  exact 35:00 finalization, canonical path, tips stay attached ═══
DO $$
DECLARE u uuid := allow_t.capped('t9'); s public.live_sessions; v public.live_sessions; r jsonb; t1 uuid; t3 uuid; cap timestamptz;
BEGIN
  s := allow_t.mk_session(u, interval '38 minutes', interval '36 minutes');   -- connection took 2 minutes
  cap := s.counted_at + interval '2100 seconds';
  INSERT INTO public.tips (user_id, date_time, platform, username, tip_type, tokens, usd, tip_seq, client_event_id, source, live_session_id)
    VALUES (u, s.counted_at + interval '10 minutes', 'Chaturbate', 'fan_a', 'Live', 100, 5.00, 1, gen_random_uuid(), 'extension', s.id),
           (u, s.counted_at + interval '30 minutes', 'Chaturbate', 'fan_b', 'Live', 140, 7.00, 1, gen_random_uuid(), 'extension', s.id);
  -- No heartbeat, no read: the FIRST thing to touch the user is a tip.
  r := public.persist_extension_tip(u, gen_random_uuid(), 'k1', 'fan_c', 60, 3.00, 'chaturbate', s.counted_at + interval '34 minutes', NULL);
  PERFORM allow_t.ok((r->>'success')::boolean AND (r->>'live_session_id')::uuid = s.id, 'a tip before the cap instant attaches to the capped session');
  r := public.persist_extension_tip(u, gen_random_uuid(), 'k2', 'fan_d', 80, 4.00, 'chaturbate', s.counted_at + interval '35 minutes 30 seconds', NULL);
  PERFORM allow_t.ok((r->>'success')::boolean AND r->>'live_session_id' IS NULL, 'a tip AFTER the cap instant attaches to nothing');
  v := allow_t.sess(s.id);
  PERFORM allow_t.ok(v.status = 'ended' AND v.is_active = false AND v.live_substate IS NULL AND v.paused_at IS NULL, 'status is fully ended: no half-open session');
  PERFORM allow_t.ok(v.ended_at = cap, 'ended_at is EXACTLY counted_at + 35:00');
  PERFORM allow_t.ok(v.session_resolution_type = 'free_cap_reached' AND v.finalized_at IS NOT NULL, 'resolution recorded and finalized through the canonical path');
  PERFORM allow_t.ok(v.final_duration_seconds = EXTRACT(EPOCH FROM (v.ended_at - v.started_at))::int - v.total_paused_seconds, 'canonical duration formula is unchanged');
  PERFORM allow_t.ok(v.final_tip_count = 3 AND v.final_public_usd = 15.00 AND v.final_total_usd = 15.00, 'earnings are correct: 5 + 7 + 3 attached, the late tip excluded');
  PERFORM allow_t.ok((SELECT count(*) FROM public.tips WHERE live_session_id = s.id) = 3, 'attached tips remain attached');
  PERFORM allow_t.ok((SELECT count(*) FROM public.live_sessions WHERE user_id = u AND status IN ('starting','live','inactive_warning','ending')) = 0, 'nothing is left unresolved');
END $$;

-- ═══ T10  missing heartbeat cannot extend a Free stream (cron path) ═════
DO $$
DECLARE u uuid := allow_t.capped('t10'); s public.live_sessions; v public.live_sessions; n int;
BEGIN
  s := allow_t.mk_session(u, interval '50 minutes', interval '50 minutes', 'live', 'active', interval '9 minutes');
  n := public.enforce_all_free_live_caps();
  v := allow_t.sess(s.id);
  PERFORM allow_t.ok(n >= 1 AND v.status = 'ended' AND v.ended_at = s.counted_at + interval '2100 seconds', 'cron ends it at the exact cap instant, not at the last heartbeat');
  PERFORM allow_t.ok(v.finalized_at IS NOT NULL, 'finalized');
END $$;

-- ═══ T11  explicit pauses do not count; inactivity gaps do ══════════════
DO $$
DECLARE u uuid := allow_t.capped('t11'); s public.live_sessions; v public.live_sessions; cap timestamptz;
        u2 uuid := allow_t.capped('t11b'); s2 public.live_sessions; v2 public.live_sessions;
        u3 uuid := allow_t.capped('t11c'); s3 public.live_sessions; v3 public.live_sessions; r jsonb;
        u4 uuid := allow_t.capped('t11d'); s4 public.live_sessions; v4 public.live_sessions;
BEGIN
  -- one closed 10-minute explicit pause: cap lands 10 minutes later
  s := allow_t.mk_session(u, interval '60 minutes', interval '60 minutes', 'live', 'active', interval '0', 600);
  INSERT INTO public.live_session_pauses (session_id, user_id, paused_at, resumed_at, pause_duration_seconds)
    VALUES (s.id, u, s.counted_at + interval '20 minutes', s.counted_at + interval '30 minutes', 600);
  cap := public._free_cap_instant(s.id);
  PERFORM allow_t.ok(cap = s.counted_at + interval '45 minutes', 'explicit pause pushes the cap instant out by exactly its length');
  PERFORM allow_t.ok(abs(public._allowance_active_seconds(s.id, cap) - 2100) < 0.001, 'the two allowance formulas agree at the cap instant');
  PERFORM public.enforce_all_free_live_caps();
  v := allow_t.sess(s.id);
  PERFORM allow_t.ok(v.ended_at = cap AND v.total_paused_seconds = 600, 'ended at the paused-adjusted instant; canonical pause total untouched');

  -- open pause that began BEFORE the cap: active time is frozen, no cap
  s2 := allow_t.mk_session(u2, interval '50 minutes', interval '50 minutes', 'live', 'paused');
  UPDATE public.live_sessions SET paused_at = s2.counted_at + interval '30 minutes' WHERE id = s2.id;
  INSERT INTO public.live_session_pauses (session_id, user_id, paused_at) VALUES (s2.id, u2, s2.counted_at + interval '30 minutes');
  PERFORM public.enforce_all_free_live_caps();
  v2 := allow_t.sess(s2.id);
  PERFORM allow_t.ok(v2.status = 'live' AND v2.live_substate = 'paused', 'a paused stream below its limit is not capped');
  PERFORM allow_t.as_user(u2); r := public.get_live_mode_allowance(); RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  PERFORM allow_t.ok((r->'current'->>'paused')::boolean AND (r->'current'->>'active_seconds')::int = 1800 AND r->'current'->>'warning_level' = 'warn30' AND r->'current'->'cap_at' = 'null'::jsonb, 'paused state: active frozen at 1800 s, no cap time');

  -- open pause that began AFTER the cap instant: ended at the cap, pause closed
  s3 := allow_t.mk_session(u3, interval '60 minutes', interval '60 minutes', 'live', 'paused');
  UPDATE public.live_sessions SET paused_at = s3.counted_at + interval '40 minutes' WHERE id = s3.id;
  INSERT INTO public.live_session_pauses (session_id, user_id, paused_at) VALUES (s3.id, u3, s3.counted_at + interval '40 minutes');
  PERFORM public.enforce_all_free_live_caps();
  v3 := allow_t.sess(s3.id);
  PERFORM allow_t.ok(v3.ended_at = s3.counted_at + interval '2100 seconds' AND v3.paused_at IS NULL AND v3.total_paused_seconds = 0, 'cap before a late pause: ended at the cap, no phantom paused time');
  PERFORM allow_t.ok((SELECT resumed_at FROM public.live_session_pauses WHERE session_id = s3.id) = v3.ended_at AND (SELECT pause_duration_seconds FROM public.live_session_pauses WHERE session_id = s3.id) = 0, 'the dangling pause row is closed with zero length');

  -- an inactivity gap folded into total_paused_seconds is NOT subtracted
  s4 := allow_t.mk_session(u4, interval '40 minutes', interval '40 minutes', 'inactive_warning', 'active', interval '25 minutes', 600);
  PERFORM public.enforce_all_free_live_caps();
  v4 := allow_t.sess(s4.id);
  PERFORM allow_t.ok(v4.ended_at = s4.counted_at + interval '2100 seconds' AND v4.session_resolution_type = 'free_cap_reached', 'inactivity gaps count as active time for the cap (no minutes given back)');
END $$;

-- ═══ T12  "still live" cannot give Free minutes back ════════════════════
DO $$
DECLARE u uuid := allow_t.capped('t12'); s public.live_sessions; v public.live_sessions; r jsonb;
BEGIN
  s := allow_t.mk_session(u, interval '30 minutes', interval '30 minutes', 'inactive_warning', 'active', interval '12 minutes');
  UPDATE public.live_sessions SET warning_started_at = now() - interval '12 minutes' WHERE id = s.id;
  PERFORM allow_t.as_user(u); PERFORM public.resolve_live_session('still_live', NULL); r := public.get_live_mode_allowance(); RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  v := allow_t.sess(s.id);
  PERFORM allow_t.ok(v.status = 'live' AND v.total_paused_seconds = 720, 'canonical behavior unchanged: the gap is folded into total_paused_seconds');
  PERFORM allow_t.ok((r->'current'->>'active_seconds')::int = 1800, 'but the allowance clock still counts those 12 minutes as active');
END $$;

-- ═══ T13  every function that touches an active session enforces first ══
DO $$
DECLARE
  rec record; u uuid; s public.live_sessions; v public.live_sessions; n int := 0;
  calls text[][] := ARRAY[
    ['pause_live_session',                'SELECT public.pause_live_session()'],
    ['resume_live_session',               'SELECT public.resume_live_session()'],
    ['stop_live_session',                 'SELECT public.stop_live_session()'],
    ['clear_live_session_tips',           'SELECT public.clear_live_session_tips()'],
    ['set_live_session_goal_tokens',      'SELECT public.set_live_session_goal_tokens(500)'],
    ['set_live_session_coaching_strategy','SELECT public.set_live_session_coaching_strategy(''balanced'')'],
    ['send_website_heartbeat',            'SELECT public.send_website_heartbeat()'],
    ['send_extension_heartbeat',          'SELECT public.send_extension_heartbeat(''chaturbate'', true)'],
    ['resolve_live_session',              'SELECT public.resolve_live_session(''still_live'', NULL)'],
    ['sweep_stale_live_session',          'SELECT public.sweep_stale_live_session()'],
    ['get_live_mode_allowance',           'SELECT public.get_live_mode_allowance()'],
    ['end_private_interval',              'SELECT public.end_private_interval()'],
    ['start_live_session',                'SELECT public.start_live_session(''Chaturbate'')']
  ];
  i int;
BEGIN
  FOR i IN 1..array_length(calls, 1) LOOP
    u := allow_t.capped('t13_' || calls[i][1]);
    s := allow_t.mk_session(u, interval '40 minutes', interval '40 minutes', 'live', 'active', interval '1 minute');
    PERFORM allow_t.as_user(u);
    EXECUTE calls[i][2];
    RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
    v := allow_t.sess(s.id);
    PERFORM allow_t.ok(v.status = 'ended' AND v.session_resolution_type = 'free_cap_reached' AND v.ended_at = s.counted_at + interval '2100 seconds' AND v.finalized_at IS NOT NULL,
                       calls[i][1] || ' ends a capped session at the exact cap instant before doing anything else');
  END LOOP;
  -- Private Start on a session past the cap must not open an interval.
  u := allow_t.capped('t13_private');
  s := allow_t.mk_session(u, interval '40 minutes', interval '40 minutes', 'live', 'active', interval '1 minute', 0, 'Chaturbate');
  PERFORM allow_t.raises(u, $q$SELECT public.start_private_interval(2, 'Chaturbate', 'fan')$q$, 'NO_LIVE_SESSION%', 'private start past the cap cannot open an interval');
  PERFORM allow_t.ok((SELECT count(*) FROM public.live_private_intervals WHERE user_id = u) = 0, 'no private interval was created');
  -- The failed call rolled back with its error (including its cap-end); the very next
  -- enforcement (any call, or the 1-minute cron) ends it at the SAME exact instant.
  PERFORM public.enforce_all_free_live_caps();
  PERFORM allow_t.ok((allow_t.sess(s.id)).status = 'ended' AND (allow_t.sess(s.id)).ended_at = s.counted_at + interval '2100 seconds', 'the capped session ends at the exact cap instant on the next enforcement');
  -- start_live_session after a cap-end allows the next (1 of 2 used) stream
  SELECT id INTO u FROM auth.users WHERE email = 't13_start_live_session@test.invalid';
  PERFORM allow_t.ok((SELECT count(*) FROM public.live_sessions WHERE user_id = u AND status = 'starting') = 1, 'Start after a cap-end creates the next pending session (1 of 2 used)');
END $$;

-- ═══ T14  unlimited Pro is never capped ═════════════════════════════════
DO $$
DECLARE u uuid := allow_t.unlimited('t14'); s public.live_sessions; r jsonb;
BEGIN
  s := allow_t.mk_session(u, interval '3 hours', interval '3 hours');
  PERFORM public.enforce_all_free_live_caps();
  PERFORM allow_t.ok((allow_t.sess(s.id)).status = 'live', 'a 3-hour unlimited stream keeps running');
  PERFORM allow_t.as_user(u); r := public.get_live_mode_allowance(); RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  PERFORM allow_t.ok((r->>'unlimited')::boolean AND (r->>'can_start')::boolean AND r->'limits' = 'null'::jsonb, 'state reports unlimited with no limits');
END $$;

-- ═══ T15  strict Private Mode ═══════════════════════════════════════════
DO $$
DECLARE u uuid := allow_t.capped('t15'); s public.live_sessions; i public.live_private_intervals; j public.live_private_intervals; v public.live_sessions;
BEGIN
  s := allow_t.mk_session(u, interval '20 minutes', interval '20 minutes');
  PERFORM allow_t.raises(u, $q$SELECT public.start_private_interval(2.5, NULL, 'fan')$q$, 'PLATFORM_REQUIRED%', 'no platform fails (no session fallback)');
  PERFORM allow_t.raises(u, $q$SELECT public.start_private_interval(2.5, 'Stripchat', 'fan')$q$, 'PLATFORM_REQUIRED%', 'unsupported platform fails');
  PERFORM allow_t.raises(u, $q$SELECT public.start_private_interval(2.5, 'MyFreeCams', '  ')$q$, 'USERNAME_REQUIRED%', 'blank username fails');
  PERFORM allow_t.raises(u, $q$SELECT public.start_private_interval(2.5, 'MyFreeCams', '@@')$q$, 'USERNAME_REQUIRED%', 'username that is only @ fails');
  PERFORM allow_t.raises(u, $q$SELECT public.start_private_interval(-1, 'MyFreeCams', 'fan')$q$, '%rate_per_minute%', 'negative rate fails');
  PERFORM allow_t.ok((SELECT count(*) FROM public.live_private_intervals WHERE user_id = u) = 0, 'failed attempts create nothing');
  PERFORM allow_t.as_user(u);
  i := public.start_private_interval(2.5, 'myfreecams', '@@SomeFan ');
  j := public.start_private_interval(9, 'Chaturbate', 'other');   -- already open: returns the same interval
  RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  PERFORM allow_t.ok(i.platform = 'MyFreeCams' AND i.username = 'SomeFan' AND i.rate_per_minute = 2.5 AND i.ended_at IS NULL, 'canonical platform, normalized username, rate and start stored');
  PERFORM allow_t.ok(j.id = i.id AND j.rate_per_minute = 2.5, 'a repeated Start returns the open interval unchanged');
  PERFORM allow_t.raises(u, $q$SELECT public.start_private_interval(2.5, 'MyFreeCams')$q$, '%permission denied%', 'the legacy two-argument function is not callable by authenticated');
  UPDATE public.live_private_intervals SET started_at = now() - interval '10 minutes' WHERE id = i.id;
  PERFORM allow_t.as_user(u); j := public.end_private_interval(); RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  PERFORM allow_t.ok(j.ended_at IS NOT NULL AND j.estimated_earnings_usd = 25.00, 'earnings are finalized by the existing close path: 10 min x 2.5 = 25.00');
  v := allow_t.sess(s.id);
  PERFORM allow_t.ok(v.status = 'live', 'ending Private Mode does not stop the Live session');
  PERFORM allow_t.as_user(u); PERFORM public.stop_live_session(); RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  v := allow_t.sess(s.id);
  PERFORM allow_t.ok(v.final_private_usd = 25.00 AND v.final_total_usd = v.final_public_usd + 25.00, 'show total = public + private');
END $$;

-- ═══ T16  the cap closes an open private interval at the cap instant ════
DO $$
DECLARE u uuid := allow_t.capped('t16'); s public.live_sessions; i public.live_private_intervals;
BEGIN
  s := allow_t.mk_session(u, interval '40 minutes', interval '40 minutes');
  INSERT INTO public.live_private_intervals (user_id, live_session_id, platform, username, started_at, rate_per_minute)
    VALUES (u, s.id, 'Chaturbate', 'vip', s.counted_at + interval '20 minutes', 2.00);
  PERFORM public.enforce_all_free_live_caps();
  SELECT * INTO i FROM public.live_private_intervals WHERE user_id = u;
  PERFORM allow_t.ok(i.ended_at = s.counted_at + interval '2100 seconds' AND i.estimated_earnings_usd = 30.00, 'private interval closed at the cap instant: 15 min x 2.00 = 30.00 (not up to now)');
  PERFORM allow_t.ok((allow_t.sess(s.id)).final_private_usd = 30.00, 'and the show includes exactly that');
END $$;

-- ═══ T17  insert-time guard (defense in depth) ══════════════════════════
DO $$
DECLARE u uuid := allow_t.capped('t17'); u_tz uuid := allow_t.capped('t17tz', NULL); i int;
BEGIN
  FOR i IN 1..2 LOOP
    PERFORM allow_t.mk_session(u, interval '2 seconds', interval '1 second', 'ended');
    UPDATE public.live_sessions SET ended_at = now(), is_active = false, live_substate = NULL
      WHERE user_id = u AND status = 'ended' AND ended_at IS NULL;
  END LOOP;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  BEGIN
    INSERT INTO public.live_sessions (user_id, status, started_at, stream_platform) VALUES (u, 'starting', now(), 'Chaturbate');
    RAISE EXCEPTION 'FAILED: direct insert past the weekly limit was allowed';
  EXCEPTION WHEN OTHERS THEN
    PERFORM allow_t.ok(SQLERRM LIKE 'FREE_LIVE_WEEKLY_LIMIT%', 'direct insert at the weekly limit is refused by the trigger');
  END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_tz)::text, true);
  BEGIN
    INSERT INTO public.live_sessions (user_id, status, started_at, stream_platform) VALUES (u_tz, 'starting', now(), 'Chaturbate');
    RAISE EXCEPTION 'FAILED: direct insert without a timezone was allowed';
  EXCEPTION WHEN OTHERS THEN
    PERFORM allow_t.ok(SQLERRM LIKE 'TIMEZONE_REQUIRED%', 'direct insert without a timezone is refused by the trigger');
  END;
  RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- ═══ T18  counting only on the transition into live ═════════════════════
DO $$
DECLARE u uuid := allow_t.capped('t18'); s public.live_sessions;
BEGIN
  s := allow_t.mk_session(u, interval '5 minutes', NULL, 'live', 'active');   -- legacy-style: live but never counted
  UPDATE public.live_sessions SET last_heartbeat_at = now(), total_tips = 1 WHERE id = s.id;
  PERFORM allow_t.ok((allow_t.sess(s.id)).counted_at IS NULL, 'unrelated updates never stamp counted_at (the migration preflight blocks applying while a stream is live)');
END $$;

-- ═══ T19  privileges ════════════════════════════════════════════════════
DO $$
DECLARE u uuid := allow_t.capped('t19'); r jsonb;
BEGIN
  PERFORM allow_t.raises(u, format('SELECT public._enforce_free_live_cap(%L)', u), '%permission denied%', 'authenticated cannot call the cap enforcer');
  PERFORM allow_t.raises(u, format('SELECT public.live_mode_entitlement(%L)', u), '%permission denied%', 'authenticated cannot call the entitlement function directly');
  PERFORM allow_t.raises(u, format('SELECT public._assert_may_start_live(%L)', u), '%permission denied%', 'authenticated cannot call the gate directly');
  PERFORM allow_t.raises(u, format('SELECT public._expire_never_connected(%L)', u), '%permission denied%', 'authenticated cannot call the never-connected closer');
  PERFORM allow_t.raises(NULL, 'SELECT public.get_live_mode_allowance()', '%permission denied%', 'anon cannot read allowance state');
  PERFORM allow_t.raises(NULL, $q$SELECT public.start_live_session('Chaturbate')$q$, '%', 'anon cannot start (permission denied or Not authenticated)');
  PERFORM allow_t.as_user(u); r := public.get_live_mode_allowance(); RESET ROLE; PERFORM set_config('request.jwt.claims', '', true);
  PERFORM allow_t.ok(r->>'entitlement' = 'capped', 'authenticated can read its own allowance state');
END $$;

DO $$
DECLARE n int;
BEGIN
  SELECT passes.n INTO n FROM allow_t.passes;
  RAISE NOTICE 'LIVE MODE ALLOWANCE TESTS: ALL PASSED (% checks)', n;
END $$;

ROLLBACK;
