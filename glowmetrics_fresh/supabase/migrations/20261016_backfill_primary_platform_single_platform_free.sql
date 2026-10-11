-- NOT YET APPLIED — awaiting owner approval (counts reported 2026-10-11).
--
-- Free users with NO primary platform get every platform cut to 31 days, so
-- they never receive the free tier's one full-history platform. Owner rule
-- (2026-10-11): auto-assign ONLY when the user has exactly one real platform
-- with data (tips or live_tips; Chaturbate / BongaCams / MyFreeCams after
-- canonical_platform_name()). 'Unknown' and other labels are not real
-- platforms and are ignored. Multi-platform users are never guessed — they
-- keep the existing "Choose your primary platform" banner.
--
-- Prod counts on 2026-10-11 (free, primary NULL, 177 users):
--   exactly 1 real platform : 53  → assigned here
--   2 real platforms        :  3  → untouched (prompted)
--   only 'Unknown' rows     :  3  → untouched
--   no data                 : 118 → untouched
-- primary_pro_platform is permanent by design (20261010 trigger blocks any
-- later change), so the affected ids and prior value (NULL) are backed up.
BEGIN;

create table if not exists public._backup_20261016_primary_platform_backfill (
  user_id uuid primary key,
  assigned_platform text not null,
  assigned_at timestamptz not null default now()
);
alter table public._backup_20261016_primary_platform_backfill enable row level security;
revoke all on public._backup_20261016_primary_platform_backfill from anon, authenticated;

with real_platforms as (
  select x.user_id, public.canonical_platform_name(x.platform) as platform
  from (
    select user_id, platform from public.tips
    union
    select user_id, platform from public.live_tips
  ) x
  where public.canonical_platform_name(x.platform) in ('Chaturbate', 'BongaCams', 'MyFreeCams')
),
single as (
  select user_id, min(platform) as platform
  from real_platforms
  group by user_id
  having count(distinct platform) = 1
),
targets as (
  select s.user_id, s.platform
  from single s
  join public.profiles p on p.id = s.user_id
  where p.plan = 'free' and p.primary_pro_platform is null
)
insert into public._backup_20261016_primary_platform_backfill (user_id, assigned_platform)
select user_id, platform from targets
on conflict do nothing;

update public.profiles p
set primary_pro_platform = b.assigned_platform
from public._backup_20261016_primary_platform_backfill b
where p.id = b.user_id
  and p.primary_pro_platform is null;

COMMIT;
