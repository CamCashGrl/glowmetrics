-- Phase 1A: Live Mode session-lifecycle foundation on public.live_sessions.
--
-- This migration targets the verified production-shaped schema only. It
-- does not attempt to recreate live_sessions, its RLS policies, its trigger,
-- its function, or its realtime publication membership — all of that
-- already exists in production but was applied outside any repo migration
-- (see the Phase 1A schema-discovery report's drift analysis). Capturing
-- that historical baseline is separate, larger work, deferred — this
-- migration only adds the three things approved for Phase 1A.
--
-- Does not touch live_tips, does not touch stream_sessions, does not touch
-- application code.

-- Precondition: fail loudly and immediately if the target table is missing,
-- rather than silently doing nothing or partially applying.
DO $$
BEGIN
  IF to_regclass('public.live_sessions') IS NULL THEN
    RAISE EXCEPTION 'Phase 1A migration requires public.live_sessions to already exist. This migration intentionally does not create it. Aborting — see the Phase 1A schema-discovery report.';
  END IF;
END $$;

-- ── 1. Lifecycle status vocabulary ──────────────────────────────────────────
-- Safe: live_sessions has 0 rows today, so nothing can violate this on add.
ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_status_check;
ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_status_check
  CHECK (status IN ('starting','active','paused','stopping','ended','needs_resolution','error'));

-- ── 2. Heartbeat column ─────────────────────────────────────────────────────
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz;

-- ── 3. One-unresolved-session-per-user protection ──────────────────────────
-- 'ended' and 'error' are terminal and deliberately excluded, so a finished
-- or failed session never blocks a new one from starting.
CREATE UNIQUE INDEX IF NOT EXISTS live_sessions_one_unresolved_per_user
  ON public.live_sessions (user_id)
  WHERE status IN ('starting','active','paused','stopping','needs_resolution');
