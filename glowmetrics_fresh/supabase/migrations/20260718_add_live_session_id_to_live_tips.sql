-- Tags each tip with the live_sessions row it occurred in, so the dashboard
-- and /live page can show only a given session's real-time activity. Only
-- ever set when that session's status is 'active' at insert time (never
-- 'paused' or absent) — see app/api/live/tips/route.js. A tip synced while
-- no session lookup succeeds is still saved, just unattributed (NULL).
ALTER TABLE public.live_tips ADD COLUMN IF NOT EXISTS live_session_id uuid REFERENCES public.live_sessions(id);
