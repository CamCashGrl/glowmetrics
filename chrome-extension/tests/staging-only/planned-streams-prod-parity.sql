-- STAGING ONLY. Never apply to production (production already has this).
-- Recreates production's existing public.planned_streams exactly as it is
-- today (migration add_planned_streams, 2026-08-11, read from production on
-- 2026-10-09: 0 rows, table-wide ALL grants to anon/authenticated, four *_own
-- policies), replacing the staging-only table from the earlier draft, so
-- 20261012_planned_streams.sql is proven against production's real shape.
DROP TABLE IF EXISTS public.planned_streams;
CREATE TABLE public.planned_streams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_at    timestamptz NOT NULL,
  end_at      timestamptz NOT NULL,
  platform    text NOT NULL,
  goal        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planned_streams_end_after_start CHECK (end_at > start_at)
);
CREATE INDEX planned_streams_user_id_start_at_idx ON public.planned_streams(user_id, start_at);
ALTER TABLE public.planned_streams ENABLE ROW LEVEL SECURITY;
CREATE POLICY planned_streams_select_own ON public.planned_streams FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY planned_streams_insert_own ON public.planned_streams FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY planned_streams_update_own ON public.planned_streams FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY planned_streams_delete_own ON public.planned_streams FOR DELETE USING ((select auth.uid()) = user_id);
GRANT ALL ON public.planned_streams TO anon, authenticated, service_role;
