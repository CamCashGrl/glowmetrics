-- Scratch replica of the production objects the 20261103 migration touches.
-- Function bodies copied from production pg_get_functiondef (2026-10-28).
DO $r$ BEGIN CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
CREATE SCHEMA cron;
CREATE TABLE cron.job (jobname text primary key, schedule text, command text);
CREATE FUNCTION cron.schedule(n text, s text, c text) RETURNS bigint LANGUAGE sql AS
  $$ INSERT INTO cron.job VALUES (n, s, c) ON CONFLICT (jobname) DO UPDATE SET schedule=excluded.schedule, command=excluded.command; SELECT 1::bigint $$;

CREATE TABLE public.profiles (id uuid primary key, plan text, subscription_status text, trial_ends_at timestamptz, plan_expires_at timestamptz, timezone text);
CREATE TABLE public.live_sessions (id uuid primary key DEFAULT gen_random_uuid(), user_id uuid, stream_platform text NOT NULL DEFAULT 'Chaturbate', started_at timestamptz DEFAULT now(), ended_at timestamptz, status text DEFAULT 'active', is_active boolean DEFAULT true, last_heartbeat_at timestamptz, paused_at timestamptz, total_paused_seconds integer DEFAULT 0, website_last_heartbeat_at timestamptz, extension_last_heartbeat_at timestamptz, extension_platform text, status_before_resolution text, session_resolution_type text, live_substate text, warning_started_at timestamptz,
  session_earnings_usd numeric, session_tokens integer, tip_count integer, unique_tipper_count integer, largest_tip_usd numeric, average_tip_usd numeric, earnings_per_active_hour numeric, tips_per_active_hour numeric,
  final_total_usd numeric, final_tokens integer, final_tip_count integer, final_unique_tippers integer, final_top_tipper_username text, final_top_tipper_usd numeric, final_largest_tip_usd numeric, final_avg_tip_usd numeric, final_duration_seconds integer, final_usd_per_hour numeric, finalized_at timestamptz, final_public_usd numeric, final_private_usd numeric, final_private_seconds integer, final_platform_breakdown jsonb,
  CONSTRAINT live_sessions_resolution_type_check CHECK (session_resolution_type IS NULL OR session_resolution_type = ANY (ARRAY['normal_stop','still_live','end_at_last_heartbeat','chosen_end_time','marked_invalid','auto_ended_inactivity'])));
CREATE UNIQUE INDEX live_sessions_one_running_per_user ON public.live_sessions (user_id) WHERE status = ANY (ARRAY['starting','live','inactive_warning','ending']);
CREATE TABLE public.live_session_pauses (id uuid DEFAULT gen_random_uuid(), session_id uuid, user_id uuid, paused_at timestamptz, resumed_at timestamptz, pause_duration_seconds integer);
CREATE TABLE public.live_private_intervals (id uuid primary key DEFAULT gen_random_uuid(), user_id uuid, live_session_id uuid, platform text NOT NULL, started_at timestamptz DEFAULT now(), ended_at timestamptz, rate_per_minute numeric NOT NULL, estimated_earnings_usd numeric, created_at timestamptz DEFAULT now());
CREATE UNIQUE INDEX live_private_intervals_one_open_per_session ON public.live_private_intervals (live_session_id) WHERE ended_at IS NULL;
CREATE TABLE public.tips (id bigserial, user_id uuid, platform text, username text, usd numeric, tokens integer, live_session_id uuid);
CREATE TABLE public.live_tips (id uuid DEFAULT gen_random_uuid(), user_id uuid, platform text, username text, usd numeric, tokens integer, live_session_id uuid);
CREATE TABLE public.paid_sessions (id bigserial, user_id uuid, platform text);
CREATE FUNCTION public.platform_limit_noop() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN new; END $$;
CREATE TRIGGER trg_enforce_platform_limit_tips BEFORE INSERT ON public.tips FOR EACH ROW EXECUTE FUNCTION public.platform_limit_noop();
CREATE TRIGGER trg_enforce_platform_limit_live_tips BEFORE INSERT ON public.live_tips FOR EACH ROW EXECUTE FUNCTION public.platform_limit_noop();
CREATE TRIGGER trg_enforce_platform_limit_paid_sessions BEFORE INSERT ON public.paid_sessions FOR EACH ROW EXECUTE FUNCTION public.platform_limit_noop();

CREATE OR REPLACE FUNCTION public.canonical_platform_name(p text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $function$
  select case lower(btrim(p))
    when 'chaturbate' then 'Chaturbate'
    when 'bongacams'  then 'BongaCams'
    when 'myfreecams' then 'MyFreeCams'
    else nullif(btrim(p), '')
  end
$function$;

CREATE FUNCTION public.canonical_platform(p text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT public.canonical_platform_name(p) $$;

CREATE OR REPLACE FUNCTION public.check_free_tier_platform_limit(p_user_id uuid, p_platform text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
begin
  return; -- body irrelevant to these tests (unchanged by the migration)
end;
$function$;

CREATE OR REPLACE FUNCTION public.check_live_mode_pro_entitlement(p_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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

CREATE OR REPLACE FUNCTION public.start_live_session(p_platform text DEFAULT NULL::text) RETURNS live_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $function$
begin
  raise exception 'pre-migration version; must be replaced';
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_live_mode_pro_entitlement() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
begin
  if auth.uid() is null then return new; end if;
  if new.user_id is distinct from auth.uid() then return new; end if;
  if exists (select 1 from public.live_sessions where user_id = new.user_id and status in ('starting', 'live', 'inactive_warning', 'ending')) then return new; end if;
  perform public.check_live_mode_pro_entitlement(auth.uid());
  return new;
end;
$function$;
CREATE TRIGGER trg_enforce_live_mode_pro_entitlement BEFORE INSERT ON public.live_sessions FOR EACH ROW EXECUTE FUNCTION public.enforce_live_mode_pro_entitlement();

CREATE OR REPLACE FUNCTION public._close_private_intervals(p_session_id uuid, p_at timestamp with time zone) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
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

CREATE OR REPLACE FUNCTION public._finalize_live_session_metrics(p_session_id uuid) RETURNS live_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $function$
DECLARE
  v_row public.live_sessions;
  v_duration integer;
  v_private_usd numeric;
  v_private_secs integer;
BEGIN
  SELECT * INTO v_row FROM public.live_sessions WHERE id = p_session_id;
  IF NOT FOUND OR v_row.ended_at IS NULL THEN
    RETURN v_row;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_row.user_id::text, 0));
  PERFORM public._close_private_intervals(p_session_id, v_row.ended_at);
  v_duration := GREATEST(0, EXTRACT(EPOCH FROM (v_row.ended_at - v_row.started_at))::integer - v_row.total_paused_seconds);
  SELECT COALESCE(SUM(estimated_earnings_usd), 0), COALESCE(SUM(EXTRACT(EPOCH FROM (ended_at - started_at))::integer), 0)
    INTO v_private_usd, v_private_secs
    FROM public.live_private_intervals WHERE live_session_id = p_session_id AND ended_at IS NOT NULL;
  UPDATE public.live_sessions
    SET final_private_usd = round(v_private_usd, 2), final_private_seconds = v_private_secs,
        final_duration_seconds = v_duration, finalized_at = COALESCE(finalized_at, ended_at)
    WHERE id = p_session_id RETURNING * INTO v_row;
  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pause_live_session() RETURNS live_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_result public.live_sessions;
BEGIN
  UPDATE public.live_sessions SET live_substate = 'paused', paused_at = now(), last_heartbeat_at = now()
    WHERE user_id = v_uid AND status = 'live' AND live_substate = 'active' RETURNING * INTO v_result;
  IF v_result.id IS NOT NULL THEN
    INSERT INTO public.live_session_pauses (session_id, user_id, paused_at) VALUES (v_result.id, v_uid, v_result.paused_at);
  END IF;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.end_private_interval() RETURNS live_private_intervals LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.live_private_intervals;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  SELECT * INTO v_row FROM public.live_private_intervals
    WHERE user_id = v_uid AND ended_at IS NULL
    ORDER BY started_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  PERFORM public._close_private_intervals(v_row.live_session_id, now());
  SELECT * INTO v_row FROM public.live_private_intervals WHERE id = v_row.id;
  RETURN v_row;
END;
$function$;
