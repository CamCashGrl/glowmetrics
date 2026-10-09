-- Rollback for 20261012_planned_streams.sql: restores production's previous
-- state exactly (four *_own policies, table-wide ALL to anon/authenticated,
-- no source column or extra checks). Keeps the table and its rows; drops
-- only the source column. NOTE: this re-opens past-plan editing/back-dating.
BEGIN;
DROP POLICY IF EXISTS planned_streams_insert_future ON public.planned_streams;
DROP POLICY IF EXISTS planned_streams_update_future ON public.planned_streams;
DROP POLICY IF EXISTS planned_streams_delete_future ON public.planned_streams;
DROP POLICY IF EXISTS planned_streams_select_own ON public.planned_streams;
CREATE POLICY planned_streams_select_own ON public.planned_streams FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY planned_streams_insert_own ON public.planned_streams FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY planned_streams_update_own ON public.planned_streams FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY planned_streams_delete_own ON public.planned_streams FOR DELETE USING ((select auth.uid()) = user_id);
ALTER TABLE public.planned_streams DROP CONSTRAINT IF EXISTS planned_streams_source_check;
ALTER TABLE public.planned_streams DROP CONSTRAINT IF EXISTS planned_streams_platform_check;
ALTER TABLE public.planned_streams DROP CONSTRAINT IF EXISTS planned_streams_max_length;
ALTER TABLE public.planned_streams DROP COLUMN IF EXISTS source;
GRANT ALL ON public.planned_streams TO anon, authenticated;
COMMIT;
