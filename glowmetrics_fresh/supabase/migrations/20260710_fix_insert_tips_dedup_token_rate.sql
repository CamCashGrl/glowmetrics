-- insert_tips_dedup hardcoded 0.05 in its token<->usd fallback math (used only
-- when a row arrives with tokens but no usd, or usd but no tokens). That's
-- correct for Chaturbate/MyFreeCams/Stripchat/CamSoda but wrong for
-- BongaCams, whose broadcaster rate is 0.025 per lib/constants.js
-- (PLATFORM_TOKEN_RATES). SQL can't import that JS file, so the per-platform
-- rate is hardcoded here too — keep this in sync BY HAND with
-- glowmetrics_fresh/lib/constants.js if that table ever changes.
--
-- Audited on 2026-07-10: 3,910 existing BongaCams rows checked against this
-- rate mismatch. 44 rows matched the bug signature (usd computed at 0.05
-- instead of 0.025), all belonging to a single QA test account
-- (qa-dashboard-test@camcashgrl.com) inserted in one batch with no
-- upload_id/tip_ref — not real creator data. The two protected real
-- accounts (polefreaktrial@gmail.com, polefreaktrial2@gmail.com) have zero
-- BongaCams rows and are unaffected. No data correction applied — this
-- migration only fixes the function going forward.
--
-- Only the rate fallback math changes below. Dedup logic, the ON CONFLICT
-- target, and tip_seq handling are untouched from the prior migration.
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
$function$
;
