-- Fixes insert_tips_dedup's tip_seq numbering, which previously reset to 1 on
-- every RPC call. app/api/upload/route.js calls this RPC once per
-- BATCH_SIZE=250 chunk of a CSV; ROW_NUMBER() was scoped to the current
-- batch's jsonb array, so whenever a genuine duplicate-key group (same
-- user_id + username + tokens + usd + date_time — e.g. the same fan tipping
-- the same amount at the same recorded minute, common with coarse CSV
-- timestamps) straddled a batch boundary, the second batch's rows got
-- tip_seq values that collided with rows the first batch had already
-- inserted for that same group, and were silently dropped by
-- ON CONFLICT DO NOTHING as if they were duplicates.
-- Measured impact on a real 55,546-row import: 32,337 rows (58%) skipped.
--
-- Fix: route.js now computes tip_seq itself, over the whole file before
-- batching (see app/api/upload/route.js), and passes it in each row. This
-- function uses that client-supplied tip_seq when present, falling back to
-- its own per-call ROW_NUMBER() for callers that don't batch and don't send
-- one (e.g. stats-sync/route.js, which posts its full result set in a
-- single call).
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
        ELSE round(COALESCE((row_data->>'usd')::numeric, 0) / 0.05)::int
      END AS tokens,
      round(CASE
        WHEN (row_data->>'usd') IS NOT NULL AND (row_data->>'usd') != ''
        THEN (row_data->>'usd')::numeric
        ELSE COALESCE((row_data->>'tokens')::numeric, 0) * 0.05
      END, 2) AS usd,
      COALESCE(row_data->>'tip_note', '') AS tip_note,
      p_upload_id AS upload_id,
      NULLIF(row_data->>'tip_seq', '')::int AS client_seq,
      -- Fallback for callers that don't pre-assign tip_seq (e.g. stats-sync,
      -- which sends its whole result set in one call — no batching, so a
      -- call-scoped sequence is already correct for them).
      ROW_NUMBER() OVER (
        PARTITION BY
          (row_data->>'user_id')::uuid,
          lower(row_data->>'username'),
          CASE
            WHEN (row_data->>'tokens') IS NOT NULL AND (row_data->>'tokens') != ''
            THEN (row_data->>'tokens')::numeric::int
            ELSE round(COALESCE((row_data->>'usd')::numeric, 0) / 0.05)::int
          END,
          round(CASE
            WHEN (row_data->>'usd') IS NOT NULL AND (row_data->>'usd') != ''
            THEN (row_data->>'usd')::numeric
            ELSE COALESCE((row_data->>'tokens')::numeric, 0) * 0.05
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
$function$
;
