-- Fix a gap introduced by the "permanent history is a Pro feature" change
-- (#182): free-tier live tips no longer get written into `tips`, so the
-- platform-limit trigger's distinct-platform count (sourced only from
-- `tips`) undercounts for free users who only ever use live tracking —
-- letting them add unlimited platforms via the extension without ever
-- writing a CSV. Count distinct platforms from `tips` UNION `live_tips`
-- instead, so the 1-platform-free rule holds regardless of whether a given
-- tip ends up in permanent history.

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

  if existing_platform_count >= 1 and not coalesce(already_tracked, false) then
    raise exception 'PLATFORM_LIMIT_REACHED: Free tier tracks 1 platform. Upgrade to Standard ($19.99/mo) to track multiple platforms.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;
