-- Production-shaped mirror for rehearsing 20261101_harden_dedup_rpc_grants.sql
-- on a DISPOSABLE local Postgres. Never run against production or staging.
--
-- Captured read-only from production (hlsdlaibnayzbfflxclj) on 2026-11-01:
-- tips / paid_sessions / csv_uploads columns (types, defaults, generated
-- expressions, NOT NULL), dedup unique indexes, FKs, the platform-limit
-- trigger function (verbatim) and both import RPC bodies (verbatim — the
-- run script verifies their md5 equals production's), and the function ACLs.
-- auth.uid()/auth.role() match production's definitions.
-- Reduced: auth.users, profiles and live_tips keep only the columns these
-- paths read. Production runs Postgres 17; this runs on 16.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $f$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text $f$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $f$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE TABLE public.profiles (id uuid PRIMARY KEY, plan text DEFAULT 'free'::text, timezone text);
CREATE TABLE public.live_tips (id bigserial PRIMARY KEY, user_id uuid NOT NULL, platform text);

CREATE TABLE public.csv_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  upload_ref text NOT NULL,
  platform text NOT NULL,
  file_name text,
  date_from timestamptz, date_to timestamptz,
  months_covered text[],
  total_rows integer DEFAULT 0, inserted_rows integer DEFAULT 0, skipped_rows integer DEFAULT 0,
  total_usd numeric DEFAULT 0, total_tokens bigint DEFAULT 0,
  uploaded_at timestamptz DEFAULT now(),
  status text DEFAULT 'complete'::text
);

CREATE TABLE public.tips (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date_time timestamptz NOT NULL,
  platform text NOT NULL,
  username text NOT NULL,
  tip_type text NOT NULL DEFAULT 'Tip'::text,
  tokens integer NOT NULL DEFAULT 0,
  usd numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  session_id uuid,
  tip_note text DEFAULT ''::text,
  username_lower text GENERATED ALWAYS AS (lower(username)) STORED,
  usd_rounded numeric GENERATED ALWAYS AS (round(usd, 2)) STORED,
  upload_id uuid REFERENCES public.csv_uploads(id) ON DELETE CASCADE,
  tip_ref text,
  tip_seq integer NOT NULL DEFAULT 1,
  client_event_id uuid,
  source text,
  live_session_id uuid
);
CREATE UNIQUE INDEX tips_dedup_unique ON public.tips (user_id, username_lower, tokens, usd_rounded, date_time, tip_seq);
CREATE UNIQUE INDEX idx_tips_tip_ref ON public.tips (user_id, tip_ref) WHERE tip_ref IS NOT NULL;
CREATE INDEX idx_tips_upload_id ON public.tips (upload_id);

CREATE TABLE public.paid_sessions (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date_time timestamptz NOT NULL,
  platform text NOT NULL DEFAULT 'BongaCams'::text,
  username text NOT NULL,
  username_lower text GENERATED ALWAYS AS (lower(username)) STORED,
  session_type text NOT NULL,
  tokens integer NOT NULL DEFAULT 0,
  usd numeric(10,4) NOT NULL DEFAULT 0,
  usd_rounded numeric(10,2) GENERATED ALWAYS AS (round(usd, 2)) STORED,
  upload_id uuid,
  session_ref text,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX paid_sessions_dedup_unique ON public.paid_sessions (user_id, username_lower, tokens, usd_rounded, date_time, session_type);
CREATE UNIQUE INDEX idx_paid_sessions_session_ref ON public.paid_sessions (user_id, session_ref) WHERE session_ref IS NOT NULL;

ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paid_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_uploads ENABLE ROW LEVEL SECURITY;
-- RLS policies as in production (read 2026-11-01): own-row select/insert/delete
-- on tips and paid_sessions (no UPDATE policy); csv_uploads own-row ALL.
CREATE POLICY tips_own_select ON public.tips FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY tips_own_insert ON public.tips FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY tips_own_delete ON public.tips FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY paid_sessions_own_select ON public.paid_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY paid_sessions_own_insert ON public.paid_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY paid_sessions_own_delete ON public.paid_sessions FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY csv_uploads_own ON public.csv_uploads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Table grants as in production (read 2026-11-01): anon, authenticated and
-- service_role all hold DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE,
-- UPDATE on these three tables. RLS limits rows; TRUNCATE ignores RLS.
GRANT ALL ON public.tips, public.paid_sessions, public.csv_uploads TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Platform-limit trigger function: production body, verbatim.
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
CREATE TRIGGER trg_enforce_platform_limit_tips BEFORE INSERT ON public.tips FOR EACH ROW EXECUTE FUNCTION enforce_free_tier_platform_limit();
CREATE TRIGGER trg_enforce_platform_limit_paid_sessions BEFORE INSERT ON public.paid_sessions FOR EACH ROW EXECUTE FUNCTION enforce_free_tier_platform_limit();

-- ── Import RPCs: production bodies as of 2026-11-01, verbatim ────────────
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

CREATE OR REPLACE FUNCTION public.insert_paid_sessions_dedup(sessions jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inserted_count integer := 0;
  skipped_count  integer := 0;
  total_count    integer := 0;
  rec            jsonb;
BEGIN
  -- Verify caller owns the rows they're trying to insert
  FOR rec IN SELECT * FROM jsonb_array_elements(sessions)
  LOOP
    total_count := total_count + 1;

    IF (rec->>'user_id')::uuid != auth.uid() THEN
      RAISE EXCEPTION 'RLS violation: user_id mismatch on row %', total_count;
    END IF;

    INSERT INTO public.paid_sessions (
      user_id,
      date_time,
      platform,
      username,
      session_type,
      tokens,
      usd,
      upload_id,
      session_ref
    )
    VALUES (
      (rec->>'user_id')::uuid,
      (rec->>'date_time')::timestamptz,
      COALESCE(rec->>'platform', 'BongaCams'),
      rec->>'username',
      rec->>'session_type',
      COALESCE((rec->>'tokens')::integer, 0),
      COALESCE((rec->>'usd')::numeric, 0),
      CASE WHEN rec->>'upload_id' IS NOT NULL THEN (rec->>'upload_id')::uuid ELSE NULL END,
      rec->>'session_ref'
    )
    ON CONFLICT DO NOTHING;

    IF FOUND THEN
      inserted_count := inserted_count + 1;
    ELSE
      skipped_count := skipped_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', inserted_count,
    'skipped',  skipped_count,
    'total',    total_count
  );
END;
$function$;

-- Production ACLs: tips {postgres, authenticated, service_role};
-- paid {postgres, anon, authenticated, service_role}.
REVOKE ALL ON FUNCTION public.insert_tips_dedup(jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_tips_dedup(jsonb, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.insert_paid_sessions_dedup(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_paid_sessions_dedup(jsonb) TO anon, authenticated, service_role;

-- ── Test helpers ─────────────────────────────────────────────────────────
CREATE SCHEMA t;
CREATE FUNCTION t.ok(cond boolean, label text) RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  IF cond IS TRUE THEN RAISE NOTICE 'PASS: %', label; ELSE RAISE NOTICE 'FAIL: %', label; END IF;
END $f$;
-- Run a statement under a simulated PostgREST role; returns the SQLSTATE it
-- raised ('00000' if none). Always rolls back its own work.
CREATE FUNCTION t.sqlstate_as(p_role text, p_sub text, p_sql text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE st text := '00000';
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claim.role', coalesce(p_role,''), true);
    PERFORM set_config('request.jwt.claim.sub', coalesce(p_sub,''), true);
    EXECUTE format('SET LOCAL ROLE %I', p_role);
    EXECUTE p_sql;
    RESET ROLE;
    RAISE SQLSTATE 'T0001';  -- force rollback of the work
  EXCEPTION
    WHEN SQLSTATE 'T0001' THEN st := '00000';
    WHEN OTHERS THEN st := SQLSTATE;
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN st;
END $f$;
