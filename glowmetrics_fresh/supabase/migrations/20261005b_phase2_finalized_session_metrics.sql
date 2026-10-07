-- Phase 2: Finalized session metrics and atomic finalization.
--
-- Adds the final_* metric columns to live_sessions and introduces
-- the 'finalizing' status for atomic Stop/Finalize operations.
--
-- These columns are populated atomically by finalize_live_session()
-- RPC and recalculate_session_final_metrics() when a session ends
-- or when a delayed tip is reconciled to an already-ended session.

-- ── 1. Update status constraint to include 'finalizing' ───────────────
ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_status_check;
ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_status_check
  CHECK (status IN ('starting','active','paused','stopping','ended','needs_resolution','error','finalizing'));

-- ── 2. Add finalized metrics columns ─────────────────────────────────
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS final_total_usd numeric(10, 2),
  ADD COLUMN IF NOT EXISTS final_tokens integer,
  ADD COLUMN IF NOT EXISTS final_tip_count integer,
  ADD COLUMN IF NOT EXISTS final_unique_tippers integer,
  ADD COLUMN IF NOT EXISTS final_top_tipper_username text,
  ADD COLUMN IF NOT EXISTS final_top_tipper_usd numeric(10, 2),
  ADD COLUMN IF NOT EXISTS final_largest_tip_usd numeric(10, 2),
  ADD COLUMN IF NOT EXISTS final_avg_tip_usd numeric(10, 2),
  ADD COLUMN IF NOT EXISTS final_duration_seconds integer,
  ADD COLUMN IF NOT EXISTS final_usd_per_hour numeric(10, 2),
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz;
