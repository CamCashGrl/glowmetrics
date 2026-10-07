-- Phase 2: Unattributed tips log table for ambiguity tracking
--
-- Records tips that cannot be attributed to a session due to ambiguity
-- (e.g., multiple ended sessions overlap the tip's event_at timestamp).
-- Used for diagnostics, user notification, and strict harness verification.

CREATE TABLE IF NOT EXISTS public.unattributed_tips_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text NOT NULL,
  usd numeric NOT NULL,
  event_at timestamptz NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS and define policies for direct table access
ALTER TABLE public.unattributed_tips_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own ambiguity logs"
  ON public.unattributed_tips_log
  FOR SELECT
  USING (user_id = auth.uid());

-- Index for efficient user_id queries (used by verification helper)
CREATE INDEX idx_unattributed_tips_log_user_id
  ON public.unattributed_tips_log(user_id);

-- ── Helper: log_unattributed_tip_ambiguity ────────────────────────────────
-- Logs a tip that cannot be attributed to a session due to ambiguity.
-- Called by persist_extension_tip when multiple ended sessions overlap.
-- Uses SECURITY DEFINER to bypass RLS (persist_extension_tip is service_role).

CREATE OR REPLACE FUNCTION public.log_unattributed_tip_ambiguity(
  p_user_id uuid,
  p_username text,
  p_usd numeric,
  p_event_at timestamptz,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required' USING ERRCODE = '22004';
  END IF;
  IF p_username IS NULL OR btrim(p_username) = '' THEN
    RAISE EXCEPTION 'username is required' USING ERRCODE = '22004';
  END IF;
  IF p_usd IS NULL OR p_usd < 0 THEN
    RAISE EXCEPTION 'usd must be >= 0' USING ERRCODE = '22003';
  END IF;
  IF p_event_at IS NULL THEN
    RAISE EXCEPTION 'event_at is required' USING ERRCODE = '22004';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason is required' USING ERRCODE = '22004';
  END IF;

  INSERT INTO public.unattributed_tips_log (user_id, username, usd, event_at, reason)
  VALUES (p_user_id, btrim(p_username), p_usd, p_event_at, btrim(p_reason))
  RETURNING id INTO v_log_id;

  RETURN v_log_id;

END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_unattributed_tip_ambiguity(uuid, text, numeric, timestamptz, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_unattributed_tip_ambiguity(uuid, text, numeric, timestamptz, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_unattributed_tip_ambiguity(uuid, text, numeric, timestamptz, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.log_unattributed_tip_ambiguity(uuid, text, numeric, timestamptz, text) TO service_role;
