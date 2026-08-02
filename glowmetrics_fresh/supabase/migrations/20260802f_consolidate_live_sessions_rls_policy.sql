-- Caught by the performance advisor during acceptance testing: live_sessions
-- carried two functionally-identical RLS policies ("Users can manage their
-- own sessions" and "Users manage own live sessions", both ALL/auth.uid() =
-- user_id) — pre-existing duplication from before this rewrite, not
-- introduced by it, but on the single hottest table this whole feature
-- touches, so every heartbeat/poll was evaluating RLS twice for nothing.
-- Consolidated to one policy, and wrapped auth.uid() in (select ...) per
-- Supabase's RLS perf guidance so it's evaluated once per query instead of
-- once per row.
DROP POLICY IF EXISTS "Users can manage their own sessions" ON public.live_sessions;
DROP POLICY IF EXISTS "Users manage own live sessions" ON public.live_sessions;

CREATE POLICY "Users manage own live sessions" ON public.live_sessions
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
