-- Harden the EXISTING public.planned_streams (created by migration
-- add_planned_streams, 2026-08-11; 0 rows in production on 2026-10-09) so
-- Sessions can match sessions to saved, dated plans truthfully.
--
-- Production today: browser roles (anon AND authenticated) hold ALL on the
-- table, and creators can edit or delete any of their plans, past or future,
-- or create a plan dated in the past. That would let an old session be made
-- to look "on schedule". After this migration:
--   * a plan can only be created, edited or deleted while start_at is in the
--     future; past plans are read-only to browser users (server role can
--     still repair);
--   * anon has no access; authenticated may SELECT/INSERT/DELETE own rows and
--     UPDATE only platform, start_at, end_at, goal;
--   * platform must be Chaturbate/BongaCams/MyFreeCams, at most 12 hours long;
--   * source records where a plan came from.
-- Columns, data and indexes are otherwise unchanged; no rows are touched.

BEGIN;
SET LOCAL lock_timeout = '10s';

ALTER TABLE public.planned_streams
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'stream_planner';

ALTER TABLE public.planned_streams DROP CONSTRAINT IF EXISTS planned_streams_source_check;
ALTER TABLE public.planned_streams ADD CONSTRAINT planned_streams_source_check
  CHECK (source IN ('stream_planner', 'manual'));
ALTER TABLE public.planned_streams DROP CONSTRAINT IF EXISTS planned_streams_platform_check;
ALTER TABLE public.planned_streams ADD CONSTRAINT planned_streams_platform_check
  CHECK (platform IN ('Chaturbate', 'BongaCams', 'MyFreeCams'));
ALTER TABLE public.planned_streams DROP CONSTRAINT IF EXISTS planned_streams_max_length;
ALTER TABLE public.planned_streams ADD CONSTRAINT planned_streams_max_length
  CHECK (end_at - start_at <= interval '12 hours');

ALTER TABLE public.planned_streams ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.planned_streams FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.planned_streams TO authenticated;
GRANT UPDATE (platform, start_at, end_at, goal) ON public.planned_streams TO authenticated;
GRANT ALL ON public.planned_streams TO service_role;

DROP POLICY IF EXISTS planned_streams_select_own ON public.planned_streams;
DROP POLICY IF EXISTS planned_streams_insert_own ON public.planned_streams;
DROP POLICY IF EXISTS planned_streams_update_own ON public.planned_streams;
DROP POLICY IF EXISTS planned_streams_delete_own ON public.planned_streams;
DROP POLICY IF EXISTS planned_streams_insert_future ON public.planned_streams;
DROP POLICY IF EXISTS planned_streams_update_future ON public.planned_streams;
DROP POLICY IF EXISTS planned_streams_delete_future ON public.planned_streams;

CREATE POLICY planned_streams_select_own ON public.planned_streams
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY planned_streams_insert_future ON public.planned_streams
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id AND start_at > now());
CREATE POLICY planned_streams_update_future ON public.planned_streams
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id AND start_at > now())
  WITH CHECK ((select auth.uid()) = user_id AND start_at > now());
CREATE POLICY planned_streams_delete_future ON public.planned_streams
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id AND start_at > now());

COMMIT;
