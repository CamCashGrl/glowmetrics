-- Phase 1B (batch 1): additive fields on public.live_sessions supporting
-- Pause/Resume duration tracking and separated website/extension heartbeat
-- signals. Depends on Phase 1A (20260715_add_live_session_lifecycle_foundation.sql)
-- already being applied — this migration checks for that explicitly and
-- aborts cleanly if it isn't, rather than silently proceeding against an
-- unprepared schema.
--
-- Does not touch live_tips, does not touch stream_sessions, does not touch
-- application code. Additive only.

DO $$
BEGIN
  IF to_regclass('public.live_sessions') IS NULL THEN
    RAISE EXCEPTION 'Phase 1B requires public.live_sessions to already exist. Aborting — see the Phase 1A migration.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'live_sessions_status_check'
  ) THEN
    RAISE EXCEPTION 'Phase 1B requires the Phase 1A migration (live_sessions_status_check) to be applied first. Aborting.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'live_sessions_one_unresolved_per_user'
  ) THEN
    RAISE EXCEPTION 'Phase 1B requires the Phase 1A migration (live_sessions_one_unresolved_per_user) to be applied first. Aborting.';
  END IF;
END $$;

-- ── Pause-duration tracking ─────────────────────────────────────────────────
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS total_paused_seconds integer NOT NULL DEFAULT 0;

-- ── Separated heartbeat signals ──────────────────────────────────────────────
-- last_heartbeat_at (from Phase 1A) is kept as a general "most recent
-- activity of either kind" convenience field only — it is intentionally
-- never read by any disconnect/needs_resolution decision. Only
-- extension_last_heartbeat_at / broadcaster_page_missing_since gate that,
-- because website presence is not proof of broadcasting.
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS website_last_heartbeat_at timestamptz;

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS extension_last_heartbeat_at timestamptz;

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS extension_platform text;

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS broadcaster_page_detected boolean NOT NULL DEFAULT false;

-- Tracks how long broadcaster_page_detected has been continuously false —
-- extension_last_heartbeat_at alone can't measure this, since it keeps
-- advancing as long as the extension is alive, even while reporting false.
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS broadcaster_page_missing_since timestamptz;

-- ── needs_resolution recovery ────────────────────────────────────────────────
-- Set only by the (not-yet-activated) sweep at the moment it transitions a
-- row to needs_resolution, so a later manual resolution knows whether to
-- restore 'active' or 'paused'. Cleared once resolved either way.
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS status_before_resolution text;
