-- Adds the columns needed to show a real Plan & Billing section (renewal
-- date, billing interval, early-adopter status) and to represent a failed
-- payment as its own state rather than silently falling back to `plan =
-- 'free'`. `plan` itself keeps its existing free/pro/unlimited meaning and
-- is NOT touched — billing_status is a separate, additive signal for UI
-- messaging only; feature access decisions continue to key off `plan`.
--
-- Rollback: these columns are purely additive and nullable/defaulted, so a
-- rollback is just `alter table profiles drop column <name>` for each one
-- below, in any order. No data migration, no backfill, nothing references
-- these columns outside the webhook writer and the new billing UI reader.

alter table public.profiles
  add column if not exists billing_status text default 'ok',
  add column if not exists billing_interval text,
  add column if not exists current_period_end timestamptz,
  add column if not exists is_early_adopter boolean default false;

comment on column public.profiles.billing_status is
  'Informational billing signal from Stripe: ok | past_due | unpaid | incomplete | canceled. Never used for feature-access decisions — plan is the single source of truth for that.';
comment on column public.profiles.billing_interval is
  'month | year, mirrors the active subscription price interval.';
comment on column public.profiles.current_period_end is
  'Renewal/expiry date of the active subscription period, from Stripe.';
comment on column public.profiles.is_early_adopter is
  'True if the user is on an early_adopter_* plan_type. Display-only.';
