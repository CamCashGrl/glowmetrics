-- Rollback for 20261013_platform_limit_trigger_fast_path.sql: restores the
-- exact previous function body (from 20260910_free_tier_three_platform_limit)
-- and drops the two indexes it added. No data is touched.
BEGIN;
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
DROP INDEX IF EXISTS public.idx_tips_user_platform_lower;
DROP INDEX IF EXISTS public.idx_live_tips_user_platform_lower;
COMMIT;
