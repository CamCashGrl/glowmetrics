#!/usr/bin/env bash
# Rehearse Batch 1 (migrations 20261029c + 20261029d) against a disposable,
# production-shaped local Postgres. NEVER point this at production or staging:
# 15_baseline_vulnerability.sql really truncates tables (inside a rolled-back
# transaction) to prove the anon hole exists before the fix.
#
# Usage: PGHOST=/path/to/socket PGPORT=54329 ./run.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"   # glowmetrics_fresh/supabase
MIG_A="$ROOT/migrations/20261029c_revoke_anon_writes_tips_live_tips_coaching_events.sql"
MIG_B="$ROOT/migrations/20261029d_widen_tip_usd_precision.sql"
RB_A="$ROOT/rollbacks/20261029c_revoke_anon_writes_tips_live_tips_coaching_events.rollback.sql"
RB_B="$ROOT/rollbacks/20261029d_widen_tip_usd_precision.rollback.sql"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -U "${PGUSER:-postgres}")
DB=batch1_rehearsal
FRESH=batch1_fresh
LOG="$(mktemp)"

case "${PGHOST:-}" in
  *supabase.co*|*supabase.com*) echo "Refusing to run against a Supabase host." >&2; exit 2 ;;
esac

run() { "${PSQL[@]}" -d "$1" -f "$2" 2>&1 | tee -a "$LOG" | grep -E 'PASS|FAIL|ERROR' || true; }
step() { echo; echo "== $*"; }

"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "DROP DATABASE IF EXISTS $FRESH" -c "CREATE DATABASE $DB" -c "CREATE DATABASE $FRESH"

step "mirror + seed";                 run $DB "$HERE/00_mirror.sql"; run $DB "$HERE/10_seed.sql"
step "baseline: vulnerability exists"; run $DB "$HERE/15_baseline_vulnerability.sql"
step "apply A";                       run $DB "$MIG_A"
step "verify A";                      run $DB "$HERE/20_after_A.sql"
step "apply B";                       run $DB "$MIG_B"
step "verify B + money fixtures";     run $DB "$HERE/30_after_B.sql"

step "B must refuse to run twice"
TWICE="$(mktemp)"
if "${PSQL[@]}" -d $DB -f "$MIG_B" >"$TWICE" 2>&1; then
  echo "FAIL: B applied twice" | tee -a "$LOG"; exit 1
elif grep -q 'Preflight failed' "$TWICE"; then
  echo "PASS: B preflight refuses an already-widened schema" | tee -a "$LOG"
else
  echo "FAIL: B second run failed for an unexpected reason" | tee -a "$LOG"; cat "$TWICE"; exit 1
fi

step "rollback B, rollback A";        run $DB "$RB_B"; run $DB "$RB_A"
step "verify rollback";               run $DB "$HERE/40_after_rollback.sql"

step "re-apply A + B after rollback"; run $DB "$MIG_A"; run $DB "$MIG_B"
"${PSQL[@]}" -d $DB -c "SELECT t.assert_history_unchanged('after re-apply')" 2>&1 | tee -a "$LOG" | grep -E 'PASS|FAIL' || true

step "fresh rebuild: mirror + A + B"
run $FRESH "$HERE/00_mirror.sql"; run $FRESH "$MIG_A"; run $FRESH "$MIG_B"
dump() { pg_dump -U "${PGUSER:-postgres}" --schema-only --no-owner --schema=public "$1" | grep -v '^--' | grep -v '^SET ' | grep -vE '^.(un)?restrict ' | sed '/^$/d' | sort; }
if diff <(dump $DB) <(dump $FRESH) >/dev/null; then
  echo "PASS: rehearsed schema == fresh mirror + A + B (public schema identical)" | tee -a "$LOG" >/dev/null
else
  echo "FAIL: schema differs between rehearsal and fresh rebuild"; diff <(dump $DB) <(dump $FRESH) | head -40; exit 1
fi

echo
PASSES=$(grep -c 'PASS' "$LOG" || true); FAILS=$(grep -cE 'FAIL|ERROR' "$LOG" || true)
echo "SUMMARY: $PASSES passed, $FAILS failed"
[ "$FAILS" -eq 0 ]
