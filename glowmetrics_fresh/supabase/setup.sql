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

-- ── OPTIONAL ADVANCED ANALYTICS TABLES ───────────────────────────────────────
-- These tables support stream/session-level analytics, show tagging,
-- subscriber tracking, and fan events. They are not required for basic usage
-- but are safe to create for future expansion.

create table if not exists stream_sessions (
  id              bigserial primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  platform        text not null,
  start_time      timestamptz not null,
  end_time        timestamptz not null,
  hours_streamed  numeric(6,2) not null default 0,
  tokens          integer not null default 0,
  usd             numeric(10,2) not null default 0,
  tip_count       integer not null default 0,
  viewers         integer not null default 0,
  new_followers   integer not null default 0,
  new_subscribers integer not null default 0,
  show_type       text,
  game            text,
  goal_type       text,
  event_tag       text,
  created_at      timestamptz default now()
);

create table if not exists fan_events (
  id              bigserial primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  platform        text not null,
  username        text not null,
  event_type      text not null, -- view, follow, tip, whale, subscribe, cancel
  stream_session_id bigint references stream_sessions(id) on delete cascade,
  tokens          integer default 0,
  usd             numeric(10,2) default 0,
  created_at      timestamptz default now()
);

create table if not exists subscriber_stats (
  id              bigserial primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  platform        text not null,
  stat_date       date not null,
  total_subscribers integer default 0,
  new_subscribers   integer default 0,
  churned_subscribers integer default 0,
  subscriber_revenue numeric(10,2) default 0,
  created_at      timestamptz default now(),
  unique(user_id, platform, stat_date)
);

alter table stream_sessions   enable row level security;
alter table fan_events        enable row level security;
alter table subscriber_stats  enable row level security;

create policy "sessions_own_rw" on stream_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "fan_events_own_rw" on fan_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "subscriber_stats_own_rw" on subscriber_stats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_sessions_user_date on stream_sessions(user_id, start_time);
create index if not exists idx_fan_events_user    on fan_events(user_id, username);
create index if not exists idx_subs_user_date     on subscriber_stats(user_id, stat_date);
