-- Phase 0 (import traceability prerequisite): harden the two import RPCs.
-- Forward-only; no applied migration is edited.
-- Routine recovery (keeps every security fix):
--   supabase/rollbacks/20261101_harden_dedup_rpc_grants.rollback.sql
-- Rehearsal (isolated local Postgres only):
--   supabase/tests/import_rpc_hardening/run.sh
--
-- Findings (read-only inspection of production, 2026-11-01):
--  * insert_paid_sessions_dedup was EXECUTE-able by anon. Its guard
--    `(rec->>'user_id')::uuid != auth.uid()` is NULL (not true) when
--    auth.uid() is NULL, so an anonymous caller could insert private-earnings
--    rows into ANY account (SECURITY DEFINER bypasses RLS). Fixed: anon
--    revoked, guard uses IS DISTINCT FROM, only service_role may write for a
--    user_id it supplies.
--  * Both functions accepted an upload_id without checking that the import
--    (csv_uploads row) belongs to the earnings owner. Fixed: the linked import
--    must exist and be owned by the row's user_id (all roles, incl. service_role).
--  * insert_tips_dedup's live body has an auth.uid() ownership check that the
--    repo's 20260710 migration lacks. The body below is the live body with
--    ONLY the import-ownership block added.
--
-- Unchanged on purpose: rounding (tips: round(...,2) exactly as live — see
-- MONEY PRECISION below), insert columns, ON CONFLICT targets / dedup keys,
-- tip_seq handling, inserted/skipped/total counts, the exception handler in
-- insert_tips_dedup, and the Free/Pro platform-limit triggers.
--
-- MONEY PRECISION: PR #712 (20261029d) widens tips.usd to numeric(12,4) but
-- does not redefine this function, so CSV imports would still round to 2dp
-- here (and in app/api/upload/route.js). To stop either change silently
-- overwriting the other, the preflight below refuses to run unless both
-- functions are byte-identical (md5 of prosrc) to the live bodies captured on
-- 2026-11-01, or already equal this migration's result (safe re-run). Any
-- precision change to insert_tips_dedup must be rebased onto this body and
-- update these fingerprints.

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $preflight$
DECLARE
  v_tips text;
  v_paid text;
BEGIN
  SELECT md5(prosrc) INTO v_tips FROM pg_proc WHERE oid = 'public.insert_tips_dedup(jsonb, uuid)'::regprocedure;
  SELECT md5(prosrc) INTO v_paid FROM pg_proc WHERE oid = 'public.insert_paid_sessions_dedup(jsonb)'::regprocedure;
  IF v_tips IS DISTINCT FROM '17eb475cd6ba94dba9bc46f5a3a119ab'   -- live 2026-11-01
     AND v_tips IS DISTINCT FROM '697af8bff40087433588302799d1d03e' -- this migration
     -- (the recovery script restores the live tips body, so it matches line 1)
  THEN
    RAISE EXCEPTION 'Preflight failed: insert_tips_dedup body (md5 %) is not the 2026-11-01 live body. Another migration (e.g. money precision) changed it; rebase this migration first.', v_tips;
  END IF;
  IF v_paid IS DISTINCT FROM '89a624f9e63b001e2571110c06544734'
     AND v_paid IS DISTINCT FROM '3ec5ef2097af41a421f49026182e78f7' -- this migration
     AND v_paid IS DISTINCT FROM '86f0d23545b9fedcd2b2dea908ae942f' -- after the recovery script
  THEN
    RAISE EXCEPTION 'Preflight failed: insert_paid_sessions_dedup body (md5 %) is not the 2026-11-01 live body; rebase this migration first.', v_paid;
  END IF;
END
$preflight$;

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

  -- Import ownership: a tip may only be linked to an import record owned by
  -- the same creator as the tip. A missing import (owner NULL) is rejected too.
  -- Applies to every role, including service_role.
  IF p_upload_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(tips) AS row_data
    WHERE (row_data->>'user_id')::uuid IS DISTINCT FROM
          (SELECT u.user_id FROM public.csv_uploads u WHERE u.id = p_upload_id)
  ) THEN
    RAISE EXCEPTION 'Import ownership violation: upload_id does not belong to the earnings owner' USING errcode = '28000';
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
  -- Verify caller owns the rows they're trying to insert. IS DISTINCT FROM
  -- (not !=) so a NULL auth.uid() — an anonymous caller — is rejected instead
  -- of slipping through as NULL. Only the service role (server-side code that
  -- has already verified the user) may write rows for a user_id it supplies.
  FOR rec IN SELECT * FROM jsonb_array_elements(sessions)
  LOOP
    total_count := total_count + 1;

    IF auth.role() IS DISTINCT FROM 'service_role'
       AND (rec->>'user_id')::uuid IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'RLS violation: user_id mismatch on row %', total_count;
    END IF;

    -- Import ownership: the linked import must belong to this row's owner.
    IF NULLIF(rec->>'upload_id', '') IS NOT NULL
       AND (SELECT u.user_id FROM public.csv_uploads u WHERE u.id = (rec->>'upload_id')::uuid)
           IS DISTINCT FROM (rec->>'user_id')::uuid THEN
      RAISE EXCEPTION 'Import ownership violation: upload_id does not belong to the earnings owner (row %)', total_count;
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

REVOKE ALL ON FUNCTION public.insert_tips_dedup(jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.insert_tips_dedup(jsonb, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.insert_paid_sessions_dedup(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.insert_paid_sessions_dedup(jsonb) TO authenticated, service_role;

COMMIT;
