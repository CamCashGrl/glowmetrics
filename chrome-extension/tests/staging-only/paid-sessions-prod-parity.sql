-- STAGING ONLY. Never apply to production (production already has this).
--
-- Mirrors production's paid_sessions access on the staging project
-- ("Live Mode Testing", qqvflqcxglkmeuahubwv). Production (read-only check,
-- 2026-10-07): RLS enabled; policies paid_sessions_own_select / _own_insert /
-- _own_delete, each auth.uid() = user_id. Staging had RLS enabled with no
-- policies and no grants, so the dashboard could not read imported private
-- sessions and the browser pass could not seed one as the creator.
-- Staging's table was also a 3-column stub (id uuid, user_id, platform) with
-- 0 rows; the production columns are added (additive only; staging keeps its
-- uuid id). The studio-admin read policy is not mirrored (its helper function
-- is not on staging and nothing tested here uses it).

ALTER TABLE public.paid_sessions
  ADD COLUMN IF NOT EXISTS date_time      timestamptz,
  ADD COLUMN IF NOT EXISTS username       text,
  ADD COLUMN IF NOT EXISTS username_lower text,
  ADD COLUMN IF NOT EXISTS session_type   text,
  ADD COLUMN IF NOT EXISTS tokens         integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usd            numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usd_rounded    numeric,
  ADD COLUMN IF NOT EXISTS upload_id      uuid,
  ADD COLUMN IF NOT EXISTS session_ref    text,
  ADD COLUMN IF NOT EXISTS created_at     timestamptz DEFAULT now();

GRANT SELECT, INSERT, DELETE ON public.paid_sessions TO authenticated;

DROP POLICY IF EXISTS paid_sessions_own_select ON public.paid_sessions;
CREATE POLICY paid_sessions_own_select ON public.paid_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS paid_sessions_own_insert ON public.paid_sessions;
CREATE POLICY paid_sessions_own_insert ON public.paid_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS paid_sessions_own_delete ON public.paid_sessions;
CREATE POLICY paid_sessions_own_delete ON public.paid_sessions
  FOR DELETE USING (auth.uid() = user_id);
