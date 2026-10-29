-- Production-shaped mirror for rehearsing Batch 1 (anon grant hardening +
-- tips/live_tips USD precision) against a disposable local Postgres.
--
-- Captured read-only from production (hlsdlaibnayzbfflxclj) on 2026-10-29 via
-- pg_catalog: table columns (types, defaults, generated expressions, NOT
-- NULL), constraints, indexes, triggers, RLS policies, table grants, and the
-- verbatim bodies of every function the tip-persistence, finalization and
-- import paths call. Nothing here is invented; omissions are listed below.
--
-- Not mirrored (not on any path Batch 1 touches):
--   * profiles' normalize_* / guard_* triggers (platform-name normalization on
--     profile edits only).
--   * studios / studio_models are reduced to the 3 columns
--     is_linked_studio_admin() reads.
--   * auth.* is a minimal stub: auth.uid() / auth.role() read the same
--     request.jwt.claim.* settings PostgREST sets.
-- Production runs Postgres 17; this mirror is exercised on Postgres 16.

-- ── Supabase roles + auth stub ───────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- ── Studio stubs (only what is_linked_studio_admin reads) ────────────────
CREATE TABLE public.studios (id uuid PRIMARY KEY, owner_user_id uuid);
CREATE TABLE public.studio_models (studio_id uuid, model_user_id uuid, status text);

-- ── Tables (production DDL) ──────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.paid_sessions_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.tips_id_seq;

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  display_name text,
  plan text DEFAULT 'free'::text,
  created_at timestamp with time zone DEFAULT now(),
  chaturbate_username text,
  broadcaster_type text DEFAULT 'female'::text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  attributed_landing_page text,
  attributed_at timestamp with time zone,
  show_coaching_action_buttons boolean DEFAULT true NOT NULL,
  timezone text,
  stripe_customer_id text,
  plan_expires_at timestamp with time zone,
  plan_expiry_notified_at timestamp with time zone,
  live_mode_guide_sent_at timestamp with time zone,
  pro_trial_email_sent_at timestamp with time zone,
  trial_ends_at timestamp with time zone,
  last_seen_intelligence jsonb,
  primary_pro_platform text,
  streaming_platforms text[],
  trial_days integer DEFAULT 7,
  stripe_subscription_id text,
  subscription_status text DEFAULT 'none'::text,
  bongacams_username text,
  myfreecams_username text
);

CREATE TABLE public.live_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  stream_platform text DEFAULT 'Chaturbate'::text NOT NULL,
  started_at timestamp with time zone DEFAULT now(),
  ended_at timestamp with time zone,
  goal_tokens integer DEFAULT 0,
  goal_usd numeric(10,2) DEFAULT 0,
  status text DEFAULT 'active'::text,
  is_active boolean DEFAULT true NOT NULL,
  total_tokens integer DEFAULT 0 NOT NULL,
  total_tips integer DEFAULT 0 NOT NULL,
  total_usd numeric(10,2) DEFAULT 0 NOT NULL,
  peak_viewers integer,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  last_heartbeat_at timestamp with time zone,
  paused_at timestamp with time zone,
  total_paused_seconds integer DEFAULT 0 NOT NULL,
  website_last_heartbeat_at timestamp with time zone,
  extension_last_heartbeat_at timestamp with time zone,
  extension_platform text,
  broadcaster_page_detected boolean DEFAULT false NOT NULL,
  broadcaster_page_missing_since timestamp with time zone,
  status_before_resolution text,
  tips_cleared_at timestamp with time zone,
  duration_confidence text DEFAULT 'verified'::text NOT NULL,
  starting_earnings_usd numeric,
  ending_earnings_usd numeric,
  session_earnings_usd numeric,
  starting_tokens integer,
  ending_tokens integer,
  session_tokens integer,
  tip_count integer,
  unique_tipper_count integer,
  new_tipper_count integer,
  returning_tipper_count integer,
  whale_tip_count integer,
  largest_tip_usd numeric,
  average_tip_usd numeric,
  earnings_per_active_hour numeric,
  tips_per_active_hour numeric,
  platform_detected_automatically boolean DEFAULT false NOT NULL,
  session_resolution_type text,
  is_inaccurate boolean DEFAULT false NOT NULL,
  inaccuracy_reason text,
  coaching_strategy text DEFAULT 'balanced'::text NOT NULL,
  coaching_goal_tokens integer DEFAULT 0 NOT NULL,
  live_substate text,
  warning_started_at timestamp with time zone,
  final_total_usd numeric(10,2),
  final_tokens integer,
  final_tip_count integer,
  final_unique_tippers integer,
  final_top_tipper_username text,
  final_top_tipper_usd numeric(10,2),
  final_largest_tip_usd numeric(10,2),
  final_avg_tip_usd numeric(10,2),
  final_duration_seconds integer,
  final_usd_per_hour numeric(10,2),
  finalized_at timestamp with time zone,
  final_public_usd numeric(10,2),
  final_private_usd numeric(10,2),
  final_private_seconds integer,
  final_platform_breakdown jsonb,
  dashboard_seen_at timestamp with time zone
);

CREATE TABLE public.tips (
  id bigint DEFAULT nextval('tips_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  date_time timestamp with time zone NOT NULL,
  platform text NOT NULL,
  username text NOT NULL,
  tip_type text DEFAULT 'Tip'::text NOT NULL,
  tokens integer DEFAULT 0 NOT NULL,
  usd numeric(10,2) DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  session_id uuid,
  tip_note text DEFAULT ''::text,
  username_lower text GENERATED ALWAYS AS (lower(username)) STORED,
  usd_rounded numeric GENERATED ALWAYS AS (round(usd, 2)) STORED,
  upload_id uuid,
  tip_ref text,
  tip_seq integer DEFAULT 1 NOT NULL,
  client_event_id uuid,
  source text,
  live_session_id uuid
);

CREATE TABLE public.live_tips (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  session_id uuid,
  user_id uuid NOT NULL,
  username text NOT NULL,
  tokens integer DEFAULT 0,
  usd numeric(10,2) DEFAULT 0,
  source text DEFAULT 'manual'::text,
  received_at timestamp with time zone DEFAULT now(),
  deduplication_key text,
  platform text DEFAULT 'chaturbate'::text,
  live_session_id uuid,
  client_event_id uuid
);

CREATE TABLE public.live_session_pauses (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  paused_at timestamp with time zone NOT NULL,
  resumed_at timestamp with time zone,
  pause_duration_seconds integer,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.live_private_intervals (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  live_session_id uuid NOT NULL,
  platform text NOT NULL,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  ended_at timestamp with time zone,
  rate_per_minute numeric(10,2) NOT NULL,
  estimated_earnings_usd numeric(10,2),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.paid_sessions (
  id bigint DEFAULT nextval('paid_sessions_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  date_time timestamp with time zone NOT NULL,
  platform text DEFAULT 'BongaCams'::text NOT NULL,
  username text NOT NULL,
  username_lower text GENERATED ALWAYS AS (lower(username)) STORED,
  session_type text NOT NULL,
  tokens integer DEFAULT 0 NOT NULL,
  usd numeric(10,4) DEFAULT 0 NOT NULL,
  usd_rounded numeric(10,2) GENERATED ALWAYS AS (round(usd, 2)) STORED,
  upload_id uuid,
  session_ref text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.unattributed_tips_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  username text NOT NULL,
  usd numeric NOT NULL,
  event_at timestamp with time zone NOT NULL,
  reason text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.coaching_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,
  category text NOT NULL,
  priority integer DEFAULT 0 NOT NULL,
  dedupe_key text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  compact_message text NOT NULL,
  related_tip_id uuid,
  related_tipper_id text,
  related_tipper_name text,
  related_amount_usd numeric,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  shown_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone,
  dismissed_at timestamp with time zone,
  action_status text DEFAULT 'unmarked'::text NOT NULL,
  action_responded_at timestamp with time zone,
  bullets jsonb DEFAULT '[]'::jsonb NOT NULL,
  recommended_action text,
  estimated_impact text,
  reason text,
  confidence numeric
);

ALTER TABLE public.coaching_events ADD CONSTRAINT coaching_events_pkey PRIMARY KEY (id);
ALTER TABLE public.coaching_events ADD CONSTRAINT coaching_events_action_status_check CHECK ((action_status = ANY (ARRAY['unmarked'::text, 'performed'::text, 'skipped'::text])));
ALTER TABLE public.coaching_events ADD CONSTRAINT coaching_events_category_check CHECK ((category = ANY (ARRAY['supporter_engagement'::text, 'new_supporter'::text, 'returning_supporter'::text, 'goal_momentum'::text, 'room_recovery'::text, 'pace_management'::text, 'retention'::text, 'session_timing'::text, 'stream_ending'::text])));
ALTER TABLE public.coaching_events ADD CONSTRAINT coaching_events_confidence_check CHECK (((confidence IS NULL) OR ((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))));
ALTER TABLE public.live_private_intervals ADD CONSTRAINT live_private_intervals_pkey PRIMARY KEY (id);
ALTER TABLE public.live_private_intervals ADD CONSTRAINT live_private_intervals_end_after_start CHECK (((ended_at IS NULL) OR (ended_at >= started_at)));
ALTER TABLE public.live_private_intervals ADD CONSTRAINT live_private_intervals_rate_per_minute_check CHECK ((rate_per_minute >= (0)::numeric));
ALTER TABLE public.live_session_pauses ADD CONSTRAINT live_session_pauses_pkey PRIMARY KEY (id);
ALTER TABLE public.live_sessions ADD CONSTRAINT live_sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.live_sessions ADD CONSTRAINT live_sessions_coaching_goal_tokens_check CHECK ((coaching_goal_tokens >= 0));
ALTER TABLE public.live_sessions ADD CONSTRAINT live_sessions_coaching_strategy_check CHECK ((coaching_strategy = ANY (ARRAY['balanced'::text, 'aggressive'::text, 'retention'::text, 'engagement'::text, 'whale'::text, 'goal'::text])));
ALTER TABLE public.live_sessions ADD CONSTRAINT live_sessions_duration_confidence_check CHECK ((duration_confidence = ANY (ARRAY['verified'::text, 'user_confirmed'::text, 'estimated'::text])));
ALTER TABLE public.live_sessions ADD CONSTRAINT live_sessions_live_substate_check CHECK (((live_substate IS NULL) OR (live_substate = ANY (ARRAY['active'::text, 'paused'::text]))));
ALTER TABLE public.live_sessions ADD CONSTRAINT live_sessions_resolution_type_check CHECK (((session_resolution_type IS NULL) OR (session_resolution_type = ANY (ARRAY['normal_stop'::text, 'still_live'::text, 'end_at_last_heartbeat'::text, 'chosen_end_time'::text, 'marked_invalid'::text, 'auto_ended_inactivity'::text]))));
ALTER TABLE public.live_sessions ADD CONSTRAINT live_sessions_status_check CHECK ((status = ANY (ARRAY['starting'::text, 'live'::text, 'inactive_warning'::text, 'ending'::text, 'ended'::text])));
ALTER TABLE public.live_tips ADD CONSTRAINT live_tips_deduplication_key_key UNIQUE (deduplication_key);
ALTER TABLE public.live_tips ADD CONSTRAINT live_tips_pkey PRIMARY KEY (id);
ALTER TABLE public.paid_sessions ADD CONSTRAINT paid_sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.tips ADD CONSTRAINT tips_pkey PRIMARY KEY (id);
ALTER TABLE public.unattributed_tips_log ADD CONSTRAINT unattributed_tips_log_pkey PRIMARY KEY (id);

CREATE INDEX coaching_events_session_id_idx ON public.coaching_events USING btree (session_id);
CREATE INDEX coaching_events_session_dedupe_shown_idx ON public.coaching_events USING btree (session_id, dedupe_key, shown_at DESC);
CREATE INDEX coaching_events_user_id_shown_at_idx ON public.coaching_events USING btree (user_id, shown_at DESC);
CREATE INDEX coaching_events_session_active_idx ON public.coaching_events USING btree (session_id, action_status, expires_at);
CREATE INDEX idx_live_private_intervals_session ON public.live_private_intervals USING btree (live_session_id);
CREATE INDEX idx_live_private_intervals_user ON public.live_private_intervals USING btree (user_id);
CREATE UNIQUE INDEX live_private_intervals_one_open_per_session ON public.live_private_intervals USING btree (live_session_id) WHERE (ended_at IS NULL);
CREATE INDEX live_session_pauses_session_id_idx ON public.live_session_pauses USING btree (session_id);
CREATE INDEX live_sessions_user_active ON public.live_sessions USING btree (user_id, is_active, started_at DESC);
CREATE UNIQUE INDEX live_sessions_one_running_per_user ON public.live_sessions USING btree (user_id) WHERE (status = ANY (ARRAY['starting'::text, 'live'::text, 'inactive_warning'::text, 'ending'::text]));
CREATE INDEX idx_live_sessions_user_finalized ON public.live_sessions USING btree (user_id, ended_at DESC) WHERE (finalized_at IS NOT NULL);
CREATE UNIQUE INDEX live_tips_client_event_id_ext_key ON public.live_tips USING btree (user_id, client_event_id) WHERE (client_event_id IS NOT NULL);
CREATE INDEX live_tips_received_idx ON public.live_tips USING btree (received_at DESC);
CREATE INDEX live_tips_session_idx ON public.live_tips USING btree (session_id);
CREATE INDEX idx_live_tips_user_platform_lower ON public.live_tips USING btree (user_id, lower(platform));
CREATE INDEX live_tips_session_id ON public.live_tips USING btree (session_id);
CREATE INDEX idx_paid_sessions_upload_id ON public.paid_sessions USING btree (upload_id);
CREATE INDEX idx_paid_sessions_username ON public.paid_sessions USING btree (user_id, username_lower);
CREATE INDEX idx_paid_sessions_date ON public.paid_sessions USING btree (user_id, date_time);
CREATE UNIQUE INDEX idx_paid_sessions_session_ref ON public.paid_sessions USING btree (user_id, session_ref) WHERE (session_ref IS NOT NULL);
CREATE INDEX idx_paid_sessions_user_id ON public.paid_sessions USING btree (user_id);
CREATE UNIQUE INDEX paid_sessions_dedup_unique ON public.paid_sessions USING btree (user_id, username_lower, tokens, usd_rounded, date_time, session_type);
CREATE INDEX idx_profiles_stripe_customer_id ON public.profiles USING btree (stripe_customer_id);
CREATE INDEX idx_profiles_subscription_status ON public.profiles USING btree (subscription_status);
CREATE UNIQUE INDEX tips_dedup_unique ON public.tips USING btree (user_id, username_lower, tokens, usd_rounded, date_time, tip_seq);
CREATE UNIQUE INDEX tips_client_event_id_ext_key ON public.tips USING btree (user_id, client_event_id) WHERE (client_event_id IS NOT NULL);
CREATE INDEX idx_tips_upload_id ON public.tips USING btree (upload_id);
CREATE INDEX idx_tips_date ON public.tips USING btree (user_id, date_time);
CREATE INDEX idx_tips_live_session_id ON public.tips USING btree (live_session_id) WHERE (live_session_id IS NOT NULL);
CREATE INDEX idx_tips_user_platform_lower ON public.tips USING btree (user_id, lower(platform));
CREATE UNIQUE INDEX idx_tips_tip_ref ON public.tips USING btree (user_id, tip_ref) WHERE (tip_ref IS NOT NULL);
CREATE INDEX idx_tips_username ON public.tips USING btree (user_id, username);
CREATE INDEX idx_tips_user_id ON public.tips USING btree (user_id);
CREATE INDEX idx_unattributed_tips_log_user_id ON public.unattributed_tips_log USING btree (user_id);

-- ── Functions (production bodies, verbatim) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.canonical_platform(p_value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.canonical_platform_name(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select case lower(btrim(p))
    when 'chaturbate' then 'Chaturbate'
    when 'bongacams'  then 'BongaCams'
    when 'myfreecams' then 'MyFreeCams'
    else nullif(btrim(p), '')
  end
$function$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.is_linked_studio_admin(target_model_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.studio_models sm
    join public.studios s on s.id = sm.studio_id
    where sm.model_user_id = target_model_id
      and s.owner_user_id = auth.uid()
      and sm.status = 'accepted'
  );
$function$;

CREATE OR REPLACE FUNCTION public._close_private_intervals(p_session_id uuid, p_at timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.live_sessions WHERE id = p_session_id AND user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  UPDATE public.live_private_intervals
     SET ended_at = GREATEST(started_at, p_at),
         estimated_earnings_usd = round(
           rate_per_minute * EXTRACT(EPOCH FROM (GREATEST(started_at, p_at) - started_at)) / 60.0, 2)
   WHERE live_session_id = p_session_id AND ended_at IS NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_unattributed_tip_ambiguity(p_user_id uuid, p_username text, p_usd numeric, p_event_at timestamp with time zone, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_log_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required' USING ERRCODE = '22004';
  END IF;
  IF p_username IS NULL OR btrim(p_username) = '' THEN
    RAISE EXCEPTION 'username is required' USING ERRCODE = '22004';
  END IF;
  IF p_usd IS NULL OR p_usd < 0 THEN
    RAISE EXCEPTION 'usd must be >= 0' USING ERRCODE = '22003';
  END IF;
  IF p_event_at IS NULL THEN
    RAISE EXCEPTION 'event_at is required' USING ERRCODE = '22004';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason is required' USING ERRCODE = '22004';
  END IF;

  INSERT INTO public.unattributed_tips_log (user_id, username, usd, event_at, reason)
  VALUES (p_user_id, btrim(p_username), p_usd, p_event_at, btrim(p_reason))
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_live_mode_pro_entitlement(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  user_plan text;
  user_plan_expires_at timestamptz;
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'NOT_AUTHORIZED' using errcode = '28000';
  end if;

  select plan, plan_expires_at into user_plan, user_plan_expires_at
  from profiles where id = p_user_id;

  if user_plan is not null and user_plan not in ('free')
     and (user_plan_expires_at is null or user_plan_expires_at > now()) then
    return;
  end if;

  raise exception 'LIVE_MODE_REQUIRES_PRO: Live Mode is a Pro feature. Upgrade to Pro to start a live session.'
    using errcode = 'P0001';
end;
$function$;

CREATE OR REPLACE FUNCTION public.check_free_tier_platform_limit(p_user_id uuid, p_platform text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

CREATE OR REPLACE FUNCTION public.enforce_live_mode_pro_entitlement()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  -- auth.uid() is null for service-role and maintenance contexts (the pg_cron
  -- stale-session sweep, migrations, backfills). Those are not creator actions
  -- and must not be gated on a creator's plan; the bypass this migration
  -- closes is specifically an *authenticated* PostgREST caller.
  if auth.uid() is null then
    return new;
  end if;

  -- A row for somebody else is refused by the policy's WITH CHECK regardless.
  -- Returning here keeps the guard from reading a plan for a user id the
  -- caller supplied, which would turn this trigger into a Pro-status oracle.
  if new.user_id is distinct from auth.uid() then
    return new;
  end if;

  -- Mirrors start_live_session()'s in-progress exemption verbatim.
  if exists (
    select 1 from public.live_sessions
    where user_id = new.user_id
      and status in ('starting', 'live', 'inactive_warning', 'ending')
  ) then
    return new;
  end if;

  -- The canonical check. Raises LIVE_MODE_REQUIRES_PRO (P0001) for free,
  -- null-plan, and expired pro/trial; returns quietly for active pro,
  -- unlimited, and an unexpired promo-code trial grant.
  perform public.check_live_mode_pro_entitlement(auth.uid());

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_free_tier_platform_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  user_plan text;
  existing_platform_count int;
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

  -- Fast path: platform already tracked for this user → never blocked.
  if exists (
       select 1 from tips
        where user_id = new.user_id and lower(platform) = lower(new.platform))
     or exists (
       select 1 from live_tips
        where user_id = new.user_id and lower(platform) = lower(new.platform))
  then
    return new;
  end if;

  -- Genuinely new platform: same count as before.
  select count(distinct platform)
  into existing_platform_count
  from (
    select lower(platform) as platform from tips where user_id = new.user_id
    union
    select lower(platform) as platform from live_tips where user_id = new.user_id
  ) p;

  if existing_platform_count >= free_platform_limit then
    raise exception 'PLATFORM_LIMIT_REACHED: Free tier tracks up to 3 platforms. Upgrade to Standard ($9.99/mo) for additional platform coverage.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

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
    user_id,
    date_time,
    platform,
    username,
    tip_type,
    tokens,
    usd,
    tip_note,
    upload_id,
    tip_seq
  )
  VALUES (
    NEW.user_id,
    v_date_time,
    COALESCE(public.canonical_platform_name(NEW.platform), 'Chaturbate'),
    NEW.username,
    'Live',
    COALESCE(NEW.tokens, 0),
    v_usd_rounded,
    '',
    NULL,
    1
  )
  ON CONFLICT (user_id, username_lower, tokens, usd_rounded, date_time, tip_seq)
  DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.insert_tips_dedup(tips jsonb, p_upload_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inserted_count int := 0;
  total_input    int := 0;
BEGIN
  SELECT jsonb_array_length(tips) INTO total_input;

  IF auth.role() = 'authenticated' AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(tips) AS row_data
    WHERE (row_data->>'user_id')::uuid IS DISTINCT FROM auth.uid()
  ) THEN
    RAISE EXCEPTION 'RLS violation: user_id mismatch' USING errcode = '28000';
  END IF;

  WITH incoming AS (
    SELECT
      (row_data->>'user_id')::uuid AS user_id,
      (row_data->>'date_time')::timestamptz AS date_time,
      COALESCE(NULLIF(row_data->>'platform', ''), 'Unknown') AS platform,
      row_data->>'username' AS username,
      COALESCE(NULLIF(row_data->>'tip_type', ''), 'Tip') AS tip_type,
      CASE
        WHEN (row_data->>'tokens') IS NOT NULL AND (row_data->>'tokens') != ''
        THEN (row_data->>'tokens')::numeric::int
        ELSE round(COALESCE((row_data->>'usd')::numeric, 0) /
          (CASE WHEN COALESCE(NULLIF(row_data->>'platform', ''), 'Unknown') = 'BongaCams' THEN 0.025 ELSE 0.05 END)
        )::int
      END AS tokens,
      round(CASE
        WHEN (row_data->>'usd') IS NOT NULL AND (row_data->>'usd') != ''
        THEN (row_data->>'usd')::numeric
        ELSE COALESCE((row_data->>'tokens')::numeric, 0) *
          (CASE WHEN COALESCE(NULLIF(row_data->>'platform', ''), 'Unknown') = 'BongaCams' THEN 0.025 ELSE 0.05 END)
      END, 2) AS usd,
      COALESCE(row_data->>'tip_note', '') AS tip_note,
      p_upload_id AS upload_id,
      NULLIF(row_data->>'tip_seq', '')::int AS client_seq,
      ROW_NUMBER() OVER (
        PARTITION BY
          (row_data->>'user_id')::uuid,
          lower(row_data->>'username'),
          CASE
            WHEN (row_data->>'tokens') IS NOT NULL AND (row_data->>'tokens') != ''
            THEN (row_data->>'tokens')::numeric::int
            ELSE round(COALESCE((row_data->>'usd')::numeric, 0) /
              (CASE WHEN COALESCE(NULLIF(row_data->>'platform', ''), 'Unknown') = 'BongaCams' THEN 0.025 ELSE 0.05 END)
            )::int
          END,
          round(CASE
            WHEN (row_data->>'usd') IS NOT NULL AND (row_data->>'usd') != ''
            THEN (row_data->>'usd')::numeric
            ELSE COALESCE((row_data->>'tokens')::numeric, 0) *
              (CASE WHEN COALESCE(NULLIF(row_data->>'platform', ''), 'Unknown') = 'BongaCams' THEN 0.025 ELSE 0.05 END)
          END, 2),
          (row_data->>'date_time')::timestamptz
        ORDER BY ordinality
      ) AS batch_seq
    FROM jsonb_array_elements(tips) WITH ORDINALITY AS t(row_data, ordinality)
    WHERE (row_data->>'user_id')   IS NOT NULL
      AND (row_data->>'date_time') IS NOT NULL
      AND (row_data->>'username')  IS NOT NULL
      AND (row_data->>'username')  != ''
      AND (
        ((row_data->>'tokens') IS NOT NULL AND (row_data->>'tokens') != '' AND (row_data->>'tokens')::numeric > 0)
        OR
        ((row_data->>'usd') IS NOT NULL AND (row_data->>'usd') != '' AND (row_data->>'usd')::numeric > 0)
      )
  ),
  result AS (
    INSERT INTO public.tips (
      user_id, date_time, platform, username, tip_type, tokens, usd, tip_note, upload_id, tip_seq
    )
    SELECT user_id, date_time, platform, username, tip_type, tokens, usd, tip_note, upload_id,
      COALESCE(client_seq, batch_seq) AS tip_seq
    FROM incoming
    ON CONFLICT (user_id, username_lower, tokens, usd_rounded, date_time, tip_seq)
    DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*) INTO inserted_count FROM result;

  RETURN jsonb_build_object(
    'inserted', inserted_count,
    'skipped',  total_input - inserted_count,
    'total',    total_input
  );

EXCEPTION WHEN others THEN
  RETURN jsonb_build_object(
    'error',    SQLERRM,
    'detail',   SQLSTATE,
    'inserted', 0,
    'skipped',  0
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public._finalize_live_session_metrics(p_session_id uuid)
 RETURNS live_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row            public.live_sessions;
  v_active_secs    numeric;
  v_tip_count      integer;
  v_unique_tippers integer;
  v_earnings       numeric;
  v_tokens         integer;
  v_largest_tip    numeric;
  v_avg_tip        numeric;
  v_pub_count      integer;
  v_pub_unique     integer;
  v_pub_usd        numeric;
  v_pub_tokens     integer;
  v_pub_largest    numeric;
  v_pub_avg        numeric;
  v_top_username   text;
  v_top_usd        numeric;
  v_private_usd    numeric;
  v_private_secs   integer;
  v_breakdown      jsonb;
  v_duration       integer;
BEGIN
  SELECT * INTO v_row FROM public.live_sessions WHERE id = p_session_id;
  IF NOT FOUND OR v_row.ended_at IS NULL THEN
    RETURN v_row;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_row.user_id::text, 0));

  PERFORM public._close_private_intervals(p_session_id, v_row.ended_at);

  v_active_secs := GREATEST(0,
    EXTRACT(EPOCH FROM (v_row.ended_at - v_row.started_at)) - v_row.total_paused_seconds
  );
  v_duration := GREATEST(0,
    EXTRACT(EPOCH FROM (v_row.ended_at - v_row.started_at))::integer - v_row.total_paused_seconds
  );

  SELECT
    COUNT(*), COUNT(DISTINCT (lower(platform), lower(username))),
    COALESCE(SUM(usd), 0), COALESCE(SUM(tokens), 0),
    COALESCE(MAX(usd), 0), COALESCE(AVG(usd), 0)
    INTO v_tip_count, v_unique_tippers, v_earnings, v_tokens, v_largest_tip, v_avg_tip
    FROM public.live_tips
    WHERE live_session_id = p_session_id;

  SELECT
    COUNT(*), COUNT(DISTINCT (lower(platform), lower(username))),
    COALESCE(SUM(usd), 0), COALESCE(SUM(tokens), 0),
    COALESCE(MAX(usd), 0), COALESCE(AVG(usd), 0)
    INTO v_pub_count, v_pub_unique, v_pub_usd, v_pub_tokens, v_pub_largest, v_pub_avg
    FROM public.tips
    WHERE live_session_id = p_session_id;

  SELECT min(username), SUM(usd)
    INTO v_top_username, v_top_usd
    FROM public.tips
    WHERE live_session_id = p_session_id
    GROUP BY lower(platform), lower(username)
    ORDER BY SUM(usd) DESC, lower(username), lower(platform)
    LIMIT 1;

  SELECT COALESCE(jsonb_object_agg(platform, jsonb_build_object('usd', usd, 'tips', n)), '{}'::jsonb)
    INTO v_breakdown
    FROM (
      SELECT COALESCE(platform, 'unknown') AS platform, round(SUM(usd), 2) AS usd, COUNT(*) AS n
      FROM public.tips WHERE live_session_id = p_session_id
      GROUP BY 1
    ) b;

  SELECT COALESCE(SUM(estimated_earnings_usd), 0),
         COALESCE(SUM(EXTRACT(EPOCH FROM (ended_at - started_at))::integer), 0)
    INTO v_private_usd, v_private_secs
    FROM public.live_private_intervals
    WHERE live_session_id = p_session_id AND ended_at IS NOT NULL;

  UPDATE public.live_sessions
    SET session_earnings_usd     = v_earnings,
        session_tokens           = v_tokens,
        tip_count                = v_tip_count,
        unique_tipper_count      = v_unique_tippers,
        largest_tip_usd          = v_largest_tip,
        average_tip_usd          = v_avg_tip,
        earnings_per_active_hour = CASE WHEN v_active_secs > 0 THEN round((v_earnings / (v_active_secs / 3600.0))::numeric, 2) ELSE 0 END,
        tips_per_active_hour     = CASE WHEN v_active_secs > 0 THEN round((v_tip_count / (v_active_secs / 3600.0))::numeric, 2) ELSE 0 END,
        final_public_usd          = round(v_pub_usd, 2),
        final_private_usd         = round(v_private_usd, 2),
        final_private_seconds     = v_private_secs,
        final_platform_breakdown  = v_breakdown,
        final_total_usd           = round(v_pub_usd + v_private_usd, 2),
        final_tokens              = v_pub_tokens,
        final_tip_count           = v_pub_count,
        final_unique_tippers      = v_pub_unique,
        final_top_tipper_username = v_top_username,
        final_top_tipper_usd      = v_top_usd,
        final_largest_tip_usd     = v_pub_largest,
        final_avg_tip_usd         = round(v_pub_avg::numeric, 2),
        final_duration_seconds    = v_duration,
        final_usd_per_hour        = CASE WHEN v_duration > 0 THEN round(((v_pub_usd + v_private_usd) / v_duration) * 3600, 2) ELSE NULL END,
        finalized_at              = COALESCE(finalized_at, ended_at)
    WHERE id = p_session_id
    RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.persist_extension_tip(p_user_id uuid, p_client_event_id uuid, p_deduplication_key text, p_username text, p_tokens integer, p_usd numeric, p_platform text, p_event_at timestamp with time zone, p_queued_ms bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_live_id uuid;
  v_existing_session_id uuid;
  v_session_id uuid;
  v_session_ended boolean := false;
  v_matching_sessions integer;
  v_live_tip_id uuid;
  v_tip_id bigint;
  v_seq integer := 1;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required' USING ERRCODE = '22004';
  END IF;
  IF p_client_event_id IS NULL THEN
    RAISE EXCEPTION 'client_event_id is required' USING ERRCODE = '22004';
  END IF;
  IF p_username IS NULL OR btrim(p_username) = '' THEN
    RAISE EXCEPTION 'username is required' USING ERRCODE = '22004';
  END IF;
  IF p_tokens IS NULL OR p_tokens < 1 THEN
    RAISE EXCEPTION 'tokens must be > 0' USING ERRCODE = '22003';
  END IF;
  IF p_usd IS NULL OR p_usd < 0 THEN
    RAISE EXCEPTION 'usd must be >= 0' USING ERRCODE = '22003';
  END IF;
  IF p_event_at IS NULL THEN
    RAISE EXCEPTION 'event time is required' USING ERRCODE = '22004';
  END IF;
  IF p_queued_ms IS NOT NULL AND p_queued_ms < 0 THEN
    RAISE EXCEPTION 'queued_ms must be >= 0' USING ERRCODE = '22003';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT id, live_session_id INTO v_existing_live_id, v_existing_session_id
  FROM public.live_tips
  WHERE user_id = p_user_id
    AND (client_event_id = p_client_event_id
         OR (p_deduplication_key IS NOT NULL AND deduplication_key = p_deduplication_key))
  LIMIT 1;

  IF v_existing_live_id IS NOT NULL THEN
    SELECT id INTO v_tip_id FROM public.tips
    WHERE user_id = p_user_id AND client_event_id = p_client_event_id
    LIMIT 1;
    RETURN jsonb_build_object(
      'success', true,
      'duplicate', true,
      'live_tip_id', v_existing_live_id,
      'tip_id', v_tip_id,
      'live_session_id', v_existing_session_id,
      'client_event_id', p_client_event_id
    );
  END IF;

  SELECT id INTO v_session_id
  FROM public.live_sessions
  WHERE user_id = p_user_id
    AND status IN ('starting', 'live', 'inactive_warning', 'ending')
    AND (p_queued_ms IS NULL
         OR started_at <= now() - make_interval(secs => p_queued_ms / 1000.0) + interval '30 seconds')
  ORDER BY started_at DESC
  LIMIT 1;

  IF v_session_id IS NULL THEN
    SELECT COUNT(*) INTO v_matching_sessions
    FROM public.live_sessions
    WHERE user_id = p_user_id
      AND status = 'ended'
      AND started_at <= p_event_at
      AND p_event_at <= ended_at
      AND ended_at > now() - INTERVAL '30 minutes';

    IF v_matching_sessions = 1 THEN
      SELECT id INTO v_session_id
      FROM public.live_sessions
      WHERE user_id = p_user_id
        AND status = 'ended'
        AND started_at <= p_event_at
        AND p_event_at <= ended_at
        AND ended_at > now() - INTERVAL '30 minutes';
      v_session_ended := true;
    ELSIF v_matching_sessions > 1 THEN
      PERFORM public.log_unattributed_tip_ambiguity(
        p_user_id, p_username, p_usd, p_event_at, 'multiple_session_matches'
      );
    END IF;
  END IF;

  LOOP
    BEGIN
      INSERT INTO public.tips (
        user_id, date_time, platform, username, tip_type, tokens, usd,
        tip_note, tip_seq, client_event_id, source, live_session_id
      ) VALUES (
        p_user_id, p_event_at, public.canonical_platform_name(p_platform), btrim(p_username), 'Live',
        p_tokens, p_usd, '', v_seq, p_client_event_id, 'extension', v_session_id
      )
      RETURNING id INTO v_tip_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_seq := v_seq + 1;
      IF v_seq > 100 THEN
        RAISE;
      END IF;
    END;
  END LOOP;

  INSERT INTO public.live_tips (
    user_id, live_session_id, username, tokens, usd, platform, source,
    received_at, deduplication_key, client_event_id
  ) VALUES (
    p_user_id, v_session_id, btrim(p_username), p_tokens, p_usd,
    lower(btrim(p_platform)), 'extension', p_event_at, p_deduplication_key,
    p_client_event_id
  )
  RETURNING id INTO v_live_tip_id;

  IF v_session_ended THEN
    PERFORM public._finalize_live_session_metrics(v_session_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'duplicate', false,
    'live_tip_id', v_live_tip_id,
    'tip_id', v_tip_id,
    'live_session_id', v_session_id,
    'client_event_id', p_client_event_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_live_session(p_platform text DEFAULT NULL::text)
 RETURNS live_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

CREATE OR REPLACE FUNCTION public.stop_live_session()
 RETURNS live_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_before public.live_sessions;
  v_result public.live_sessions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  SELECT * INTO v_before FROM public.live_sessions
    WHERE user_id = v_uid
      AND status IN ('starting','live','inactive_warning','ending')
    ORDER BY started_at DESC
    LIMIT 1
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.live_sessions
    SET status = 'ended',
        live_substate = null,
        is_active = false,
        ended_at = now(),
        last_heartbeat_at = now(),
        total_paused_seconds = total_paused_seconds
          + CASE WHEN paused_at IS NOT NULL
                 THEN GREATEST(0, EXTRACT(EPOCH FROM (now() - paused_at))::integer)
                 ELSE 0 END,
        paused_at = null,
        warning_started_at = null,
        status_before_resolution = null,
        session_resolution_type = 'normal_stop'
    WHERE id = v_before.id
    RETURNING * INTO v_result;

  IF v_before.paused_at IS NOT NULL THEN
    UPDATE public.live_session_pauses
      SET resumed_at = v_result.ended_at,
          pause_duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (v_result.ended_at - paused_at))::integer)
      WHERE session_id = v_result.id AND resumed_at IS NULL;
  END IF;

  RETURN public._finalize_live_session_metrics(v_result.id);
END;
$function$;

-- ── Triggers (production; profiles' normalize/guard triggers omitted) ────
CREATE TRIGGER live_sessions_updated_at BEFORE UPDATE ON public.live_sessions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_enforce_live_mode_pro_entitlement BEFORE INSERT ON public.live_sessions FOR EACH ROW EXECUTE FUNCTION enforce_live_mode_pro_entitlement();
CREATE TRIGGER sync_live_tip AFTER INSERT ON public.live_tips FOR EACH ROW EXECUTE FUNCTION sync_live_tip_to_tips();
CREATE TRIGGER trg_enforce_platform_limit_live_tips BEFORE INSERT ON public.live_tips FOR EACH ROW EXECUTE FUNCTION enforce_free_tier_platform_limit();
CREATE TRIGGER trg_enforce_platform_limit_paid_sessions BEFORE INSERT ON public.paid_sessions FOR EACH ROW EXECUTE FUNCTION enforce_free_tier_platform_limit();
CREATE TRIGGER trg_enforce_platform_limit_tips BEFORE INSERT ON public.tips FOR EACH ROW EXECUTE FUNCTION enforce_free_tier_platform_limit();

-- ── RLS + policies (production) ──────────────────────────────────────────
ALTER TABLE public.coaching_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_private_intervals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_session_pauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paid_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unattributed_tips_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY coaching_events_insert_own ON public.coaching_events AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY coaching_events_select_own ON public.coaching_events AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY coaching_events_update_own ON public.coaching_events AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY live_private_intervals_select_own ON public.live_private_intervals AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY live_session_pauses_select_own ON public.live_session_pauses AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users read own live sessions" ON public.live_sessions AS PERMISSIVE FOR SELECT TO public USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "studio admin read linked model live_sessions" ON public.live_sessions AS PERMISSIVE FOR SELECT TO public USING (is_linked_studio_admin(user_id));
CREATE POLICY "Users manage own live tips" ON public.live_tips AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id));
CREATE POLICY "studio admin read linked model live_tips" ON public.live_tips AS PERMISSIVE FOR SELECT TO public USING (is_linked_studio_admin(user_id));
CREATE POLICY paid_sessions_own_delete ON public.paid_sessions AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY paid_sessions_own_insert ON public.paid_sessions AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY paid_sessions_own_select ON public.paid_sessions AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "studio admin read linked model paid_sessions" ON public.paid_sessions AS PERMISSIVE FOR SELECT TO public USING (is_linked_studio_admin(user_id));
CREATE POLICY profiles_own_insert ON public.profiles AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = id));
CREATE POLICY profiles_own_select ON public.profiles AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = id));
CREATE POLICY profiles_own_update ON public.profiles AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = id));
CREATE POLICY "studio admin read linked model tips" ON public.tips AS PERMISSIVE FOR SELECT TO public USING (is_linked_studio_admin(user_id));
CREATE POLICY tips_own_delete ON public.tips AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY tips_own_insert ON public.tips AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY tips_own_select ON public.tips AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can see their own ambiguity logs" ON public.unattributed_tips_log AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));

-- ── Table grants (production, 2026-10-29) ────────────────────────────────
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.coaching_events TO anon;
GRANT SELECT ON public.live_session_pauses TO anon;
GRANT SELECT ON public.live_sessions TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.live_tips TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.paid_sessions TO anon;
GRANT REFERENCES, SELECT, TRIGGER ON public.profiles TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.tips TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.coaching_events TO authenticated;
GRANT SELECT ON public.live_private_intervals TO authenticated;
GRANT SELECT ON public.live_session_pauses TO authenticated;
GRANT SELECT ON public.live_sessions TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.live_tips TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.paid_sessions TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER ON public.profiles TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.tips TO authenticated;
GRANT SELECT ON public.unattributed_tips_log TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.coaching_events TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.live_private_intervals TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.live_session_pauses TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.live_sessions TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.live_tips TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.paid_sessions TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.profiles TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.tips TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.unattributed_tips_log TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
