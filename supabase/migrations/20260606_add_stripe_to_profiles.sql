ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id text;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;
