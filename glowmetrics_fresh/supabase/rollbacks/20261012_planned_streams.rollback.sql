-- Rollback for 20261012_planned_streams.sql. Deletes every saved plan.
BEGIN;
DROP TABLE IF EXISTS public.planned_streams;
COMMIT;
