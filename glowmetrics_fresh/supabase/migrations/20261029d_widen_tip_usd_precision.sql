-- Batch 1 / B: store per-tip USD exactly.
--
-- BongaCams is $0.025/token. tips.usd and live_tips.usd were numeric(10,2),
-- so every 1-token BongaCams tip was stored as $0.03 and totals drifted
-- (40 single-token tips: $1.20 instead of $1.00). numeric(12,4) keeps the same
-- 8 integer digits and adds two decimal places.
--
-- Existing rows are NOT recalculated: widening the scale preserves every
-- stored value exactly (12.34 -> 12.3400). Historical BongaCams values are
-- under a separate provenance audit and must not be touched here.
--
-- tips.usd_rounded is GENERATED ALWAYS AS (round(usd, 2)) and backs the unique
-- index tips_dedup_unique (used by ON CONFLICT in insert_tips_dedup and
-- sync_live_tip_to_tips). Postgres cannot change the type of a column a
-- generated column depends on, so both are dropped and recreated with the
-- identical definition. Dedup behavior is unchanged.
--
-- Takes ACCESS EXCLUSIVE on tips and live_tips while they are rewritten.
-- Apply when no stream is live. A backup branch is created before any
-- production apply.
--
-- Rollback: supabase/rollbacks/20261029d_widen_tip_usd_precision.rollback.sql

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';

-- Preflight: only run against the exact production shape this was written for.
DO $$
BEGIN
  IF (SELECT format_type(atttypid, atttypmod) FROM pg_attribute
      WHERE attrelid = 'public.tips'::regclass AND attname = 'usd' AND NOT attisdropped) IS DISTINCT FROM 'numeric(10,2)'
  OR (SELECT format_type(atttypid, atttypmod) FROM pg_attribute
      WHERE attrelid = 'public.live_tips'::regclass AND attname = 'usd' AND NOT attisdropped) IS DISTINCT FROM 'numeric(10,2)'
  OR (SELECT pg_get_expr(d.adbin, d.adrelid) FROM pg_attrdef d
      JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
      WHERE a.attrelid = 'public.tips'::regclass AND a.attname = 'usd_rounded') IS DISTINCT FROM 'round(usd, 2)'
  OR (SELECT pg_get_indexdef('public.tips_dedup_unique'::regclass))
       IS DISTINCT FROM 'CREATE UNIQUE INDEX tips_dedup_unique ON public.tips USING btree (user_id, username_lower, tokens, usd_rounded, date_time, tip_seq)'
  THEN
    RAISE EXCEPTION 'Preflight failed: tips/live_tips are not in the expected production shape. Aborting.';
  END IF;
END $$;

-- Snapshot to prove no stored value changes.
CREATE TEMP TABLE _usd_before ON COMMIT DROP AS
  SELECT (SELECT sum(usd)         FROM public.tips)      AS tips_sum,
         (SELECT sum(usd_rounded) FROM public.tips)      AS tips_rounded_sum,
         (SELECT count(*)         FROM public.tips)      AS tips_n,
         (SELECT sum(usd)         FROM public.live_tips) AS live_sum,
         (SELECT count(*)         FROM public.live_tips) AS live_n;

DROP INDEX public.tips_dedup_unique;
ALTER TABLE public.tips DROP COLUMN usd_rounded;
ALTER TABLE public.tips ALTER COLUMN usd TYPE numeric(12,4);
ALTER TABLE public.tips ADD COLUMN usd_rounded numeric GENERATED ALWAYS AS (round(usd, 2)) STORED;
CREATE UNIQUE INDEX tips_dedup_unique ON public.tips
  USING btree (user_id, username_lower, tokens, usd_rounded, date_time, tip_seq);

ALTER TABLE public.live_tips ALTER COLUMN usd TYPE numeric(12,4);

DO $$
DECLARE b record;
BEGIN
  SELECT * INTO b FROM _usd_before;
  IF b.tips_sum         IS DISTINCT FROM (SELECT sum(usd)         FROM public.tips)
  OR b.tips_rounded_sum IS DISTINCT FROM (SELECT sum(usd_rounded) FROM public.tips)
  OR b.tips_n           <>               (SELECT count(*)         FROM public.tips)
  OR b.live_sum         IS DISTINCT FROM (SELECT sum(usd)         FROM public.live_tips)
  OR b.live_n           <>               (SELECT count(*)         FROM public.live_tips)
  THEN
    RAISE EXCEPTION 'Post-check failed: stored USD or row counts changed. Rolling back.';
  END IF;
END $$;

COMMIT;
