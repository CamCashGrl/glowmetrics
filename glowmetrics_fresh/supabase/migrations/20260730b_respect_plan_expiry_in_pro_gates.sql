-- Promo codes (20260730_add_promo_codes.sql) grant Pro by setting
-- profiles.plan = 'pro' with a plan_expires_at that lapses on its own —
-- nothing flips `plan` back to 'free' when it expires; the app is expected
-- to treat plan_expires_at in the past as "not actually Pro". Two
-- server-side Pro gates were only checking `plan` and never adopted that
-- rule, so a promo grant would silently become permanent for these two
-- features even after showing as expired everywhere else:
--   - enforce_free_tier_platform_limit(): free-tier 1-platform cap
--   - sync_live_tip_to_tips(): permanent-history mirror for live tips
-- Bring both in line with the dashboard's isPro check.

CREATE OR REPLACE FUNCTION public.enforce_free_tier_platform_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_plan text;
  user_plan_expires_at timestamptz;
  existing_platform_count int;
  already_tracked boolean;
BEGIN
  IF new.platform IS NULL OR new.platform = '' THEN
    RETURN new;
  END IF;

  SELECT plan, plan_expires_at INTO user_plan, user_plan_expires_at
  FROM profiles WHERE id = new.user_id;

  -- Paid plans (pro/unlimited) have no platform limit, unless a
  -- time-limited grant (e.g. a promo code) has lapsed.
  IF user_plan IS NOT NULL AND user_plan NOT IN ('free')
     AND (user_plan_expires_at IS NULL OR user_plan_expires_at > now()) THEN
    RETURN new;
  END IF;

  SELECT count(DISTINCT platform), bool_or(platform = lower(new.platform))
  INTO existing_platform_count, already_tracked
  FROM (
    SELECT lower(platform) AS platform FROM tips WHERE user_id = new.user_id
    UNION
    SELECT lower(platform) AS platform FROM live_tips WHERE user_id = new.user_id
  ) p;

  IF existing_platform_count >= 1 AND NOT coalesce(already_tracked, false) THEN
    RAISE EXCEPTION 'PLATFORM_LIMIT_REACHED: Free tier tracks 1 platform. Upgrade to Standard ($19.99/mo) to track multiple platforms.'
      USING errcode = 'P0001';
  END IF;

  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_live_tip_to_tips()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_plan TEXT;
  user_plan_expires_at TIMESTAMPTZ;
  v_username_lower TEXT;
  v_usd_rounded NUMERIC;
  v_date_time TIMESTAMPTZ;
  v_near_duplicate_exists BOOLEAN;
BEGIN
  SELECT plan, plan_expires_at INTO user_plan, user_plan_expires_at
  FROM profiles WHERE id = NEW.user_id;

  -- Permanent history is a Pro/unlimited feature — free accounts (and
  -- accounts whose time-limited Pro grant has lapsed) keep the live feed
  -- (this row already went into live_tips) but nothing gets mirrored into
  -- the permanent `tips` table.
  IF user_plan IS NULL OR user_plan = 'free'
     OR (user_plan_expires_at IS NOT NULL AND user_plan_expires_at <= now()) THEN
    RETURN NEW;
  END IF;

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
