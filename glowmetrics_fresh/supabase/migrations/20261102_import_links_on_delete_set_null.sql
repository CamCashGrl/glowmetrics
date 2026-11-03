-- Deleting an import record must never delete earnings.
--
-- Production (read-only check, 2026-11-01):
--  * tips.upload_id -> csv_uploads(id) is ON DELETE CASCADE
--    (tips_upload_id_fkey). Users hold DELETE on their own csv_uploads rows,
--    so once tips are linked to imports, deleting an import record would
--    silently delete every tip it introduced.
--  * paid_sessions.upload_id has NO foreign key: a deleted import would leave
--    a dangling id that looks like real provenance.
--  * 0 tips and 0 private-earnings rows are linked today (0 orphans), so no
--    stored value changes.
--
-- After this migration, deleting an import keeps every earning and clears its
-- link (upload_id -> NULL). The UI then shows "Import source unavailable".
-- Tip and private-earnings ids, amounts and dedup keys are untouched.
--
-- Recovery: supabase/rollbacks/20261102_import_links_on_delete_set_null.rollback.sql
-- Rehearsal: supabase/tests/import_rpc_hardening/run.sh

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $preflight$
DECLARE
  v_tips_action "char";
  v_orphans bigint;
BEGIN
  SELECT confdeltype INTO v_tips_action FROM pg_constraint
   WHERE conname = 'tips_upload_id_fkey' AND conrelid = 'public.tips'::regclass;
  -- 'c' = production today, 'n' = already applied, NULL = after the recovery script.
  IF v_tips_action IS NOT NULL AND v_tips_action NOT IN ('c', 'n') THEN
    RAISE EXCEPTION 'Preflight failed: tips_upload_id_fkey has unexpected ON DELETE action (%)', v_tips_action;
  END IF;
  SELECT count(*) INTO v_orphans FROM public.paid_sessions p
   WHERE p.upload_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.csv_uploads u WHERE u.id = p.upload_id);
  IF v_orphans > 0 THEN
    RAISE EXCEPTION 'Preflight failed: % private-earnings rows reference a missing import; resolve before adding the foreign key', v_orphans;
  END IF;
END
$preflight$;

ALTER TABLE public.tips DROP CONSTRAINT IF EXISTS tips_upload_id_fkey;
ALTER TABLE public.tips
  ADD CONSTRAINT tips_upload_id_fkey FOREIGN KEY (upload_id)
  REFERENCES public.csv_uploads(id) ON DELETE SET NULL NOT VALID;

ALTER TABLE public.paid_sessions DROP CONSTRAINT IF EXISTS paid_sessions_upload_id_fkey;
ALTER TABLE public.paid_sessions
  ADD CONSTRAINT paid_sessions_upload_id_fkey FOREIGN KEY (upload_id)
  REFERENCES public.csv_uploads(id) ON DELETE SET NULL NOT VALID;

COMMIT;

-- Validation scans existing rows under a lighter lock (writes continue).
ALTER TABLE public.tips VALIDATE CONSTRAINT tips_upload_id_fkey;
ALTER TABLE public.paid_sessions VALIDATE CONSTRAINT paid_sessions_upload_id_fkey;
