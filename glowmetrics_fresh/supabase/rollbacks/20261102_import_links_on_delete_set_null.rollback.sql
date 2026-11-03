-- Recovery for 20261102_import_links_on_delete_set_null.sql.
--
-- Deliberately does NOT restore ON DELETE CASCADE on tips.upload_id: that
-- re-arms "deleting an import deletes its earnings". If the new constraints
-- must be removed (e.g. they block a legitimate write), this drops them and
-- leaves upload_id unconstrained, which can lose provenance integrity but
-- never earnings. Restoring CASCADE requires explicit owner approval.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.tips DROP CONSTRAINT IF EXISTS tips_upload_id_fkey;
ALTER TABLE public.paid_sessions DROP CONSTRAINT IF EXISTS paid_sessions_upload_id_fkey;
COMMIT;
