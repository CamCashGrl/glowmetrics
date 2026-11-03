#!/bin/bash
# Applies a scratch replica of the production Live objects (fixture.sql,
# function bodies copied from production on 2026-10-28), then the 20261103
# migration, then the behaviour assertions in tests.sql.
# Needs a disposable local Postgres: PGHOST/PGPORT/PGUSER as usual.
# NEVER point this at a real project — it drops and recreates database "t".
set -e
cd "$(dirname "$0")"
psql -q -c 'drop database if exists t' -c 'create database t' >/dev/null
psql -q -d t -v ON_ERROR_STOP=1 -f fixture.sql
psql -q -d t -v ON_ERROR_STOP=1 -f ../../migrations/20261103_live_mode_free_allowance_and_private_mode.sql
out=$(psql -q -d t -f tests.sql 2>&1)
echo "$out" | grep -E 'pass:|FAIL|ERROR' | sed 's/^psql:[^ ]* //'
! echo "$out" | grep -qE 'FAIL|ERROR'
