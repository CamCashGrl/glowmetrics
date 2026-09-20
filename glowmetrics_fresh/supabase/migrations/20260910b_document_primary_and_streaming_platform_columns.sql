-- Formalize primary_pro_platform / streaming_platforms in migration history.
--
-- Both columns already exist on the live profiles table (confirmed via direct
-- schema query) and are already read/written by the onboarding multi-platform
-- selection flow on this branch (selectedPlatforms[0] = primary_pro_platform,
-- selectedPlatforms = streaming_platforms). No prior migration file in this
-- repo created them, so this migration only documents/formalizes what is
-- already live — IF NOT EXISTS makes it a no-op on the current database,
-- and lets any other environment (fresh dev DB, the separate "Live Mode
-- Testing" Supabase project) reach the same schema from git history alone.
--
-- primary_pro_platform: the platform id the user marked as primary during
--   onboarding (e.g. 'chaturbate', 'bongacams', 'myfreecams'). Free-text,
--   not an enum, matching how every other platform-id column in this schema
--   (tips.platform, csv_uploads.platform, etc.) is stored.
-- streaming_platforms: every platform the user selected during onboarding,
--   in primary-first order — index 0 is always equal to primary_pro_platform.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS primary_pro_platform TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streaming_platforms TEXT[];
