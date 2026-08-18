-- Live Mode entitlement fix: start_live_session() previously checked ONLY
-- the free-tier 1-platform limit (20260806_gate_live_mode_free_tier_platform_
-- limit.sql) — it had no check at all for whether the caller is Pro. Free
-- and Pro users got the identical real-time coaching engine. Per product
-- decision: Live Mode (real-time revenue tracking, room-health coaching,
-- whale alerts, peak-window countdown) is Pro-only.
--
-- Client-side, app/dashboard/page.js now shows a locked preview (explaining
-- what Live Mode does, using the user's own real historical data where
-- available) BEFORE a free user could reach the live engine at all — this
-- migration is the server-side enforcement so a direct RPC call can't
-- bypass that UI gate, same defense-in-depth pattern already applied to
-- get_user_insights (20260814b_make_get_user_insights_plan_aware.sql).
--
-- An in-progress session started before a downgrade is allowed to be
-- reconnected to / ended normally — this only blocks STARTING a new
-- session as a free user, matching check_free_tier_platform_limit's own
-- "existing in-progress session" exemption just above it in
-- start_live_session().

create or replace function public.check_live_mode_pro_entitlement(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  user_plan text;
  user_plan_expires_at timestamptz;
begin
  select plan, plan_expires_at into user_plan, user_plan_expires_at
  from profiles where id = p_user_id;

  if user_plan is not null and user_plan not in ('free')
     and (user_plan_expires_at is null or user_plan_expires_at > now()) then
    return;
  end if;

  raise exception 'LIVE_MODE_REQUIRES_PRO: Live Mode is a Pro feature. Upgrade to Pro to start a live session.'
    using errcode = 'P0001';
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
  -- existing in-progress session is fine either way (reconnect/end must
  -- still work after a downgrade), and re-raising either check for a
  -- session that's just being reconnected to would be wrong.
  if not exists (
    select 1 from public.live_sessions
    where user_id = v_uid and status in ('starting','live','inactive_warning','ending')
  ) then
    perform public.check_live_mode_pro_entitlement(v_uid);
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
