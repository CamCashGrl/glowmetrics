-- Phase 2: Update persist_extension_tip() with delayed-tip reconciliation
--
-- Preserves all Phase 1 contract (signature, return type, dedup behavior)
-- Adds: session resolution using immutable event_at timestamp + delayed-tip
-- reconciliation for tips that occurred during a previous session

CREATE OR REPLACE FUNCTION public.persist_extension_tip(
  p_user_id uuid,
  p_client_event_id uuid,
  p_deduplication_key text,
  p_username text,
  p_tokens integer,
  p_usd numeric,
  p_platform text,
  p_event_at timestamp with time zone,
  p_queued_ms bigint DEFAULT NULL::bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_live_id uuid;
  v_existing_session_id uuid;
  v_unresolved_session live_sessions;
  v_candidate_ended_sessions live_sessions[];
  v_ended_session live_sessions;
  v_session_id uuid;
  v_live_tip_id uuid;
  v_tip_id bigint;
  v_seq integer := 1;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required' USING ERRCODE = '22004';
  END IF;

  IF p_client_event_id IS NULL THEN
    RAISE EXCEPTION 'client_event_id is required' USING ERRCODE = '22004';
  END IF;

  IF p_username IS NULL OR btrim(p_username) = '' THEN
    RAISE EXCEPTION 'username is required' USING ERRCODE = '22004';
  END IF;

  IF p_tokens IS NULL OR p_tokens < 1 THEN
    RAISE EXCEPTION 'tokens must be > 0' USING ERRCODE = '22003';
  END IF;

  IF p_usd IS NULL OR p_usd < 0 THEN
    RAISE EXCEPTION 'usd must be >= 0' USING ERRCODE = '22003';
  END IF;

  IF p_event_at IS NULL THEN
    RAISE EXCEPTION 'event time is required' USING ERRCODE = '22004';
  END IF;

  IF p_queued_ms IS NOT NULL AND p_queued_ms < 0 THEN
    RAISE EXCEPTION 'queued_ms must be >= 0' USING ERRCODE = '22003';
  END IF;

  -- Acquire user-level advisory lock (matches finalize_live_session for atomic boundary)
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0)::bigint);

  -- Phase 1 dedup check (unchanged)
  SELECT id, live_session_id
  INTO v_existing_live_id, v_existing_session_id
  FROM public.live_tips
  WHERE user_id = p_user_id
    AND (
      client_event_id = p_client_event_id
      OR (
        p_deduplication_key IS NOT NULL
        AND deduplication_key = p_deduplication_key
      )
    )
  LIMIT 1;

  IF v_existing_live_id IS NOT NULL THEN
    SELECT id
    INTO v_tip_id
    FROM public.tips
    WHERE user_id = p_user_id
      AND client_event_id = p_client_event_id
    LIMIT 1;

    RETURN jsonb_build_object(
      'success', true,
      'duplicate', true,
      'live_tip_id', v_existing_live_id,
      'tip_id', v_tip_id,
      'live_session_id', v_existing_session_id,
      'client_event_id', p_client_event_id
    );
  END IF;

  -- Phase 2: Resolve session using immutable event_at timestamp
  -- Step 1: Try unresolved session (only if event_at >= session.started_at)
  SELECT *
  INTO v_unresolved_session
  FROM public.live_sessions
  WHERE user_id = p_user_id
    AND status IN ('active', 'paused', 'finalizing', 'needs_resolution')
    AND p_event_at >= started_at
    AND (
      p_queued_ms IS NULL
      OR started_at <= now() - make_interval(secs => p_queued_ms / 1000.0) + interval '30 seconds'
    )
  ORDER BY started_at DESC
  LIMIT 1;

  IF v_unresolved_session IS NOT NULL THEN
    v_session_id := v_unresolved_session.id;
  ELSE
    -- Step 2: Event_at predates current session, search recently-ended sessions
    SELECT ARRAY_AGG(s.*)
    INTO v_candidate_ended_sessions
    FROM public.live_sessions s
    WHERE s.user_id = p_user_id
      AND s.status = 'ended'
      AND s.started_at <= p_event_at
      AND p_event_at <= s.ended_at
      AND s.ended_at > now() - INTERVAL '30 minutes';

    -- Step 3: Only reconcile if exactly one match (no ambiguity)
    IF v_candidate_ended_sessions IS NOT NULL AND array_length(v_candidate_ended_sessions, 1) = 1 THEN
      v_ended_session := v_candidate_ended_sessions[1];
      v_session_id := v_ended_session.id;
    ELSIF v_candidate_ended_sessions IS NOT NULL AND array_length(v_candidate_ended_sessions, 1) > 1 THEN
      -- Multiple sessions match event_at; ambiguous
      v_session_id := NULL;
      PERFORM public.log_unattributed_tip_ambiguity(
        p_user_id, btrim(p_username), p_usd, p_event_at,
        'multiple_session_matches: ' || array_length(v_candidate_ended_sessions, 1)::text
      );
    ELSE
      -- No matching session; leave unattributed
      v_session_id := NULL;
    END IF;
  END IF;

  -- Phase 1: Persist canonical tip first (with retry loop, unchanged)
  LOOP
    BEGIN
      INSERT INTO public.tips (
        user_id,
        date_time,
        platform,
        username,
        tip_type,
        tokens,
        usd,
        tip_note,
        tip_seq,
        client_event_id,
        source
      )
      VALUES (
        p_user_id,
        p_event_at,
        lower(btrim(p_platform)),
        btrim(p_username),
        'Live',
        p_tokens,
        p_usd,
        '',
        v_seq,
        p_client_event_id,
        'extension'
      )
      RETURNING id INTO v_tip_id;

      EXIT;

    EXCEPTION WHEN unique_violation THEN
      v_seq := v_seq + 1;

      IF v_seq > 100 THEN
        RAISE;
      END IF;
    END;
  END LOOP;

  -- Phase 1: Persist live_tip (unchanged)
  INSERT INTO public.live_tips (
    user_id,
    live_session_id,
    username,
    tokens,
    usd,
    platform,
    source,
    received_at,
    deduplication_key,
    client_event_id
  )
  VALUES (
    p_user_id,
    v_session_id,
    btrim(p_username),
    p_tokens,
    p_usd,
    lower(btrim(p_platform)),
    'extension',
    p_event_at,
    p_deduplication_key,
    p_client_event_id
  )
  RETURNING id INTO v_live_tip_id;

  -- Phase 2: If assigned to an ended session, recalculate its final metrics
  IF v_session_id IS NOT NULL AND v_ended_session IS NOT NULL THEN
    PERFORM public.recalculate_session_final_metrics(v_session_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'duplicate', false,
    'live_tip_id', v_live_tip_id,
    'tip_id', v_tip_id,
    'live_session_id', v_session_id,
    'client_event_id', p_client_event_id
  );
END;
$function$;
