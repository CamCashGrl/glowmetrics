-- Phase 1: Extension Reliability + Persistent Tip Queue + Canonical Persistence
-- Adds client_event_id (immutable UUID from extension) and source tracking to
-- both live_tips and tips tables for idempotent deduplication and canonical history.
--
-- Safe, backwards-compatible approach:
-- - Nullable columns initially (no constraint on existing rows)
-- - Partial unique indexes that don't constrain legacy NULL rows
-- - Both tables write immediately (all users get canonical history now, not Pro-only)

-- Add client_event_id and source columns to live_tips (if not already present)
ALTER TABLE public.live_tips
  ADD COLUMN IF NOT EXISTS client_event_id UUID,
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Create partial unique index on live_tips for idempotent deduplication
-- Only applies to rows where client_event_id IS NOT NULL
-- Existing rows with NULL client_event_id are unaffected
CREATE UNIQUE INDEX IF NOT EXISTS live_tips_client_event_id_ext_key
  ON public.live_tips(user_id, client_event_id)
  WHERE client_event_id IS NOT NULL;

-- Add client_event_id and source columns to tips (canonical history)
ALTER TABLE public.tips
  ADD COLUMN IF NOT EXISTS client_event_id UUID,
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Create partial unique index on tips for idempotent deduplication
-- Only applies to rows where client_event_id IS NOT NULL
-- Existing rows with NULL client_event_id are unaffected
CREATE UNIQUE INDEX IF NOT EXISTS tips_client_event_id_ext_key
  ON public.tips(user_id, client_event_id)
  WHERE client_event_id IS NOT NULL;
