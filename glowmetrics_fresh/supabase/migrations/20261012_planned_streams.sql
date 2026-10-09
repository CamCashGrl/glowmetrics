-- Dated planned streams for Sessions schedule status (On Schedule / Started
-- Early / Started Late / Unscheduled). Additive: new table only.
--
-- Historical truth: a plan can only be created, changed or deleted while its
-- planned start is still in the future. Once planned_start_at <= now() the
-- row is read-only to browser users, so a past session can never be made to
-- look "on schedule" by editing or back-dating a plan. The server role can
-- still repair data.

BEGIN;
SET LOCAL lock_timeout = '10s';

CREATE TABLE IF NOT EXISTS public.planned_streams (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform         text NOT NULL CHECK (platform IN ('Chaturbate', 'BongaCams', 'MyFreeCams')),
  planned_start_at timestamptz NOT NULL,
  planned_end_at   timestamptz NOT NULL,
  source           text NOT NULL DEFAULT 'stream_planner' CHECK (source IN ('stream_planner', 'manual')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planned_streams_window CHECK (
    planned_end_at > planned_start_at
    AND planned_end_at - planned_start_at <= interval '12 hours'
  )
);

CREATE INDEX IF NOT EXISTS planned_streams_user_start_idx
  ON public.planned_streams (user_id, planned_start_at);

ALTER TABLE public.planned_streams ENABLE ROW LEVEL SECURITY;

-- Explicit grants (production's defaults would otherwise give anon/authenticated ALL).
REVOKE ALL ON public.planned_streams FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.planned_streams TO authenticated;
GRANT UPDATE (platform, planned_start_at, planned_end_at) ON public.planned_streams TO authenticated;
GRANT ALL ON public.planned_streams TO service_role;

DROP POLICY IF EXISTS planned_streams_select_own ON public.planned_streams;
CREATE POLICY planned_streams_select_own ON public.planned_streams
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Only future plans can be created (no back-dating).
DROP POLICY IF EXISTS planned_streams_insert_future ON public.planned_streams;
CREATE POLICY planned_streams_insert_future ON public.planned_streams
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND planned_start_at > now());

-- Only plans that have not started yet can be edited, and only into the future.
DROP POLICY IF EXISTS planned_streams_update_future ON public.planned_streams;
CREATE POLICY planned_streams_update_future ON public.planned_streams
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND planned_start_at > now())
  WITH CHECK (user_id = auth.uid() AND planned_start_at > now());

-- Only plans that have not started yet can be deleted.
DROP POLICY IF EXISTS planned_streams_delete_future ON public.planned_streams;
CREATE POLICY planned_streams_delete_future ON public.planned_streams
  FOR DELETE TO authenticated USING (user_id = auth.uid() AND planned_start_at > now());

COMMIT;
