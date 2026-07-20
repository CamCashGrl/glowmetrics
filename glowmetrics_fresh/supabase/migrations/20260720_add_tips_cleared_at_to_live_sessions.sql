-- "Clear Session Tips" support. Non-destructive by design: no live_tips row
-- is ever deleted or modified. Setting this timestamp on a live_sessions row
-- means "hide this session's tips from live displays as of now" — every
-- reader (the tips API route, and each client's own tip feed) filters out
-- rows for that exact live_session_id received at or before this timestamp.
-- Historical/completed sessions and imported tips are structurally
-- unaffected, since the filter only ever applies to rows tagged with this
-- specific session's id.
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS tips_cleared_at timestamptz;
