-- Creator-timezone correction for previously imported tip / private-session times.
--
-- Background (2026-10-24 investigation): the dashboard importer stored the
-- export's wall-clock time as if it were UTC ("05:33" saved as 05:33Z), while
-- onboarding pastes were stored as real instants. Re-importing the same history
-- through both paths created copies a whole UTC offset apart (~510 pairs).
-- New code (lib/creatorTimezone toStoredInstant) stores real instants read in the
-- creator's saved profiles.timezone; this migration corrects the legacy rows.
--
-- SCOPE — only rows that are certainly "wall clock saved as UTC":
--   * source is not 'extension' (extension tips are real instants)
--   * created by a dashboard upload (nearest csv_uploads row within 3 minutes,
--     file name not 'pasted_import%')
--   * minute precision (seconds = 0)
--   * created before p_cutoff (rows saved by the new code are never touched)
--   * the creator has a saved profiles.timezone
-- NOT touched (pending owner decisions): CSV rows with seconds, rows with no
-- upload record, onboarding pastes, Stats API sync rows, creators without a
-- saved timezone.
--
-- A shifted row whose corrected time lands exactly on an existing row with the
-- same dedup key is a double-counted copy: it is deleted instead of updated.
-- Every changed or deleted row is copied to the backup tables first.
-- A creator can be corrected at most once (tip_time_migrations).

BEGIN;
SET LOCAL lock_timeout = '10s';

CREATE TABLE IF NOT EXISTS public.tip_time_migrations (
  user_id                  uuid PRIMARY KEY,
  time_zone                text NOT NULL,
  cutoff                   timestamptz NOT NULL,
  tips_shifted             integer NOT NULL,
  tips_duplicates_removed  integer NOT NULL,
  sessions_shifted         integer NOT NULL,
  sessions_duplicates_removed integer NOT NULL,
  migrated_at              timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tip_time_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tip_time_migrations FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.tips_time_backup_20261025 (LIKE public.tips INCLUDING DEFAULTS);
ALTER TABLE public.tips_time_backup_20261025 ADD COLUMN IF NOT EXISTS backup_action text;
ALTER TABLE public.tips_time_backup_20261025 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tips_time_backup_20261025 FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.paid_sessions_time_backup_20261025 (LIKE public.paid_sessions INCLUDING DEFAULTS);
ALTER TABLE public.paid_sessions_time_backup_20261025 ADD COLUMN IF NOT EXISTS backup_action text;
ALTER TABLE public.paid_sessions_time_backup_20261025 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.paid_sessions_time_backup_20261025 FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.migrate_creator_import_times(
  p_user uuid,
  p_cutoff timestamptz,
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz text;
  v_tips_shift int; v_tips_dup int; v_sess_shift int; v_sess_dup int;
BEGIN
  SELECT timezone INTO v_tz FROM profiles WHERE id = p_user;
  IF v_tz IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_tz) THEN
    RETURN jsonb_build_object('user_id', p_user, 'skipped', 'no saved timezone');
  END IF;
  IF EXISTS (SELECT 1 FROM tip_time_migrations WHERE user_id = p_user) THEN
    RETURN jsonb_build_object('user_id', p_user, 'skipped', 'already migrated');
  END IF;

  -- Legacy rows for this creator, with their corrected instant.
  CREATE TEMP TABLE _tips ON COMMIT DROP AS
  SELECT t.id, ((t.date_time AT TIME ZONE 'UTC') AT TIME ZONE v_tz) AS new_dt
  FROM tips t
  WHERE t.user_id = p_user
    AND coalesce(t.source, '') <> 'extension'
    AND extract(second FROM t.date_time) = 0
    AND t.created_at < p_cutoff
    AND (SELECT u.file_name NOT ILIKE 'pasted_import%'
         FROM csv_uploads u
         WHERE u.user_id = t.user_id
           AND u.uploaded_at BETWEEN t.created_at - interval '3 minutes' AND t.created_at + interval '3 minutes'
         ORDER BY abs(extract(epoch FROM (u.uploaded_at - t.created_at)))
         LIMIT 1) IS TRUE;

  CREATE TEMP TABLE _sess ON COMMIT DROP AS
  SELECT p.id, ((p.date_time AT TIME ZONE 'UTC') AT TIME ZONE v_tz) AS new_dt
  FROM paid_sessions p
  WHERE p.user_id = p_user
    AND extract(second FROM p.date_time) = 0
    AND p.created_at < p_cutoff
    AND (SELECT u.file_name NOT ILIKE 'pasted_import%'
         FROM csv_uploads u
         WHERE u.user_id = p.user_id
           AND u.uploaded_at BETWEEN p.created_at - interval '3 minutes' AND p.created_at + interval '3 minutes'
         ORDER BY abs(extract(epoch FROM (u.uploaded_at - p.created_at)))
         LIMIT 1) IS TRUE;

  -- Double-counted copies: the corrected time already exists as another row
  -- (not itself being shifted) with the same dedup key.
  CREATE TEMP TABLE _tips_dup ON COMMIT DROP AS
  SELECT l.id FROM _tips l JOIN tips t ON t.id = l.id
  WHERE EXISTS (SELECT 1 FROM tips o
                WHERE o.user_id = t.user_id AND o.username_lower = t.username_lower AND o.tokens = t.tokens
                  AND o.usd_rounded IS NOT DISTINCT FROM t.usd_rounded AND o.tip_seq IS NOT DISTINCT FROM t.tip_seq
                  AND o.date_time = l.new_dt AND o.id <> t.id
                  AND NOT EXISTS (SELECT 1 FROM _tips x WHERE x.id = o.id));

  CREATE TEMP TABLE _sess_dup ON COMMIT DROP AS
  SELECT l.id FROM _sess l JOIN paid_sessions p ON p.id = l.id
  WHERE EXISTS (SELECT 1 FROM paid_sessions o
                WHERE o.user_id = p.user_id AND o.username_lower = p.username_lower AND o.tokens = p.tokens
                  AND o.usd_rounded IS NOT DISTINCT FROM p.usd_rounded AND o.session_type = p.session_type
                  AND o.date_time = l.new_dt AND o.id <> p.id
                  AND NOT EXISTS (SELECT 1 FROM _sess x WHERE x.id = o.id));

  SELECT count(*) INTO v_tips_dup FROM _tips_dup;
  SELECT count(*) - v_tips_dup INTO v_tips_shift FROM _tips;
  SELECT count(*) INTO v_sess_dup FROM _sess_dup;
  SELECT count(*) - v_sess_dup INTO v_sess_shift FROM _sess;

  IF NOT p_dry_run THEN
    -- Back up every row that will change, then apply.
    INSERT INTO tips_time_backup_20261025
      SELECT t.*, CASE WHEN d.id IS NULL THEN 'shifted' ELSE 'duplicate_removed' END
      FROM tips t JOIN _tips l ON l.id = t.id LEFT JOIN _tips_dup d ON d.id = t.id;
    INSERT INTO paid_sessions_time_backup_20261025
      SELECT p.*, CASE WHEN d.id IS NULL THEN 'shifted' ELSE 'duplicate_removed' END
      FROM paid_sessions p JOIN _sess l ON l.id = p.id LEFT JOIN _sess_dup d ON d.id = p.id;

    DELETE FROM tips WHERE id IN (SELECT id FROM _tips_dup);
    DELETE FROM paid_sessions WHERE id IN (SELECT id FROM _sess_dup);

    -- Two-step move so shifted rows never collide with each other mid-update.
    UPDATE tips t SET date_time = t.date_time + interval '2000 years'
      FROM _tips l WHERE l.id = t.id AND l.id NOT IN (SELECT id FROM _tips_dup);
    UPDATE tips t SET date_time = l.new_dt
      FROM _tips l WHERE l.id = t.id AND l.id NOT IN (SELECT id FROM _tips_dup);
    UPDATE paid_sessions p SET date_time = p.date_time + interval '2000 years'
      FROM _sess l WHERE l.id = p.id AND l.id NOT IN (SELECT id FROM _sess_dup);
    UPDATE paid_sessions p SET date_time = l.new_dt
      FROM _sess l WHERE l.id = p.id AND l.id NOT IN (SELECT id FROM _sess_dup);

    INSERT INTO tip_time_migrations (user_id, time_zone, cutoff, tips_shifted, tips_duplicates_removed, sessions_shifted, sessions_duplicates_removed)
    VALUES (p_user, v_tz, p_cutoff, v_tips_shift, v_tips_dup, v_sess_shift, v_sess_dup);
  END IF;

  DROP TABLE IF EXISTS _tips, _sess, _tips_dup, _sess_dup;

  RETURN jsonb_build_object(
    'user_id', p_user, 'time_zone', v_tz, 'dry_run', p_dry_run,
    'tips_shifted', v_tips_shift, 'tips_duplicates_removed', v_tips_dup,
    'sessions_shifted', v_sess_shift, 'sessions_duplicates_removed', v_sess_dup);
END;
$$;

REVOKE ALL ON FUNCTION public.migrate_creator_import_times(uuid, timestamptz, boolean) FROM PUBLIC, anon, authenticated;

COMMIT;

-- ── RUNBOOK (run by hand, in this order) ─────────────────────────────────────
-- 1. Pick the cutoff = the moment the new upload code is deployed (rows saved
--    after it are already real instants). Until deploy, use now().
--
-- 2. DRY RUN — changes nothing, returns per-creator counts:
--    SELECT public.migrate_creator_import_times(p.id, now(), true)
--    FROM public.profiles p WHERE p.timezone IS NOT NULL;
--
-- 3. Review the counts, then APPLY (same cutoff value as the dry run):
--    SELECT public.migrate_creator_import_times(p.id, '<cutoff>'::timestamptz, false)
--    FROM public.profiles p WHERE p.timezone IS NOT NULL;
--
-- 4. Verify:
--    SELECT * FROM public.tip_time_migrations ORDER BY migrated_at;
--    SELECT backup_action, count(*) FROM public.tips_time_backup_20261025 GROUP BY 1;
--
-- ROLLBACK for one creator (restores every shifted + removed row exactly):
--    BEGIN;
--    DELETE FROM public.tips WHERE id IN (SELECT id FROM public.tips_time_backup_20261025 WHERE user_id = '<uuid>');
--    INSERT INTO public.tips (id, user_id, date_time, platform, username, tip_type, tokens, usd, created_at, session_id, tip_note, upload_id, tip_ref, tip_seq, client_event_id, source, live_session_id)
--      SELECT id, user_id, date_time, platform, username, tip_type, tokens, usd, created_at, session_id, tip_note, upload_id, tip_ref, tip_seq, client_event_id, source, live_session_id
--      FROM public.tips_time_backup_20261025 WHERE user_id = '<uuid>';
--    DELETE FROM public.paid_sessions WHERE id IN (SELECT id FROM public.paid_sessions_time_backup_20261025 WHERE user_id = '<uuid>');
--    INSERT INTO public.paid_sessions (id, user_id, date_time, platform, username, session_type, tokens, usd, upload_id, session_ref, created_at)
--      SELECT id, user_id, date_time, platform, username, session_type, tokens, usd, upload_id, session_ref, created_at
--      FROM public.paid_sessions_time_backup_20261025 WHERE user_id = '<uuid>';
--    DELETE FROM public.tip_time_migrations WHERE user_id = '<uuid>';
--    COMMIT;
