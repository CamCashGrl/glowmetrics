-- Brand Studio (logged-in dashboard module) reuses creator_profiles as the
-- single Brand Profile source of truth shared with the public Creator
-- Profile Studio (see 20260721_add_creator_profile_studio.sql). Most of the
-- fields Brand Studio needs already exist on that table (display_name,
-- persona_tags, tone, desired_audience, brand_colors, boundaries,
-- social_usernames, platforms, cta_primary, cta_secondary).
--
-- This adds exactly one additive column for the handful of fields that
-- don't have a home yet and don't need to be queried/filtered/indexed
-- independently (see brandSettings shape in app/api/profile-studio/profile/route.js):
--   primaryPlatform, emojiStyle, alwaysUseWords, neverUseWords, website,
--   notes, comfortLevel, audienceTags, defaultBioFormat, defaultTipMenuStrategy
--
-- Nullable-safe default, no backfill, no RLS change (existing row-level
-- policies on creator_profiles already cover this column).

ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS brand_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
