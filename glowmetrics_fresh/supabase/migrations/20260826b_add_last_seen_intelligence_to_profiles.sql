-- Stores the creator's intelligence snapshot as of the last time they were
-- shown their report, so the next visit can say what their new data actually
-- unlocked ("your report just got smarter") instead of guessing.
--
-- Shape (written by lib/intelligence/readiness.js snapshot()):
--   { "states": { "<insight_id>": "<INSIGHT_STATE>", ... }, "pct": <int> }
--
-- Deliberately a snapshot of STATES ONLY, not the whole payload: it is a
-- comparison baseline, not a cache, and must never become a second place
-- analytics live.
--
-- NULL means "no baseline yet" — the first read after this deploy records a
-- baseline and shows no false burst of newly-unlocked insights.
--
-- RLS: profiles already restricts row access to the owner; this column adds
-- no new access path and is written only by the authenticated user's own
-- session via the server route.

alter table public.profiles
  add column if not exists last_seen_intelligence jsonb;

comment on column public.profiles.last_seen_intelligence is
  'Intelligence state snapshot from the creator''s last report view: {"states":{insight_id:STATE},"pct":int}. Comparison baseline for the post-import "what changed" moment. Never a cache of analytics.';
