-- Phase 0 (import traceability prerequisite): sync the live dedup RPCs into the
-- repo and close an anonymous write path. Forward-only; no applied migration
-- is edited. Rollback: supabase/rollbacks/20261101_harden_dedup_rpc_grants.rollback.sql
--
-- Findings (read-only inspection of production, 2026-11-01):
--  * insert_tips_dedup — the live body has an auth.uid() ownership check that
--    the repo's latest migration (20260710_fix_insert_tips_dedup_token_rate.sql)
--    does not. Re-applying the repo version would let one user write tips into
--    another account. The body below is the LIVE body, verbatim, so the repo
--    matches production. No behaviour change. Live ACL already excluded anon
--    and PUBLIC; the REVOKE/GRANT below only makes that explicit.
--  * insert_paid_sessions_dedup — live ACL granted EXECUTE to anon. Its guard
--    `(rec->>'user_id')::uuid != auth.uid()` is NULL (not true) when auth.uid()
--    is NULL, so an anonymous caller could insert private-earnings rows into
--    ANY account (SECURITY DEFINER bypasses RLS). The only callers
--    (/api/upload, /api/upload-paid-sessions) use the creator's own JWT
--    (role 'authenticated'), so revoking anon breaks no legitimate caller.
--    The guard now uses IS DISTINCT FROM and allows service_role only.
--    Insert columns, ON CONFLICT DO NOTHING, dedup key
--    (paid_sessions_dedup_unique) and counts are unchanged.
--  * Triggers trg_enforce_platform_limit_* (Free/Pro gate) are not touched.

BEGIN;

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

REVOKE ALL ON FUNCTION public.insert_tips_dedup(jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.insert_tips_dedup(jsonb, uuid) TO authenticated, service_role;

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

REVOKE ALL ON FUNCTION public.insert_paid_sessions_dedup(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.insert_paid_sessions_dedup(jsonb) TO authenticated, service_role;

COMMIT;

-- ── VERIFY (run on a Supabase branch before production) ─────────────────────
-- 1. ACLs: anon must be absent from both.
--    SELECT proname, proacl FROM pg_proc WHERE proname IN ('insert_tips_dedup','insert_paid_sessions_dedup');
-- 2. As anon (anon key, no JWT): rpc('insert_paid_sessions_dedup', …) → permission denied.
-- 3. As user A: rpc with user_id = B → 'RLS violation'; nothing inserted.
-- 4. As user A: rpc with user_id = A → inserted; re-run → skipped (dedup unchanged).
-- 5. Counts unchanged: SELECT count(*), sum(usd) FROM paid_sessions; / tips — before = after.
