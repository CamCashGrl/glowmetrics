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

DROP FUNCTION IF EXISTS public.persist_extension_tip(uuid, text, integer, text, text, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.persist_extension_tip(
  p_user_id uuid,
  p_client_event_id uuid,
  p_deduplication_key text,
  p_username text,
  p_tokens integer,
  p_usd numeric,
  p_platform text,
  p_event_at timestamptz
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

  -- Serialize concurrent submissions of the same event (e.g. a retry that
  -- overlaps a slow first attempt) so the existence check below is reliable.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_client_event_id::text, 0));

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

  -- Same attribution rule as the pre-Phase-1 route: the caller's most recent
  -- 'active' or 'needs_resolution' session, never 'paused'.
  SELECT id INTO v_session_id
  FROM public.live_sessions
  WHERE user_id = p_user_id
    AND status IN ('active', 'needs_resolution')
  ORDER BY started_at DESC
  LIMIT 1;

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

REVOKE ALL ON FUNCTION public.persist_extension_tip(uuid, uuid, text, text, integer, numeric, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persist_extension_tip(uuid, uuid, text, text, integer, numeric, text, timestamptz)
  TO service_role;
