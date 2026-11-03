\set ON_ERROR_STOP on
-- Assertion helper
CREATE FUNCTION pg_temp.ok(c boolean, msg text) RETURNS void LANGUAGE plpgsql AS
$$ BEGIN IF c IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: %', msg; END IF; RAISE NOTICE 'pass: %', msg; END $$;
CREATE FUNCTION pg_temp.err(q text) RETURNS text LANGUAGE plpgsql AS
$$ BEGIN EXECUTE q; RETURN 'NO ERROR'; EXCEPTION WHEN others THEN RETURN SQLERRM; END $$;

INSERT INTO profiles (id, plan, timezone) VALUES
  ('00000000-0000-0000-0000-00000000000f', 'free', 'America/Los_Angeles'),
  ('00000000-0000-0000-0000-00000000000a', 'pro', NULL),
  ('00000000-0000-0000-0000-00000000000e', 'pro', NULL),
  ('00000000-0000-0000-0000-00000000000b', 'free', NULL);
UPDATE profiles SET plan_expires_at = now() - interval '1 day' WHERE id = '00000000-0000-0000-0000-00000000000e';

-- ── platform-cap triggers gone ──
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname LIKE 'trg_enforce_platform_limit_%'), '3-platform ingestion triggers removed');

-- ── Pro rule unchanged ──
SELECT pg_temp.ok(is_live_mode_pro('00000000-0000-0000-0000-00000000000a'), 'pro w/o expiry = pro');
SELECT pg_temp.ok(NOT is_live_mode_pro('00000000-0000-0000-0000-00000000000e'), 'expired pro = not pro');
SELECT pg_temp.ok(NOT is_live_mode_pro('00000000-0000-0000-0000-00000000000f'), 'free = not pro');
SELECT pg_temp.ok(NOT is_live_mode_pro('00000000-0000-0000-0000-0000000000ff'), 'missing profile = not pro');

-- ── creator-local week ──
SELECT pg_temp.ok(_live_week_start('America/Los_Angeles', '2026-10-26 06:59:00+00') = '2026-10-19 07:00:00+00', 'Sun 23:59 LA is still previous week (starts Mon 00:00 LA = 07:00Z)');
SELECT pg_temp.ok(_live_week_start('America/Los_Angeles', '2026-10-26 07:00:00+00') = '2026-10-26 07:00:00+00', 'Mon 00:00 LA starts new week');
SELECT pg_temp.ok(_live_week_start('Asia/Tokyo', '2026-10-25 15:30:00+00') = '2026-10-25 15:00:00+00', 'Tokyo Monday begins Sun 15:00Z');
SELECT pg_temp.ok(_live_week_start('America/New_York', '2026-11-02 05:30:00+00') = '2026-11-02 05:00:00+00', 'DST end week (EST Mon 00:00 = 05:00Z)');
SELECT pg_temp.ok(_live_creator_timezone('00000000-0000-0000-0000-00000000000f', 'Asia/Tokyo') = 'America/Los_Angeles', 'saved tz beats browser tz');
SELECT pg_temp.ok(_live_creator_timezone('00000000-0000-0000-0000-00000000000b', 'Asia/Tokyo') = 'Asia/Tokyo', 'browser tz used when none saved');
SELECT pg_temp.ok(_live_creator_timezone('00000000-0000-0000-0000-00000000000b', 'Mars/Base') = 'UTC', 'invalid browser tz -> UTC');

-- ── Free: 2 starts per week ──
SELECT set_config('test.uid', '00000000-0000-0000-0000-00000000000f', false);
SELECT pg_temp.ok((start_live_session('BongaCams', NULL)).stream_platform = 'BongaCams', 'free start #1 allowed');
SELECT pg_temp.ok((start_live_session('BongaCams', NULL)).id = (SELECT id FROM live_sessions WHERE status='starting'), 'reload/second tab reuses running session, no new start');
SELECT pg_temp.ok((SELECT count(*) FROM live_sessions) = 1, 'still one session after re-start');
UPDATE live_sessions SET status='ended', ended_at=now() WHERE status='starting';
SELECT pg_temp.ok((start_live_session('Chaturbate', NULL)).id IS NOT NULL, 'free start #2 allowed');
UPDATE live_sessions SET status='ended', ended_at=now() WHERE status='starting';
SELECT pg_temp.ok(pg_temp.err($$SELECT start_live_session('Chaturbate', NULL)$$) LIKE 'FREE_LIVE_WEEKLY_LIMIT%', 'free start #3 blocked: ' || pg_temp.err($$SELECT start_live_session('Chaturbate', NULL)$$));
SELECT pg_temp.ok(pg_temp.err($$INSERT INTO live_sessions (user_id, status) VALUES ('00000000-0000-0000-0000-00000000000f','starting')$$) LIKE 'FREE_LIVE_WEEKLY_LIMIT%', 'direct insert bypass also blocked');
SELECT pg_temp.ok((get_live_mode_allowance(NULL)->>'streams_used')::int = 2 AND get_live_mode_allowance(NULL)->>'timezone' = 'America/Los_Angeles', 'allowance read model');
-- last week's sessions do not count
UPDATE live_sessions SET started_at = started_at - interval '8 days', ended_at = ended_at - interval '8 days';
SELECT pg_temp.ok((start_live_session('Chaturbate', NULL)).id IS NOT NULL, 'new week -> start allowed again');
UPDATE live_sessions SET status='ended', ended_at=now() WHERE status='starting';
DELETE FROM live_sessions;

-- ── Pro unlimited, expired Pro is Free ──
SELECT set_config('test.uid', '00000000-0000-0000-0000-00000000000a', false);
DO $$ BEGIN FOR i IN 1..4 LOOP PERFORM start_live_session('Chaturbate', NULL); UPDATE live_sessions SET status='ended', ended_at=now() WHERE status='starting'; END LOOP; END $$;
SELECT pg_temp.ok((SELECT count(*) FROM live_sessions) = 4, 'pro: 4 starts allowed');
SELECT pg_temp.ok((get_live_mode_allowance(NULL)->>'unlimited')::boolean, 'pro allowance unlimited');
DELETE FROM live_sessions;

-- ── 35 active minutes, paused time excluded, exact end ──
SELECT set_config('test.uid', '00000000-0000-0000-0000-00000000000f', false);
SELECT start_live_session('BongaCams', NULL);
-- 30 active minutes so far + a 20-minute pause already folded in
UPDATE live_sessions SET status='live', live_substate='active', started_at = now() - interval '50 minutes', total_paused_seconds = 20*60, last_heartbeat_at = now();
SELECT pg_temp.ok((enforce_live_active_limit()).id IS NULL, '30 active min (50 wall, 20 paused) -> not ended');
-- now 36 active minutes
UPDATE live_sessions SET started_at = now() - interval '56 minutes';
SELECT pg_temp.ok((enforce_live_active_limit()).session_resolution_type = 'free_active_limit', '36 active min -> ended server-side');
SELECT pg_temp.ok((SELECT abs(final_duration_seconds - 2100) <= 1 FROM live_sessions), 'final duration = exactly 35:00 active: ' || (SELECT final_duration_seconds FROM live_sessions));
SELECT pg_temp.ok((SELECT abs(EXTRACT(EPOCH FROM (now() - ended_at)) - 60) < 2 FROM live_sessions), 'ended_at = the instant it hit 35 (1 min ago)');
DELETE FROM live_sessions;

-- paused past the limit? pause began at 34 active minutes -> still not ended
SELECT start_live_session('BongaCams', NULL);
UPDATE live_sessions SET status='live', live_substate='paused', started_at = now() - interval '2 hours', paused_at = now() - interval '86 minutes', total_paused_seconds = 0, last_heartbeat_at = now();
SELECT pg_temp.ok((enforce_live_active_limit()).id IS NULL, 'paused at 34 active min, paused 86 min -> not ended (pause does not consume)');
SELECT pg_temp.ok(sweep_free_live_active_limits() = 0, 'sweep agrees');
DELETE FROM live_sessions;

-- sweep ends closed-tab streams; closes open private at the cap
SELECT start_live_session('BongaCams', NULL);
UPDATE live_sessions SET status='live', live_substate='active', started_at = now() - interval '40 minutes', last_heartbeat_at = now();
SELECT set_config('test.uid', '', false);
INSERT INTO live_private_intervals (user_id, live_session_id, platform, username, rate_per_minute, started_at)
  SELECT user_id, id, 'BongaCams', 'fan1', 2.00, now() - interval '10 minutes' FROM live_sessions;
SELECT pg_temp.ok(sweep_free_live_active_limits() = 1, 'service sweep ends stream nobody is polling');
SELECT pg_temp.ok((SELECT estimated_earnings_usd FROM live_private_intervals) = 10.00, 'open private closed at the cap: 5 min x $2 = $10 -> ' || (SELECT estimated_earnings_usd FROM live_private_intervals));
DELETE FROM live_private_intervals; DELETE FROM live_sessions;

-- inactive_warning with last heartbeat before the cap -> left to stale sweep
SELECT set_config('test.uid', '00000000-0000-0000-0000-00000000000f', false);
SELECT start_live_session('BongaCams', NULL);
UPDATE live_sessions SET status='inactive_warning', live_substate='active', started_at = now() - interval '50 minutes', last_heartbeat_at = now() - interval '30 minutes';
SELECT pg_temp.ok((enforce_live_active_limit()).id IS NULL, 'silent since minute 20 -> stale sweep decides end, not the cap');
DELETE FROM live_sessions;

-- pro never ended
SELECT set_config('test.uid', '00000000-0000-0000-0000-00000000000a', false);
SELECT start_live_session('Chaturbate', NULL);
UPDATE live_sessions SET status='live', live_substate='active', started_at = now() - interval '5 hours';
SELECT pg_temp.ok((enforce_live_active_limit()).id IS NULL AND sweep_free_live_active_limits() = 0, 'pro 5h stream untouched');
DELETE FROM live_sessions;

-- ── Private Mode ──
SELECT set_config('test.uid', '00000000-0000-0000-0000-00000000000b', false);
SELECT pg_temp.ok(pg_temp.err($$SELECT start_private_interval(2, NULL, 'fan')$$) LIKE 'NO_LIVE_SESSION%', 'private needs a live session');
SELECT start_live_session('BongaCams', NULL);
UPDATE live_sessions SET status='live', live_substate='active';
SELECT pg_temp.ok(pg_temp.err($$SELECT start_private_interval(2, NULL, '  ')$$) LIKE 'USERNAME_REQUIRED%', 'username required');
SELECT pg_temp.ok(pg_temp.err($$SELECT start_private_interval(NULL, NULL, 'fan')$$) LIKE 'INVALID_RATE%', 'rate required');
SELECT pg_temp.ok(pg_temp.err($$SELECT start_private_interval(2, 'Chaturbate', 'fan')$$) LIKE 'PLATFORM_MISMATCH%', 'requested platform must match session');
UPDATE live_sessions SET extension_platform = 'chaturbate';
SELECT pg_temp.ok(pg_temp.err($$SELECT start_private_interval(2, NULL, 'fan')$$) LIKE 'PLATFORM_MISMATCH%', 'extension-detected platform disagreeing -> refused, nothing saved');
SELECT pg_temp.ok((SELECT count(*) FROM live_private_intervals) = 0, 'no interval saved on refusal');
UPDATE live_sessions SET extension_platform = 'bongacams';
SELECT pg_temp.ok((start_private_interval(2.5, 'bongacams', ' Fan_One ')).platform = 'BongaCams', 'canonical platform recorded');
SELECT pg_temp.ok((SELECT username FROM live_private_intervals) = 'Fan_One', 'username trimmed + stored');
SELECT pg_temp.ok((start_private_interval(9, NULL, 'other')).username = 'Fan_One', 'refresh/second Start returns the open interval (no duplicate)');
SELECT pg_temp.ok((SELECT count(*) FROM live_private_intervals) = 1, 'one open interval');
SELECT pg_temp.ok((SELECT status FROM live_sessions) = 'live', 'session still live while private');

-- ── grants ──
SELECT pg_temp.ok(NOT has_function_privilege('anon', 'public.enforce_live_active_limit()', 'EXECUTE'), 'anon cannot call enforce');
SELECT pg_temp.ok(NOT has_function_privilege('authenticated', 'public.sweep_free_live_active_limits()', 'EXECUTE'), 'creators cannot run the global sweep');
SELECT pg_temp.ok(NOT has_function_privilege('authenticated', 'public._end_live_session_at_free_limit(public.live_sessions)', 'EXECUTE'), 'creators cannot end arbitrary sessions');
SELECT pg_temp.ok(NOT has_function_privilege('anon', 'public.check_live_mode_pro_entitlement(uuid)', 'EXECUTE'), 'anon EXECUTE on pro check revoked');
SELECT pg_temp.ok((SELECT schedule FROM cron.job WHERE jobname='sweep-free-live-active-limits') = '* * * * *', 'sweep scheduled every minute');
-- Stripchat: lowercase extension detection must not be a false mismatch
SELECT set_config('test.uid', '00000000-0000-0000-0000-00000000000b', false);
SELECT end_private_interval();
UPDATE live_sessions SET status='ended', ended_at=now();
UPDATE profiles SET plan='pro' WHERE id='00000000-0000-0000-0000-00000000000b';
SELECT start_live_session('Stripchat', NULL);
UPDATE live_sessions SET status='live', live_substate='active', extension_platform='stripchat' WHERE status='starting';
SELECT pg_temp.ok((start_private_interval(1, 'stripchat', 'sfan')).platform = 'Stripchat', 'stripchat detection matches Stripchat session');
SELECT pg_temp.ok((SELECT estimated_earnings_usd FROM live_private_intervals WHERE username='Fan_One') IS NOT NULL, 'end_private_interval closed the earlier interval with an estimate');
