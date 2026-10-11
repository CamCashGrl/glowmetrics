-- Rollback for 20261016_backfill_primary_platform_single_platform_free.sql:
-- clears primary_pro_platform ONLY on rows this migration set and that still
-- hold the value it assigned (a user's later real choice is never touched —
-- though by design it cannot differ). Runs as a server role, which the
-- zz_guard_profiles_primary_platform trigger allows.
BEGIN;
update public.profiles p
set primary_pro_platform = null
from public._backup_20261016_primary_platform_backfill b
where p.id = b.user_id
  and p.primary_pro_platform = b.assigned_platform;
drop table if exists public._backup_20261016_primary_platform_backfill;
COMMIT;
