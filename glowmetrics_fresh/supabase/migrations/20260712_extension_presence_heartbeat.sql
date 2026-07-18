-- ═══════════════════════════════════════════════════════════════════════
-- EXTENSION PRESENCE / HEARTBEAT
--
-- Lets the web app know whether the CamCash Chrome extension is actually
-- open and active on a supported cam site, not just that the user clicked
-- Start on the Live Mode page. The extension pings this on an interval
-- while a supported-platform tab is open; the web page treats the
-- heartbeat as stale after a short window and auto-pauses the active
-- session for that gap, so active-duration and Actual $/Hour never count
-- time the extension wasn't really there to capture tips for.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists extension_presence (
  user_id      uuid references auth.users(id) on delete cascade primary key,
  platform     text,
  last_seen_at timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table extension_presence enable row level security;

drop policy if exists "extension_presence_own_rw" on extension_presence;
create policy "extension_presence_own_rw" on extension_presence
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
