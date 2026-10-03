-- Minimal replica of the PRODUCTION objects persist_extension_tip touches,
-- copied from the live database on 2026-10-03 (information_schema, pg_indexes,
-- pg_get_functiondef). Used only by the local SQL test harness — never applied
-- to any Supabase project. Phase 1 migrations are applied on top of this.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  plan text,
  plan_expires_at timestamptz
);

CREATE TABLE public.live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stream_platform text NOT NULL DEFAULT 'Chaturbate',
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  status text DEFAULT 'active'
);
CREATE UNIQUE INDEX live_sessions_one_unresolved_per_user ON public.live_sessions (user_id)
  WHERE status = ANY (ARRAY['starting','active','paused','stopping','needs_resolution']);

CREATE TABLE public.live_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid,
  user_id uuid NOT NULL,
  username text NOT NULL,
  tokens integer DEFAULT 0,
  usd numeric DEFAULT 0,
  source text DEFAULT 'manual',
  received_at timestamptz DEFAULT now(),
  deduplication_key text,
  platform text DEFAULT 'chaturbate',
  live_session_id uuid
);
CREATE UNIQUE INDEX live_tips_deduplication_key_key ON public.live_tips (deduplication_key);

CREATE TABLE public.tips (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  date_time timestamptz NOT NULL,
  platform text NOT NULL,
  username text NOT NULL,
  tip_type text NOT NULL DEFAULT 'Tip',
  tokens integer NOT NULL DEFAULT 0,
  usd numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  session_id uuid,
  tip_note text DEFAULT '',
  username_lower text GENERATED ALWAYS AS (lower(username)) STORED,
  usd_rounded numeric GENERATED ALWAYS AS (round(usd, 2)) STORED,
  upload_id uuid,
  tip_ref text,
  tip_seq integer NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX tips_dedup_unique ON public.tips (user_id, username_lower, tokens, usd_rounded, date_time, tip_seq);
CREATE UNIQUE INDEX idx_tips_tip_ref ON public.tips (user_id, tip_ref) WHERE tip_ref IS NOT NULL;

-- Production definition (pg_get_functiondef, 2026-10-03).
CREATE OR REPLACE FUNCTION public.sync_live_tip_to_tips()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_plan TEXT;
  user_plan_expires_at TIMESTAMPTZ;
  v_username_lower TEXT;
  v_usd_rounded NUMERIC;
  v_date_time TIMESTAMPTZ;
  v_near_duplicate_exists BOOLEAN;
BEGIN
  SELECT plan, plan_expires_at INTO user_plan, user_plan_expires_at
  FROM profiles WHERE id = NEW.user_id;

  IF user_plan IS NULL OR user_plan = 'free'
     OR (user_plan_expires_at IS NOT NULL AND user_plan_expires_at <= now()) THEN
    RETURN NEW;
  END IF;

  v_username_lower := lower(NEW.username);
  v_date_time := COALESCE(NEW.received_at, NOW());
  v_usd_rounded := ROUND(COALESCE(NEW.usd, ROUND(COALESCE(NEW.tokens, 0) * 0.05, 2)), 2);

  SELECT EXISTS (
    SELECT 1 FROM public.tips
    WHERE user_id = NEW.user_id
      AND username_lower = v_username_lower
      AND tokens = COALESCE(NEW.tokens, 0)
      AND usd_rounded = v_usd_rounded
      AND date_time BETWEEN v_date_time - INTERVAL '3 seconds'
                         AND v_date_time + INTERVAL '3 seconds'
  ) INTO v_near_duplicate_exists;

  IF v_near_duplicate_exists THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.tips (
    user_id, date_time, platform, username, tip_type, tokens, usd, tip_note, upload_id, tip_seq
  )
  VALUES (
    NEW.user_id, v_date_time, COALESCE(NEW.platform, 'Chaturbate'), NEW.username, 'Live',
    COALESCE(NEW.tokens, 0), v_usd_rounded, '', NULL, 1
  )
  ON CONFLICT (user_id, username_lower, tokens, usd_rounded, date_time, tip_seq)
  DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Production definition (pg_get_functiondef, 2026-10-03).
CREATE OR REPLACE FUNCTION public.enforce_free_tier_platform_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE TRIGGER sync_live_tip AFTER INSERT ON public.live_tips
  FOR EACH ROW EXECUTE FUNCTION sync_live_tip_to_tips();
CREATE TRIGGER trg_enforce_platform_limit_live_tips BEFORE INSERT ON public.live_tips
  FOR EACH ROW EXECUTE FUNCTION enforce_free_tier_platform_limit();
CREATE TRIGGER trg_enforce_platform_limit_tips BEFORE INSERT ON public.tips
  FOR EACH ROW EXECUTE FUNCTION enforce_free_tier_platform_limit();
