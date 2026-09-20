-- Reproduces production migration "studios_phase1" (version 20260909021417).
-- This file is a recovery/documentation migration only: it must match what is
-- already live in production. Do not modify without a separate, reviewed change.

create table public.studios (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  name text not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_type text not null default 'studio_monthly'
    check (plan_type in ('studio_monthly', 'studio_annual')),
  status text not null default 'active'
    check (status in ('active', 'canceled', 'past_due')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.studios enable row level security;

create policy "studio owner full access"
  on public.studios
  for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create table public.studio_models (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  model_user_id uuid not null references auth.users(id),
  status text not null default 'invited'
    check (status in ('invited', 'accepted', 'revoked')),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  unique (studio_id, model_user_id)
);

alter table public.studio_models enable row level security;

create policy "studio owner manage own invites"
  on public.studio_models
  for all
  using (studio_id in (select id from public.studios where owner_user_id = auth.uid()))
  with check (studio_id in (select id from public.studios where owner_user_id = auth.uid()));

create policy "model view own invites"
  on public.studio_models
  for select
  using (model_user_id = auth.uid());

create policy "model accept or revoke own invite"
  on public.studio_models
  for update
  using (model_user_id = auth.uid())
  with check (model_user_id = auth.uid());

create or replace function public.is_linked_studio_admin(target_model_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.studio_models sm
    join public.studios s on s.id = sm.studio_id
    where sm.model_user_id = target_model_id
      and s.owner_user_id = auth.uid()
      and sm.status = 'accepted'
  );
$$;

create policy "studio admin read linked model tips"
  on public.tips
  for select
  using (is_linked_studio_admin(user_id));

create policy "studio admin read linked model live_sessions"
  on public.live_sessions
  for select
  using (is_linked_studio_admin(user_id));

create policy "studio admin read linked model live_tips"
  on public.live_tips
  for select
  using (is_linked_studio_admin(user_id));

create policy "studio admin read linked model paid_sessions"
  on public.paid_sessions
  for select
  using (is_linked_studio_admin(user_id));
