-- Conversion/freemium alignment for 2026-10-18.
--
-- STORAGE / IMPORT:
--   Free/trial may upload any supported platform and any amount of history.
--   Extra data is stored; application reads decide what is visible.
--
-- FREE ANALYTICS:
--   One selected analytics platform, rolling 31 days of detailed analytics.
--   Platform Comparison remains available using 31-day platform slices.
--   Other stored data may power locked/blurred Pro teasers only.
--
-- LIVE MODE:
--   Free = max 2 newly-started sessions per UTC Monday-Sunday week.
--   Trial = max 2 newly-started sessions TOTAL during the 7-day trial.
--   Paid active Pro / unlimited = no start-count cap.
--
-- PRIVATE MODE:
--   Persist platform-scoped fan username using canonical platform casing.
--
-- This migration is intentionally non-destructive to creator tip/history data.

-- ── Remove obsolete 3-platform Free ceiling ────────────────────────────────
drop trigger if exists trg_enforce_platform_limit_tips on public.tips;
drop trigger if exists trg_enforce_platform_limit_live_tips on public.live_tips;
drop trigger if exists trg_enforce_platform_limit_paid_sessions on public.paid_sessions;

-- Keep the historical function for rollback/history compatibility, but no
-- production write path should call it after the triggers above are removed.

-- ── Free + trial Live Mode start guard ─────────────────────────────────────
create or replace function public.enforce_free_live_weekly_start_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_subscription_status text;
  v_trial_ends_at timestamptz;
  v_count integer;
  v_scope_start timestamptz;
  v_scope_end timestamptz;
  v_is_trial boolean := false;
begin
  select p.plan, p.subscription_status, p.trial_ends_at
    into v_plan, v_subscription_status, v_trial_ends_at
  from public.profiles p
  where p.id = new.user_id;

  -- Only a server-confirmed ACTIVE paid Pro subscription (or legacy unlimited)
  -- bypasses the allowance. Stripe trialing is intentionally capped.
  if coalesce(v_plan, 'free') = 'unlimited'
     or (v_plan = 'pro' and v_subscription_status = 'active') then
    return new;
  end if;

  v_is_trial := v_subscription_status = 'trialing'
    and v_trial_ends_at is not null
    and v_trial_ends_at > now();

  if v_is_trial then
    -- Product trial is exactly 7 days. A trial gets TWO Live Mode starts total,
    -- not two per calendar week. Existing sessions outside this trial window do
    -- not consume the trial allowance.
    v_scope_start := v_trial_ends_at - interval '7 days';
    v_scope_end := v_trial_ends_at;

    select count(*) into v_count
    from public.live_sessions s
    where s.user_id = new.user_id
      and s.started_at >= v_scope_start
      and s.started_at < v_scope_end;

    if v_count >= 2 then
      raise exception 'TRIAL_LIVE_TOTAL_LIMIT: The 7-day trial includes 2 Live Mode sessions total. Upgrade to paid Pro for unlimited Live Mode.'
        using errcode = 'P0001';
    end if;

    return new;
  end if;

  -- Ordinary Free allowance resets Monday 00:00 UTC.
  v_scope_start := date_trunc('week', now() at time zone 'UTC') at time zone 'UTC';
  v_scope_end := v_scope_start + interval '7 days';

  select count(*) into v_count
  from public.live_sessions s
  where s.user_id = new.user_id
    and s.started_at >= v_scope_start
    and s.started_at < v_scope_end;

  if v_count >= 2 then
    raise exception 'FREE_LIVE_WEEKLY_LIMIT: Free Live Mode includes 2 streams per week. Upgrade to Pro for unlimited Live Mode.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_free_live_weekly_start_limit() from public, anon, authenticated;
grant execute on function public.enforce_free_live_weekly_start_limit() to service_role;

drop trigger if exists trg_enforce_free_live_weekly_start_limit on public.live_sessions;
create trigger trg_enforce_free_live_weekly_start_limit
  before insert on public.live_sessions
  for each row execute function public.enforce_free_live_weekly_start_limit();

-- ── Attribute private-show revenue to platform + username identity ─────────
alter table public.live_private_intervals
  add column if not exists username text;

create index if not exists idx_live_private_intervals_user_platform_username
  on public.live_private_intervals (user_id, lower(platform), lower(username))
  where username is not null;

-- New three-argument RPC. Keep the existing two-argument signature in place
-- temporarily for older deployed clients; new web clients call this overload.
create or replace function public.start_private_interval(
  p_rate_per_minute numeric,
  p_platform text,
  p_username text
)
returns public.live_private_intervals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.live_sessions;
  v_row public.live_private_intervals;
  v_username text := btrim(coalesce(p_username, ''));
  v_platform text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_rate_per_minute is null or p_rate_per_minute < 0 or p_rate_per_minute > 1000 then
    raise exception 'rate_per_minute must be between 0 and 1000' using errcode = '22023';
  end if;
  if v_username = '' or length(v_username) > 80 then
    raise exception 'username is required and must be 80 characters or fewer' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  select * into v_session
  from public.live_sessions
  where user_id = v_uid and status in ('live', 'inactive_warning')
  order by started_at desc
  limit 1;

  if not found then
    raise exception 'NO_LIVE_SESSION: start private only while live' using errcode = '22023';
  end if;

  select * into v_row
  from public.live_private_intervals
  where live_session_id = v_session.id and ended_at is null;
  if found then
    return v_row;
  end if;

  v_platform := coalesce(
    public.canonical_platform_name(nullif(btrim(p_platform), '')),
    public.canonical_platform_name(v_session.stream_platform),
    'Chaturbate'
  );

  insert into public.live_private_intervals (
    user_id, live_session_id, platform, username, rate_per_minute
  ) values (
    v_uid,
    v_session.id,
    v_platform,
    v_username,
    p_rate_per_minute
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.start_private_interval(numeric, text, text) from public, anon;
grant execute on function public.start_private_interval(numeric, text, text) to authenticated;
