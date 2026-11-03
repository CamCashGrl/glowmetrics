#!/usr/bin/env bash
# Rehearse the #729 migrations THROUGH PostgREST (the Supabase Data API layer)
# with anonymous, authenticated and service_role JWTs, against a DISPOSABLE
# local Postgres. NEVER point this at production or staging.
#
# STATUS: written but NOT YET EXECUTED.
#
# Requires: a PostgREST binary (https://github.com/PostgREST/postgrest/releases,
# static linux build; v12.x matches what Supabase runs closely) -- not
# downloaded by this script -- and node >= 18.
#
# Usage:
#   PGHOST=/path/to/socket PGPORT=54331 POSTGREST_BIN=/path/to/postgrest ./run_api.sh
#
# What differs from a full Supabase stack: no GoTrue (JWTs are minted here with
# the same HS256 scheme), no Kong gateway, no Storage; Postgres 16 locally vs 17
# in production. The Data API behaviour that matters here -- role switching from
# the JWT, request.jwt.claims for auth.uid()/auth.role(), function exposure and
# EXECUTE grants, RLS, table grants -- is PostgREST itself.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SQLDIR="$HERE/.."
ROOT="$(cd "$HERE/../../.." && pwd)"   # glowmetrics_fresh/supabase
MIG1="$ROOT/migrations/20261101_harden_dedup_rpc_grants.sql"
MIG2="$ROOT/migrations/20261102_import_links_on_delete_set_null.sql"
DB=api_rehearsal
PORT_API="${API_PORT:-3901}"
: "${POSTGREST_BIN:?set POSTGREST_BIN to a PostgREST executable}"
: "${PGHOST:?set PGHOST to the local socket directory}"
PGPORT="${PGPORT:-5432}"
case "$PGHOST" in *supabase.co*|*supabase.com*) echo "Refusing to run against a Supabase host." >&2; exit 2 ;; esac
SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U postgres)
LOG="$(mktemp)"
PID=""
cleanup() { [ -n "$PID" ] && kill "$PID" 2>/dev/null || true; }
trap cleanup EXIT

start_api() {
  cleanup
  PGRST_DB_URI="postgres://authenticator@/$DB?host=$PGHOST&port=$PGPORT" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon \
  PGRST_JWT_SECRET="$SECRET" PGRST_SERVER_HOST=127.0.0.1 PGRST_SERVER_PORT="$PORT_API" \
    "$POSTGREST_BIN" >>"$LOG" 2>&1 &
  PID=$!
  for _ in $(seq 1 40); do curl -sf "http://127.0.0.1:$PORT_API/" -o /dev/null && return 0; sleep 0.5; done
  echo "PostgREST did not start; log:"; tail -20 "$LOG"; exit 1
}
api() { API_URL="http://127.0.0.1:$PORT_API" JWT_SECRET="$SECRET" PGHOST="$PGHOST" PGPORT="$PGPORT" PGDATABASE="$DB" node "$HERE/api_checks.mjs" "$1"; }

"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
"${PSQL[@]}" -d postgres -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticator') THEN CREATE ROLE authenticator NOINHERIT LOGIN; END IF; END \$\$"
"${PSQL[@]}" -d $DB -f "$SQLDIR/00_mirror.sql" -f "$SQLDIR/10_seed.sql" >/dev/null
"${PSQL[@]}" -d $DB -c "GRANT anon, authenticated, service_role TO authenticator"

echo "== baseline: production-identical functions and grants, through PostgREST"
start_api; api baseline

echo "== apply migrations"
"${PSQL[@]}" -d $DB -f "$MIG1" -f "$MIG2"
start_api   # restart reloads PostgREST's schema cache

echo "== after: through PostgREST"
api after
