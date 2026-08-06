-- The advisor correctly flagged that check_free_tier_platform_limit(p_user_id, ...)
-- is directly callable via RPC with an arbitrary p_user_id, letting any signed-in
-- user probe another user's plan/platform status. It's only ever meant to be
-- called for the current caller (from start_live_session, and in the future
-- from other places doing the same check) — so restrict it to that.
create or replace function public.check_free_tier_platform_limit(p_user_id uuid, p_platform text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  user_plan text;
  user_plan_expires_at timestamptz;
  existing_platform_count int;
  already_tracked boolean;
begin
  if p_user_id is distinct from auth.uid() then
    return;
  end if;

  if p_platform is null or p_platform = '' then
    return;
  end if;

  select plan, plan_expires_at into user_plan, user_plan_expires_at
  from profiles where id = p_user_id;

  if user_plan is not null and user_plan not in ('free')
     and (user_plan_expires_at is null or user_plan_expires_at > now()) then
    return;
  end if;

  select count(distinct platform), bool_or(platform = lower(p_platform))
  into existing_platform_count, already_tracked
  from (
    select lower(platform) as platform from tips where user_id = p_user_id
    union
    select lower(platform) as platform from live_tips where user_id = p_user_id
  ) p;

  if existing_platform_count >= 1 and not coalesce(already_tracked, false) then
    raise exception 'PLATFORM_LIMIT_REACHED: Free tier tracks Live Mode on 1 platform. Upgrade to Standard ($19.99/mo) to use Live Mode on multiple platforms.'
      using errcode = 'P0001';
  end if;
end;
$$;
