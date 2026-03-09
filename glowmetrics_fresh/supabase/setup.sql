-- ═══════════════════════════════════════════════════════════════════════
-- GLOWMETRICS DATABASE SETUP
-- Run this ONCE in: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════════════

-- 1. TIPS TABLE
create table if not exists tips (
  id          bigserial primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  date_time   timestamptz not null,
  platform    text not null,
  username    text not null,
  tip_type    text not null default 'Tip',
  tokens      integer not null default 0,
  usd         numeric(10,2) not null default 0,
  created_at  timestamptz default now()
);

-- 2. TIPPER NOTES (CRM)
create table if not exists tipper_notes (
  id               bigserial primary key,
  user_id          uuid references auth.users(id) on delete cascade not null,
  tipper_username  text not null,
  note             text,
  follow_up        boolean default false,
  contact_pref     text,
  updated_at       timestamptz default now(),
  unique(user_id, tipper_username)
);

-- 3. PROFILES
create table if not exists profiles (
  id           uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  plan         text default 'free',
  created_at   timestamptz default now()
);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- Each user can ONLY ever see their own rows.
-- This is enforced at the DATABASE level — not just app code.

alter table tips         enable row level security;
alter table tipper_notes enable row level security;
alter table profiles     enable row level security;

-- Tips
create policy "tips_own_select" on tips for select using (auth.uid() = user_id);
create policy "tips_own_insert" on tips for insert with check (auth.uid() = user_id);
create policy "tips_own_delete" on tips for delete using (auth.uid() = user_id);

-- Notes
create policy "notes_own_select" on tipper_notes for select using (auth.uid() = user_id);
create policy "notes_own_insert" on tipper_notes for insert with check (auth.uid() = user_id);
create policy "notes_own_update" on tipper_notes for update using (auth.uid() = user_id);
create policy "notes_own_delete" on tipper_notes for delete using (auth.uid() = user_id);

-- Profiles
create policy "profiles_own_select" on profiles for select using (auth.uid() = id);
create policy "profiles_own_insert" on profiles for insert with check (auth.uid() = id);
create policy "profiles_own_update" on profiles for update using (auth.uid() = id);

-- ── AUTO-CREATE PROFILE ON SIGNUP ────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── PERFORMANCE INDEXES ───────────────────────────────────────────────────────
create index if not exists idx_tips_user_id    on tips(user_id);
create index if not exists idx_tips_date       on tips(user_id, date_time);
create index if not exists idx_tips_username   on tips(user_id, username);
create index if not exists idx_notes_user      on tipper_notes(user_id, tipper_username);
