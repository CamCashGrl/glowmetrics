-- Minimal stand-in for the production tables the platform-limit trigger
-- reads/fires on. Test-only: never run against a real project.
drop schema if exists public cascade; create schema public;
create table public.profiles (id uuid primary key, plan text);
create table public.tips (id bigserial primary key, user_id uuid not null, platform text, username text, tokens int, date_time timestamptz);
create index idx_tips_user_id on public.tips (user_id);
create table public.live_tips (id bigserial primary key, user_id uuid not null, platform text);
create table public.paid_sessions (id bigserial primary key, user_id uuid not null, platform text);
