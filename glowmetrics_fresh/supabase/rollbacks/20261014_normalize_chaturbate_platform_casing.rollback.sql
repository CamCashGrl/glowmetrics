-- Rollback for 20261014_normalize_chaturbate_platform_casing.sql: restores
-- the exact previous bodies of persist_extension_tip() and
-- sync_live_tip_to_tips(), puts back the original lowercase value on
-- exactly the rows the migration relabeled, and drops the helper.
BEGIN;
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
        p_user_id, p_event_at, lower(btrim(p_platform)), btrim(p_username), 'Live',
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
    COALESCE(NEW.platform, 'Chaturbate'),
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

update public.tips t set platform = b.old_platform
from public._backup_20261014_tips_platform_lowercase b
where t.id = b.tip_id;

drop function if exists public.canonical_platform_name(text);
drop table if exists public._backup_20261014_tips_platform_lowercase;
COMMIT;
