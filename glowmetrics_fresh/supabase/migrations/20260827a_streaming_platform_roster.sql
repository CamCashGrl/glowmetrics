-- ═══════════════════════════════════════════════════════════════════════════
-- STREAMING PLATFORM ROSTER
--
-- Onboarding now asks the creator to name every platform she streams on, not
-- just the one she is importing first. That roster is a STATED PREFERENCE —
-- it says nothing about her data and is never used in a calculation. It is
-- stored so the dashboard can tell the difference between "she does not
-- stream there" and "she streams there but has not imported it yet", which
-- are two very different things to say to someone.
--
-- Additive and nullable: no existing row is read, written or altered by this
-- migration. profiles.primary_pro_platform (20260826d) continues to hold the
-- primary; this holds the full set.
--
-- Values are normalised through the same public.canonical_platform() the
-- primary already uses, so one site can never be recorded under two names.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS streaming_platforms text[];

COMMENT ON COLUMN public.profiles.streaming_platforms IS
  'Platforms the creator says she streams on, set during onboarding. A stated preference, never an analytics input. Normalised via canonical_platform().';

CREATE OR REPLACE FUNCTION public.normalize_streaming_platforms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw       text;
  canon     text;
  collected text[] := '{}';
BEGIN
  IF NEW.streaming_platforms IS NULL THEN
    RETURN NEW;
  END IF;

  IF array_length(NEW.streaming_platforms, 1) IS NULL THEN
    NEW.streaming_platforms := NULL;   -- an empty roster is no roster
    RETURN NEW;
  END IF;

  FOREACH raw IN ARRAY NEW.streaming_platforms LOOP
    CONTINUE WHEN raw IS NULL OR btrim(raw) = '';
    canon := public.canonical_platform(raw);
    -- 'Unknown' is the parser's undetected bucket, not a site she streams on.
    CONTINUE WHEN canon = 'Unknown';
    IF NOT (canon = ANY (collected)) THEN
      collected := array_append(collected, canon);
    END IF;
  END LOOP;

  NEW.streaming_platforms := CASE
    WHEN array_length(collected, 1) IS NULL THEN NULL
    ELSE collected
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_streaming_platforms_trg ON public.profiles;
CREATE TRIGGER normalize_streaming_platforms_trg
  BEFORE INSERT OR UPDATE OF streaming_platforms ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_streaming_platforms();
