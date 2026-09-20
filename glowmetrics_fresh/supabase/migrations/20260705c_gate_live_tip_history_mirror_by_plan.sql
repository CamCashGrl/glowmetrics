-- #182 made permanent dashboard history (the `tips` table) a Pro-only
-- feature for live-captured tips: /api/live/tips only inserts into `tips`
-- when the account is on a paid plan. But this pre-existing AFTER INSERT
-- trigger on live_tips mirrored every live tip into `tips` unconditionally,
-- silently giving free accounts permanent history anyway regardless of the
-- app-layer check. Gate the mirror the same way the app does.
--
-- Verified this doesn't affect the free tier's "current-session analytics"
-- feature: the dashboard's live/session view reads directly from
-- `live_tips` (last 12h), never from `tips`.

create or replace function public.sync_live_tip_to_tips()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_plan text;
begin
  select plan into user_plan from profiles where id = new.user_id;

  -- Permanent history is a Pro/unlimited feature — free accounts keep the
  -- live feed (this row already went into live_tips) but nothing gets
  -- mirrored into the permanent `tips` table.
  if user_plan is null or user_plan = 'free' then
    return new;
  end if;

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
    COALESCE(NEW.received_at, NOW()),
    COALESCE(NEW.platform, 'Chaturbate'),
    NEW.username,
    'Live',
    COALESCE(NEW.tokens, 0),
    COALESCE(NEW.usd, ROUND(COALESCE(NEW.tokens, 0) * 0.05, 2)),
    '',
    NULL,
    1
  )
  ON CONFLICT (user_id, username_lower, tokens, usd_rounded, date_time, tip_seq)
  DO NOTHING;

  RETURN NEW;
END;
$$;
