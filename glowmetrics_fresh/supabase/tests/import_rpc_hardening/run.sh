#!/usr/bin/env bash
# Rehearse 20261101_harden_dedup_rpc_grants.sql against a DISPOSABLE local
# Postgres. NEVER point this at production or staging.
#
# Usage: PGHOST=/path/to/socket PGPORT=54331 ./run.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"   # glowmetrics_fresh/supabase
MIG="$ROOT/migrations/20261101_harden_dedup_rpc_grants.sql"
REC="$ROOT/rollbacks/20261101_harden_dedup_rpc_grants.rollback.sql"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -U "${PGUSER:-postgres}")
DB=import_rpc_rehearsal
PF=import_rpc_preflight
LOG="$(mktemp)"

case "${PGHOST:-}" in
  *supabase.co*|*supabase.com*) echo "Refusing to run against a Supabase host." >&2; exit 2 ;;
esac

run() { "${PSQL[@]}" -d "$1" -f "$2" 2>&1 | tee -a "$LOG" | grep -E 'PASS|FAIL|ERROR' || true; }
q()   { "${PSQL[@]}" -d "$DB" -tA -c "$1"; }
check() { if [ "$1" = "$2" ]; then echo "PASS: $3" | tee -a "$LOG"; else echo "FAIL: $3 (got '$1', want '$2')" | tee -a "$LOG"; fi; }
step() { echo; echo "== $*"; }

"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "DROP DATABASE IF EXISTS $PF" -c "CREATE DATABASE $DB" -c "CREATE DATABASE $PF"

step "mirror + seed"; run $DB "$HERE/00_mirror.sql"; run $DB "$HERE/10_seed.sql"
check "$(q "SELECT md5(prosrc) FROM pg_proc WHERE oid='public.insert_tips_dedup(jsonb,uuid)'::regprocedure")" 17eb475cd6ba94dba9bc46f5a3a119ab "mirror: insert_tips_dedup body md5 == production"
check "$(q "SELECT md5(prosrc) FROM pg_proc WHERE oid='public.insert_paid_sessions_dedup(jsonb)'::regprocedure")" 89a624f9e63b001e2571110c06544734 "mirror: insert_paid_sessions_dedup body md5 == production"

step "baseline (production-identical functions)"; run $DB "$HERE/15_baseline.sql"
step "apply migration"; run $DB "$MIG"
step "verify";          run $DB "$HERE/20_after.sql"

step "concurrency: two overlapping imports for one creator"
A=00000000-0000-0000-0000-00000000000a
row() { printf '{"user_id":"%s","date_time":"2026-06-01T00:%02d:00Z","platform":"Chaturbate","username":"cc%d","tokens":"%d","tip_seq":"1"}' $A "$1" "$1" $((10+$1)); }
X="[$(row 1),$(row 2),$(row 3),$(row 4),$(row 5)]"            # import 1: rows 1-5
XY="[$(row 3),$(row 4),$(row 5),$(row 6),$(row 7),$(row 8)]"  # import 2 overlaps 3-5, adds 6-8
CLAIMS="SET request.jwt.claim.role='authenticated'; SET request.jwt.claim.sub='$A'; SET ROLE authenticated;"
"${PSQL[@]}" -d $DB -tA -c "BEGIN; $CLAIMS SELECT public.insert_tips_dedup('$X'::jsonb,'10000000-0000-0000-0000-0000000000a1'); SELECT pg_sleep(3); COMMIT;" > "$LOG.s1" &
P1=$!; sleep 1
T0=$(date +%s)
"${PSQL[@]}" -d $DB -tA -c "$CLAIMS SELECT public.insert_tips_dedup('$XY'::jsonb,'10000000-0000-0000-0000-0000000000a2');" > "$LOG.s2"
T1=$(date +%s); wait $P1
check "$(grep -o '"inserted": [0-9]*' "$LOG.s1")" '"inserted": 5' "concurrency: import 1 inserted its 5 rows"
check "$(grep -o '"inserted": [0-9]*' "$LOG.s2")" '"inserted": 3' "concurrency: import 2 (started while 1 was uncommitted) inserted only the 3 new rows"
check "$([ $((T1-T0)) -ge 1 ] && echo waited)" waited "concurrency: import 2 waited on import 1's uncommitted rows instead of double-inserting"
check "$(q "SELECT count(*) FROM tips WHERE username LIKE 'cc%'")" 8 "concurrency: 8 distinct tips total, no duplicates"
check "$(q "SELECT count(*) FROM tips WHERE username IN ('cc3','cc4','cc5') AND upload_id='10000000-0000-0000-0000-0000000000a1'")" 3 "concurrency: overlapping rows keep the FIRST import's upload_id"
q "DELETE FROM tips WHERE username LIKE 'cc%'" >/dev/null

step "concurrency: first import rolls back, second must insert everything"
"${PSQL[@]}" -d $DB -tA -c "BEGIN; $CLAIMS SELECT public.insert_tips_dedup('$X'::jsonb,'10000000-0000-0000-0000-0000000000a1'); SELECT pg_sleep(3); ROLLBACK;" > /dev/null &
P1=$!; sleep 1
"${PSQL[@]}" -d $DB -tA -c "$CLAIMS SELECT public.insert_tips_dedup('$XY'::jsonb,'10000000-0000-0000-0000-0000000000a2');" > "$LOG.s3"; wait $P1
check "$(grep -o '"inserted": [0-9]*' "$LOG.s3")" '"inserted": 6' "concurrency: after the other import rolled back, all 6 rows inserted (nothing lost)"
q "DELETE FROM tips WHERE username LIKE 'cc%'" >/dev/null
"${PSQL[@]}" -d $DB -c "SELECT t.assert_history_unchanged('after concurrency')" 2>&1 | tee -a "$LOG" | grep -E 'PASS|FAIL' || true

step "re-run migration (idempotent)"; run $DB "$MIG"
"${PSQL[@]}" -d $DB -c "SELECT t.assert_history_unchanged('after re-run')" 2>&1 | tee -a "$LOG" | grep -E 'PASS|FAIL' || true

step "recovery script (keeps security fix)"; run $DB "$REC"; run $DB "$HERE/30_after_recovery.sql"
step "re-apply migration after recovery"; run $DB "$MIG"
check "$(q "SELECT md5(prosrc) FROM pg_proc WHERE oid='public.insert_tips_dedup(jsonb,uuid)'::regprocedure")" 697af8bff40087433588302799d1d03e "re-apply: hardened tips body restored"

step "preflight refuses a function changed by other work (e.g. money precision)"
run $PF "$HERE/00_mirror.sql"
"${PSQL[@]}" -d $PF -c "CREATE OR REPLACE FUNCTION public.insert_tips_dedup(tips jsonb, p_upload_id uuid DEFAULT NULL::uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS \$\$ BEGIN RETURN '{}'::jsonb; END \$\$;"
OUT="$(mktemp)"
if "${PSQL[@]}" -d $PF -f "$MIG" >"$OUT" 2>&1; then
  echo "FAIL: migration overwrote a changed insert_tips_dedup" | tee -a "$LOG"
elif grep -q 'Preflight failed: insert_tips_dedup' "$OUT"; then
  echo "PASS: preflight refused to overwrite a changed insert_tips_dedup" | tee -a "$LOG"
else
  echo "FAIL: migration failed for an unexpected reason"; cat "$OUT" | tee -a "$LOG"
fi
check "$("${PSQL[@]}" -d $PF -tA -c "SELECT has_function_privilege('anon','public.insert_paid_sessions_dedup(jsonb)','EXECUTE')")" t "preflight: a refused migration changed nothing (transaction rolled back)"

echo
PASSES=$(grep -c 'PASS' "$LOG" || true); FAILS=$(grep -cE 'FAIL|ERROR' "$LOG" || true)
echo "SUMMARY: $PASSES passed, $FAILS failed"
[ "$FAILS" -eq 0 ]
