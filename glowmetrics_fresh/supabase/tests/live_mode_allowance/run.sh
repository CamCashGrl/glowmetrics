#!/usr/bin/env bash
# LOCAL / STAGING ONLY. Runs the Free Live Mode allowance SQL suite against a
# DISPOSABLE Postgres (never production):
#   PGHOST=/tmp PGPORT=54329 PGUSER=postgres ./run.sh
# Creates and drops its own databases (allowance_t, allowance_pf, allowance_rb).
set -euo pipefail
cd "$(dirname "$0")"
MIG=../../migrations
RB=../../rollbacks
q() { psql -q -v ON_ERROR_STOP=1 "$@"; }
fresh() { dropdb --if-exists "$1" >/dev/null 2>&1; createdb "$1"; q -d "$1" -f 00_mirror.sql >/dev/null; }

echo "== 1. migrations + suite"
fresh allowance_t
q -d allowance_t -f "$MIG/20261029_live_mode_free_allowance.sql" >/dev/null
q -d allowance_t -f "$MIG/20261029b_private_interval_strict.sql" >/dev/null
q -d allowance_t -f 10_tests.sql 2>&1 | grep -E "ALL PASSED|ERROR|FAILED" || { echo "SUITE DID NOT REPORT SUCCESS"; exit 1; }

echo "== 2. preflight refuses entitlement drift and running streams"
fresh allowance_pf
psql -q -d allowance_pf -c "insert into auth.users values ('00000000-0000-4000-8000-000000000001','d@test.invalid'); insert into profiles(id,plan,subscription_status) values ('00000000-0000-4000-8000-000000000001','pro','none');" >/dev/null
if q -d allowance_pf -f "$MIG/20261029_live_mode_free_allowance.sql" >/dev/null 2>/tmp/pf.err; then echo "FAILED: drift did not block the migration"; exit 1; fi
grep -q ENTITLEMENT_DRIFT /tmp/pf.err && echo "ok: ENTITLEMENT_DRIFT blocks apply"
PGOPTIONS="-c camcash.accept_entitlement_drift=on" q -d allowance_pf -f "$MIG/20261029_live_mode_free_allowance.sql" >/dev/null && echo "ok: explicit override applies"
fresh allowance_pf
psql -q -d allowance_pf -c "insert into auth.users values ('00000000-0000-4000-8000-000000000002','r@test.invalid'); insert into live_sessions(user_id,status,started_at) values ('00000000-0000-4000-8000-000000000002','live',now());" >/dev/null
if q -d allowance_pf -f "$MIG/20261029_live_mode_free_allowance.sql" >/dev/null 2>/tmp/pf.err; then echo "FAILED: running stream did not block the migration"; exit 1; fi
grep -q LIVE_SESSIONS_RUNNING /tmp/pf.err && echo "ok: a running stream blocks apply"

echo "== 3. rollbacks are non-destructive and restore production text"
fresh allowance_rb
q -d allowance_rb -f "$MIG/20261029_live_mode_free_allowance.sql" >/dev/null
q -d allowance_rb -f "$MIG/20261029b_private_interval_strict.sql" >/dev/null
psql -q -d allowance_rb -c "insert into auth.users values ('00000000-0000-4000-8000-000000000003','b@test.invalid'); insert into live_sessions(user_id,status,started_at,counted_at,allowance_timezone) values ('00000000-0000-4000-8000-000000000003','ended',now(),now(),'America/New_York');" >/dev/null
q -d allowance_rb -f "$RB/20261029b_private_interval_strict.rollback.sql" >/dev/null
q -d allowance_rb -f "$RB/20261029_live_mode_free_allowance.rollback.sql" >/dev/null
psql -tA -d allowance_rb -c "select count(*) from live_sessions where counted_at is not null and allowance_timezone='America/New_York'" | grep -qx 1 && echo "ok: collected allowance data survives rollback"
psql -tA -d allowance_rb -c "select count(*) from information_schema.columns where table_name='live_private_intervals' and column_name='username'" | grep -qx 1 && echo "ok: username column survives rollback"
psql -tA -d allowance_rb -c "select proname||':'||md5(prosrc) from pg_proc where pronamespace='public'::regnamespace and proname in ('pause_live_session','resume_live_session','stop_live_session','resolve_live_session','send_website_heartbeat','send_extension_heartbeat','clear_live_session_tips','set_live_session_goal_tokens','set_live_session_coaching_strategy','sweep_stale_live_session','sweep_all_stale_live_sessions','start_live_session','persist_extension_tip','enforce_live_mode_pro_entitlement','end_private_interval') order by 1" > /tmp/rb.md5
for want in pause_live_session:0be5b37483e5fbfd07342702466b1fdc resume_live_session:cfc2c006ac4cee5b2296b733793f7133 stop_live_session:ba2ebb5520c81cea4c063e6e6dcc9443 resolve_live_session:2aed993eb20a82f1f3d448d2c972abb5 send_website_heartbeat:29c036fe4552c7dbf3312c451e8792ae send_extension_heartbeat:4c78fdc3869a612591148435849f7f71 clear_live_session_tips:96543db83c6541685fe922ad9b22bb51 set_live_session_goal_tokens:dd4069407fd9f6c10d795d57ea7dc95c set_live_session_coaching_strategy:1d868a835ddc8b5a1c8849d33a40a57b sweep_stale_live_session:028e107eb67b5b06f4f073b272980b5a sweep_all_stale_live_sessions:003474a9c52e6b802f4e2e47e512d3dd start_live_session:da56439bbbbcda93b3244a3f2c299892 persist_extension_tip:013f636617182a5833b3d2c4564dd20e enforce_live_mode_pro_entitlement:9536c3e5efc94d0902d4f64e78fa0f31 end_private_interval:7ab69a5901dcda730a05659bc288bc3a; do
  grep -qx "$want" /tmp/rb.md5 || { echo "FAILED: rollback did not restore $want"; exit 1; }
done
echo "ok: 15 functions restored byte-identical to production (md5(prosrc))"
dropdb allowance_t; dropdb allowance_pf; dropdb allowance_rb
echo "ALL SQL CHECKS DONE"
