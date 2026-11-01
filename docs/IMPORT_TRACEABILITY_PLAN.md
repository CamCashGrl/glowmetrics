# Import History & Tip Traceability — revision 3

## Context
Users need to see their uploaded and pasted datasets, re-download the originals, quote a permanent import reference, and trace saved tips to their imports.

Revision 3:
- Resolves the six inconsistencies from your review.
- Narrows the first batch to Phase 0 (safety). Phase 0 is separate from the feature.
- Phase 0 is implemented on `claude/focused-mayer-jlkuyi`. Nothing is merged, and no production migration is applied.

## New live-DB findings (read-only)

**`insert_paid_sessions_dedup` can be called anonymously and writes into any account.**
- Live ACL: `anon=X, authenticated=X, service_role=X`. It is SECURITY DEFINER.
- Its only guard is `IF (rec->>'user_id')::uuid != auth.uid()`. For an `anon` caller, `auth.uid()` is NULL, so the comparison is NULL, the IF is false, and the row is inserted.
- So anyone holding the public anon key can insert private-earnings rows into any user whose UUID they know. That corrupts that user's analytics.
- The `upload_id` taken from each row is also not ownership-checked.
- The only callers are `/api/upload` and `/api/upload-paid-sessions`, and both call with the user's own JWT (`authenticated`). Removing `anon` access breaks no legitimate caller.

**`insert_tips_dedup`:**
- Live ACL: `authenticated`, `service_role` (no anon, no PUBLIC). The live guard is `auth.role()='authenticated' AND user_id IS DISTINCT FROM auth.uid()`.
- Callers: `/api/upload` (user JWT), `chaturbate/stats-sync` (user JWT), `scan/import` (service role, sets `user_id` from the verified token).
- The repo's latest migration (`20260710_...`) **lacks** that guard. Re-applying it would remove ownership protection.

**Other checks:**
- Triggers: `BEFORE INSERT` `enforce_free_tier_platform_limit()` on both tables (the Free/Pro gate).
- `user_id` is NOT NULL on both tables. 0 orphan rows.
- No other function calls the dedup RPCs.

**`replace=true`** (`app/api/upload/route.js:56`, `:203`):
- Deletes **all** of the user's tips before inserting anything. It runs after the parse-attempt log write.
- No caller in the app, the extension or tests sends it.

---

## Phase 0 — first batch (implemented for review)
1. **`app/api/upload/route.js`**: reject `replace=true` with `400 { code: 'replace_not_supported' }` immediately after authentication and form parsing. This happens **before any write**: before the timezone lookup, the parse log, any delete or any insert. Delete the destructive branch.
2. **New migration `supabase/migrations/20261101_harden_dedup_rpc_grants.sql`** (forward-only; no applied migration is rewritten):
   - `insert_tips_dedup`: the **live definition, verbatim**, so the repo matches production and keeps the guard. Explicit `REVOKE ALL FROM PUBLIC, anon`; `GRANT EXECUTE TO authenticated, service_role`.
   - `insert_paid_sessions_dedup`: live body with **one change**. The guard becomes `IF auth.role() IS DISTINCT FROM 'service_role' AND (rec->>'user_id')::uuid IS DISTINCT FROM auth.uid() THEN RAISE`, which closes the NULL bypass. Same grants as above (anon revoked). The insert, the dedup (`ON CONFLICT DO NOTHING`, key unchanged) and the counts are untouched.
   - It touches no data and no triggers.
3. **Rollback** `supabase/rollbacks/20261101_harden_dedup_rpc_grants.rollback.sql`: restores the exact live bodies and ACLs.
4. **Tests** `app/api/upload/__tests__/replace-rejected.test.js` (existing mock pattern):
   - `replace=true` → 400, and no `from().delete`, no insert, no RPC.
   - `replace=false` and an omitted `replace` still import normally.
5. **Verification:**
   - Local jest run of the whole suite.
   - The migration's SQL is checked against a *Supabase branch* only if you approve one. Otherwise it is checked by inspection.
   - The ownership tests (anon call → error; authenticated with another user's id → error; own id → inserted) are documented as SQL run on a branch before production.
   - Before production: create the backup branch, then apply.

---

## Corrected feature design (pending approval; not implemented)

### 1. Row tracking moves into the phase that uses it
`import_rows` ships in **Phase 1**. It is the single source of truth for counts, accepted exports and interrupted-import recovery. `csv_uploads` counters are derived from it, never accumulated in JavaScript.

### 2. Source-row identity
- Today `parseCSV` (`lib/analytics.js:238`) and the onboarding parsers split on `\n`. Quoted multi-line CSV records are **not** supported, so one physical line maps to at most one record today.
- To stay correct if multi-line support is added, the identity is:
  - **`(upload_id, record_index, part_index)`**.
  - `record_index` = the 1-based ordinal of the source record the parser emitted. The header counts as a record and is labeled `header`.
  - `line_start` / `line_end` = the physical lines it spanned, for display.
  - `part_index` = 0 normally, 1…n when one record yields several transactions.
- The parser must expose `record_index` and `line_start`/`line_end` (a small, additive change to the `parseCSV` output).
- Outcomes:
  - `added`, `duplicate`, `rejected` (with a reason)
  - `failed` (its batch errored)
  - **`ignored_non_transaction`**: header, blank, subtotal and summary lines. These are not counted as "rejected".
  - **`pending`**: written before its batch runs.
- `kind`: `tip` | `paid_session` | `none`.

### 3. Duplicate matching (verified against the live function, not assumed)
- Keep the existing key and `tip_seq` rules exactly. The client assigns `tip_seq` over the whole file (`route.js` `dedupSeq`), and the RPC uses `COALESCE(client_seq, batch_seq)`. No new definition of duplicate.
- Mechanism:
  - Write the `pending` `import_rows` first.
  - The RPC (`insert_tips_dedup_v2`, a new function so the old one keeps working) does `INSERT … ON CONFLICT DO NOTHING RETURNING id, <key>`.
  - The rows that were not returned are joined to `tips` on `(user_id, username_lower, tokens, usd_rounded, date_time, tip_seq)`.
- Concurrency facts to verify by test:
  - Under READ COMMITTED, a concurrent insert of the same key **waits** on the unique index, then takes the DO NOTHING path once the other transaction commits.
  - The follow-up SELECT is a new statement in the same function, so it sees the committed row.
  - If the other transaction is still uncommitted when the SELECT runs, that can't happen, because the wait resolves first. If it rolled back, our row would have been inserted.
- The `BEFORE INSERT` platform-limit trigger raises for the whole statement. The batch is marked `failed`/`blocked`, never `duplicate`.
- **Tests required before shipping** (Supabase branch):
  - two concurrent overlapping imports
  - within-file repeats (`tip_seq` 1 and 2)
  - a repeat across a batch boundary
  - a platform-limit block mid-file
- Private earnings get the same treatment with `insert_paid_sessions_dedup_v2`, key `(user_id, username_lower, tokens, usd_rounded, date_time, session_type)`. It has no `tip_seq`, which matches today's behavior.

### 4. One parent import for a BongaCams submission
- The onboarding preview uses client parsers (`parseRows`, `parseBCPaidSessions` in `app/onboarding/page.js:105`, `:367`). They differ from the server's `parseCSV`. Moving to a single server request would change classification relative to what the user previewed, so that waits until the parsers are reconciled.
- Chosen approach: **linked parts under one parent.**
  1. `POST /api/imports` creates the parent (`processing`) and stores the **raw paste** as the original, returning `upload_id`.
  2. The tip and private-earnings requests each send `upload_id`. The server verifies ownership with the RLS client; a forged id gets a 404.
  3. Each part records `part_status` in `csv_uploads.parts jsonb` (`tips`: pending|complete|partial|failed, `private`: same).
  4. The parent becomes `complete` only when **every declared part** is final. It shows separate tip and private results.

### 5. Original storage and retry in the same phase
- Exact-byte storage, the download, **and** "Retry saving original" all ship in Phase 1.
- UI: an original-file status badge, shown independently of the earnings status:
  - "Original saved"
  - "Original not saved — Retry"
  - "Not retained (before tracking)"
- Earnings messages come only from `import_rows`:
  - "N tips saved" appears only when confirmed rows exist.
  - The UI never says "Your earnings were saved" without that confirmation.

### 6. Interrupted-import recovery
- A closed browser or a request timeout does not prove processing stopped.
- Mechanism:
  - Each processing request updates `csv_uploads.heartbeat_at` after every batch.
  - A reconciler (`reconcile_import(upload_id)`, SECURITY DEFINER, owner-checked) runs on history load and from the existing cron (`app/api/cron/*`).
  - It marks an import `interrupted` only when `status='processing'` **and** `heartbeat_at` is older than 2 × `maxDuration` (120s). Past that point the serverless function is provably dead.
- Recompute uses `import_rows`:
  - A `pending` row whose transaction exists in `tips` with this `upload_id` becomes `added`.
  - A `pending` row whose dedup key matches a tip from another import becomes `duplicate`.
  - Otherwise the row becomes `failed`.
- Counters are then re-derived. This is idempotent.

### Kept requirements
- Reuse `csv_uploads` as the parent import and `tips.id`/`paid_sessions.id` as permanent references (`TIP-`, `PVT-`).
- `IMP-` numbers come from a sequence and are backfilled for the existing 153 rows.
- First-import provenance is never overwritten. Later encounters are recorded in `import_rows`.
- Unlinked tips show "Import source unavailable".
- Nothing is reconstructed from the 500-character snippets.
- `import_time_zone` and `date_order` are retained. Display uses the selected IANA timezone.
- The analytics engine, dedup rules, `numeric(…,2)` money handling and Free/Pro triggers are unchanged.

## Corrected sequence and dependencies
| Phase | Contents | Depends on |
|---|---|---|
| 0 | `replace` removal; RPC grants and guard; repo/live sync | — |
| 1a | Schema: `csv_uploads` columns, `import_number`, `heartbeat_at`, `parts`; `import_rows`; private bucket and policies; `*_dedup_v2` RPCs; `reconcile_import` | 0, plus concurrency tests on a branch |
| 1b | Server: parent-import create, exact original storage and retry, `/api/upload` + `/api/upload-paid-sessions` on v2 with `upload_id`, parser `record_index` | 1a |
| 1c | Downloads: original (signed URL), accepted-data CSV (plan rules) | 1b, plus the eligibility decision |
| 1d | UI: history list, detail, original badge and retry, tip references, "Introduced by" / "Import source unavailable", duplicates and rejected tabs | 1b–1c |
| 2 | Re-run import, delete original, extension scan records, reconciling the onboarding and server parsers | 1, plus decisions |

## Tests for the feature
- **Exact bytes:** SHA-256 round-trip with CRLF, BOM, TSV and emoji; a BongaCams paste downloads as raw text.
- **Owner-only downloads:**
  - user B gets a 404 on A's metadata, original and export
  - direct Storage access is denied
  - anon is denied
- **Forged `upload_id`** on either part request → 404, nothing written.
- **Retries:** re-upload → 0 added; tip ids and `upload_id` unchanged; the duplicate rows point to the original tips.
- **Concurrent overlapping imports and within-file repeats:** total tips = N; each row is `added` in exactly one import; `tip_seq` behavior is unchanged.
- **Partial and interrupted imports:** forced batch error → `partial`; killed process → the reconciler gives `interrupted` with exact counts; heartbeat freshness prevents false positives.
- **BongaCams private earnings:** the parent stays `processing` until the private part is final; tip and private results are separate.
- **Timezone:** the same naive file under two zones gives a stored offset difference equal to the zone difference; `import_time_zone` is recorded; display follows the selected zone.
- **Analytics unchanged:** per-user tip and paid-session counts and `sum(usd)` match before and after every migration; existing jest suites stay green.

## Product decisions (proposed; none approved yet)
1. **Retention:** keep originals until the user deletes them or closes the account. Account deletion purges `import-originals/{uid}/`.
2. **Original storage fails:** continue importing earnings, show the separate warning and a retry.
3. **Blocked (Free-limit) submissions:** keep the original so the user can re-run it after upgrading.
4. **Download eligibility:** originals for all plans (it is the user's own file). Accepted-data export and detail tip lists follow the dashboard window rules (`FREE_ANALYSIS_WINDOW_DAYS`, `resolvePlatformRoles`).
5. **Limits:** 10 MB; `.csv` / `.tsv` / `.txt`, and pasted text only.
6. **Deletion and re-run:** deleting an original removes the file only. Re-run creates a new import from the stored original. Deleting earnings per import is deferred.
