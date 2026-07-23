-- Optional, user-set timezone override. Null means "not set" — every
-- existing timezone-dependent calculation already falls back to the
-- browser's detected timezone (Intl.DateTimeFormat().resolvedOptions().
-- timeZone) when this is null, so this is purely additive: nothing changes
-- for a user who never sets one, but anyone whose device timezone is wrong
-- (or who streams from a different location than their system clock) can
-- now pin analytics to a specific IANA zone instead.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone text;
