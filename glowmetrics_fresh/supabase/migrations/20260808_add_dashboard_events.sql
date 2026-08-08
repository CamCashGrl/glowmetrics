-- CamCash Living Dashboard Intelligence — Phase 1: event persistence only.
--
-- Account-wide counterpart to public.coaching_events (which is Live-Mode-
-- session-scoped). Same shape and dedup philosophy, deliberately reused
-- rather than reinvented: SECURITY INVOKER RPCs keyed off auth.uid(), a
-- pg_advisory_xact_lock to serialize concurrent writers, and a
-- check-then-insert dedupe lookup instead of relying on a unique index
-- alone (a fingerprint is not always meant to be globally unique forever —
-- future event types may want a cooldown window rather than a one-time
-- fingerprint, so the dedupe check lives in the RPC, not a constraint).
--
-- Deliberately NOT built here (per phase scope): any event type other than
-- import_completed, any UI, any priority-scoring algorithm (priority is
-- passed in and stored verbatim), any push/email notification.
--
-- IMPORTANT — status must never transition to 'seen' as a side effect of a
-- SELECT. Only mark_dashboard_event_seen / dismiss_dashboard_event (both
-- explicit, user-initiated RPC calls) may change status away from 'new'.
-- Reading the table via GET must remain side-effect-free.

CREATE TABLE IF NOT EXISTS public.dashboard_events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  event_type           text NOT NULL,
  source               text NOT NULL,
  priority             text NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status               text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'seen', 'dismissed')),

  -- Deterministic per logical event instance (e.g. tied to a specific
  -- csv_uploads.upload_ref). Used by record_dashboard_event_if_new's
  -- dedupe check — never enforced as a raw unique constraint because some
  -- future event types will legitimately want a cooldown window (multiple
  -- rows sharing a fingerprint, spaced out) rather than a permanent
  -- one-fingerprint-ever rule.
  fingerprint          text NOT NULL,

  title                text NOT NULL,
  message              text NOT NULL,
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,

  related_entity_type  text,
  related_entity_id    text,

  created_at           timestamptz NOT NULL DEFAULT now(),
  seen_at              timestamptz,
  dismissed_at         timestamptz,
  expires_at           timestamptz
);

CREATE INDEX IF NOT EXISTS dashboard_events_user_created_idx
  ON public.dashboard_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS dashboard_events_user_status_idx
  ON public.dashboard_events(user_id, status);

-- Supports record_dashboard_event_if_new's dedupe lookback.
CREATE INDEX IF NOT EXISTS dashboard_events_user_fingerprint_idx
  ON public.dashboard_events(user_id, fingerprint, created_at DESC);

ALTER TABLE public.dashboard_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dashboard_events_select_own ON public.dashboard_events;
CREATE POLICY dashboard_events_select_own ON public.dashboard_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS dashboard_events_insert_own ON public.dashboard_events;
CREATE POLICY dashboard_events_insert_own ON public.dashboard_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS dashboard_events_update_own ON public.dashboard_events;
CREATE POLICY dashboard_events_update_own ON public.dashboard_events
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Raw INSERT/UPDATE grants exist only so the SECURITY INVOKER RPCs below can
-- write while running as the calling user (same pattern as coaching_events).
-- The application layer must only ever go through those RPCs — never a raw
-- insert/update from the client — so validation (dedupe, status-transition
-- rules) can't be bypassed.
GRANT SELECT, INSERT, UPDATE ON public.dashboard_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_events TO service_role;

-- ── record_dashboard_event_if_new ───────────────────────────────────────────
-- Locked on (user_id, fingerprint) so concurrent callers for the exact same
-- logical event (e.g. a retried request) can't both insert. Unlike
-- coaching_events' cooldown-window dedupe, Phase 1's only event type
-- (import_completed) uses a permanent one-fingerprint-ever rule: the caller
-- is expected to pass a fingerprint tied to a specific completed import
-- (its upload_ref), which is unique per successful import by construction.
CREATE OR REPLACE FUNCTION public.record_dashboard_event_if_new(
  p_event_type          text,
  p_source              text,
  p_priority             text,
  p_title               text,
  p_message             text,
  p_fingerprint         text,
  p_metadata            jsonb DEFAULT '{}'::jsonb,
  p_related_entity_type text DEFAULT NULL,
  p_related_entity_id   text DEFAULT NULL,
  p_expires_at          timestamptz DEFAULT NULL
)
RETURNS public.dashboard_events
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_existing public.dashboard_events;
  v_result   public.dashboard_events;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_priority NOT IN ('critical', 'high', 'medium', 'low') THEN
    RAISE EXCEPTION 'Invalid priority: %', p_priority USING ERRCODE = '22023';
  END IF;
  IF p_event_type IS NULL OR length(trim(p_event_type)) = 0 THEN
    RAISE EXCEPTION 'event_type is required' USING ERRCODE = '22023';
  END IF;
  IF p_fingerprint IS NULL OR length(trim(p_fingerprint)) = 0 THEN
    RAISE EXCEPTION 'fingerprint is required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_fingerprint, 0));

  SELECT * INTO v_existing FROM public.dashboard_events
    WHERE user_id = v_uid
      AND fingerprint = p_fingerprint
    ORDER BY created_at DESC
    LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.dashboard_events (
    user_id, event_type, source, priority, title, message,
    fingerprint, metadata, related_entity_type, related_entity_id, expires_at
  ) VALUES (
    v_uid, p_event_type, p_source, p_priority, p_title, p_message,
    p_fingerprint, COALESCE(p_metadata, '{}'::jsonb), p_related_entity_type, p_related_entity_id, p_expires_at
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.record_dashboard_event_if_new(text, text, text, text, text, text, jsonb, text, text, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_dashboard_event_if_new(text, text, text, text, text, text, jsonb, text, text, timestamptz) FROM anon;
GRANT  EXECUTE ON FUNCTION public.record_dashboard_event_if_new(text, text, text, text, text, text, jsonb, text, text, timestamptz) TO authenticated;

-- ── mark_dashboard_event_seen ───────────────────────────────────────────────
-- Explicit, user-initiated only — never called from a GET/list path.
-- seen_at is set once (first call wins); status only moves 'new' → 'seen'.
-- A 'dismissed' event is left dismissed (terminal for Phase 1's purposes).
CREATE OR REPLACE FUNCTION public.mark_dashboard_event_seen(p_event_id uuid)
RETURNS public.dashboard_events
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_uid     uuid := auth.uid();
  v_current public.dashboard_events;
  v_result  public.dashboard_events;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_current FROM public.dashboard_events
    WHERE id = p_event_id AND user_id = v_uid;
  IF v_current.id IS NULL THEN
    RAISE EXCEPTION 'Dashboard event not found' USING ERRCODE = '22023';
  END IF;

  IF v_current.status = 'dismissed' THEN
    RETURN v_current;
  END IF;

  UPDATE public.dashboard_events
    SET status  = 'seen',
        seen_at = COALESCE(seen_at, now())
    WHERE id = p_event_id
    RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.mark_dashboard_event_seen(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_dashboard_event_seen(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.mark_dashboard_event_seen(uuid) TO authenticated;

-- ── dismiss_dashboard_event ──────────────────────────────────────────────────
-- Dismissing implies the event was seen, so seen_at is backfilled if it was
-- never explicitly set. Idempotent — resubmitting is a no-op.
CREATE OR REPLACE FUNCTION public.dismiss_dashboard_event(p_event_id uuid)
RETURNS public.dashboard_events
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_uid     uuid := auth.uid();
  v_current public.dashboard_events;
  v_result  public.dashboard_events;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_current FROM public.dashboard_events
    WHERE id = p_event_id AND user_id = v_uid;
  IF v_current.id IS NULL THEN
    RAISE EXCEPTION 'Dashboard event not found' USING ERRCODE = '22023';
  END IF;

  IF v_current.status = 'dismissed' THEN
    RETURN v_current;
  END IF;

  UPDATE public.dashboard_events
    SET status       = 'dismissed',
        dismissed_at = now(),
        seen_at      = COALESCE(seen_at, now())
    WHERE id = p_event_id
    RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.dismiss_dashboard_event(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dismiss_dashboard_event(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.dismiss_dashboard_event(uuid) TO authenticated;

-- ── Realtime ─────────────────────────────────────────────────────────────
-- Same delivery mechanism app/dashboard/page.js already uses for the `tips`
-- and `live_tips` tables (postgres_changes INSERT subscriptions) — added
-- here explicitly rather than relying on dashboard-only publication
-- settings, since (unlike those two tables) dashboard_events has no prior
-- drift/history to account for.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'dashboard_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dashboard_events;
  END IF;
END $$;
