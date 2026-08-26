-- Makes the intelligence layer's milestone writes idempotent at the database
-- level: re-acknowledging a report can never produce a duplicate "New insight
-- unlocked" card for the same milestone.
--
-- The fingerprints written by lib/intelligence/milestones.js are deterministic
-- ('milestone:<id>', 'confidence:<insight>:<from>-><to>'), so this index is
-- what turns them into an upsert no-op rather than a second row.
--
-- Partial: rows without a fingerprint (any other producer) are unaffected.
-- Created concurrently is not used because this table currently holds 2 rows.

create unique index if not exists dashboard_events_user_fingerprint_uniq
  on public.dashboard_events (user_id, fingerprint)
  where fingerprint is not null;
