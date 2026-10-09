#!/usr/bin/env bash
# Runs the free-tier platform-limit trigger tests against a throwaway local
# Postgres (never a Supabase project). Usage:
#   PGHOST=... PGPORT=... PGUSER=... ./supabase/tests/run_platform_limit_trigger_test.sh
# Installs the PREVIOUS function (20260910) and the NEW one (20261013) in turn,
# runs every entitlement scenario under both, and fails unless the outcomes are
# identical and match the expected rule. Then times one 250-row free-tier batch
# at growing history sizes under both versions.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${PGDATABASE:-platform_limit_test}
psql -qX -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $DB" -c "create database $DB"
P="psql -qX -v ON_ERROR_STOP=1 -d $DB"
TRIGGERS="
create trigger trg_enforce_platform_limit_tips before insert on public.tips for each row execute function enforce_free_tier_platform_limit();
create trigger trg_enforce_platform_limit_live_tips before insert on public.live_tips for each row execute function enforce_free_tier_platform_limit();
create trigger trg_enforce_platform_limit_paid_sessions before insert on public.paid_sessions for each row execute function enforce_free_tier_platform_limit();"

run_version () { # label, migration file
  $P -f tests/platform_limit_schema.sql
  $P -f "$2"
  $P -c "$TRIGGERS"
  $P -v fn="$1" -c "create table public._results (fn text, name text, outcome text)" \
     -f tests/platform_limit_scenarios.sql -c "insert into public._results select * from results" > /dev/null
  $P -c "copy public._results to stdout" > "/tmp/platform_limit_$1.tsv"
}
run_version old migrations/20260910_free_tier_three_platform_limit.sql
run_version new migrations/20261013_platform_limit_trigger_fast_path.sql

cat > /tmp/platform_limit_expected.tsv <<'X'
free at limit, existing platform, same case	allow
free at limit, existing platform, different case	allow
free at exactly limit, new 4th platform	reject
platform only in live_tips, insert into tips	allow
live_tips-counted user at limit, new platform	reject
paid plan bypass, 4th platform	allow
free below limit, new 3rd platform	allow
no profile row at limit, new platform	reject
no profile row, existing platform	allow
empty platform always allowed	allow
null platform always allowed	allow
live_tips insert, at limit, new platform	reject
live_tips insert, existing platform	allow
paid_sessions insert, at limit, new platform	reject
paid_sessions insert, existing platform	allow
one statement adds 4 new platforms from empty	reject
one statement adds 3 new platforms from empty	allow
X
fail=0
for v in old new; do
  if diff <(cut -f2,3 /tmp/platform_limit_$v.tsv) /tmp/platform_limit_expected.tsv >/dev/null; then
    echo "PASS  $v function: all $(wc -l < /tmp/platform_limit_expected.tsv) scenarios match expected"
  else
    echo "FAIL  $v function:"; diff <(cut -f2,3 /tmp/platform_limit_$v.tsv) /tmp/platform_limit_expected.tsv || true; fail=1
  fi
done
diff <(cut -f2,3 /tmp/platform_limit_old.tsv) <(cut -f2,3 /tmp/platform_limit_new.tsv) >/dev/null \
  && echo "PASS  old and new outcomes identical" || { echo "FAIL  old/new outcomes differ"; fail=1; }

# ── Performance: one 250-row free-tier batch at growing history sizes ──
perf () { # label, migration file
  $P -f tests/platform_limit_schema.sql -f "$2" -c "$TRIGGERS"
  $P -c "insert into public.profiles values ('00000000-0000-0000-0000-0000000000aa','free')"
  for n in 0 10000 25000 50000; do
    $P -c "alter table public.tips disable trigger trg_enforce_platform_limit_tips" \
       -c "truncate public.tips" \
       -c "insert into public.tips (user_id, platform) select '00000000-0000-0000-0000-0000000000aa', 'Chaturbate' from generate_series(1,$n)" \
       -c "insert into public.tips (user_id, platform) select gen_random_uuid(), 'Chaturbate' from generate_series(1,50000)" \
       -c "alter table public.tips enable trigger trg_enforce_platform_limit_tips" -c "analyze public.tips"
    ms=$($P -tA -c "\timing on" -c "insert into public.tips (user_id, platform) select '00000000-0000-0000-0000-0000000000aa', 'Chaturbate' from generate_series(1,250)" | sed -n 's/^Time: \([0-9.]*\) ms.*/\1/p')
    printf "PERF  %-3s history=%-6s 250-row batch: %8s ms\n" "$1" "$n" "$ms"
  done
}
perf old migrations/20260910_free_tier_three_platform_limit.sql
perf new migrations/20261013_platform_limit_trigger_fast_path.sql

psql -qX -d postgres -c "drop database if exists $DB"
exit $fail
