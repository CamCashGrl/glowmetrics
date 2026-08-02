-- The Vercel Cron route (app/api/cron/live-session-sweep) requires a Pro
-- plan to run sub-daily — this account has no Vercel subscription, so that
-- route would only ever fire once a day on Hobby, defeating the whole
-- point of the fix (sessions would still sit "live" for up to 24h with
-- zero tabs open). pg_cron runs directly on the database itself, needs no
-- Vercel plan at all, and is the primary defense from here on. The Vercel
-- route is left in place as a harmless redundant caller (idempotent -
-- sweeping twice is a no-op for anything not actually stale).
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'sweep-stale-live-sessions',
  '*/5 * * * *',
  $$SELECT public.sweep_all_stale_live_sessions();$$
);
