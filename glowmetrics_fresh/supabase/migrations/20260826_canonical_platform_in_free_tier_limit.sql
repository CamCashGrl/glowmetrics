-- Free-tier platform counting must use the same alias semantics the
-- application uses (canonicalPlatform() in lib/constants.js), so one site is
-- never counted as two.
--
-- Production holds 'BC' (519 rows) beside 'BongaCams', and the extension path
-- writes lowercase where the CSV path writes title case. The counting logic
-- previously lowercased only, so 'bc' and 'bongacams' were different strings —
-- and because the countable set is an allowlist, 'bc' was silently DROPPED
-- from the count rather than merged. A free account tracking three sites under
-- mixed spellings therefore counted as fewer platforms than it really had.
--
-- NO STORED ROW IS MODIFIED. Historical rows keep their original spelling and
-- are canonicalized at read time, inside the count.
--
-- Everything else is preserved exactly as deployed:
--   * the free limit stays 3 platforms
--   * the counted population stays tips UNION live_tips UNION paid_sessions
--   * the countable set stays the same four platforms — an unrecognized
--     platform is still not counted toward the limit, because widening that
--     would newly block existing accounts
--   * paid plans still return early
-- The ONLY change is that platform strings are canonicalized before being
-- compared and counted.
--
-- Verified before deploy: across all 50 accounts with tips, no account's
-- counted platform total changes.

create or replace function public.canonical_platform(p_value text)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when p_value is null then 'Unknown'
    when btrim(p_value) = '' then 'Unknown'
    -- exact canonical names (any casing)
    when lower(btrim(p_value)) in ('chaturbate') then 'Chaturbate'
    when lower(btrim(p_value)) in ('bongacams') then 'BongaCams'
    when lower(btrim(p_value)) in ('myfreecams') then 'MyFreeCams'
    when lower(btrim(p_value)) in ('stripchat') then 'Stripchat'
    when lower(btrim(p_value)) in ('camsoda') then 'CamSoda'
    -- short codes: the source of the 519 'BC' rows
    when lower(btrim(p_value)) = 'cb' then 'Chaturbate'
    when lower(btrim(p_value)) = 'bc' then 'BongaCams'
    when lower(btrim(p_value)) = 'mfc' then 'MyFreeCams'
    when lower(btrim(p_value)) = 'sc' then 'Stripchat'
    when lower(btrim(p_value)) = 'cs' then 'CamSoda'
    -- spacing / punctuation variants
    when lower(btrim(p_value)) in ('bonga cams','bonga-cams','bongamodels') then 'BongaCams'
    when lower(btrim(p_value)) = 'my free cams' then 'MyFreeCams'
    when lower(btrim(p_value)) = 'strip chat' then 'Stripchat'
    when lower(btrim(p_value)) = 'cam soda' then 'CamSoda'
    -- substring fallbacks, same order as PLATFORM_SUBSTRINGS in JS
    when lower(btrim(p_value)) like '%bonga%' then 'BongaCams'
    when lower(btrim(p_value)) like '%chaturbate%' then 'Chaturbate'
    when lower(btrim(p_value)) like '%freecams%' then 'MyFreeCams'
    when lower(btrim(p_value)) like '%stripchat%' then 'Stripchat'
    when lower(btrim(p_value)) like '%camsoda%' then 'CamSoda'
    -- an unrecognized platform is NEVER guessed into a known one
    else btrim(p_value)
  end;
$$;

comment on function public.canonical_platform(text) is
  'SQL mirror of canonicalPlatform() in lib/constants.js. Keep the two in sync. Never folds an unrecognized platform into a known one.';

create or replace function public.check_free_tier_platform_limit(p_user_id uuid, p_platform text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  user_plan text;
  user_plan_expires_at timestamptz;
  existing_platform_count int;
  already_tracked boolean;
  incoming_platform text;
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

  incoming_platform := public.canonical_platform(p_platform);

  select count(distinct platform), bool_or(platform = incoming_platform)
  into existing_platform_count, already_tracked
  from (
    select public.canonical_platform(platform) as platform from tips where user_id = p_user_id
    union
    select public.canonical_platform(platform) as platform from live_tips where user_id = p_user_id
    union
    select public.canonical_platform(platform) as platform from paid_sessions where user_id = p_user_id
  ) p where platform in ('Chaturbate','BongaCams','MyFreeCams','Stripchat');

  if existing_platform_count >= 3 and not coalesce(already_tracked, false) then
    raise exception 'PLATFORM_LIMIT_REACHED: Free tracks up to 3 platforms. Upgrade to Creator Pro ($19.99/mo) to track more.'
      using errcode = 'P0001';
  end if;
end;
$function$;

create or replace function public.enforce_free_tier_platform_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  user_plan text;
  user_plan_expires_at timestamptz;
  existing_platform_count int;
  already_tracked boolean;
  incoming_platform text;
BEGIN
  IF new.platform IS NULL OR new.platform = '' THEN
    RETURN new;
  END IF;

  SELECT plan, plan_expires_at INTO user_plan, user_plan_expires_at
  FROM profiles WHERE id = new.user_id;

  IF user_plan IS NOT NULL AND user_plan NOT IN ('free')
     AND (user_plan_expires_at IS NULL OR user_plan_expires_at > now()) THEN
    RETURN new;
  END IF;

  incoming_platform := public.canonical_platform(new.platform);

  SELECT count(DISTINCT platform), bool_or(platform = incoming_platform)
  INTO existing_platform_count, already_tracked
  FROM (
    SELECT public.canonical_platform(platform) AS platform FROM tips WHERE user_id = new.user_id
    UNION
    SELECT public.canonical_platform(platform) AS platform FROM live_tips WHERE user_id = new.user_id
    UNION
    SELECT public.canonical_platform(platform) AS platform FROM paid_sessions WHERE user_id = new.user_id
  ) p where platform in ('Chaturbate','BongaCams','MyFreeCams','Stripchat');

  IF existing_platform_count >= 3 AND NOT coalesce(already_tracked, false) THEN
    RAISE EXCEPTION 'PLATFORM_LIMIT_REACHED: Free tracks up to 3 platforms. Upgrade to Creator Pro ($19.99/mo) to track more.'
      USING errcode = 'P0001';
  END IF;

  RETURN new;
END;
$function$;
