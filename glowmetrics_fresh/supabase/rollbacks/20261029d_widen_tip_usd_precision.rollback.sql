-- Rollback for 20261029d: narrows tips.usd / live_tips.usd back to numeric(10,2).
-- LOSSY for any row written after 20261029d with sub-cent precision (for
-- example a 1-token BongaCams tip, 0.0250 -> 0.03). Rows that existed before
-- 20261029d round-trip exactly. Cannot create new tips_dedup_unique conflicts,
-- because that index already keys on round(usd, 2).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';

DROP INDEX public.tips_dedup_unique;
ALTER TABLE public.tips DROP COLUMN usd_rounded;
ALTER TABLE public.tips ALTER COLUMN usd TYPE numeric(10,2) USING round(usd, 2);
ALTER TABLE public.tips ADD COLUMN usd_rounded numeric GENERATED ALWAYS AS (round(usd, 2)) STORED;
CREATE UNIQUE INDEX tips_dedup_unique ON public.tips
  USING btree (user_id, username_lower, tokens, usd_rounded, date_time, tip_seq);

ALTER TABLE public.live_tips ALTER COLUMN usd TYPE numeric(10,2) USING round(usd, 2);
COMMIT;
