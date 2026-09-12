-- sync_live_tip_to_tips() (added in 20260705c_gate_live_tip_history_mirror_by_plan.sql)
-- mirrors live_tips -> tips for Pro/unlimited accounts, relying on the ON
-- CONFLICT (user_id, username_lower, tokens, usd_rounded, date_time, tip_seq)
-- unique key to skip duplicates. That key matches date_time to the
-- millisecond, but the live-capture path (chat-scraping the same on-screen
-- tip notification) can fire multiple times within a second or two for the
-- same real event, each with a slightly different received_at — so the
-- canonical key does not catch those as duplicates, and each one mirrors
-- into `tips` as a separate permanent row.
--
-- Fix, scoped ONLY to this mirror: before inserting, check for an existing
-- `tips` row from the same user/fan/amount within a 3-second window and
-- skip if found. The canonical exact-match ON CONFLICT stays in place
-- underneath as a second layer. insert_tips_dedup (CSV/API imports) and its
-- key are completely untouched by this change.
--
-- Audited on 2026-07-10: every profiles.plan value in production is
-- currently 'free' (0 rows are 'pro'/'unlimited'), so this mirror's INSERT
-- branch has never actually executed for any real account yet — this is a
-- latent fix, not a correction of realized duplicate data.
CREATE OR REPLACE FUNCTION public.sync_live_tip_to_tips()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_plan TEXT;
  v_username_lower TEXT;
  v_usd_rounded NUMERIC;
  v_date_time TIMESTAMPTZ;
  v_near_duplicate_exists BOOLEAN;
BEGIN
  SELECT plan INTO user_plan FROM profiles WHERE id = NEW.user_id;

  -- Permanent history is a Pro/unlimited feature — free accounts keep the
  -- live feed (this row already went into live_tips) but nothing gets
  -- mirrored into the permanent `tips` table.
  IF user_plan IS NULL OR user_plan = 'free' THEN
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
