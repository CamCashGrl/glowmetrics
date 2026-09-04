-- ============================================================================
-- PRO PLATFORM ENTITLEMENT — the creator's chosen full-Pro platform
--
-- A Pro subscription entitles ONE platform to full history; the second gets a
-- rolling 31-day window. Only the CHOICE needs storing. The window itself is
-- derived from the creator's own newest eligible record for that platform, so
-- storing it would immediately go stale and give two answers to one question.
--
-- This extends the existing subscription source of truth (public.profiles,
-- which already holds plan / plan_expires_at / stripe_customer_id) rather than
-- introducing a second entitlement table.
--
-- NOT A RETENTION RULE. No tip, session or upload is deleted, altered or
-- expired by this column. It governs what the analytics layer may include for
-- a subscriber; the raw imported data stays exactly as the creator uploaded it,
-- and reassigning the primary platform later only changes which rows are
-- analysed, never which rows exist.
--
-- No platform is hardcoded. NULL is the normal state and means "derive it" —
-- lib/platformEntitlement.js then picks the platform with the most eligible
-- data. Values are stored canonicalised via public.canonical_platform(), the
-- same normaliser the free-tier platform limit already uses, so 'BC' and
-- 'BongaCams' can never be stored as two different platforms.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS primary_pro_platform text;

COMMENT ON COLUMN public.profiles.primary_pro_platform IS
  'Canonical platform name entitled to full Pro history. NULL = derive from the creator''s own data. The second platform gets a rolling 31-day window computed from its newest eligible record. Access/analytics entitlement only — never a data-retention rule.';

-- Store only canonical names, and only names we recognise. A write of 'BC'
-- lands as 'BongaCams'; an unrecognised value is rejected rather than silently
-- entitling a platform that does not exist.
CREATE OR REPLACE FUNCTION public.normalize_primary_pro_platform()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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
$$;

DROP TRIGGER IF EXISTS normalize_primary_pro_platform_trg ON public.profiles;
CREATE TRIGGER normalize_primary_pro_platform_trg
  BEFORE INSERT OR UPDATE OF primary_pro_platform ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_primary_pro_platform();
