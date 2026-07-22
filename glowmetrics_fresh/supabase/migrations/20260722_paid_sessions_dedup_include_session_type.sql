-- paid_sessions_dedup_unique previously excluded session_type, so two
-- genuinely different sessions (e.g. a Private Chat and a Group Chat) for
-- the same fan at the same tokens/usd/timestamp collided on the unique
-- index and the second was silently dropped as a false-positive duplicate.
-- Confirmed live via direct RPC testing against a disposable test account
-- (created and fully deleted, no production data affected).
--
-- insert_paid_sessions_dedup's `ON CONFLICT DO NOTHING` has no explicit
-- conflict target, so it automatically picks up whichever unique
-- index/constraint would be violated -- the RPC function itself does not
-- need to change, only the index.
--
-- Safe to apply against existing data: the OLD index already guaranteed no
-- two existing rows share (user_id, username_lower, tokens, usd_rounded,
-- date_time), so no two rows can possibly collide on this new, strictly
-- larger key either.
drop index if exists public.paid_sessions_dedup_unique;

create unique index paid_sessions_dedup_unique
  on public.paid_sessions (user_id, username_lower, tokens, usd_rounded, date_time, session_type);
