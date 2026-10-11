-- Rollback for 20261015_analytics_events_lock_reads_and_funnel_inserts.sql:
-- restores the exact previous policies. Re-opens the public read exposure.
BEGIN;
alter policy "users_read_own_analytics" on public.analytics_events
  using ((user_id = auth.uid()) OR (user_id IS NULL));
alter policy "Admin can read all events" on public.analytics_events
  using (auth.uid() = 'e42d59be-867a-468d-a479-4ca101bb0592'::uuid);
drop policy if exists "users_insert_own_checkout" on public.checkout_events;
drop policy if exists "users_insert_own_trial" on public.free_trial_events;
drop policy if exists "users_insert_own_csv" on public.csv_upload_events;
COMMIT;
