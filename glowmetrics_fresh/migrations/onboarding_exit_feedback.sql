-- Migration: onboarding_exit_feedback
-- Purpose: capture why users abandon onboarding after reaching the paste/CSV step
-- Does NOT touch tips, profiles, or any existing table.

create table if not exists onboarding_exit_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  step_number int not null,
  step_name text not null,
  reason text not null,
  free_text text,
  created_at timestamptz default now()
);

alter table onboarding_exit_feedback enable row level security;

-- Users can insert only their own feedback
create policy "Users can insert own exit feedback"
on onboarding_exit_feedback
for insert
to authenticated
with check (auth.uid() = user_id);

-- Users can read only their own feedback (no update/delete policies —
-- feedback is immutable once submitted)
create policy "Users can read own exit feedback"
on onboarding_exit_feedback
for select
to authenticated
using (auth.uid() = user_id);

-- Index for admin/analytics queries by step
create index if not exists idx_onboarding_exit_feedback_step
on onboarding_exit_feedback (step_number, created_at desc);
