-- ═══════════════════════════════════════════════════════════════════════
-- MIGRATION: tip_ref column + deterministic dedup RPC
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
-- Safe to run multiple times (IF NOT EXISTS / CREATE OR REPLACE).
-- Does NOT modify any existing tip data.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Add tip_ref column (stores deterministic import fingerprint per row)
ALTER TABLE tips ADD COLUMN IF NOT EXISTS tip_ref TEXT;

-- 2. Add tip_note column if not already present
ALTER TABLE tips ADD COLUMN IF NOT EXISTS tip_note TEXT DEFAULT '';

-- 3. Unique index on (user_id, tip_ref) — NULLs are excluded so existing
--    rows without tip_ref are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS tips_tip_ref_idx
  ON tips (user_id, tip_ref)
  WHERE tip_ref IS NOT NULL;

-- 4. Replace insert_tips_dedup RPC to use tip_ref for deduplication.
--    Rows WITH a tip_ref use ON CONFLICT (user_id, tip_ref) — exact match.
--    Rows WITHOUT a tip_ref (legacy / manual inserts) fall back to
--    date_time + username + tokens subquery check.
CREATE OR REPLACE FUNCTION insert_tips_dedup(tips jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tip_item       jsonb;
  inserted_count int  := 0;
  skipped_count  int  := 0;
  tip_ref_val    text;
  rows_affected  int;
BEGIN
  FOR tip_item IN SELECT * FROM jsonb_array_elements(tips)
  LOOP
    tip_ref_val := NULLIF(TRIM(tip_item->>'tip_ref'), '');

    BEGIN
      IF tip_ref_val IS NOT NULL THEN
        -- Deterministic dedup via tip_ref unique index
        INSERT INTO public.tips (
          user_id, date_time, platform, username,
          tip_type, tip_note, tokens, usd, tip_ref
        ) VALUES (
          (tip_item->>'user_id')::uuid,
          (tip_item->>'date_time')::timestamptz,
           tip_item->>'platform',
           tip_item->>'username',
          COALESCE(NULLIF(tip_item->>'tip_type', ''), 'Tip'),
          COALESCE(tip_item->>'tip_note', ''),
          COALESCE((tip_item->>'tokens')::integer, 0),
          COALESCE((tip_item->>'usd')::numeric,    0),
          tip_ref_val
        )
        ON CONFLICT (user_id, tip_ref)
          WHERE tip_ref IS NOT NULL
          DO NOTHING;
      ELSE
        -- Legacy fallback: dedup on date_time + username + tokens
        INSERT INTO public.tips (
          user_id, date_time, platform, username,
          tip_type, tip_note, tokens, usd
        )
        SELECT
          (tip_item->>'user_id')::uuid,
          (tip_item->>'date_time')::timestamptz,
           tip_item->>'platform',
           tip_item->>'username',
          COALESCE(NULLIF(tip_item->>'tip_type', ''), 'Tip'),
          COALESCE(tip_item->>'tip_note', ''),
          COALESCE((tip_item->>'tokens')::integer, 0),
          COALESCE((tip_item->>'usd')::numeric,    0)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.tips
          WHERE user_id  = (tip_item->>'user_id')::uuid
            AND date_time = (tip_item->>'date_time')::timestamptz
            AND username  =  tip_item->>'username'
            AND tokens    = COALESCE((tip_item->>'tokens')::integer, 0)
        );
      END IF;

      GET DIAGNOSTICS rows_affected = ROW_COUNT;
      IF rows_affected > 0 THEN
        inserted_count := inserted_count + 1;
      ELSE
        skipped_count  := skipped_count  + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      skipped_count := skipped_count + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('inserted', inserted_count, 'skipped', skipped_count);
END;
$$;
