-- STAGING ONLY. Never apply to production (production already has all of this).
--
-- Brings staging's public.profiles (a 7-column stub) and public.subscriptions
-- (missing) to production's shape so the profile-security fix can be proven on
-- staging before production. Production state was read (read-only) on
-- 2026-10-08: 30 profiles columns, triggers normalize_primary_pro_platform_trg
-- and normalize_streaming_platforms_trg, policies profiles_own_select /
-- _own_insert / _own_update; subscriptions with 14 columns and policies
-- "Users can view own subscription" (SELECT), "Users can update own
-- subscription" (UPDATE), subs_own (ALL). Additive only.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS broadcaster_type text DEFAULT 'female',
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS referrer text,
  ADD COLUMN IF NOT EXISTS attributed_landing_page text,
  ADD COLUMN IF NOT EXISTS attributed_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS plan_expiry_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS live_mode_guide_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS pro_trial_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_intelligence jsonb,
  ADD COLUMN IF NOT EXISTS primary_pro_platform text,
  ADD COLUMN IF NOT EXISTS streaming_platforms text[],
  ADD COLUMN IF NOT EXISTS trial_days integer DEFAULT 7,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS bongacams_username text,
  ADD COLUMN IF NOT EXISTS myfreecams_username text;

-- Production's normalize triggers (definitions copied verbatim).
CREATE OR REPLACE FUNCTION public.normalize_primary_pro_platform()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.primary_pro_platform IS NULL OR btrim(NEW.primary_pro_platform) = '' THEN
    NEW.primary_pro_platform := NULL;
    RETURN NEW;
  END IF;
  NEW.primary_pro_platform := public.canonical_platform(NEW.primary_pro_platform);
  IF NEW.primary_pro_platform = 'Unknown' THEN
    RAISE EXCEPTION 'primary_pro_platform must be a recognised platform, got %', NEW.primary_pro_platform
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.normalize_streaming_platforms()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  raw       text;
  canon     text;
  collected text[] := '{}';
  known     text[];
BEGIN
  IF NEW.streaming_platforms IS NULL THEN
    RETURN NEW;
  END IF;
  IF array_length(NEW.streaming_platforms, 1) IS NULL THEN
    NEW.streaming_platforms := NULL;
    RETURN NEW;
  END IF;
  known := ARRAY[
    public.canonical_platform('cb'), public.canonical_platform('bc'), public.canonical_platform('mfc'),
    public.canonical_platform('sc'), public.canonical_platform('cs')
  ];
  FOREACH raw IN ARRAY NEW.streaming_platforms LOOP
    CONTINUE WHEN raw IS NULL OR btrim(raw) = '';
    canon := public.canonical_platform(raw);
    CONTINUE WHEN NOT (canon = ANY (known));
    IF NOT (canon = ANY (collected)) THEN
      collected := array_append(collected, canon);
    END IF;
  END LOOP;
  NEW.streaming_platforms := CASE WHEN array_length(collected, 1) IS NULL THEN NULL ELSE collected END;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS normalize_primary_pro_platform_trg ON public.profiles;
CREATE TRIGGER normalize_primary_pro_platform_trg BEFORE INSERT OR UPDATE OF primary_pro_platform
  ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.normalize_primary_pro_platform();
DROP TRIGGER IF EXISTS normalize_streaming_platforms_trg ON public.profiles;
CREATE TRIGGER normalize_streaming_platforms_trg BEFORE INSERT OR UPDATE OF streaming_platforms
  ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.normalize_streaming_platforms();

-- Production's subscriptions shape and policies.
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  status text DEFAULT 'free',
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  plan_type text DEFAULT 'free',
  billing_cycle text,
  is_lifetime_locked boolean DEFAULT false,
  lifetime_price_locked numeric,
  current_period_start timestamptz
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.subscriptions TO authenticated, anon, service_role;
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
CREATE POLICY "Users can update own subscription" ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS subs_own ON public.subscriptions;
CREATE POLICY subs_own ON public.subscriptions FOR ALL USING (auth.uid() = user_id);

-- Production grants on profiles (table-level ALL to authenticated/anon).
GRANT ALL ON public.profiles TO authenticated, anon, service_role;
