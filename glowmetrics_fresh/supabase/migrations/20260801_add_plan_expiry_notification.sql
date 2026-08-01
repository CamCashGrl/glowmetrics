-- Tracks whether a user has already been sent the "your Pro access is
-- ending soon" reminder email for their *current* plan_expires_at, so the
-- daily cron job (see /api/notify/plan-expiry-reminder) sends it exactly
-- once per grant instead of once per day for the whole 48-hour window.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_expiry_notified_at timestamptz;

-- Redeeming a promo code sets a fresh plan_expires_at — clear any stale
-- notification flag from a previous grant so the reminder job re-arms for
-- the new expiry date instead of assuming it already fired for this one.
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
  SET plan = 'pro', plan_expires_at = v_new_expires, plan_expiry_notified_at = NULL
  WHERE id = v_user_id;

  UPDATE public.promo_codes
  SET redemption_count = redemption_count + 1
  WHERE code = v_code;

  INSERT INTO public.promo_code_redemptions (code, user_id) VALUES (v_code, v_user_id);

  RETURN jsonb_build_object('plan_expires_at', v_new_expires, 'duration_days', v_promo.duration_days);
END;
$$;
