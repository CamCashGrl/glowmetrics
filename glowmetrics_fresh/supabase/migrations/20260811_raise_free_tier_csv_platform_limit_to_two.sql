-- Free tier historical CSV/tip tracking now allows 2 platforms instead of 1.
--
-- Business rationale: under the 1-platform cap, a free user who has tips
-- from a 2nd platform is blocked at import before they ever see any value
-- from combining them — there's nothing for the product to show them to
-- justify upgrading. Raising the cap to 2 lets that data actually land, so
-- the Platforms tab's cross-platform comparison view (gated separately,
-- requires_pro regardless of platform count — see page.js "platforms" tab)
-- can show a real, specific locked-insight card built from the user's own
-- numbers instead of a wall before any data exists.
--
-- Live Mode's real-time multi-platform gate (check_free_tier_platform_limit,
-- used by start_live_session) is intentionally left at 1 platform — this
-- migration only touches historical CSV/tip import, a separate feature axis.

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

  if existing_platform_count >= 2 and not coalesce(already_tracked, false) then
    raise exception 'PLATFORM_LIMIT_REACHED: Free tier tracks 2 platforms. Upgrade to Standard ($19.99/mo) to track unlimited platforms and unlock cross-platform comparison.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- Trigger definitions are unchanged (still fire the same function on tips,
-- live_tips, paid_sessions) — only the function body's threshold moved.
