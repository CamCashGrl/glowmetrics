-- Free Live Mode allowance — the DATABASE is the single entitlement authority.
--
--   * 2 newly-started streams per creator-local week
--   * 35 ACTIVE minutes per stream, warnings at 25 and 30, hard stop at 35
--   * paid active Pro = unlimited
--
-- WRITTEN, NOT APPLIED. Do not apply to production until every item in
-- "BEFORE PRODUCTION" (end of this header) is done.
--
-- ENTITLEMENT (one function: public.live_mode_entitlement)
--   unlimited : plan = 'pro' AND subscription_status = 'active'
--               AND stripe_subscription_id IS NOT NULL
--   capped    : everything else (free, canceled, trialing, promo/goodwill
--               grants, expired trials that still carry plan = 'pro').
--   There is no "denied" entitlement state. Start is refused by the gate:
--   not signed in, TIMEZONE_REQUIRED (capped only), PLATFORM_REQUIRED, or
--   FREE_LIVE_WEEKLY_LIMIT.
--
-- WHAT CONSUMES A WEEKLY START
--   A start is consumed when the session FIRST BECOMES 'live' (counted_at is
--   stamped once, by trigger, on that transition). A 'starting' row is never
--   counted. Repeated Start / refresh / a second tab return the existing
--   unresolved session and insert nothing. A 'starting' session that never
--   connects is closed as 'never_connected' after the existing stale timing
--   (20 minutes without a heartbeat — the same threshold that auto-ends a
--   live session) and consumes nothing. Once counted, a start stays consumed
--   even if the stream ends immediately.
--
-- THE ALLOWANCE CLOCK (separate from analytics duration)
--   allowance_active_seconds = (now - counted_at) - EXPLICIT pause seconds
--   Explicit pauses come from live_session_pauses. Inactivity gaps folded in
--   by resolve_live_session('still_live') are NOT subtracted: they count as
--   active time for the cap. total_paused_seconds, final_duration_seconds and
--   every analytics formula are unchanged.
--
-- 35:00 ENFORCEMENT
--   _free_cap_instant() walks the explicit pause rows to find the exact
--   instant active time reached 2100 s. _enforce_free_live_cap() ends the
--   session AT THAT INSTANT through the same finalize path as a manual End
--   (_finalize_live_session_metrics), so a late or missing heartbeat cannot
--   extend a Free stream. It is called FIRST by every function that mutates
--   or reads an active session (list in the postconditions) and by pg_cron
--   every minute.
--
-- CREATOR-LOCAL WEEK (never UTC)
--   Monday 00:00 in the creator's saved IANA timezone, validated against
--   pg_timezone_names. Capped users with a missing/invalid timezone get
--   TIMEZONE_REQUIRED. When a session is counted, the allowance timezone and
--   week window are snapshotted on it; for the rest of that open week the
--   snapshot is used even if profiles.timezone changes (no quota reset by
--   changing timezone). After that week ends, the current profile timezone
--   decides the next week (a new week never starts before the previous
--   snapshot week ended).
--
-- PLATFORM
--   Start requires Chaturbate, BongaCams or MyFreeCams (case-insensitive
--   input, canonical output). No fallback to Chaturbate. NOTE: production's
--   start_live_session currently also accepts Stripchat and CamSoda; this
--   migration narrows Live Mode Start to the three approved platforms.
--
-- BEFORE PRODUCTION (this migration enforces the first two itself)
--   1. Entitlement drift must be reconciled: the preflight below ABORTS if
--      any profile has plan <> 'free' but does not meet the unlimited rule.
--      (2026-10-28: two expired non-Stripe "pro" profiles.) Override only
--      deliberately: SET LOCAL camcash.accept_entitlement_drift = 'on';
--   2. No stream may be live/inactive_warning/ending during apply (such a
--      row has no counted_at and would be uncapped).
--   3. Real Pro Start -> Live -> End smoke test of #676, SQL allowance suite,
--      full Jest, extension harnesses, production build, draft PR review.
--   4. Migration history is NOT written by this file.

BEGIN;
SET LOCAL lock_timeout = '10s';

-- ── Entitlement: THE one definition (the preflight below uses it too) ────
CREATE OR REPLACE FUNCTION public.live_mode_entitlement(p_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE
           WHEN p.plan = 'pro'
            AND p.subscription_status = 'active'
            AND p.stripe_subscription_id IS NOT NULL
           THEN 'unlimited'
           ELSE 'capped'
         END
  FROM (SELECT p_user_id AS id) u
  LEFT JOIN public.profiles p ON p.id = u.id
$function$;

-- ── Preflight ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_drift   integer;
  v_running integer;
BEGIN
  IF to_regprocedure('public._finalize_live_session_metrics(uuid)') IS NULL
     OR to_regprocedure('public._close_private_intervals(uuid, timestamptz)') IS NULL
     OR to_regprocedure('public.canonical_platform_name(text)') IS NULL
     OR to_regprocedure('public.check_free_tier_platform_limit(uuid, text)') IS NULL
     OR to_regprocedure('public.persist_extension_tip(uuid, uuid, text, text, integer, numeric, text, timestamptz, bigint)') IS NULL THEN
    RAISE EXCEPTION 'Live Engine functions missing — wrong database or baseline not applied. Aborting.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'live_sessions_status_check'
      AND pg_get_constraintdef(oid) LIKE '%inactive_warning%'
  ) THEN
    RAISE EXCEPTION 'live_sessions does not use the production status vocabulary. Aborting.';
  END IF;

  SELECT count(*) INTO v_drift
  FROM public.profiles p
  WHERE coalesce(p.plan, 'free') <> 'free'
    AND public.live_mode_entitlement(p.id) <> 'unlimited';
  IF v_drift > 0 AND coalesce(current_setting('camcash.accept_entitlement_drift', true), '') <> 'on' THEN
    RAISE EXCEPTION 'ENTITLEMENT_DRIFT: % profile(s) have plan <> free but are not unlimited under public.live_mode_entitlement (plan=pro AND subscription_status=active AND stripe_subscription_id present). Reconcile those accounts before applying. Aborting.', v_drift;
  END IF;

  SELECT count(*) INTO v_running
  FROM public.live_sessions
  WHERE status IN ('live', 'inactive_warning', 'ending');
  IF v_running > 0 THEN
    RAISE EXCEPTION 'LIVE_SESSIONS_RUNNING: % session(s) are live; they have no counted_at and would escape the cap. Apply when no stream is live. Aborting.', v_running;
  END IF;
END $$;

-- ── Columns (additive; nothing is dropped or rewritten) ──────────────────
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS counted_at            timestamptz,
  ADD COLUMN IF NOT EXISTS allowance_timezone    text,
  ADD COLUMN IF NOT EXISTS allowance_week_start  timestamptz,
  ADD COLUMN IF NOT EXISTS allowance_week_end    timestamptz;

CREATE INDEX IF NOT EXISTS live_sessions_user_counted_idx
  ON public.live_sessions (user_id, counted_at)
  WHERE counted_at IS NOT NULL;

-- Resolution types: production's list + the two new Free-allowance outcomes.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.live_sessions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%session_resolution_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.live_sessions DROP CONSTRAINT %I', r.conname);
  END LOOP;
  ALTER TABLE public.live_sessions ADD CONSTRAINT live_sessions_resolution_type_check
    CHECK (session_resolution_type IS NULL OR session_resolution_type = ANY (ARRAY[
      'normal_stop', 'still_live', 'end_at_last_heartbeat', 'chosen_end_time',
      'marked_invalid', 'auto_ended_inactivity', 'free_cap_reached', 'never_connected'
    ]));
END $$;

-- ── Constants, validators, entitlement ───────────────────────────────────
-- THE only place the numbers live. Everything else reads this.
CREATE OR REPLACE FUNCTION public.live_mode_free_limits()
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT jsonb_build_object(
    'starts_per_week', 2,
    'stream_seconds', 2100,
    'warn_seconds', 1500,
    'strong_warn_seconds', 1800
  )
$function$;

CREATE OR REPLACE FUNCTION public.strict_canonical_platform(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE lower(btrim(p))
    WHEN 'chaturbate' THEN 'Chaturbate'
    WHEN 'bongacams'  THEN 'BongaCams'
    WHEN 'myfreecams' THEN 'MyFreeCams'
    ELSE NULL
  END
$function$;

CREATE OR REPLACE FUNCTION public._valid_iana_timezone(p_tz text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT p_tz IS NOT NULL
     AND btrim(p_tz) <> ''
     AND EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = p_tz)
$function$;

-- ── Creator-local allowance window ───────────────────────────────────────
-- source: 'snapshot' (an open week snapshotted on a counted session),
--         'profile'  (computed from the saved timezone),
--         'missing' / 'invalid' (no week can be computed: week_* are NULL).
-- Never falls back to UTC, browser, device or server timezone.
CREATE OR REPLACE FUNCTION public._allowance_window(
  p_user uuid, p_at timestamptz,
  OUT tz text, OUT week_start timestamptz, OUT week_end timestamptz, OUT source text)
 RETURNS record
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_tz       text;
  v_prev_end timestamptz;
  v_local    timestamp;
  v_wk       timestamp;
BEGIN
  -- 1. A week already in progress keeps its snapshotted timezone and window,
  --    even if profiles.timezone has changed since.
  SELECT s.allowance_timezone, s.allowance_week_start, s.allowance_week_end
    INTO tz, week_start, week_end
  FROM public.live_sessions s
  WHERE s.user_id = p_user
    AND s.counted_at IS NOT NULL
    AND s.allowance_week_start IS NOT NULL
    AND s.allowance_week_start <= p_at
    AND s.allowance_week_end > p_at
  ORDER BY s.counted_at DESC
  LIMIT 1;
  IF FOUND THEN
    source := 'snapshot';
    RETURN;
  END IF;

  -- 2. Otherwise the creator's CURRENT saved timezone decides the week.
  SELECT p.timezone INTO v_tz FROM public.profiles p WHERE p.id = p_user;
  IF v_tz IS NULL OR btrim(v_tz) = '' THEN
    tz := NULL; week_start := NULL; week_end := NULL; source := 'missing';
    RETURN;
  END IF;
  IF NOT public._valid_iana_timezone(v_tz) THEN
    tz := v_tz; week_start := NULL; week_end := NULL; source := 'invalid';
    RETURN;
  END IF;

  SELECT max(s.allowance_week_end) INTO v_prev_end
  FROM public.live_sessions s
  WHERE s.user_id = p_user AND s.allowance_week_end IS NOT NULL AND s.allowance_week_end <= p_at;

  v_local := p_at AT TIME ZONE v_tz;           -- wall clock in the creator's zone
  v_wk    := date_trunc('week', v_local);      -- Monday 00:00 local (ISO week)
  tz         := v_tz;
  week_start := GREATEST(v_wk AT TIME ZONE v_tz, coalesce(v_prev_end, '-infinity'::timestamptz));
  week_end   := (v_wk + interval '7 days') AT TIME ZONE v_tz;   -- calendar days: DST-correct
  source     := 'profile';
END;
$function$;

-- ── The allowance clock ──────────────────────────────────────────────────
-- (now - counted_at) - EXPLICIT pause seconds. Inactivity gaps are NOT
-- subtracted. Independent of the analytics duration formula.
CREATE OR REPLACE FUNCTION public._allowance_active_seconds(p_session_id uuid, p_at timestamptz DEFAULT now())
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  s        public.live_sessions;
  v_at     timestamptz;
  v_paused numeric;
BEGIN
  SELECT * INTO s FROM public.live_sessions WHERE id = p_session_id;
  IF NOT FOUND OR s.counted_at IS NULL THEN
    RETURN 0;
  END IF;
  v_at := LEAST(p_at, coalesce(s.ended_at, p_at));
  IF v_at <= s.counted_at THEN
    RETURN 0;
  END IF;
  SELECT coalesce(sum(GREATEST(0, EXTRACT(EPOCH FROM (
           LEAST(coalesce(pz.resumed_at, v_at), v_at) - GREATEST(pz.paused_at, s.counted_at)))::numeric)), 0)
    INTO v_paused
  FROM public.live_session_pauses pz
  WHERE pz.session_id = s.id;
  RETURN GREATEST(0, EXTRACT(EPOCH FROM (v_at - s.counted_at))::numeric - v_paused);
END;
$function$;

-- The exact instant allowance_active_seconds reaches the stream limit,
-- assuming no further pause. NULL if never (counted_at unset, or an open
-- pause began before the limit was reached). May be in the future.
CREATE OR REPLACE FUNCTION public._free_cap_instant(p_session_id uuid)
 RETURNS timestamptz
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  s        public.live_sessions;
  v_limit  numeric := (public.live_mode_free_limits() ->> 'stream_seconds')::numeric;
  v_cursor timestamptz;
  v_accum  numeric := 0;
  v_seg    numeric;
  r        record;
BEGIN
  SELECT * INTO s FROM public.live_sessions WHERE id = p_session_id;
  IF NOT FOUND OR s.counted_at IS NULL THEN
    RETURN NULL;
  END IF;
  v_cursor := s.counted_at;
  FOR r IN
    SELECT pz.paused_at AS p, pz.resumed_at AS q
    FROM public.live_session_pauses pz
    WHERE pz.session_id = s.id
    ORDER BY pz.paused_at
  LOOP
    IF r.p > v_cursor THEN
      v_seg := EXTRACT(EPOCH FROM (r.p - v_cursor))::numeric;
      IF v_accum + v_seg >= v_limit THEN
        RETURN v_cursor + make_interval(secs => (v_limit - v_accum)::double precision);
      END IF;
      v_accum := v_accum + v_seg;
    END IF;
    IF r.q IS NULL THEN
      RETURN NULL;                      -- paused and still paused: no further active time
    END IF;
    v_cursor := GREATEST(v_cursor, r.q);
  END LOOP;
  RETURN v_cursor + make_interval(secs => (v_limit - v_accum)::double precision);
END;
$function$;

-- ── Cap enforcement: the canonical stop/finalize path, at the exact instant ─
-- Returns the finalized row if it ended a session, otherwise NULL.
CREATE OR REPLACE FUNCTION public._enforce_free_live_cap(p_user uuid)
 RETURNS public.live_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  s        public.live_sessions;
  v_cap    timestamptz;
  v_result public.live_sessions;
BEGIN
  IF p_user IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO s FROM public.live_sessions
  WHERE user_id = p_user
    AND status IN ('live', 'inactive_warning', 'ending')
    AND counted_at IS NOT NULL
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF public.live_mode_entitlement(p_user) = 'unlimited' THEN
    RETURN NULL;
  END IF;
  v_cap := public._free_cap_instant(s.id);
  IF v_cap IS NULL OR v_cap > now() THEN
    RETURN NULL;
  END IF;

  -- Same per-user lock as stop_live_session / persist_extension_tip.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  SELECT * INTO s FROM public.live_sessions
  WHERE id = s.id AND status IN ('live', 'inactive_warning', 'ending')
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_cap := public._free_cap_instant(s.id);
  IF v_cap IS NULL OR v_cap > now() THEN
    RETURN NULL;
  END IF;
  v_cap := GREATEST(v_cap, s.started_at);

  UPDATE public.live_sessions
    SET status = 'ended',
        live_substate = null,
        is_active = false,
        ended_at = v_cap,
        last_heartbeat_at = now(),
        total_paused_seconds = total_paused_seconds
          + CASE WHEN s.paused_at IS NOT NULL
                 THEN GREATEST(0, EXTRACT(EPOCH FROM (v_cap - s.paused_at))::integer)
                 ELSE 0 END,
        paused_at = null,
        warning_started_at = null,
        status_before_resolution = null,
        session_resolution_type = 'free_cap_reached'
    WHERE id = s.id
    RETURNING * INTO v_result;

  IF s.paused_at IS NOT NULL THEN
    UPDATE public.live_session_pauses
      SET resumed_at = v_result.ended_at,
          pause_duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (v_result.ended_at - paused_at))::integer)
      WHERE session_id = v_result.id AND resumed_at IS NULL;
  END IF;

  RETURN public._finalize_live_session_metrics(v_result.id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_all_free_live_caps()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT user_id FROM public.live_sessions
    WHERE status IN ('live', 'inactive_warning', 'ending') AND counted_at IS NOT NULL
  LOOP
    IF (public._enforce_free_live_cap(r.user_id)).id IS NOT NULL THEN
      n := n + 1;
    END IF;
  END LOOP;
  RETURN n;
END;
$function$;

-- ── Never-connected sessions ─────────────────────────────────────────────
-- A 'starting' row that never became live and has had no heartbeat for the
-- same 20 minutes after which the existing sweep auto-ends a live session.
-- Closed, NOT finalized (no show is produced), counted_at stays NULL, so it
-- consumes no weekly start.
CREATE OR REPLACE FUNCTION public._expire_never_connected(p_user uuid DEFAULT NULL)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  n integer;
BEGIN
  UPDATE public.live_sessions
    SET status = 'ended',
        live_substate = null,
        is_active = false,
        warning_started_at = null,
        ended_at = GREATEST(last_heartbeat_at, started_at),
        session_resolution_type = 'never_connected',
        is_inaccurate = true,
        inaccuracy_reason = 'never_connected'
    WHERE status = 'starting'
      AND counted_at IS NULL
      AND now() - last_heartbeat_at >= interval '20 minutes'
      AND (p_user IS NULL OR user_id = p_user);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$function$;

-- ── Start gate ───────────────────────────────────────────────────────────
-- Called with the per-user advisory lock held (start_live_session) and again
-- from the insert trigger as defense in depth.
CREATE OR REPLACE FUNCTION public._assert_may_start_live(p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  w       record;
  v_used  integer;
  v_limit integer := (public.live_mode_free_limits() ->> 'starts_per_week')::integer;
BEGIN
  IF public.live_mode_entitlement(p_user) = 'unlimited' THEN
    RETURN;
  END IF;
  SELECT * INTO w FROM public._allowance_window(p_user, now());
  IF w.week_start IS NULL THEN
    RAISE EXCEPTION 'TIMEZONE_REQUIRED: Choose your timezone to start Live Mode. Your weekly Free allowance resets on Monday in your timezone.'
      USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO v_used
  FROM public.live_sessions s
  WHERE s.user_id = p_user AND s.counted_at >= w.week_start AND s.counted_at < w.week_end;
  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'FREE_LIVE_WEEKLY_LIMIT: Free Live Mode includes % streams per week. Upgrade to Pro for unlimited Live Mode.', v_limit
      USING ERRCODE = 'P0001';
  END IF;
END;
$function$;

-- ── Counting: stamp counted_at when a session FIRST becomes live ─────────
CREATE OR REPLACE FUNCTION public._stamp_live_session_counted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  w       record;
  v_used  integer;
  v_limit integer := (public.live_mode_free_limits() ->> 'starts_per_week')::integer;
BEGIN
  NEW.counted_at := now();
  SELECT * INTO w FROM public._allowance_window(NEW.user_id, NEW.counted_at);
  IF w.week_start IS NOT NULL THEN
    NEW.allowance_timezone   := w.tz;
    NEW.allowance_week_start := w.week_start;
    NEW.allowance_week_end   := w.week_end;
    IF public.live_mode_entitlement(NEW.user_id) <> 'unlimited' THEN
      SELECT count(*) INTO v_used
      FROM public.live_sessions s
      WHERE s.user_id = NEW.user_id AND s.id <> NEW.id
        AND s.counted_at >= w.week_start AND s.counted_at < w.week_end;
      IF v_used >= v_limit THEN
        RAISE EXCEPTION 'FREE_LIVE_WEEKLY_LIMIT: Free Live Mode includes % streams per week. Upgrade to Pro for unlimited Live Mode.', v_limit
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- ── Allowance state for the UI (display only; never decides anything) ────
CREATE OR REPLACE FUNCTION public.get_live_mode_allowance()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid     uuid := auth.uid();
  v_limits  jsonb := public.live_mode_free_limits();
  v_ent     text;
  w         record;
  s         public.live_sessions;
  v_used    integer := 0;
  v_limit   integer := (public.live_mode_free_limits() ->> 'starts_per_week')::integer;
  v_secs    integer := (public.live_mode_free_limits() ->> 'stream_seconds')::integer;
  v_warn    integer := (public.live_mode_free_limits() ->> 'warn_seconds')::integer;
  v_strong  integer := (public.live_mode_free_limits() ->> 'strong_warn_seconds')::integer;
  v_active  numeric;
  v_current jsonb := null;
  v_capped  jsonb := null;
  v_lock    text := null;
  v_tz_req  boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  PERFORM public._enforce_free_live_cap(v_uid);
  PERFORM public._expire_never_connected(v_uid);

  v_ent := public.live_mode_entitlement(v_uid);

  SELECT * INTO s FROM public.live_sessions
  WHERE user_id = v_uid AND status IN ('starting', 'live', 'inactive_warning', 'ending')
  ORDER BY started_at DESC LIMIT 1;

  IF v_ent = 'unlimited' THEN
    IF FOUND THEN
      v_current := jsonb_build_object('session_id', s.id, 'status', s.status, 'counted', s.counted_at IS NOT NULL);
    END IF;
    RETURN jsonb_build_object(
      'server_now', now(), 'entitlement', 'unlimited', 'unlimited', true,
      'limits', null, 'timezone', null, 'week', null,
      'can_start', true, 'lock_reason', null,
      'current', v_current, 'latest_cap_ended', null);
  END IF;

  SELECT * INTO w FROM public._allowance_window(v_uid, now());
  v_tz_req := w.week_start IS NULL;
  IF NOT v_tz_req THEN
    SELECT count(*) INTO v_used FROM public.live_sessions x
    WHERE x.user_id = v_uid AND x.counted_at >= w.week_start AND x.counted_at < w.week_end;
  END IF;

  IF s.id IS NOT NULL THEN
    v_active := public._allowance_active_seconds(s.id, now());
    v_current := jsonb_build_object(
      'session_id', s.id,
      'status', s.status,
      'counted', s.counted_at IS NOT NULL,
      'paused', s.paused_at IS NOT NULL,
      'active_seconds', floor(v_active),
      'remaining_seconds', CASE WHEN s.counted_at IS NULL THEN v_secs ELSE GREATEST(0, v_secs - floor(v_active)) END,
      'warning_level', CASE
          WHEN s.counted_at IS NULL THEN 'none'
          WHEN v_active >= v_secs   THEN 'limit'
          WHEN v_active >= v_strong THEN 'warn30'
          WHEN v_active >= v_warn   THEN 'warn25'
          ELSE 'none' END,
      'cap_at', CASE WHEN s.counted_at IS NULL OR s.paused_at IS NOT NULL THEN null
                     ELSE public._free_cap_instant(s.id) END);
  END IF;

  IF v_tz_req THEN
    v_lock := 'TIMEZONE_REQUIRED';
  ELSIF v_used >= v_limit AND s.id IS NULL THEN
    v_lock := 'FREE_LIVE_WEEKLY_LIMIT';
  END IF;

  SELECT jsonb_build_object('session_id', x.id, 'ended_at', x.ended_at) INTO v_capped
  FROM public.live_sessions x
  WHERE x.user_id = v_uid AND x.session_resolution_type = 'free_cap_reached'
    AND x.ended_at > now() - interval '15 minutes'
  ORDER BY x.ended_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'server_now', now(),
    'entitlement', 'capped',
    'unlimited', false,
    'limits', v_limits,
    'timezone', jsonb_build_object('value', w.tz, 'source', w.source, 'required', v_tz_req),
    'week', CASE WHEN v_tz_req THEN null ELSE jsonb_build_object(
        'start', w.week_start, 'end', w.week_end,
        'starts_used', v_used, 'starts_remaining', GREATEST(0, v_limit - v_used)) END,
    'can_start', v_lock IS NULL,
    'lock_reason', v_lock,
    'current', v_current,
    'latest_cap_ended', v_capped);
END;
$function$;

-- ── Start: strict platform, no fallback, gate under the per-user lock ────
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

  v_platform := public.strict_canonical_platform(p_platform);
  if v_platform is null then
    raise exception 'PLATFORM_REQUIRED: Live Mode needs Chaturbate, BongaCams or MyFreeCams. No platform is ever guessed.'
      using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  perform public._enforce_free_live_cap(v_uid);
  perform public._expire_never_connected(v_uid);

  -- An unresolved session is returned as-is: refresh, reconnect and a second
  -- tab never insert a row, never consume a weekly start, never reset a clock.
  select * into v_result from public.live_sessions
    where user_id = v_uid and status in ('starting','live','inactive_warning','ending')
    order by started_at desc
    limit 1;
  if found then
    return v_result;
  end if;

  perform public._assert_may_start_live(v_uid);
  perform public.check_free_tier_platform_limit(v_uid, v_platform);

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

-- The insert-time guard (kept under its existing name/trigger): defense in
-- depth against any direct insert. Browser inserts are already revoked.
CREATE OR REPLACE FUNCTION public.enforce_live_mode_pro_entitlement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.user_id is distinct from auth.uid() then
    return new;
  end if;
  if exists (
    select 1 from public.live_sessions
    where user_id = new.user_id
      and status in ('starting', 'live', 'inactive_warning', 'ending')
  ) then
    return new;
  end if;
  perform public._assert_may_start_live(auth.uid());
  return new;
end;
$function$;

-- ── pause_live_session: production body + cap check first ─────────────────────
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

  PERFORM public._enforce_free_live_cap(v_uid);

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

-- ── resume_live_session: production body + cap check first ─────────────────────
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

  PERFORM public._enforce_free_live_cap(v_uid);

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

-- ── stop_live_session: production body + cap check first ─────────────────────
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

  PERFORM public._enforce_free_live_cap(v_uid);

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

-- ── resolve_live_session: production body + cap check first ─────────────────────
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

  PERFORM public._enforce_free_live_cap(v_uid);
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

-- ── send_website_heartbeat: production body + cap check first ─────────────────────
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

  PERFORM public._enforce_free_live_cap(v_uid);

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

-- ── send_extension_heartbeat: production body + cap check first ─────────────────────
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

  PERFORM public._enforce_free_live_cap(v_uid);

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

-- ── clear_live_session_tips: production body + cap check first ─────────────────────
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

  PERFORM public._enforce_free_live_cap(v_uid);

  UPDATE public.live_sessions
    SET tips_cleared_at = now()
    WHERE user_id = v_uid
      AND status IN ('starting','live','inactive_warning','ending')
    RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;

-- ── set_live_session_coaching_strategy: production body + cap check first ─────────────────────
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

  PERFORM public._enforce_free_live_cap(v_uid);
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

-- ── set_live_session_goal_tokens: production body + cap check first ─────────────────────
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

  PERFORM public._enforce_free_live_cap(v_uid);
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

-- ── sweep_stale_live_session: production body + cap check, never-connected ──
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

  PERFORM public._enforce_free_live_cap(v_uid);
  PERFORM public._expire_never_connected(v_uid);

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

-- ── sweep_all_stale_live_sessions: production body + cap check, never-connected ──
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
  v_swept := v_swept + public.enforce_all_free_live_caps();
  v_swept := v_swept + public._expire_never_connected(NULL);
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

-- ── persist_extension_tip: production body + cap check first ───────────────
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

  -- Free cap: a stream past 35 active minutes is ended at the exact cap
  -- instant BEFORE this tip looks for a session to attach to.
  PERFORM public._enforce_free_live_cap(p_user_id);

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


-- ── Triggers ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_stamp_live_session_counted ON public.live_sessions;
CREATE TRIGGER trg_stamp_live_session_counted
  BEFORE UPDATE ON public.live_sessions
  FOR EACH ROW
  WHEN (NEW.status = 'live' AND OLD.status IS DISTINCT FROM 'live'
        AND OLD.counted_at IS NULL AND NEW.counted_at IS NULL)
  EXECUTE FUNCTION public._stamp_live_session_counted();
-- trg_enforce_live_mode_pro_entitlement already exists and now calls the
-- new gate through enforce_live_mode_pro_entitlement().

-- ── Grants ───────────────────────────────────────────────────────────────
-- Internal helpers: server-side only (called from SECURITY DEFINER functions
-- that run as the owner, and from pg_cron).
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.live_mode_free_limits()',
    'public.strict_canonical_platform(text)',
    'public._valid_iana_timezone(text)',
    'public.live_mode_entitlement(uuid)',
    'public._allowance_window(uuid, timestamptz)',
    'public._allowance_active_seconds(uuid, timestamptz)',
    'public._free_cap_instant(uuid)',
    'public._enforce_free_live_cap(uuid)',
    'public.enforce_all_free_live_caps()',
    'public._expire_never_connected(uuid)',
    'public._assert_may_start_live(uuid)',
    'public._stamp_live_session_counted()',
    'public.persist_extension_tip(uuid, uuid, text, text, integer, numeric, text, timestamptz, bigint)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
  -- The UI-facing, read-only-in-effect state RPC.
  REVOKE EXECUTE ON FUNCTION public.get_live_mode_allowance() FROM PUBLIC, anon;
  GRANT  EXECUTE ON FUNCTION public.get_live_mode_allowance() TO authenticated, service_role;
END $$;

-- ── pg_cron: enforce caps every minute (the existing 5-minute sweep also does)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('enforce-free-live-caps', '* * * * *', 'SELECT public.enforce_all_free_live_caps();');
  END IF;
END $$;

-- ── Postconditions ───────────────────────────────────────────────────────
DO $$
DECLARE
  f text;
BEGIN
  IF has_function_privilege('authenticated', 'public._enforce_free_live_cap(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._assert_may_start_live(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.live_mode_entitlement(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'internal allowance functions must not be callable by authenticated';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.get_live_mode_allowance()', 'EXECUTE') THEN
    RAISE EXCEPTION 'get_live_mode_allowance must be callable by authenticated';
  END IF;
  -- Every function that mutates or reads an active session enforces the cap first.
  FOREACH f IN ARRAY ARRAY[
    'start_live_session','pause_live_session','resume_live_session','stop_live_session',
    'resolve_live_session','send_website_heartbeat','send_extension_heartbeat',
    'clear_live_session_tips','set_live_session_coaching_strategy','set_live_session_goal_tokens',
    'sweep_stale_live_session','sweep_all_stale_live_sessions','persist_extension_tip',
    'get_live_mode_allowance'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      WHERE p.pronamespace = 'public'::regnamespace AND p.proname = f
        AND (p.prosrc LIKE '%_enforce_free_live_cap%' OR p.prosrc LIKE '%enforce_all_free_live_caps%')
    ) THEN
      RAISE EXCEPTION '% does not enforce the Free cap', f;
    END IF;
  END LOOP;
END $$;

COMMIT;
