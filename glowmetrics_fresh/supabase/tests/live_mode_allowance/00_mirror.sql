-- LOCAL / STAGING ONLY. Never run against production.
--
-- Approximate mirror of the production objects the Free Live Mode allowance
-- migrations depend on, for the disposable-Postgres SQL suite
-- (see run.sh). Column TYPES are inferred from production column names
-- and usage; function bodies below marked VERBATIM are byte-identical to
-- production (md5(prosrc) verified when this file was generated):
--   _finalize_live_session_metrics 9590d711…, _close_private_intervals cac5eb95…,
--   persist_extension_tip 013f6366…, enforce_live_mode_pro_entitlement 9536c3e5…
-- check_free_tier_platform_limit is a NO-OP stub (platform-cap behavior is
-- not under test here).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
-- Supabase default privileges: new functions are executable by the API roles.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  plan text DEFAULT 'free',
  subscription_status text DEFAULT 'none',
  stripe_subscription_id text,
  stripe_customer_id text,
  plan_expires_at timestamptz,
  trial_ends_at timestamptz,
  timezone text
);

CREATE TABLE public.live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  stream_platform text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  goal_tokens integer, goal_usd numeric,
  status text,
  is_active boolean DEFAULT true,
  total_tokens integer, total_tips integer, total_usd numeric, peak_viewers integer, notes text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  last_heartbeat_at timestamptz DEFAULT now(),
  paused_at timestamptz,
  total_paused_seconds integer NOT NULL DEFAULT 0,
  website_last_heartbeat_at timestamptz, extension_last_heartbeat_at timestamptz,
  extension_platform text, broadcaster_page_detected boolean, broadcaster_page_missing_since timestamptz,
  status_before_resolution text, tips_cleared_at timestamptz, duration_confidence text,
  starting_earnings_usd numeric, ending_earnings_usd numeric, session_earnings_usd numeric,
  starting_tokens integer, ending_tokens integer, session_tokens integer,
  tip_count integer, unique_tipper_count integer, new_tipper_count integer, returning_tipper_count integer,
  whale_tip_count integer, largest_tip_usd numeric, average_tip_usd numeric,
  earnings_per_active_hour numeric, tips_per_active_hour numeric,
  platform_detected_automatically boolean, session_resolution_type text,
  is_inaccurate boolean, inaccuracy_reason text,
  coaching_strategy text, coaching_goal_tokens integer,
  live_substate text, warning_started_at timestamptz,
  final_total_usd numeric, final_tokens integer, final_tip_count integer, final_unique_tippers integer,
  final_top_tipper_username text, final_top_tipper_usd numeric, final_largest_tip_usd numeric,
  final_avg_tip_usd numeric, final_duration_seconds integer, final_usd_per_hour numeric,
  finalized_at timestamptz, final_public_usd numeric, final_private_usd numeric,
  final_private_seconds integer, final_platform_breakdown jsonb, dashboard_seen_at timestamptz
);
ALTER TABLE public.live_sessions ADD CONSTRAINT live_sessions_status_check
  CHECK (status = ANY (ARRAY['starting','live','inactive_warning','ending','ended']));
ALTER TABLE public.live_sessions ADD CONSTRAINT live_sessions_live_substate_check
  CHECK (live_substate IS NULL OR live_substate = ANY (ARRAY['active','paused']));
ALTER TABLE public.live_sessions ADD CONSTRAINT live_sessions_resolution_type_check
  CHECK (session_resolution_type IS NULL OR session_resolution_type = ANY (ARRAY['normal_stop','still_live','end_at_last_heartbeat','chosen_end_time','marked_invalid','auto_ended_inactivity']));
CREATE UNIQUE INDEX live_sessions_one_running_per_user ON public.live_sessions (user_id)
  WHERE status = ANY (ARRAY['starting','live','inactive_warning','ending']);

-- Production's other live_sessions / pauses indexes (read from production 2026-10-29), so query plans in tests are realistic.
CREATE INDEX live_sessions_user_active ON public.live_sessions (user_id, is_active, started_at DESC);
CREATE INDEX idx_live_sessions_user_finalized ON public.live_sessions (user_id, ended_at DESC) WHERE (finalized_at IS NOT NULL);

CREATE TABLE public.live_session_pauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.live_sessions(id),
  user_id uuid NOT NULL,
  paused_at timestamptz, resumed_at timestamptz, pause_duration_seconds integer,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX live_session_pauses_session_id_idx ON public.live_session_pauses (session_id);
CREATE TABLE public.live_private_intervals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, live_session_id uuid NOT NULL REFERENCES public.live_sessions(id),
  platform text, started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz,
  rate_per_minute numeric, estimated_earnings_usd numeric, created_at timestamptz DEFAULT now()
);
CREATE TABLE public.live_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, live_session_id uuid, username text, tokens integer, usd numeric,
  platform text, source text, received_at timestamptz, deduplication_key text, client_event_id uuid,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE public.tips (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL, date_time timestamptz, platform text, username text, tip_type text,
  tokens integer, usd numeric, tip_note text, tip_seq integer, client_event_id uuid, source text,
  live_session_id uuid
);

CREATE FUNCTION public.canonical_platform_name(p text) RETURNS text
 LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $function$
  select case lower(btrim(p))
    when 'chaturbate' then 'Chaturbate'
    when 'bongacams'  then 'BongaCams'
    when 'myfreecams' then 'MyFreeCams'
    else nullif(btrim(p), '')
  end
$function$;

-- Stub: platform-cap behavior is out of scope for these tests.
CREATE FUNCTION public.check_free_tier_platform_limit(p_user_id uuid, p_platform text) RETURNS void
 LANGUAGE sql AS $function$ SELECT $function$;
CREATE FUNCTION public.log_unattributed_tip_ambiguity(uuid, text, numeric, timestamptz, text) RETURNS void
 LANGUAGE sql AS $function$ SELECT $function$;

-- VERBATIM
CREATE FUNCTION public._close_private_intervals(p_session_id uuid, p_at timestamp with time zone)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
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

-- VERBATIM
CREATE FUNCTION public._finalize_live_session_metrics(p_session_id uuid)
 RETURNS live_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
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

-- VERBATIM (production text from 20261014_normalize_chaturbate_platform_casing.sql)
CREATE FUNCTION public.persist_extension_tip(p_user_id uuid, p_client_event_id uuid, p_deduplication_key text, p_username text, p_tokens integer, p_usd numeric, p_platform text, p_event_at timestamp with time zone, p_queued_ms bigint DEFAULT NULL::bigint)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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

-- VERBATIM pre-migration insert guard + its trigger (Pro-only gate stubbed:
-- the migration replaces this function).
CREATE FUNCTION public.enforce_live_mode_pro_entitlement() RETURNS trigger
 LANGUAGE plpgsql SET search_path TO 'public'
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
CREATE FUNCTION public.check_live_mode_pro_entitlement(p_user_id uuid) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$ begin return; end; $function$;
CREATE TRIGGER trg_enforce_live_mode_pro_entitlement BEFORE INSERT ON public.live_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_live_mode_pro_entitlement();

-- Pre-migration lifecycle functions: only needed so the migration's
-- "CREATE OR REPLACE" has something to replace and to prove the rollback
-- restores production text. The real bodies are installed by the migration.
CREATE FUNCTION public.legacy_private_placeholder() RETURNS void LANGUAGE sql AS $function$ SELECT $function$;
