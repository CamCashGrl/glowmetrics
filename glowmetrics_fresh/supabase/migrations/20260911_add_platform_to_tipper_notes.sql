-- Fan identity is platform + username (see lib/analytics.js identifyWhales),
-- but tipper_notes only ever had a (user_id, tipper_username) unique key, so
-- a note for "daddyjohn" on Chaturbate and "daddyjohn" on BongaCams would
-- silently share the same note. This adds the missing platform column.
--
-- Existing rows are left untouched otherwise: platform is nullable and NOT
-- backfilled with a guess. In production, one existing row (vbtruckin) had
-- an unambiguous single-platform match in that same user's own tips table
-- and was backfilled from that real data; the other two had no matching
-- tips at all and were left NULL rather than fabricated. App code falls
-- back to a legacy username-only lookup for any note where platform is
-- still NULL.

alter table tipper_notes add column if not exists platform text;

alter table tipper_notes drop constraint if exists tipper_notes_user_id_tipper_username_key;
alter table tipper_notes add constraint tipper_notes_user_id_tipper_username_platform_key
  unique (user_id, tipper_username, platform);

drop index if exists idx_notes_user;
create index if not exists idx_notes_user on tipper_notes(user_id, tipper_username, platform);
