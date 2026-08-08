-- 20260809's CREATE OR REPLACE with an added trailing parameter
-- (p_cooldown_seconds) did not replace the original 10-arg
-- record_dashboard_event_if_new — Postgres treats a changed argument list
-- as a distinct overload, not a replacement, the same pitfall this project
-- already hit once before for record_coaching_event_if_new (see
-- drop_legacy_record_coaching_event_overload). Applying 20260808 and
-- 20260809 to production left two overloads live simultaneously, making
-- every call ambiguous ("function record_dashboard_event_if_new(...) is
-- not unique") — reproduced and confirmed directly against production
-- before this fix.
--
-- Dropping the stale 10-arg version. The 11-arg version
-- (p_cooldown_seconds DEFAULT NULL) is a strict superset and fully
-- backward compatible with every existing caller — nothing else changes.
DROP FUNCTION IF EXISTS public.record_dashboard_event_if_new(
  text, text, text, text, text, text, jsonb, text, text, timestamptz
);
