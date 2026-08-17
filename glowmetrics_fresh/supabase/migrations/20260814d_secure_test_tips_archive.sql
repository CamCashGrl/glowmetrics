-- SECURITY: public.test_tips_archive was exposed to the anon role.
--
-- Verified state before this migration:
--   relrowsecurity = false, 0 policies,
--   has_table_privilege('anon',   'public.test_tips_archive', 'SELECT') = true
--   has_table_privilege('authenticated', ..., 'SELECT')                 = true
--   6 rows
--
-- The table holds archived tip rows with the same shape as production tip
-- data (user_id, username, tokens, usd, tip_note), so anyone holding the
-- public anon key could read them across users. Nothing in the application
-- references this table (verified by repo-wide search), so access is removed
-- entirely rather than policied.
--
-- With RLS enabled, FORCEd, and no policy, the table denies anon and
-- authenticated even if a GRANT is later re-added by mistake. service_role
-- bypasses RLS, so server-side and admin access to the archive still works.
-- No production table's access is changed by this migration.

revoke all on table public.test_tips_archive from anon;
revoke all on table public.test_tips_archive from authenticated;

alter table public.test_tips_archive enable row level security;
alter table public.test_tips_archive force row level security;
