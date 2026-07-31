-- Promo codes: lets an admin mint a code that grants a free period of Pro
-- when a user redeems it. Redemption is one-per-user (enforced by the
-- unique index below) so a user can't stack multiple codes for extra months.

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text NOT NULL UNIQUE,
  description       text,
  duration_days     integer NOT NULL DEFAULT 30,
  max_redemptions   integer,                 -- NULL = unlimited
  redemption_count  integer NOT NULL DEFAULT 0,
  active            boolean NOT NULL DEFAULT true,
  expires_at        timestamptz,             -- NULL = code never expires
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        text
);

CREATE TABLE IF NOT EXISTS public.promo_code_redemptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL REFERENCES public.promo_codes(code),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_redemptions ENABLE ROW LEVEL SECURITY;

-- No public policies on promo_codes — only the service role (admin API) and
-- the SECURITY DEFINER function below may read/write it.

-- Users may see their own redemption row (e.g. to show "code applied on X").
DROP POLICY IF EXISTS "Users can view own promo redemptions" ON public.promo_code_redemptions;
CREATE POLICY "Users can view own promo redemptions"
  ON public.promo_code_redemptions FOR SELECT
  USING (auth.uid() = user_id);

-- Atomically validates + redeems a code for the calling user and grants Pro.
-- Runs as SECURITY DEFINER so it can read/write promo_codes (no public
-- policies) and profiles, while still trusting only auth.uid() for identity.
CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       uuid := auth.uid();
  v_code          text := upper(trim(p_code));
  v_promo         public.promo_codes%ROWTYPE;
  v_current_plan  text;
  v_current_exp   timestamptz;
  v_base          timestamptz;
  v_new_expires   timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF v_code IS NULL OR v_code = '' THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  IF EXISTS (SELECT 1 FROM public.promo_code_redemptions WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'already_redeemed';
  END IF;

  SELECT * INTO v_promo FROM public.promo_codes WHERE code = v_code FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  IF NOT v_promo.active THEN
    RAISE EXCEPTION 'inactive_code';
  END IF;

  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < now() THEN
    RAISE EXCEPTION 'expired_code';
  END IF;

  IF v_promo.max_redemptions IS NOT NULL AND v_promo.redemption_count >= v_promo.max_redemptions THEN
    RAISE EXCEPTION 'code_exhausted';
  END IF;

  SELECT plan, plan_expires_at INTO v_current_plan, v_current_exp
  FROM public.profiles WHERE id = v_user_id;

  -- Extend from the user's existing expiry if they're already an active,
  -- unexpired Pro; otherwise start the free period from now.
  v_base := CASE
    WHEN v_current_plan IN ('pro', 'unlimited') AND v_current_exp IS NOT NULL AND v_current_exp > now()
      THEN v_current_exp
    ELSE now()
  END;
  v_new_expires := v_base + make_interval(days => v_promo.duration_days);

  UPDATE public.profiles
  SET plan = 'pro', plan_expires_at = v_new_expires
  WHERE id = v_user_id;

  UPDATE public.promo_codes
  SET redemption_count = redemption_count + 1
  WHERE code = v_code;

  INSERT INTO public.promo_code_redemptions (code, user_id) VALUES (v_code, v_user_id);

  RETURN jsonb_build_object('plan_expires_at', v_new_expires, 'duration_days', v_promo.duration_days);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_promo_code(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.redeem_promo_code(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(text) TO authenticated;
