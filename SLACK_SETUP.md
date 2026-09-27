# CamCash Slack Integration Setup

Automatic test failure notifications to Slack.

---

## Quick Setup (2 minutes)

### 1. Create Slack Webhook

Go to your Slack workspace:
1. Open **channel** where you want test notifications (e.g., `#dev` or `#camcash-tests`)
2. Click channel name → **Integrations** → **Apps**
3. Search for **Incoming Webhooks** → **Add**
4. Click **Add New Webhook to Workspace**
5. Select your channel
6. Copy the **Webhook URL** (starts with `https://hooks.slack.com/...`)

### 2. Add Secret to GitHub

1. Go to repo: https://github.com/daphneoncam/glowmetrics
2. **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `SLACK_WEBHOOK_URL`
5. Value: Paste webhook URL
6. Click **Add secret**

### 3. Done!

Next test failure will post to Slack automatically. ✅

---

## What You'll See

### Test Failure Notification
```
🚨 CamCash Tests Failed

Status: ❌ Failed
Branch: claude/awesome-lamport-ejo48f
Tests Passed: 42
Tests Failed: 3

[View Workflow] [View PR]
```

### Test Success Notification
```
✅ CamCash Tests Passed

Status: ✅ All Passed
Branch: main

[View Workflow]
```

---

## Local Notifications (Optional)

Send manual Slack notifications from your machine:

```bash
# Set webhook URL
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# Send notification
node scripts/notify-slack.mjs PASS "Manual test passed"
node scripts/notify-slack.mjs FAIL "Manual test failed - check logs"
```

---

## Troubleshooting

### "Webhook URL not set" error
```bash
# Verify GitHub secret is set
gh secret list --repo daphneoncam/glowmetrics

# Verify secret name is exactly: SLACK_WEBHOOK_URL
```

### Notifications not appearing
1. Verify webhook URL is still valid (Slack revokes old ones)
2. Check channel exists and bot has access
3. View workflow logs: GitHub Actions tab → test-notifications workflow

### How to regenerate webhook
1. Go to Slack app settings
2. Delete old webhook
3. Create new webhook (same steps as setup)
4. Update GitHub secret: https://github.com/daphneoncam/glowmetrics/settings/secrets/actions

---

## Customize Notifications

Edit `.github/workflows/test-notifications.yml` to:
- Change notification format
- Add more fields (duration, coverage, etc.)
- Notify different channels based on branch
- Add custom emojis/colors

See Slack Block Kit docs: https://api.slack.com/block-kit

---

## Disable Notifications

To temporarily disable:
1. Go to Slack app settings
2. Delete the webhook
3. Or remove/rotate GitHub secret

Tests will still run, just no notifications.

---

## Test It

After setup, trigger a test failure:
1. Make a code change that breaks a test
2. Push to `claude/*` branch
3. Wait ~2 minutes for workflow
4. Check Slack channel

Should see failure notification within minutes.
