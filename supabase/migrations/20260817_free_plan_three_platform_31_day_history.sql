-- CamCash Free tier: up to 3 tracked platforms.
-- This replaces the previous 1-platform function while preserving the same
-- trigger/check entry points used by CSV uploads, Live Mode, and paid sessions.
--
-- History-window enforcement intentionally remains application-level: Free
-- analytics view only the most recent 31 days and older database rows are NOT
-- deleted. This avoids destructive data loss and keeps Pro upgrade reversible.

create or replace function public.enforce_free_tier_platform_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_plan text;
  user_plan_expires_at timestamptz;
  existing_platform_count int;
  already_tracked boolean;
begin
  if new.platform is null or trim(new.platform) = '' then
    return new;
  end if;

  select plan, plan_expires_at
    into user_plan, user_plan_expires_at
  from public.profiles
  where id = new.user_id;

  if user_plan is not null
     and user_plan not in ('free')
     and (user_plan_expires_at is null or user_plan_expires_at > now()) then
    return new;
  end if;

  select count(distinct platform), bool_or(platform = lower(trim(new.platform)))
    into existing_platform_count, already_tracked
  from (
    select lower(platform) as platform from public.tips where user_id = new.user_id
    union
    select lower(platform) as platform from public.live_tips where user_id = new.user_id
    union
    select lower(platform) as platform from public.paid_sessions where user_id = new.user_id
  ) p;

  if existing_platform_count >= 3 and not coalesce(already_tracked, false) then
    raise exception 'PLATFORM_LIMIT_REACHED: Free tier tracks up to 3 platforms. Upgrade to Pro to add more platforms and compare them.'
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

create or replace function public.check_free_tier_platform_limit(p_user_id uuid, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  user_plan text;
  user_plan_expires_at timestamptz;
  existing_platform_count int;
  already_tracked boolean;
begin
  if p_platform is null or trim(p_platform) = '' then
    return;
  end if;

  select plan, plan_expires_at
    into user_plan, user_plan_expires_at
  from public.profiles
  where id = p_user_id;

  if user_plan is not null
     and user_plan not in ('free')
     and (user_plan_expires_at is null or user_plan_expires_at > now()) then
    return;
  end if;

  select count(distinct platform), bool_or(platform = lower(trim(p_platform)))
    into existing_platform_count, already_tracked
  from (
    select lower(platform) as platform from public.tips where user_id = p_user_id
    union
    select lower(platform) as platform from public.live_tips where user_id = p_user_id
    union
    select lower(platform) as platform from public.paid_sessions where user_id = p_user_id
  ) p;

  if existing_platform_count >= 3 and not coalesce(already_tracked, false) then
    raise exception 'PLATFORM_LIMIT_REACHED: Free tier tracks up to 3 platforms. Upgrade to Pro to add more platforms and compare them.'
      using errcode = 'P0001';
  end if;
end;
$$;
