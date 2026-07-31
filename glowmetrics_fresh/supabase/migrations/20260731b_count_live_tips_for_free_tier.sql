-- sync_live_tip_to_tips() (20260730b_respect_plan_expiry_in_pro_gates.sql)
-- only mirrors a live_tips row into the permanent tips table for
-- pro/unlimited accounts with an active (non-lapsed) plan — free-tier Live
-- Mode earnings never reached the table that Command Center, avg $/hour,
-- Money Map, and Stream Planner are computed from.
--
-- Free vs. Pro should be about depth (multi-platform tracking, Fan CRM,
-- advanced coaching), not whether a tip counts toward basic earnings at
-- all — CSV imports already work this way regardless of plan. This drops
-- the plan check so every live tip mirrors into `tips`, matching that
-- existing behavior. Dedup logic (near-duplicate window, ON CONFLICT DO
-- NOTHING) is unchanged.

CREATE OR REPLACE FUNCTION public.sync_live_tip_to_tips()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username_lower TEXT;
  v_usd_rounded NUMERIC;
  v_date_time TIMESTAMPTZ;
  v_near_duplicate_exists BOOLEAN;
BEGIN
  v_username_lower := lower(NEW.username);
  v_date_time := COALESCE(NEW.received_at, NOW());
  v_usd_rounded := ROUND(COALESCE(NEW.usd, ROUND(COALESCE(NEW.tokens, 0) * 0.05, 2)), 2);

  SELECT EXISTS (
    SELECT 1 FROM public.tips
    WHERE user_id = NEW.user_id
      AND username_lower = v_username_lower
      AND tokens = COALESCE(NEW.tokens, 0)
      AND usd_rounded = v_usd_rounded
      AND date_time BETWEEN v_date_time - INTERVAL '3 seconds'
                         AND v_date_time + INTERVAL '3 seconds'
  ) INTO v_near_duplicate_exists;

  IF v_near_duplicate_exists THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.tips (
    user_id,
    date_time,
    platform,
    username,
    tip_type,
    tokens,
    usd,
    tip_note,
    upload_id,
    tip_seq
  )
  VALUES (
    NEW.user_id,
    v_date_time,
    COALESCE(NEW.platform, 'Chaturbate'),
    NEW.username,
    'Live',
    COALESCE(NEW.tokens, 0),
    v_usd_rounded,
    '',
    NULL,
    1
  )
  ON CONFLICT (user_id, username_lower, tokens, usd_rounded, date_time, tip_seq)
  DO NOTHING;

  RETURN NEW;
END;
$$;
