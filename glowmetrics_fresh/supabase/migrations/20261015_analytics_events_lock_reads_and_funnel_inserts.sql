-- 1. Security: analytics_events policy "users_read_own_analytics" allowed
--    (user_id = auth.uid()) OR (user_id IS NULL), so ANY visitor, including
--    the public anon key, could read every pre-signup event (570 rows on
--    2026-10-11). Own-row reads stay covered by "Users can view their own
--    events" (auth.uid() = user_id). Inserts are unchanged, so pre-signup
--    events (user_id NULL) are still collected. Server/admin access uses the
--    service role, which bypasses RLS and is unaffected.
--    "Admin can read all events" is pinned to a UUID with no auth.users row
--    (deleted account), so it grants nothing; neutralised (USING false) so it
--    cannot silently grant access if that id were ever reused.
--    ALTER rather than DROP so the policy names stay and the rollback is exact.
--    Applied to prod 2026-10-11 (verified: anon reads 0 rows, anon pre-signup
--    insert still works, users see only their own rows).
-- 2. Funnel: checkout_events, free_trial_events and csv_upload_events had
--    SELECT policies only, so every /api/track insert into them was rejected.
--    These events only fire for signed-in users, so inserts are allowed for
--    the caller's own rows only (no NULL user_id).
BEGIN;

alter policy "users_read_own_analytics" on public.analytics_events
  using (user_id = auth.uid());
alter policy "Admin can read all events" on public.analytics_events
  using (false);

create policy "users_insert_own_checkout" on public.checkout_events
  for insert to authenticated with check (user_id = auth.uid());
create policy "users_insert_own_trial" on public.free_trial_events
  for insert to authenticated with check (user_id = auth.uid());
create policy "users_insert_own_csv" on public.csv_upload_events
  for insert to authenticated with check (user_id = auth.uid());

COMMIT;
