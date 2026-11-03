-- Rollback for 20261029c: restores the exact pre-migration anon grants.
-- WARNING: this reopens daphneoncam/glowmetrics#711 (anon TRUNCATE ignores
-- RLS). Use only if a real dependency on anon writes is discovered.
BEGIN;
SET LOCAL lock_timeout = '5s';
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.tips            TO anon;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.live_tips       TO anon;
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.coaching_events TO anon;
COMMIT;
