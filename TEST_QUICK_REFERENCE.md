# CamCash Test Quick Reference

## One-Command Testing

```bash
# Run all tests with coverage
npm run test:ci --prefix glowmetrics_fresh

# Run & generate report
npm run test:ci --prefix glowmetrics_fresh && npm run test:report

# Watch mode (auto-rerun on changes)
npm run test:watch --prefix glowmetrics_fresh
```

## Test Specific Areas

```bash
# API endpoints only
npm run test:api --prefix glowmetrics_fresh

# UI components only
npm run test:ui --prefix glowmetrics_fresh

# Analytics formulas only
npm run test:formulas --prefix glowmetrics_fresh
```

## Logging & Reports

```bash
# View test results
cat glowmetrics_fresh/test-results/summary.json

# View last 10 test runs
ls -ltr logs/tests/ | tail -10

# Open HTML report
open glowmetrics_fresh/test-results/report.html
```

## CI/CD

```bash
# Tests run automatically on:
# • Every push to claude/* branches
# • Every PR to main/staging
# • Manual trigger in GitHub Actions tab

# View results:
# • GitHub Actions tab
# • PR comments (auto-posted)
# • Artifacts (30-day retention)
```

## Troubleshooting

```bash
# Clear cache & reinstall
npm install --prefix glowmetrics_fresh
npm run test -- --clearCache --prefix glowmetrics_fresh

# Debug a specific test
npm run test:debug --prefix glowmetrics_fresh

# View coverage
open glowmetrics_fresh/coverage/index.html
```

## Key Metrics

- **Coverage Threshold**: 60% (lines, functions, branches, statements)
- **Test Timeout**: 10 seconds per test
- **Log Retention**: 30 days (GitHub Actions artifacts)
- **Valid Session**: durationMinutes >= 30 AND tipCount >= 2

---

**See `TEST_AUTOMATION.md` for full documentation**
