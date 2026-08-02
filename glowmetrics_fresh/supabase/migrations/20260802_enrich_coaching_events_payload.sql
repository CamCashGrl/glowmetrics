-- CamCash Live Engine rewrite — Step 1: enrich coaching_events so every
-- consumer (dashboard, extension, future Session Replay) can render the
-- exact same coaching event without recomputing anything. Purely additive:
-- no existing column, row, or RPC behavior is removed. record_coaching_event_if_new
-- keeps working for any existing caller that doesn't pass the new params
-- (they default to empty/null).
--
-- estimated_impact is intentionally left NULL by every current trigger —
-- CamCash never fabricates a numeric/qualitative impact estimate that isn't
-- backed by real measured data (see coaching_prompt_outcomes, which is the
-- future source for a real number here). The column exists now so it can be
-- populated later without another migration.

ALTER TABLE public.coaching_events
  ADD COLUMN IF NOT EXISTS bullets            jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS recommended_action  text,
  ADD COLUMN IF NOT EXISTS estimated_impact    text,
  ADD COLUMN IF NOT EXISTS reason              text,
  ADD COLUMN IF NOT EXISTS confidence          numeric;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coaching_events_confidence_check'
  ) THEN
    ALTER TABLE public.coaching_events
      ADD CONSTRAINT coaching_events_confidence_check
      CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.record_coaching_event_if_new(
  p_session_id          uuid,
  p_dedupe_key          text,
  p_cooldown_seconds    integer,
  p_type                text,
  p_category            text,
  p_priority             integer,
  p_title               text,
  p_message             text,
  p_compact_message     text,
  p_related_tip_id      uuid DEFAULT NULL,
  p_related_tipper_id   text DEFAULT NULL,
  p_related_tipper_name text DEFAULT NULL,
  p_related_amount_usd  numeric DEFAULT NULL,
  p_bullets             jsonb DEFAULT '[]'::jsonb,
  p_recommended_action  text DEFAULT NULL,
  p_estimated_impact    text DEFAULT NULL,
  p_reason              text DEFAULT NULL,
  p_confidence          numeric DEFAULT NULL
)
RETURNS public.coaching_events
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_existing public.coaching_events;
  v_result   public.coaching_events;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  PERFORM 1 FROM public.live_sessions WHERE id = p_session_id AND user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_session_id::text, 0));

  SELECT * INTO v_existing FROM public.coaching_events
    WHERE session_id = p_session_id
      AND action_status = 'unmarked'
      AND expires_at > now()
    ORDER BY priority ASC, shown_at ASC
    LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT * INTO v_existing FROM public.coaching_events
    WHERE session_id = p_session_id
      AND dedupe_key = p_dedupe_key
      AND shown_at > now() - (p_cooldown_seconds || ' seconds')::interval
    ORDER BY shown_at DESC
    LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.coaching_events (
    session_id, user_id, type, category, priority, dedupe_key,
    title, message, compact_message,
    related_tip_id, related_tipper_id, related_tipper_name, related_amount_usd,
    bullets, recommended_action, estimated_impact, reason, confidence,
    expires_at
  ) VALUES (
    p_session_id, v_uid, p_type, p_category, p_priority, p_dedupe_key,
    p_title, p_message, p_compact_message,
    p_related_tip_id, p_related_tipper_id, p_related_tipper_name, p_related_amount_usd,
    COALESCE(p_bullets, '[]'::jsonb), p_recommended_action, p_estimated_impact, p_reason, p_confidence,
    now() + (p_cooldown_seconds || ' seconds')::interval
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.record_coaching_event_if_new(uuid, text, integer, text, text, integer, text, text, text, uuid, text, text, numeric, jsonb, text, text, text, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_coaching_event_if_new(uuid, text, integer, text, text, integer, text, text, text, uuid, text, text, numeric, jsonb, text, text, text, numeric) FROM anon;
GRANT  EXECUTE ON FUNCTION public.record_coaching_event_if_new(uuid, text, integer, text, text, integer, text, text, text, uuid, text, text, numeric, jsonb, text, text, text, numeric) TO authenticated;
