-- Admin → User messaging: notifications + threaded replies.
--
-- Admin auth in this app is a signed cookie (lib/adminAuth.js), not Supabase
-- Auth — there is no admin auth.uid(). So RLS cannot gate "admin-only" writes
-- via a WITH CHECK on an admin id. Instead: authenticated users get zero
-- INSERT policy on notifications (default deny), and admin-authored rows are
-- only ever written by the admin API routes' service-role client, gated by
-- the same verifyAdminToken()/getAdminTokenFromCookieHeader() check already
-- used in app/api/admin/stats/route.js.
--
-- Broadcasts are fanned out to one row per user (sharing a broadcast_id)
-- rather than a nullable user_id "visible to everyone" row, so every RLS
-- check stays a flat user_id = auth.uid() with no shared/ambiguous rows.

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  broadcast_id uuid,
  sender_type  text not null check (sender_type in ('admin_personal','system')),
  sender_id    text not null,
  subject      text,
  body         text not null,
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);

create table public.notification_replies (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  sender_type     text not null check (sender_type in ('user','admin_personal','system')),
  sender_id       text not null,
  body            text not null,
  created_at      timestamptz not null default now()
);

create index idx_notifications_user      on public.notifications(user_id, created_at desc);
create index idx_notifications_broadcast on public.notifications(broadcast_id) where broadcast_id is not null;
create index idx_replies_notification    on public.notification_replies(notification_id, created_at);

alter table public.notifications enable row level security;
alter table public.notification_replies enable row level security;

-- Users can only ever see their own notification rows.
create policy "notifications_select_own"
  on public.notifications for select
  using (auth.uid() = user_id);

-- Users may mark their own notifications read. Row policy restricts which
-- rows; column-level grant below restricts which columns (read_at only).
create policy "notifications_update_own"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- No INSERT policy for `authenticated` on notifications: default deny.
-- Broadcast / send-to-any-user is only reachable via the admin API routes'
-- service-role client (bypasses RLS by design), gated by verifyAdminToken().

-- A user may read replies only on threads (notifications) they own.
create policy "replies_select_own_thread"
  on public.notification_replies for select
  using (
    exists (
      select 1 from public.notifications n
      where n.id = notification_replies.notification_id
        and n.user_id = auth.uid()
    )
  );

-- A user may insert a reply only into their own thread, and only as themselves.
create policy "replies_insert_own_thread"
  on public.notification_replies for insert
  with check (
    sender_type = 'user'
    and sender_id = auth.uid()::text
    and exists (
      select 1 from public.notifications n
      where n.id = notification_replies.notification_id
        and n.user_id = auth.uid()
    )
  );

-- No update/delete policies for users; messages are immutable once sent.
-- Admin replies are inserted via the service-role client, same as
-- notifications inserts.
