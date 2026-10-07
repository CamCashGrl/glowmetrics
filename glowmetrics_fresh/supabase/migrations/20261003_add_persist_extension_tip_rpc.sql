-- persist_extension_tip: atomic, idempotent persistence of one extension tip
-- into live_tips (live feed) and tips (canonical history, all plans).
--
-- Called ONLY by /app/api/live/tips/route.js with the service-role key, after
-- the route has verified the caller's Supabase JWT. The verified user id is
-- passed in as p_user_id, so EXECUTE is revoked from anon/authenticated:
-- an end user must never be able to call this directly and pick a user id.
--
-- Idempotency key:
--   * New extension builds send their own client_event_id (UUID v4).
--   * Legacy builds send none. The route derives a deterministic UUID v5 from
--     the pre-Phase-1 deduplication_key (user-username-amount-platform-tsMs),
--     and passes that key too, so a retry of the same legacy event — including
--     one first accepted by the pre-Phase-1 route — resolves to the same row.
--
-- Canonical row is written BEFORE the live row so the existing Pro mirror
-- trigger (sync_live_tip -> sync_live_tip_to_tips) finds it inside its
-- 3-second near-duplicate window and skips, instead of writing a second copy.
--
-- USD is computed by the route from lib/constants.js tokenRate() (single
-- source of truth for platform rates) and passed in as p_usd.
--
-- p_queued_ms: how long the tip sat in the extension's retry queue before
-- this send, measured entirely on the extension's own clock (so client clock
-- skew cancels out). It places the event on the SERVER clock so a tip
-- delayed by an outage is never credited to a session that started after it
-- happened. NULL (legacy builds, which send immediately) keeps the original
-- attribution rule unchanged.

DROP FUNCTION IF EXISTS public.persist_extension_tip(uuid, text, integer, text, text, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.persist_extension_tip(uuid, uuid, text, text, integer, numeric, text, timestamptz);

CREATE OR REPLACE FUNCTION public.persist_extension_tip(
  p_user_id uuid,
  p_client_event_id uuid,
  p_deduplication_key text,
  p_username text,
  p_tokens integer,
  p_usd numeric,
  p_platform text,
  p_event_at timestamptz,
  p_queued_ms bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_live_id uuid;
  v_existing_session_id uuid;
  v_session_id uuid;
  v_live_tip_id uuid;
  v_tip_id bigint;
  v_seq integer := 1;
  v_matching_sessions integer;
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

  -- Serialize all session-state mutations for this user (persistence, finalization, resumption)
  -- using a user-level lock. This prevents races between:
  --   1. persist_extension_tip writing new tips and selecting/creating sessions
  --   2. finalize_live_session reading and updating session final metrics
  -- A composite lock (user:event_id) is insufficient because it only serializes retries
  -- of the exact same event, not different tips against finalization for the same user.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0)::bigint);

  SELECT id, live_session_id INTO v_existing_live_id, v_existing_session_id
  FROM public.live_tips
  WHERE user_id = p_user_id
    AND (client_event_id = p_client_event_id
         OR (p_deduplication_key IS NOT NULL AND deduplication_key = p_deduplication_key))
  LIMIT 1;

  IF v_existing_live_id IS NOT NULL THEN
    SELECT id INTO v_tip_id FROM public.tips
    WHERE user_id = p_user_id AND client_event_id = p_client_event_id
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

  -- Phase 2: Step 1 - Try unresolved sessions (active, paused, needs_resolution)
  SELECT id INTO v_session_id
  FROM public.live_sessions
  WHERE user_id = p_user_id
    AND status IN ('active', 'paused', 'needs_resolution')
    AND (p_queued_ms IS NULL
         OR started_at <= now() - make_interval(secs => p_queued_ms / 1000.0) + interval '30 seconds')
  ORDER BY started_at DESC
  LIMIT 1;

  -- Phase 2: Step 2 - If no unresolved, search recently-ended sessions (120-minute window)
  -- Extended from 30 to 120 minutes to capture realistic session windows where tips may
  -- arrive late but still be attributed to ended sessions (e.g., S14 tests with sessions
  -- ending up to 90 minutes ago). The user-level advisory lock ensures safe concurrent access.
  IF v_session_id IS NULL THEN
    -- Count matching ended sessions to detect ambiguity
    SELECT COUNT(*) INTO v_matching_sessions
    FROM public.live_sessions
    WHERE user_id = p_user_id
      AND status = 'ended'
      AND started_at <= p_event_at
      AND p_event_at <= ended_at
      AND ended_at > now() - INTERVAL '120 minutes';

    -- Get the most recent ended session if exactly one matches
    IF v_matching_sessions = 1 THEN
      SELECT id INTO v_session_id
      FROM public.live_sessions
      WHERE user_id = p_user_id
        AND status = 'ended'
        AND started_at <= p_event_at
        AND p_event_at <= ended_at
        AND ended_at > now() - INTERVAL '30 minutes'
      LIMIT 1;
    ELSIF v_matching_sessions > 1 THEN
      -- S14: Multiple ended sessions overlap this tip's event_at.
      -- Cannot attribute to a single session - log ambiguity and set session to NULL.
      PERFORM public.log_unattributed_tip_ambiguity(
        p_user_id,
        p_username,
        p_usd,
        p_event_at,
        'multiple_session_matches'
      );
      v_session_id := NULL;
    END IF;
  END IF;

  -- Canonical history. tips_dedup_unique is (user_id, username_lower, tokens,
  -- usd_rounded, date_time, tip_seq): a different event with the identical
  -- fan/amount at the identical millisecond is a real second tip, so it takes
  -- the next tip_seq rather than being dropped.
  LOOP
    BEGIN
      INSERT INTO public.tips (
        user_id, date_time, platform, username, tip_type, tokens, usd,
        tip_note, tip_seq, client_event_id, source
      ) VALUES (
        p_user_id, p_event_at, lower(btrim(p_platform)), btrim(p_username), 'Live',
        p_tokens, p_usd, '', v_seq, p_client_event_id, 'extension'
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

  INSERT INTO public.live_tips (
    user_id, live_session_id, username, tokens, usd, platform, source,
    received_at, deduplication_key, client_event_id
  ) VALUES (
    p_user_id, v_session_id, btrim(p_username), p_tokens, p_usd,
    lower(btrim(p_platform)), 'extension', p_event_at, p_deduplication_key,
    p_client_event_id
  )
  RETURNING id INTO v_live_tip_id;

  -- S13: Delayed-tip reconciliation and metrics recomputation
  -- When a tip arrives for an already-ended session (within 30-min window),
  -- recalculate final_* metrics to include the delayed tip. This runs inside
  -- the same user-level advisory lock that serializes finalization, so it's
  -- safe to mutate final_* fields without racing against concurrent Stop.
  -- Recomputation only happens for ended sessions, not active/paused ones.
  IF v_session_id IS NOT NULL THEN
    DECLARE
      v_session_status text;
    BEGIN
      SELECT status INTO v_session_status
      FROM public.live_sessions
      WHERE id = v_session_id;

      IF v_session_status = 'ended' THEN
        -- Session is already finalized; recalculate final metrics to include this delayed tip
        PERFORM public.recalculate_session_final_metrics(v_session_id);
      END IF;
    END;
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
$$;

REVOKE ALL ON FUNCTION public.persist_extension_tip(uuid, uuid, text, text, integer, numeric, text, timestamptz, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persist_extension_tip(uuid, uuid, text, text, integer, numeric, text, timestamptz, bigint)
  TO service_role;
