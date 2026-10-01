# Pre-Commit Hooks & Slack Notifications

Prevent broken commits and stay informed of test failures.

---

## Pre-Commit Hook ✅ ACTIVE

Prevents commits if tests fail or coverage drops below 60%.

### How It Works

```bash
git commit -m "Your commit"
# ↓
# 🧪 Running pre-commit test check...
# ↓
# Tests run automatically
# ↓
# If tests PASS → commit succeeds ✅
# If tests FAIL → commit blocked ❌
# If coverage LOW → commit blocked ❌
```

### When Tests Fail

```
❌ COMMIT BLOCKED: Tests failed

Last 50 lines of test output:
[error details...]

To bypass (not recommended):
  git commit --no-verify

To fix:
  npm run test:ci
  npm run test:debug  (for interactive debugging)
```

### To Bypass (Emergency Only)

```bash
git commit --no-verify
# ⚠️ Not recommended - this skips safety checks
```

### To Disable Temporarily

```bash
# Rename the hook
mv .git/hooks/pre-commit .git/hooks/pre-commit.bak

# Re-enable
mv .git/hooks/pre-commit.bak .git/hooks/pre-commit
```

---

## Slack Notifications 📢

Automatic test failure alerts to your Slack workspace.

### Setup (Required)

1. **Create Slack Webhook**
   - Go to your Slack workspace channel (e.g., `#dev`)
   - Integrations → Apps → Incoming Webhooks → Add
   - Copy webhook URL

2. **Add to GitHub Secrets**
   - Repo Settings → Secrets → Actions
   - New secret: `SLACK_WEBHOOK_URL`
   - Paste webhook URL

3. **Done!** Next test failure notifies Slack automatically.

**See `SLACK_SETUP.md` for detailed walkthrough**

### Notifications

**Test Failure:**
```
🚨 CamCash Tests Failed
Status: ❌ Failed
Branch: claude/awesome-lamport-ejo48f
Tests Passed: 42 | Tests Failed: 3
[View Workflow] [View PR]
```

**Test Success:**
```
✅ CamCash Tests Passed
Status: ✅ All Passed
Branch: main
[View Workflow]
```

### Local Manual Notifications

```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."

# Send notification
npm run notify:slack --prefix glowmetrics_fresh PASS "Tests passed locally"
npm run notify:slack --prefix glowmetrics_fresh FAIL "Tests failed - see logs"
```

---

## Complete Flow

```
┌─ Developer makes changes
│
├─ git commit
│
├─ 🧪 Pre-Commit Hook Runs Tests
│   ├─ Tests fail? → ❌ BLOCKED (must fix)
│   ├─ Coverage low? → ❌ BLOCKED (must fix)
│   └─ All pass? → ✅ COMMIT ALLOWED
│
├─ 📤 Push to GitHub
│
├─ 🔄 GitHub Actions Runs CI Suite
│   ├─ Tests run with coverage
│   ├─ Generates reports
│   ├─ Tests fail? → 📢 Slack notification (FAIL)
│   └─ Tests pass? → 📢 Slack notification (PASS)
│
└─ ✅ PR Ready (or needs fixes)
```

---

## Troubleshooting

### Pre-Commit Hook Not Running

```bash
# Check if hook exists
ls -la .git/hooks/pre-commit

# If missing, recreate:
cp HOOKS_AND_NOTIFICATIONS.md .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### Tests Fail at Commit Time

```bash
# This is working as intended!
# Run tests locally:
npm run test:ci --prefix glowmetrics_fresh

# Fix issues:
npm run test:debug --prefix glowmetrics_fresh

# View coverage:
open glowmetrics_fresh/coverage/index.html

# Try commit again
git commit -m "Your message"
```

### Slack Notifications Not Working

1. Verify webhook URL is correct
2. Check GitHub secret exists: `Settings → Secrets → Actions`
3. View workflow logs: `Actions → test-notifications`
4. Regenerate webhook if needed

---

## Configuration

### Modify Pre-Commit Hook

Edit `.git/hooks/pre-commit`:
- Change coverage threshold (currently 60%)
- Add more checks (lint, format, etc.)
- Change test command

### Customize Slack Notifications

Edit `.github/workflows/test-notifications.yml`:
- Change notification format
- Add fields (duration, branch, commit, etc.)
- Add custom channel routing
- Change emoji/colors

---

## Best Practices

✅ **DO:**
- Let pre-commit hook catch issues early
- Fix tests locally before pushing
- Monitor Slack for failures
- Keep webhook URLs secure

❌ **DON'T:**
- Bypass hooks with `--no-verify` regularly
- Commit code you know will fail tests
- Leave broken tests on branches
- Share webhook URLs publicly

---

## Files

- `.git/hooks/pre-commit` — Pre-commit hook
- `.github/workflows/test-notifications.yml` — Slack notifications
- `scripts/notify-slack.mjs` — Manual notification script
- `SLACK_SETUP.md` — Slack setup guide
- `HOOKS_AND_NOTIFICATIONS.md` — This guide
