-- CamCash Living Dashboard Intelligence — state-comparison infrastructure.
--
-- Two additive changes, neither touching anything from
-- 20260808_add_dashboard_events.sql destructively:
--
-- 1. analytics_snapshots — the smallest reliable "previous state" needed to
--    answer "what changed since the last meaningful calculation?" One row
--    per user, overwritten each time (never a history table — dashboard_events
--    is already the history of what mattered). Holds a small, hand-picked
--    JSON object built by lib/intelligence/snapshot.js from aggregateRows()'s
--    output — never the full analytics object, and never computed here in
--    SQL (no second analytics engine).
--
-- 2. record_dashboard_event_if_new gains one new optional parameter,
--    p_cooldown_seconds (default NULL). NULL preserves exactly today's
--    permanent-fingerprint-dedup behavior (what import_completed uses and
--    will keep using) — existing callers are unaffected. A non-NULL value
--    allows the same fingerprint to fire again after the cooldown elapses,
--    for future event types that describe an ongoing state (pace, platform
--    performance) rather than a one-time fact. Added now, ahead of any
--    event type actually using it, so the RPC signature only changes once.

CREATE TABLE IF NOT EXISTS public.analytics_snapshots (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot     jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analytics_snapshots_select_own ON public.analytics_snapshots;
CREATE POLICY analytics_snapshots_select_own ON public.analytics_snapshots
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS analytics_snapshots_insert_own ON public.analytics_snapshots;
CREATE POLICY analytics_snapshots_insert_own ON public.analytics_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS analytics_snapshots_update_own ON public.analytics_snapshots;
CREATE POLICY analytics_snapshots_update_own ON public.analytics_snapshots
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.analytics_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_snapshots TO service_role;

-- ── record_dashboard_event_if_new (cooldown-capable) ────────────────────────
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
  p_expires_at          timestamptz DEFAULT NULL,
  p_cooldown_seconds    integer DEFAULT NULL
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
  IF p_cooldown_seconds IS NOT NULL AND p_cooldown_seconds < 0 THEN
    RAISE EXCEPTION 'cooldown_seconds must be >= 0' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_fingerprint, 0));

  IF p_cooldown_seconds IS NULL THEN
    -- Permanent dedupe: this exact fingerprint fires at most once, ever.
    SELECT * INTO v_existing FROM public.dashboard_events
      WHERE user_id = v_uid
        AND fingerprint = p_fingerprint
      ORDER BY created_at DESC
      LIMIT 1;
  ELSE
    -- Cooldown-window dedupe: this fingerprint may fire again once
    -- p_cooldown_seconds has elapsed since the most recent one.
    SELECT * INTO v_existing FROM public.dashboard_events
      WHERE user_id = v_uid
        AND fingerprint = p_fingerprint
        AND created_at > now() - (p_cooldown_seconds || ' seconds')::interval
      ORDER BY created_at DESC
      LIMIT 1;
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.record_dashboard_event_if_new(text, text, text, text, text, text, jsonb, text, text, timestamptz, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_dashboard_event_if_new(text, text, text, text, text, text, jsonb, text, text, timestamptz, integer) FROM anon;
GRANT  EXECUTE ON FUNCTION public.record_dashboard_event_if_new(text, text, text, text, text, text, jsonb, text, text, timestamptz, integer) TO authenticated;
