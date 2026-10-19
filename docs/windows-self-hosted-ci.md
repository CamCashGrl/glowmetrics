# CamCash Windows CI setup

The feature branch configures repository CI. It does not register a runner,
resume a database, create secrets, merge the PR, or apply migrations.

## One-time setup in the GitHub website

1. Open https://github.com/daphneoncam/glowmetrics/settings/actions/runners.
2. Choose **New self-hosted runner**, then **Windows**, **x64**. Follow GitHub's
   download, checksum and registration instructions on your laptop. Use the
   actual short-lived token shown by GitHub; do not paste it into a chat,
   repository file, or workflow. The registration command runs on the laptop
   (GitHub in a browser alone cannot host a runner).
3. Add custom label **camcash-test**. Keep the automatic **self-hosted**, **Windows**
   and **X64** labels. Workflows require `[self-hosted, Windows, camcash-test]`.
4. Run the runner as the Windows service offered by registration, or keep its
   terminal open. Install PowerShell 7 (`pwsh`) and Git for Windows. Node 22 is
   provisioned by setup-node. Keep the laptop awake, online and the runner idle.
5. Prefer a dedicated Windows account with no production credentials. Do not
   enable fork PRs on this runner. PR jobs accept only same-repository PRs
   opened by the repository owner; manually review code before executing it.
   Self-hosted runners retain files between jobs and are not isolation sandboxes.

## Test backend and secrets

Resume **Live Mode Testing** (`qqvflqcxglkmeuahubwv`) in Supabase if inactive.
Do not substitute production (`hlsdlaibnayzbfflxclj`). Any required staging
schema work must be separately reviewed; these workflows apply no migrations.

In repository Settings → Environments create **camcash-test**. Add environment
secrets copied from the **testing** project only:

| Secret | Value source |
| --- | --- |
| `STAGING_SUPABASE_URL` | Live Mode Testing API URL |
| `STAGING_SUPABASE_ANON_KEY` | Testing project's anon/publishable key |
| `STAGING_SUPABASE_SERVICE_ROLE_KEY` | Testing project's service role/secret key |

Do not use generic `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` or service secrets
from production as a fallback. The workflow maps these dedicated staging secrets
to the existing application variable names. The preflight runs before npm install
or tests, requires the exact testing URL and both keys, rejects production refs
and mismatched legacy JWT project claims, and rejects unverified alternate DB
endpoints. Jest repeats the check before importing test modules, including local
`npm test`. Local mocked tests without database variables can run offline.

Opaque Supabase keys cannot be decoded to verify their project: copy them from
the testing project, never from production. Host validation and project-scoped
Supabase authentication provide the other layers. Do not hardcode production
clients in tests or load production `.env` files into the runner account.

The build uses a clearly fake Stripe test key for module initialization; it does
not create Stripe subscriptions. Do not add a live Stripe key for CI.

Add `SLACK_WEBHOOK_URL` as a **repository Actions secret** for notification
workflows. Keep the existing webhook if configured. No webhook URL is logged.

## What runs

- **CamCash Test Suite**: environment preflight, locked install, safety-script
  tests, changed-test integrity, formula/timezone guards, one full Jest run with
  coverage, JSON-based count/skip/failure verification, and HTML/JSON reports.
- **Build Check**: separate locked install and production compilation using
  testing configuration. It does not rerun the full Jest suite.
- **Daily Test Suite Execution**: reuses the full suite, without a second run or
  fixed “427/427” claims.
- **Test Integrity Guard**: checks changed tests; count verification uses the
  main suite's results and preserves the existing 427-test minimum.
- **Production Health Check**: public, read-only HTTP requests only; no Supabase
  credentials or automated production integration testing.
- **Test Notifications / Test Failure Notifications**: actual failure alerts
  only; cross-run artifacts are optional. Scripts come from the workflow
  definition commit, never a completed PR head. Existing failure issue tracking
  is retained. No claim of successful delivery when the webhook is missing.

All seven inspected workflows use the dedicated laptop label. Unrelated
Supabase security-advisor and specialized staging workflows were not converted;
they are outside essential PR CI and may still need hosted runner capacity.

## First verification

Register the runner and configure secrets, then open PR #678 → Checks. Verify
the runner picks up pending jobs. Workflow-dispatch, scheduled and workflow_run
notification definitions generally come from the default branch: changes in an
unmerged PR do not replace those default-branch definitions. Review their YAML
in the PR; do not merge merely to activate them. Until those definitions are
adopted, old default-branch notification workflows may still be billing-blocked.

Check the exact commit's Vercel preview separately. Never call a queued CI run
or a local test pass proof of successful self-hosted CI or delivered Slack alerts.
The laptop must stay available; no online runner means queued jobs and alerts.

Self-hosted compute avoids GitHub-hosted runner minutes, but artifact/storage
quotas still apply. Artifacts are retained for three days; monitor storage usage
and keep account spending limits at the desired zero-charge setting.
