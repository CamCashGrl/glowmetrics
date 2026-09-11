-- Product decision (2026-09-10): Free tier now supports up to 3 platforms
-- (Chaturbate, BongaCams, MyFreeCams — the current full platform roster),
-- not 1. The Free/Pro distinction moves to a 31-day analysis window
-- (enforced at the query/display layer, not here) plus deeper Pro-only
-- historical analysis and any platforms added beyond these 3 in the future.
--
-- This does not change what data is stored: CSV imports have always
-- written full history to `tips` regardless of plan (see app/api/upload/
-- route.js — no plan check there). This only changes how many distinct
-- platforms a free account may have rows for before being blocked, same
-- mechanism as the existing 1-platform rule (20260705b), same grandfathering
-- (existing platforms are never revoked, only adding a NEW 4th+ platform on
-- free is blocked).

create or replace function public.enforce_free_tier_platform_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_plan text;
  existing_platform_count int;
  already_tracked boolean;
  free_platform_limit constant int := 3;
begin
  if new.platform is null or new.platform = '' then
    return new;
  end if;

  select plan into user_plan from profiles where id = new.user_id;

  -- Paid plans (pro/unlimited) have no platform limit.
  if user_plan is not null and user_plan not in ('free') then
    return new;
  end if;

  select count(distinct platform), bool_or(platform = lower(new.platform))
  into existing_platform_count, already_tracked
  from (
    select lower(platform) as platform from tips where user_id = new.user_id
    union
    select lower(platform) as platform from live_tips where user_id = new.user_id
  ) p;

  if existing_platform_count >= free_platform_limit and not coalesce(already_tracked, false) then
    raise exception 'PLATFORM_LIMIT_REACHED: Free tier tracks up to 3 platforms. Upgrade to Standard ($19.99/mo) for additional platform coverage.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;
