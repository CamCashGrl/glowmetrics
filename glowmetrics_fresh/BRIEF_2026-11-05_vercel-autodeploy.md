# Brief — 2026-11-05 — Vercel auto-deploy stopped

Read-only investigation. Nothing in Vercel, GitHub or the code was changed.

## What was checked
- Vercel project `glowmetrics-ggsb` (team `daphneoncams-projects`, Hobby plan), linked to GitHub `daphneoncam/glowmetrics`.
- The last 15 Vercel deployments, plus details for 3 of them.
- GitHub commit statuses and checks for PR #728 (Nov 1) and PR #761 (Nov 5).
- `glowmetrics_fresh/vercel.json`: there is no `git.deploymentEnabled: false` and no ignore command, so the config file is not what turned deploys off.

## Findings
1. **Vercel stopped receiving GitHub events after Nov 1, 2026.**
   - The last deployment with `source: git` was on 2026-11-01 at 08:09 UTC.
   - PR #728 (Nov 1) has a "Vercel — Deployment has completed" status on GitHub.
   - PR #761 (Nov 5) has **no Vercel status at all**. Its GitHub Actions checks (build, test, integrity) all passed.
2. **Production is missing PR #761** (send /dashboard and /live to /landing when an expired login is discarded).
   - Live production is commit `ea171f9` (PR #754), deployed 2026-11-05 at 04:40 UTC.
   - That deploy has no `source: git`, which points to a manual deploy rather than an automatic one.
   - Everything up to and including #754 is live.
3. **Two failed production deploys on Nov 4** (03:25 and 03:26 UTC), both with `errorCode: git_info_fail`. Both point at GitHub owner **`CamCashGrl`**, but the project is now linked to **`daphneoncam`**.
   - PR #703 was merged "from CamCashGrl/…", so the repo has been associated with two GitHub owners.
   - Most likely cause: the Vercel GitHub App's access to the repo was lost when the repo changed owner. This could not be confirmed directly, because GitHub App installation settings are not visible from this session.

## Tasks, most important first
### New / to do
1. **(Critical, owner action)** Restore the Vercel GitHub App's access to `daphneoncam/glowmetrics` (steps in the chat reply).
2. **(Critical)** Get PR #761 to production, either by a redeploy of `main` or automatically once item 1 is fixed. Then confirm `camcashgrl.com` serves commit `2928a0b`.
3. **(High)** Test the fix: open a PR and confirm a Vercel status and preview URL appear on it.
4. **(Medium, decision)** The Vercel dashboard is offering "Set Up Vercel CI" (`npx skills use vercel/ci@setup`). It was **not** run. Vercel CI is a separate product for running checks; it does not restore Git auto-deploys. The repo already runs build, test and test-integrity checks in GitHub Actions, so adding it now would duplicate them. Revisit after item 1 is fixed, and only with owner approval.
5. **(Medium)** Before any disconnect or reconnect, record the current Vercel settings: Root Directory, Production Branch, build and install commands, env var names, domains and deploy hooks.

### In progress
- None.

### Completed
- Diagnosis above (read-only).
