# CamCash agent instructions

## Scope and repository layout

This file governs the repository and its descendants. More specific
AGENTS.md files may add requirements for their directories.

- Repository: daphneoncam/glowmetrics
- Next.js application: glowmetrics_fresh/
- GitHub Actions workflows: .github/workflows/
- Shared repository scripts: scripts/
- Browser extension: chrome-extension/

Follow explicit user instructions. If repository instructions conflict,
report the conflict before making a dependent change. Do not silently
choose a new product or analytics rule.

## Branches, approval, and pull requests

- Never edit, commit, or push directly on main.
- Work on a dedicated branch. Verify the branch and working tree first.
- List the intended files and scope before editing and obtain approval.
  Existing explicit approval for that scope remains valid.
- Preserve unrelated changes and never discard another person's work.
- Use a branch and pull request for changes intended for main.
- Commit, push, create a PR, merge, or deploy only when explicitly authorized.
  Authorization for one action does not authorize the others.
- Never force-push, rewrite shared history, or bypass required checks
  without explicit approval.

## Runtime and test timezone

- Use Node.js 22 for application development, Jest, and relevant CI jobs.
- Run application commands from glowmetrics_fresh/.
- Jest uses TZ=UTC through jest.config.js for deterministic test execution.
- Keep UTC normalization limited to Jest and CI test execution.
- Do not set a machine-wide or production-wide TZ=UTC to fix tests.
- Do not regenerate fingerprints, update snapshots, weaken assertions,
  skip tests, or change dependencies merely to make checks pass.

## Required validation before merge

Run against the final proposed revision from glowmetrics_fresh/:

    npm test -- --runInBand
    mkdir -p test-results
    npm run test:ci
    npm run test:report
    node scripts/verify-estimated-hourly-rate.mjs
    node scripts/check-timezone.mjs
    npm run build

Also:

- Run each previously failing or directly affected suite individually
  with --runInBand.
- Run npm run lint if a lint script is configured.
- Run git diff --check.
- Inspect the complete diff for scope, secrets, accidental deletions,
  weakened assertions, and generated artifacts.
- Verify all tests pass; do not rely on stale hardcoded test counts.
- Confirm all required CI checks and any configured deployment preview checks are green before merge.
  Local success alone does not establish deployed success.
- Build validation requires appropriate environment configuration and
  network access for build-time resources, including Google Fonts.
- Report blocked or failed checks accurately. Never claim a check passed
  when it was skipped, could not run, or failed.

## Creator timezone and analytics integrity

- User-facing dates, days, hours, session labels, peak hours, and analytics
  buckets must use the creator's selected timezone.
- Use shared timezone helpers and Intl.DateTimeFormat with the intended
  timezone. UTC storage does not imply UTC display or bucketing.
- UTC timestamps and duration arithmetic remain valid where appropriate.
  Do not substitute UTC calendar buckets for creator-local buckets.
- Preserve canonical analytics behavior unless the user explicitly
  authorizes a specific rule change.
- Reuse canonical implementations instead of copying formulas:
  - glowmetrics_fresh/lib/constants.js for token rates and platform identity
  - glowmetrics_fresh/lib/analytics.js for shared analytics
  - glowmetrics_fresh/lib/analytics/sessions.js for session grouping
    and session validity
- Preserve canonical revenue reconciliation, session eligibility,
  deduplication, fan identity, and confidence rules.
- Do not alter analytics output to accommodate an environment-dependent
  test. Diagnose the environment and intended contract first.
- If prose, tests, and implementations disagree, report the discrepancy
  and request a decision before changing the rule.

## Production, Supabase, and user data

- Do not perform production writes or Supabase writes without explicit
  approval for the target environment, operation, and scope.
- This includes migrations, SQL mutations, write-capable RPCs, backfills,
  imports, auth/account changes, storage mutations, and remote tests
  that create or modify data.
- Preparing a migration or script does not authorize executing it.
- Never delete or overwrite real tip data or source CSVs without explicit
  approval. Do not use real creator accounts as disposable test fixtures.
- Never expose secrets, service-role keys, tokens, or private user data
  in source code, client bundles, logs, reports, or commits.
- Preserve authentication, server-side authorization, RLS, payment gating,
  and deduplication protections.

## Protected scope and regression reporting

- Do not modify analytics, imports, auth, Supabase behavior, routing,
  Stripe behavior, or feature access during a UI-only task.
- Changes to glowmetrics_fresh/app/onboarding/page.js require explicit file-specific approval. Preserve the complete file and unrelated behavior.
- Do not remove features or simplify product behavior without approval.
- Report blockers and regressions with the exact command, error,
  file/module, likely cause, and safest next step.
- Distinguish environment failures from product regressions.
- Do not edit around failures by bypassing checks, swallowing errors,
  changing expected results, or broadening scope without approval.
- Before requesting approval to commit or merge, report the branch,
  changed files, diff summary, validation results, blockers, and whether
  production behavior changed.
