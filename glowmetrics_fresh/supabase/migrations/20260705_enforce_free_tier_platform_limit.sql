-- Free tier tracks 1 platform (via extension live tracking or CSV upload).
-- Standard/early-adopter/pro plans can track unlimited platforms.
-- Enforced at the database level (not just client-side) so it also covers
-- the Chrome extension's direct-to-Supabase insert path.
--
-- Grandfathering: only blocks adding a platform the user has never tracked
-- before. Free users who already had 2+ platforms before this rule existed
-- keep full access to their existing platforms; they just can't add a new one.

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

  select count(distinct lower(platform)) into existing_platform_count
  from tips
  where user_id = new.user_id;

  select exists (
    select 1 from tips
    where user_id = new.user_id and lower(platform) = lower(new.platform)
  ) into already_tracked;

  if existing_platform_count >= 1 and not already_tracked then
    raise exception 'PLATFORM_LIMIT_REACHED: Free tier tracks 1 platform. Upgrade to Standard ($19.99/mo) to track multiple platforms.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_platform_limit_tips on public.tips;
create trigger trg_enforce_platform_limit_tips
  before insert on public.tips
  for each row execute function public.enforce_free_tier_platform_limit();

drop trigger if exists trg_enforce_platform_limit_live_tips on public.live_tips;
create trigger trg_enforce_platform_limit_live_tips
  before insert on public.live_tips
  for each row execute function public.enforce_free_tier_platform_limit();

drop trigger if exists trg_enforce_platform_limit_paid_sessions on public.paid_sessions;
create trigger trg_enforce_platform_limit_paid_sessions
  before insert on public.paid_sessions
  for each row execute function public.enforce_free_tier_platform_limit();
