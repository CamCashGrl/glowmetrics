# Live Engine Rewrite — Rollback Plan

Branch: `claude/live-engine-timeout-bugs-vyee6y`

**Read this first:** app code and the database are two independent layers here.
Every migration below was already applied directly to the live Supabase
project during development (not just committed to git). **Reverting the git
branch / not merging the PR does NOT undo the database changes.** If you
decide to roll back, you have to do both halves, and the database half is
the one that actually matters for correctness.

---

## When to roll back

Any of these is a legitimate trigger:
- Sessions failing to start, or `start_live_session` erroring for real users
- Sessions stuck in a status the dashboard/extension doesn't understand
- The pg_cron sweep firing incorrectly (ending live sessions early, or not at all)
- Coaching prompts not appearing, or appearing duplicated

---

## Part 1 — App code rollback (fast, safe, reversible)

The app code changes are ordinary git history — reverting is low-risk:

```bash
git checkout main
git revert --no-commit <oldest-commit-on-this-branch>^..<newest-commit-on-this-branch>
git commit
git push
```

or, if the branch was merged via PR, use GitHub's "Revert" button on the
merge commit. Either redeploys the previous `app/live/*`, `app/dashboard/*`,
`app/api/live/*` code and the previous `chrome-extension/*` files.

**Caveat:** once app code is reverted, it will be calling the OLD API
contract (old status vocabulary: `active`/`paused`/`needs_resolution`/
`stopping`, `engineEnabledForNewSession` flag, etc.) against whatever the
database currently has. If you only revert app code and NOT the database,
the reverted app will be broken — the database will already be on the new
status vocabulary. **Always do Part 2 first, or in the same window, before
reverting app code.**

The Chrome extension additionally requires users to update to the reverted
`.zip` — there's no auto-push for an already-installed extension, so a code
rollback alone won't fix already-installed copies until they redownload.

---

## Part 2 — Database rollback (ordered, some steps are lossy)

Run these **in reverse order** of the forward migrations. Each one is a
single `apply_migration` call against the Supabase project
(`hlsdlaibnayzbfflxclj`).

### 2f. Undo the RLS policy consolidation (safe, cosmetic only)
No action needed — the consolidated policy has the same effect as the two
duplicates it replaced. Nothing to roll back here.

### 2e. Stop the pg_cron sweep
```sql
SELECT cron.unschedule('sweep-stale-live-sessions');
```
Do this FIRST if rolling back, before touching the status vocabulary below —
otherwise the sweep could run mid-rollback against a table in an
inconsistent state.

### 2d. Undo the `auto_ended_inactivity` resolution type (optional)
Only matters if you're also reverting 2b below. Safe to leave in place
either way — an unused allowed value in a CHECK constraint is harmless.
```sql
ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS live_sessions_resolution_type_check;
ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_resolution_type_check
  CHECK (session_resolution_type IS NULL OR session_resolution_type IN (
    'normal_stop', 'still_live', 'end_at_last_heartbeat',
    'chosen_end_time', 'marked_invalid'
  ));
```

### 2c. Restore `stream_sessions` — ⚠️ NOT DATA-RECOVERABLE
The table was dropped. Its schema can be recreated from `git log` on
`supabase/setup.sql` (the `create table stream_sessions (...)` block is in
history even though it's been removed from the current file), but the 12
rows it held are gone. **This was verified safe before dropping** — all 12
were $0/0-token placeholder rows from test/dev accounts, created by the
legacy broken handler this rewrite deleted, not real earnings. If you
still want the empty table back:
```sql
-- pull the exact CREATE TABLE from `git show <pre-drop-commit>:glowmetrics_fresh/supabase/setup.sql`
-- and the fan_events FK, then re-run both.
```

### 2b. Undo the state machine collapse — ⚠️ the risky one
This is the one that actually matters, and the one to think hardest about
before running. It reverses the status vocabulary rename. Any session that
is CURRENTLY unresolved (`starting`/`live`/`inactive_warning`/`ending`) at
the moment you run this needs to be mapped back; anything already `ended`
is untouched either way (its status name didn't change).

```sql
-- 1. Drop the new status CHECK, restore the old one
ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS live_sessions_status_check;
ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_status_check
  CHECK (status IN ('starting', 'active', 'paused', 'stopping', 'needs_resolution', 'ended', 'error'));

-- 2. Map any currently-unresolved rows back to the old vocabulary
UPDATE public.live_sessions SET status = 'active' WHERE status = 'live' AND live_substate = 'active';
UPDATE public.live_sessions SET status = 'paused' WHERE status = 'live' AND live_substate = 'paused';
UPDATE public.live_sessions SET status = 'needs_resolution' WHERE status = 'inactive_warning';
UPDATE public.live_sessions SET status = 'stopping' WHERE status = 'ending';

-- 3. live_substate/warning_started_at columns can stay (unused, harmless)
--    or be dropped:
-- ALTER TABLE public.live_sessions DROP COLUMN IF EXISTS live_substate;
-- ALTER TABLE public.live_sessions DROP COLUMN IF EXISTS warning_started_at;
```

You then also need the OLD versions of every RPC this migration replaced
(`start_live_session`, `pause_live_session`, `resume_live_session`,
`stop_live_session`, `resolve_live_session`, `send_website_heartbeat`,
`send_extension_heartbeat`, `sweep_stale_live_session`) — pull those
function bodies from `git show <commit-before-20260802b>:supabase/migrations/`
(they were last defined across the `20260715`–`20260720` migrations) and
re-apply them. This is a full function-by-function restore, not a single
statement — budget real time for it, and test each RPC against a throwaway
session before trusting it with real users.

### 2a. Undo the coaching_events payload enrichment (safe, additive-only)
This migration only added columns/fields — nothing renamed or dropped. No
rollback needed unless you specifically want the columns gone:
```sql
-- only if truly wanted — these are additive and harmless to leave:
-- ALTER TABLE public.coaching_events DROP COLUMN IF EXISTS <enriched column names>;
```

---

## Recommended approach if something goes wrong in production

Given how entangled the state-machine rename is with live user sessions,
**prefer a forward fix over a full database rollback** whenever possible —
find and patch the specific broken RPC/route rather than unwinding the
whole vocabulary change. Reserve the full Part 2b rollback for a scenario
where the new state machine is fundamentally broken for everyone, not a
single-route bug.

If you do roll back Part 2b, do it during a low-traffic window and warn any
currently-live streamers first — anyone mid-session when you flip the
vocabulary will have their session's `status` rewritten out from under
them.

---

## Post-rollback verification

After any rollback:
1. `SELECT status, count(*) FROM live_sessions GROUP BY status;` — confirm
   every row's status is a value the (rolled-back) CHECK constraint allows.
2. Start a test session end-to-end (Start Stream → tip → Pause → Resume →
   Stop) against a throwaway account before trusting it with real users.
3. Confirm `cron.job` no longer lists `sweep-stale-live-sessions` if you
   ran step 2e, or that it's still healthy if you didn't.
4. Reinstall the extension from the rolled-back `.zip` on a test browser
   profile and confirm login + Start Stream still work.
