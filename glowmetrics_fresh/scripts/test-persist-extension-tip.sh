#!/usr/bin/env bash
# Runs persist_extension_tip against a real Postgres built from the production
# schema replica + the Phase 1 migrations. Needs a disposable Postgres:
#   PGHOST/PGPORT/PGUSER pointing at a server where this script may create and
#   drop the database "cc_persist_tip_test". Never point this at Supabase.
set -euo pipefail
cd "$(dirname "$0")/.."

DB=cc_persist_tip_test
psql -v ON_ERROR_STOP=1 -q -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
run() { psql -v ON_ERROR_STOP=1 -q -d "$DB" "$@"; }

run -f supabase/tests/fixtures/prod_live_tips_schema.sql
run -f supabase/migrations/20261003_add_client_event_id_for_extension_idempotency.sql
run -f supabase/migrations/20261003_add_persist_extension_tip_rpc.sql
run -f supabase/tests/persist_extension_tip.test.sql

# Concurrency: 10 simultaneous submissions of one event must persist exactly once.
U=00000000-0000-0000-0000-0000000000c1
EV=cccccccc-0000-4000-8000-000000000001
run -c "INSERT INTO profiles VALUES ('$U','free',NULL)"
for i in $(seq 1 10); do
  run -c "SELECT public.persist_extension_tip('$U','$EV',NULL,'Racer',100,5.00,'chaturbate','2026-10-03 22:00:00+00',0)" >/dev/null &
done
wait
LIVE=$(run -tAc "SELECT count(*) FROM live_tips WHERE user_id='$U'")
CANON=$(run -tAc "SELECT count(*) FROM tips WHERE user_id='$U'")
if [ "$LIVE" != "1" ] || [ "$CANON" != "1" ]; then
  echo "FAIL concurrency: live=$LIVE canonical=$CANON (expected 1/1)"; exit 1
fi
echo "PASS concurrency: 10 parallel submissions -> live=1 canonical=1"

psql -q -d postgres -c "DROP DATABASE $DB"
