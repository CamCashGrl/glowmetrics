-- Batch 1 / A: anon (no signed-in user) must never write tip or coaching data.
--
-- Production on 2026-10-29 granted anon INSERT, UPDATE, DELETE, TRUNCATE,
-- REFERENCES, TRIGGER (and SELECT) on tips, live_tips and coaching_events.
-- RLS blocks anon's row-level writes (every policy needs auth.uid()), but
-- TRUNCATE is not subject to RLS: any holder of the public anon key could
-- empty these tables. Tracked in daphneoncam/glowmetrics#711.
--
-- No code path writes these tables as anon: extension tips go through
-- /api/live/tips (service role -> persist_extension_tip), dashboard writes run
-- as authenticated, and the extension's REST call on tips is a read.
--
-- Scope (approved): only INSERT/UPDATE/DELETE/TRUNCATE for anon on these three
-- tables. authenticated and service_role are unchanged. Left for follow-ups
-- (#711), deliberately not changed here:
--   * anon SELECT / REFERENCES / TRIGGER on these tables (not used by any
--     code path; REFERENCES/TRIGGER should be revoked separately).
--   * paid_sessions, which has the same anon write grants.
--   * Root cause: default privileges in schema public, for both postgres and
--     supabase_admin, grant anon arwdDxtm on every new table (also rwU on new
--     sequences and EXECUTE on new functions). Until those are changed with
--     ALTER DEFAULT PRIVILEGES, any future table inherits the same hole.
--
-- Rollback: supabase/rollbacks/20261029c_revoke_anon_writes_tips_live_tips_coaching_events.rollback.sql

BEGIN;
SET LOCAL lock_timeout = '5s';

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tips            FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.live_tips       FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.coaching_events FROM anon;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT t, p
    FROM unnest(ARRAY['public.tips', 'public.live_tips', 'public.coaching_events']) t,
         unnest(ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p
  LOOP
    IF has_table_privilege('anon', r.t, r.p) THEN
      RAISE EXCEPTION 'anon still has % on %. Aborting.', r.p, r.t;
    END IF;
    IF NOT has_table_privilege('authenticated', r.t, r.p)
       OR NOT has_table_privilege('service_role', r.t, r.p) THEN
      RAISE EXCEPTION 'authenticated/service_role lost % on %. Aborting.', r.p, r.t;
    END IF;
  END LOOP;
END $$;

COMMIT;
