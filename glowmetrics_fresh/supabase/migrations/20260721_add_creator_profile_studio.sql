-- Creator Profile Studio: Cam Bio Generator + Tip Menu Generator.
--
-- Four new tables, all owned per-user via RLS (auth.uid() = user_id), same
-- pattern as tips/tipper_notes in supabase/setup.sql and the recent
-- session-hub migration. Nothing existing is altered.
--
-- creator_profiles   — the saved "creator identity/brand/boundaries" used to
--                       prefill both generators (one profile per user for now).
-- generated_bios     — saved bio drafts (a generation may be shown without
--                       being saved; a row here means the user chose to keep it).
-- tip_menus          — saved tip menu drafts (header/settings level).
-- tip_menu_items     — individual line items of a tip menu, ordered by sort_order
--                       so the visual editor's up/down reorder just rewrites this column.

-- ── creator_profiles ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.creator_profiles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  display_name          text,
  usernames             jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { chaturbate: "...", instagram: "...", ... }
  pronouns              text,
  age_display           text NOT NULL DEFAULT 'none'
                          CHECK (age_display IN ('none', '18plus', 'custom')),
  age_display_value     text,
  location_general      text,
  languages             text[] NOT NULL DEFAULT '{}',
  experience_level      text NOT NULL DEFAULT 'new'
                          CHECK (experience_level IN ('new', 'growing', 'established')),
  platforms             text[] NOT NULL DEFAULT '{}',

  persona_tags          text[] NOT NULL DEFAULT '{}',
  personality_words      text[] NOT NULL DEFAULT '{}',
  desired_audience      text,
  brand_colors          jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [ "#16F4FF", "#FF2BAE" ]
  signature_phrase      text,
  room_difference        text,
  strongest_qualities    text,
  tone                  text[] NOT NULL DEFAULT '{}',

  services              text[] NOT NULL DEFAULT '{}',
  boundaries            jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- boundaries shape: { hardNo: text[], topics: text, mentionPublicly: bool,
  --                      softPhrase: bool, ageReminder: bool }

  schedule              jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- schedule shape: { days: text[], hours: text, timezone: text, consistent: bool }

  cta_primary           text,
  cta_secondary         text,
  social_usernames      jsonb NOT NULL DEFAULT '{}'::jsonb,

  pricing_preferences   jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- pricing_preferences shape: { platform, currencyType, tokenValue, privateShowPrice,
  --                               averageTip, earningsGoalPerHour, strategy }
  tip_menu_categories   text[] NOT NULL DEFAULT '{}',

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS creator_profiles_user_id_idx ON public.creator_profiles(user_id);

ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creator_profiles_select_own ON public.creator_profiles;
CREATE POLICY creator_profiles_select_own ON public.creator_profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS creator_profiles_insert_own ON public.creator_profiles;
CREATE POLICY creator_profiles_insert_own ON public.creator_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS creator_profiles_update_own ON public.creator_profiles;
CREATE POLICY creator_profiles_update_own ON public.creator_profiles
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS creator_profiles_delete_own ON public.creator_profiles;
CREATE POLICY creator_profiles_delete_own ON public.creator_profiles
  FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_profiles TO service_role;

-- ── generated_bios ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.generated_bios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id      uuid REFERENCES public.creator_profiles(id) ON DELETE SET NULL,

  name            text NOT NULL DEFAULT 'Untitled bio',
  platform        text NOT NULL,
  format          text NOT NULL,
  style           text NOT NULL DEFAULT 'best_overall'
                    CHECK (style IN ('best_overall', 'playful', 'direct')),
  length_option   text NOT NULL DEFAULT 'medium',
  emoji_option    text NOT NULL DEFAULT 'minimal',

  input_snapshot  jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_text  text NOT NULL,
  character_count integer NOT NULL DEFAULT 0,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generated_bios_user_id_updated_at_idx
  ON public.generated_bios(user_id, updated_at DESC);

ALTER TABLE public.generated_bios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS generated_bios_select_own ON public.generated_bios;
CREATE POLICY generated_bios_select_own ON public.generated_bios
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS generated_bios_insert_own ON public.generated_bios;
CREATE POLICY generated_bios_insert_own ON public.generated_bios
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS generated_bios_update_own ON public.generated_bios;
CREATE POLICY generated_bios_update_own ON public.generated_bios
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS generated_bios_delete_own ON public.generated_bios;
CREATE POLICY generated_bios_delete_own ON public.generated_bios
  FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_bios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_bios TO service_role;

-- ── tip_menus ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tip_menus (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id      uuid REFERENCES public.creator_profiles(id) ON DELETE SET NULL,

  name            text NOT NULL DEFAULT 'Untitled tip menu',
  platform        text NOT NULL,
  currency_type   text NOT NULL DEFAULT 'tokens'
                    CHECK (currency_type IN ('tokens', 'credits', 'dollars', 'custom')),
  token_value     numeric NOT NULL DEFAULT 0.05,
  style           text NOT NULL DEFAULT 'balanced'
                    CHECK (style IN ('balanced', 'high_engagement', 'premium')),

  title           text NOT NULL DEFAULT '',
  intro           text NOT NULL DEFAULT '',
  rules           text[] NOT NULL DEFAULT '{}',
  closing_cta     text,

  settings        jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- settings shape: { showEnergy, roomGoal, comfortLevel, minPrice, maxPrice,
  --                    itemCount, strategy, hideEarningsFromCustomer,
  --                    theme, boundaries: {...} }
  review          jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- review shape: { score, issues: [...], recommendations: [...], dismissed: [...] }

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tip_menus_user_id_updated_at_idx
  ON public.tip_menus(user_id, updated_at DESC);

ALTER TABLE public.tip_menus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tip_menus_select_own ON public.tip_menus;
CREATE POLICY tip_menus_select_own ON public.tip_menus
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS tip_menus_insert_own ON public.tip_menus;
CREATE POLICY tip_menus_insert_own ON public.tip_menus
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS tip_menus_update_own ON public.tip_menus;
CREATE POLICY tip_menus_update_own ON public.tip_menus
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS tip_menus_delete_own ON public.tip_menus;
CREATE POLICY tip_menus_delete_own ON public.tip_menus
  FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tip_menus TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tip_menus TO service_role;

-- ── tip_menu_items ────────────────────────────────────────────────────────
-- Ownership is enforced via user_id directly (denormalized from tip_menus)
-- rather than joining through tip_menu_id, so the RLS policy stays a simple
-- indexed auth.uid() = user_id check consistent with every other table here.
CREATE TABLE IF NOT EXISTS public.tip_menu_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tip_menu_id         uuid NOT NULL REFERENCES public.tip_menus(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  item_name           text NOT NULL,
  description         text NOT NULL DEFAULT '',
  price               numeric NOT NULL DEFAULT 0,
  estimated_earnings  numeric NOT NULL DEFAULT 0,
  category            text NOT NULL DEFAULT 'Custom',
  visibility          text NOT NULL DEFAULT 'public'
                        CHECK (visibility IN ('public', 'private_only', 'approval_required')),
  duration_seconds    integer,
  cooldown_minutes    integer,
  sort_order          integer NOT NULL DEFAULT 0,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tip_menu_items_tip_menu_id_sort_order_idx
  ON public.tip_menu_items(tip_menu_id, sort_order);
CREATE INDEX IF NOT EXISTS tip_menu_items_user_id_idx ON public.tip_menu_items(user_id);

ALTER TABLE public.tip_menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tip_menu_items_select_own ON public.tip_menu_items;
CREATE POLICY tip_menu_items_select_own ON public.tip_menu_items
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS tip_menu_items_insert_own ON public.tip_menu_items;
CREATE POLICY tip_menu_items_insert_own ON public.tip_menu_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS tip_menu_items_update_own ON public.tip_menu_items;
CREATE POLICY tip_menu_items_update_own ON public.tip_menu_items
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS tip_menu_items_delete_own ON public.tip_menu_items;
CREATE POLICY tip_menu_items_delete_own ON public.tip_menu_items
  FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tip_menu_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tip_menu_items TO service_role;
