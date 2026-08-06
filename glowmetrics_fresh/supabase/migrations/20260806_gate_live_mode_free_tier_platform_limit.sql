-- Live Mode had no free-tier platform limit at all: start_live_session()
-- would happily create a session for a 2nd/3rd platform, and the existing
-- 1-platform-free rule only bit later, silently, when the first live tip
-- tried to insert (trg_enforce_platform_limit_live_tips). A free user could
-- click "Start Stream" on a second platform, believe Live Mode was running,
-- and never find out their tips weren't being tracked until they checked
-- their history.
--
-- This extracts the platform-limit check already enforced on tips/live_tips/
-- paid_sessions into a standalone function so start_live_session() can call
-- it directly and reject the attempt up front, with the same
-- PLATFORM_LIMIT_REACHED error the upload routes already parse.

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

create or replace function public.start_live_session(p_platform text default null::text)
returns live_sessions
language plpgsql
set search_path to 'public'
as $function$
declare
  v_uid      uuid := auth.uid();
  v_platform text;
  v_result   public.live_sessions;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  v_platform := coalesce(nullif(trim(p_platform), ''), 'Chaturbate');
  if v_platform not in ('Chaturbate','BongaCams','MyFreeCams','Stripchat','CamSoda') then
    raise exception 'Unrecognized platform: %', v_platform using errcode = '22023';
  end if;

  -- Only worth checking when there's no unresolved session to resume — an
  -- existing in-progress session on this same platform is fine either way,
  -- and re-raising the limit for a session that's just being reconnected to
  -- would be wrong.
  if not exists (
    select 1 from public.live_sessions
    where user_id = v_uid and status in ('starting','live','inactive_warning','ending')
  ) then
    perform public.check_free_tier_platform_limit(v_uid, v_platform);
  end if;

  begin
    insert into public.live_sessions (
      user_id, status, live_substate, is_active, started_at, ended_at,
      last_heartbeat_at, website_last_heartbeat_at, stream_platform
    ) values (
      v_uid, 'starting', null, true, now(), null,
      now(), now(), v_platform
    )
    returning * into v_result;
    return v_result;
  exception when unique_violation then
    select * into v_result
      from public.live_sessions
      where user_id = v_uid
        and status in ('starting','live','inactive_warning','ending')
      order by started_at desc
      limit 1;
    return v_result;
  end;
end;
$function$;
