-- Rollback for 20261101_harden_dedup_rpc_grants.sql.
-- Restores the exact pre-migration (live 2026-11-01) state, INCLUDING the
-- anonymous-write gap it closed. Only run if the migration itself breaks a
-- legitimate caller. insert_tips_dedup's body was synced verbatim (unchanged),
-- so only its grants are restored here.
BEGIN;

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

GRANT EXECUTE ON FUNCTION public.insert_paid_sessions_dedup(jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.insert_tips_dedup(jsonb, uuid) TO authenticated, service_role;

COMMIT;
