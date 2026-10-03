-- Phase 1: persist_extension_tip RPC for atomic, idempotent tip persistence
-- Called by /app/api/live/tips/route.js after authentication
--
-- Security:
-- - SECURITY INVOKER: uses caller's auth context, not elevated permissions
-- - Derives user from auth.uid() (cannot be spoofed by parameters)
-- - Validates all inputs before any DB operation
-- - Rejects unauthorized users (no user in auth context)
--
-- Behavior:
-- - Calculates USD server-side from tokens using platform token rates
-- - Inserts to live_tips with idempotent client_event_id handling
-- - Inserts to tips (canonical history) for ALL users immediately
-- - Both inserts are atomic: both succeed or neither exists
-- - Returns live_tip_id, client_event_id, calculated USD on success
--
-- Token rates match /lib/constants.js (verified 2026-10-03):
-- Chaturbate: 0.05, BongaCams: 0.025, MyFreeCams: 0.05, Stripchat: 0.05, CamSoda: 0.05

CREATE OR REPLACE FUNCTION public.persist_extension_tip(
  p_client_event_id uuid,
  p_username text,
  p_tokens integer,
  p_platform text,
  p_broadcaster_username text DEFAULT NULL,
  p_received_at timestamptz DEFAULT NULL,
  p_detected_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_session_id uuid;
  v_live_tip_id uuid;
  v_usd numeric(8, 2);
  v_platform_canonical text;
  v_received_at_final timestamptz;
  v_detected_at_final timestamptz;
BEGIN
  -- Verify user is authenticated
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Input validation: client_event_id is required
  IF p_client_event_id IS NULL THEN
    RAISE EXCEPTION 'client_event_id is required' USING ERRCODE = '22004';
  END IF;

  -- Input validation: tokens must be > 0
  IF p_tokens < 1 THEN
    RAISE EXCEPTION 'tokens must be > 0' USING ERRCODE = '22003';
  END IF;

  -- Normalize platform to lowercase for comparison
  v_platform_canonical := lower(trim(COALESCE(p_platform, 'chaturbate')));

  -- Calculate USD using platform token rates (matching /lib/constants.js)
  v_usd := CASE v_platform_canonical
    WHEN 'chaturbate' THEN (p_tokens * 0.05)::numeric(8, 2)
    WHEN 'bongacams' THEN (p_tokens * 0.025)::numeric(8, 2)
    WHEN 'myfreecams' THEN (p_tokens * 0.05)::numeric(8, 2)
    WHEN 'stripchat' THEN (p_tokens * 0.05)::numeric(8, 2)
    WHEN 'camsoda' THEN (p_tokens * 0.05)::numeric(8, 2)
    ELSE (p_tokens * 0.05)::numeric(8, 2)
  END;

  -- Use provided timestamps or default to now
  v_received_at_final := COALESCE(p_received_at, NOW());
  v_detected_at_final := COALESCE(p_detected_at, NOW());

  -- Find active session for this user on this platform (best-effort)
  SELECT id INTO v_session_id
  FROM public.live_sessions
  WHERE user_id = v_uid
    AND lower(stream_platform) = v_platform_canonical
    AND status IN ('active', 'needs_resolution')
    AND started_at > now() - interval '24 hours'
  ORDER BY started_at DESC LIMIT 1;

  -- Insert to live_tips with idempotent handling for duplicate client_event_id
  BEGIN
    INSERT INTO public.live_tips (
      user_id, live_session_id, username, tokens, usd, platform,
      received_at, date_time, client_event_id, source
    ) VALUES (
      v_uid, v_session_id, trim(p_username), p_tokens, v_usd, v_platform_canonical,
      v_received_at_final, v_detected_at_final, p_client_event_id, 'extension'
    )
    RETURNING id INTO v_live_tip_id;
  EXCEPTION WHEN unique_violation THEN
    -- Duplicate client_event_id: fetch the existing live_tip_id
    SELECT id INTO v_live_tip_id
    FROM public.live_tips
    WHERE user_id = v_uid AND client_event_id = p_client_event_id
    LIMIT 1;
  END;

  -- Insert to tips (canonical history) with idempotent handling
  -- ALL users get canonical history now (not Pro-only anymore)
  BEGIN
    INSERT INTO public.tips (
      user_id, username, tokens, usd, platform, date_time,
      client_event_id, source
    ) VALUES (
      v_uid, trim(p_username), p_tokens, v_usd, v_platform_canonical, v_detected_at_final,
      p_client_event_id, 'extension'
    );
  EXCEPTION WHEN unique_violation THEN
    -- Duplicate client_event_id in tips: safe, already recorded
    NULL;
  END;

  -- Return success with details
  RETURN jsonb_build_object(
    'success', true,
    'live_tip_id', v_live_tip_id,
    'client_event_id', p_client_event_id,
    'usd', v_usd,
    'platform', v_platform_canonical,
    'message', 'Tip persisted to both live and canonical history'
  );

EXCEPTION WHEN OTHERS THEN
  -- Return error details
  RETURN jsonb_build_object(
    'success', false,
    'error', sqlerrm,
    'error_code', SQLSTATE,
    'hint', CASE
      WHEN SQLSTATE = '22004' THEN 'client_event_id is required'
      WHEN SQLSTATE = '22003' THEN 'tokens must be greater than 0'
      WHEN SQLSTATE = '28000' THEN 'Not authenticated'
      ELSE 'An error occurred during tip persistence'
    END
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.persist_extension_tip(uuid, text, integer, text, text, timestamptz, timestamptz)
  TO authenticated, postgres;
