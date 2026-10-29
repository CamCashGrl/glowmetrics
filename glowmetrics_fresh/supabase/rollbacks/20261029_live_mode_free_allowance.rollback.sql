-- Rollback for 20261029_live_mode_free_allowance.sql — NON-DESTRUCTIVE BY DESIGN.
--
-- Restores the previous (production-verbatim) function bodies and removes the
-- triggers and the cron job. It deliberately does NOT drop:
--   * live_sessions.counted_at / allowance_timezone / allowance_week_start /
--     allowance_week_end (they hold the weekly-start accounting and audit trail)
--   * the new helper functions (harmless once nothing calls them)
--   * the widened session_resolution_type CHECK (a superset; rows may already
--     use 'free_cap_reached' / 'never_connected')
-- Dropping any of those destroys entitlement data and needs a human decision
-- after looking at the rows. Document the decision before doing it manually.
--
-- WARNING: restoring start_live_session brings back production's Pro-only
-- start gate AND its default-to-Chaturbate platform fallback.

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('enforce-free-live-caps');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_stamp_live_session_counted ON public.live_sessions;

CREATE OR REPLACE FUNCTION public.pause_live_session()
 RETURNS live_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_result public.live_sessions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  UPDATE public.live_sessions
    SET live_substate = 'paused',
        paused_at = now(),
        last_heartbeat_at = now()
    WHERE user_id = v_uid AND status = 'live' AND live_substate = 'active'
    RETURNING * INTO v_result;

  IF v_result.id IS NOT NULL THEN
    INSERT INTO public.live_session_pauses (session_id, user_id, paused_at)
      VALUES (v_result.id, v_uid, v_result.paused_at);
  END IF;

  RETURN v_result; -- NULL if not currently live+active (repeated Pause = safe no-op)
END;
$function$;

CREATE OR REPLACE FUNCTION public.resume_live_session()
 RETURNS live_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_result public.live_sessions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  UPDATE public.live_sessions
    SET live_substate = 'active',
        total_paused_seconds = total_paused_seconds
          + GREATEST(0, EXTRACT(EPOCH FROM (now() - paused_at))::integer),
        paused_at = null,
        last_heartbeat_at = now()
    WHERE user_id = v_uid AND status = 'live' AND live_substate = 'paused'
    RETURNING * INTO v_result;

  IF v_result.id IS NOT NULL THEN
    UPDATE public.live_session_pauses
      SET resumed_at = now(),
          pause_duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (now() - paused_at))::integer)
      WHERE session_id = v_result.id AND resumed_at IS NULL;
  END IF;

  RETURN v_result; -- NULL if not currently live+paused (repeated Resume = safe no-op)
END;
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

CREATE OR REPLACE FUNCTION public.resolve_live_session(p_choice text, p_end_time timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS live_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid               uuid := auth.uid();
  v_current           public.live_sessions;
  v_result            public.live_sessions;
  v_uncertainty_start timestamptz;
  v_end_time          timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_choice NOT IN ('still_live', 'ended', 'end_at_last_heartbeat', 'choose_end_time', 'mark_invalid') THEN
    RAISE EXCEPTION 'Invalid choice: %', p_choice USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_current FROM public.live_sessions
    WHERE user_id = v_uid AND status = 'inactive_warning';
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_uncertainty_start := COALESCE(v_current.warning_started_at, v_current.last_heartbeat_at);

  IF p_choice = 'still_live' THEN
    UPDATE public.live_sessions
      SET status = 'live',
          warning_started_at = null,
          total_paused_seconds = total_paused_seconds
            + CASE WHEN v_current.live_substate = 'active'
                   THEN GREATEST(0, EXTRACT(EPOCH FROM (now() - COALESCE(v_uncertainty_start, now())))::integer)
                   ELSE 0 END,
          extension_last_heartbeat_at = now(),
          broadcaster_page_missing_since = null,
          website_last_heartbeat_at = now(),
          last_heartbeat_at = now()
      WHERE id = v_current.id
      RETURNING * INTO v_result;
    RETURN v_result;
  END IF;

  IF p_choice = 'ended' THEN
    v_end_time := COALESCE(p_end_time, v_uncertainty_start, now());
  ELSIF p_choice = 'end_at_last_heartbeat' THEN
    v_end_time := COALESCE(v_current.extension_last_heartbeat_at, v_current.website_last_heartbeat_at, v_uncertainty_start, now());
  ELSIF p_choice = 'choose_end_time' THEN
    IF p_end_time IS NULL THEN
      RAISE EXCEPTION 'choose_end_time requires p_end_time' USING ERRCODE = '22023';
    END IF;
    v_end_time := p_end_time;
  ELSE -- mark_invalid
    v_end_time := COALESCE(v_uncertainty_start, now());
  END IF;

  UPDATE public.live_sessions
    SET status = 'ended',
        live_substate = null,
        is_active = false,
        warning_started_at = null,
        ended_at = v_end_time,
        total_paused_seconds = total_paused_seconds
          + CASE WHEN paused_at IS NOT NULL
                 THEN GREATEST(0, EXTRACT(EPOCH FROM (v_end_time - paused_at))::integer)
                 ELSE 0 END,
        paused_at = null,
        last_heartbeat_at = now(),
        session_resolution_type = CASE p_choice
          WHEN 'ended' THEN 'end_at_last_heartbeat'
          WHEN 'end_at_last_heartbeat' THEN 'end_at_last_heartbeat'
          WHEN 'choose_end_time' THEN 'chosen_end_time'
          ELSE 'marked_invalid'
        END,
        is_inaccurate = (p_choice = 'mark_invalid'),
        inaccuracy_reason = CASE WHEN p_choice = 'mark_invalid' THEN 'marked_invalid_by_user' ELSE inaccuracy_reason END
    WHERE id = v_current.id
    RETURNING * INTO v_result;

  RETURN public._finalize_live_session_metrics(v_result.id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_website_heartbeat()
 RETURNS live_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_result public.live_sessions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  PERFORM public.sweep_stale_live_session();

  UPDATE public.live_sessions
    SET website_last_heartbeat_at = now(),
        last_heartbeat_at = now(),
        status = CASE
          WHEN status = 'starting' THEN 'live'
          WHEN status = 'inactive_warning' THEN 'live'
          ELSE status
        END,
        live_substate = CASE
          WHEN status = 'starting' THEN 'active'
          ELSE live_substate
        END,
        warning_started_at = CASE WHEN status = 'inactive_warning' THEN null ELSE warning_started_at END
    WHERE user_id = v_uid AND status IN ('starting', 'live', 'inactive_warning')
    RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_extension_heartbeat(p_platform text, p_broadcaster_page_detected boolean)
 RETURNS live_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_result public.live_sessions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- STARTING -> LIVE: this is the extension's first ack, matching the
  -- required flow ("Extension connects -> Heartbeat begins -> Dashboard
  -- timer starts"). live_substate begins at 'active'.
  UPDATE public.live_sessions
    SET extension_last_heartbeat_at = now(),
        extension_platform = p_platform,
        broadcaster_page_detected = p_broadcaster_page_detected,
        last_heartbeat_at = now(),
        status = CASE
          WHEN status = 'starting' THEN 'live'
          WHEN status = 'inactive_warning' THEN 'live'
          ELSE status
        END,
        live_substate = CASE
          WHEN status = 'starting' THEN 'active'
          ELSE live_substate
        END,
        warning_started_at = CASE WHEN status = 'inactive_warning' THEN null ELSE warning_started_at END
    WHERE user_id = v_uid AND status IN ('starting', 'live', 'inactive_warning')
    RETURNING * INTO v_result;

  PERFORM public.sweep_stale_live_session();

  IF v_result IS NULL THEN
    SELECT * INTO v_result FROM public.live_sessions
      WHERE user_id = v_uid AND status IN ('starting', 'inactive_warning', 'ending');
  END IF;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.clear_live_session_tips()
 RETURNS live_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_result public.live_sessions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  UPDATE public.live_sessions
    SET tips_cleared_at = now()
    WHERE user_id = v_uid
      AND status IN ('starting','live','inactive_warning','ending')
    RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_live_session_coaching_strategy(p_strategy text)
 RETURNS live_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_result public.live_sessions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_strategy NOT IN ('balanced', 'aggressive', 'retention', 'engagement', 'whale', 'goal') THEN
    RAISE EXCEPTION 'Invalid strategy: %', p_strategy USING ERRCODE = '22023';
  END IF;

  UPDATE public.live_sessions
    SET coaching_strategy = p_strategy
    WHERE user_id = v_uid
      AND status IN ('starting', 'live', 'inactive_warning', 'ending')
    RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_live_session_goal_tokens(p_goal_tokens integer)
 RETURNS live_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_result public.live_sessions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_goal_tokens IS NULL OR p_goal_tokens < 0 THEN
    RAISE EXCEPTION 'Invalid goal_tokens: %', p_goal_tokens USING ERRCODE = '22023';
  END IF;

  UPDATE public.live_sessions
    SET coaching_goal_tokens = p_goal_tokens
    WHERE user_id = v_uid
      AND status IN ('starting', 'live', 'inactive_warning', 'ending')
    RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sweep_stale_live_session()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid               uuid := auth.uid();
  v_row               public.live_sessions;
  v_has_proof_of_life boolean;
  v_ended_at          timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_row FROM public.live_sessions
    WHERE user_id = v_uid AND status IN ('live', 'inactive_warning')
    ORDER BY started_at DESC
    LIMIT 1;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_row.status = 'live' AND now() - v_row.last_heartbeat_at >= interval '10 minutes' THEN
    UPDATE public.live_sessions
      SET status = 'inactive_warning',
          warning_started_at = v_row.last_heartbeat_at
      WHERE id = v_row.id;
    RETURN;
  END IF;

  IF v_row.status = 'inactive_warning'
     AND now() - v_row.last_heartbeat_at >= interval '20 minutes' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.live_tips
      WHERE user_id = v_uid AND received_at > v_row.last_heartbeat_at
    ) INTO v_has_proof_of_life;

    IF v_has_proof_of_life THEN
      UPDATE public.live_sessions
        SET status = 'live',
            warning_started_at = null,
            last_heartbeat_at = now()
        WHERE id = v_row.id;
      RETURN;
    END IF;

    v_ended_at := v_row.last_heartbeat_at;

    UPDATE public.live_sessions
      SET status = 'ended',
          live_substate = null,
          is_active = false,
          warning_started_at = null,
          ended_at = v_ended_at,
          total_paused_seconds = total_paused_seconds
            + CASE WHEN paused_at IS NOT NULL
                   THEN GREATEST(0, EXTRACT(EPOCH FROM (v_ended_at - paused_at))::integer)
                   ELSE 0 END,
          paused_at = null,
          last_heartbeat_at = now(),
          session_resolution_type = 'auto_ended_inactivity'
      WHERE id = v_row.id
      RETURNING * INTO v_row;

    PERFORM public._finalize_live_session_metrics(v_row.id);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sweep_all_stale_live_sessions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row               public.live_sessions;
  v_has_proof_of_life boolean;
  v_ended_at          timestamptz;
  v_swept             integer := 0;
BEGIN
  FOR v_row IN
    SELECT * FROM public.live_sessions
      WHERE status = 'live' AND now() - last_heartbeat_at >= interval '10 minutes'
      FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.live_sessions
      SET status = 'inactive_warning',
          warning_started_at = v_row.last_heartbeat_at
      WHERE id = v_row.id;
    v_swept := v_swept + 1;
  END LOOP;

  FOR v_row IN
    SELECT * FROM public.live_sessions
      WHERE status = 'inactive_warning' AND now() - last_heartbeat_at >= interval '20 minutes'
      FOR UPDATE SKIP LOCKED
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.live_tips
      WHERE user_id = v_row.user_id AND received_at > v_row.last_heartbeat_at
    ) INTO v_has_proof_of_life;

    IF v_has_proof_of_life THEN
      UPDATE public.live_sessions
        SET status = 'live', warning_started_at = null, last_heartbeat_at = now()
        WHERE id = v_row.id;
      v_swept := v_swept + 1;
      CONTINUE;
    END IF;

    v_ended_at := v_row.last_heartbeat_at;

    UPDATE public.live_sessions
      SET status = 'ended',
          live_substate = null,
          is_active = false,
          warning_started_at = null,
          ended_at = v_ended_at,
          total_paused_seconds = total_paused_seconds
            + CASE WHEN paused_at IS NOT NULL
                   THEN GREATEST(0, EXTRACT(EPOCH FROM (v_ended_at - paused_at))::integer)
                   ELSE 0 END,
          paused_at = null,
          last_heartbeat_at = now(),
          session_resolution_type = 'auto_ended_inactivity'
      WHERE id = v_row.id
      RETURNING * INTO v_row;

    PERFORM public._finalize_live_session_metrics(v_row.id);
    v_swept := v_swept + 1;
  END LOOP;

  RETURN v_swept;
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

COMMIT;
