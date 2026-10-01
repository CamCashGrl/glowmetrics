# CamCash Test Automation & Logging

Complete testing infrastructure for automated testing, on-demand test execution, and comprehensive logging.

---

## Quick Start

### Run Tests Now
```bash
# Full test suite with coverage
npm run test:ci --prefix glowmetrics_fresh

# Specific suites
npm run test:api --prefix glowmetrics_fresh      # API endpoints only
npm run test:ui --prefix glowmetrics_fresh       # UI components only
npm run test:formulas --prefix glowmetrics_fresh # Analytics formulas only

# Watch mode (re-run on file changes)
npm run test:watch --prefix glowmetrics_fresh

# Debug mode (interactive debugger)
npm run test:debug --prefix glowmetrics_fresh
```

### Generate Test Report
```bash
npm run test:report
```

View reports:
- **JSON**: `glowmetrics_fresh/test-results/summary.json`
- **HTML**: `glowmetrics_fresh/test-results/report.html`

---

## Test Logging

All test runs are automatically logged to `logs/tests/` with timestamps:

```
logs/tests/
├── 2026-09-27T17-30-45-123Z.log
├── 2026-09-27T16-45-20-456Z.log
└── ...
```

Each log contains:
- Timestamp (ISO 8601)
- Test suite run (all, api, ui, formulas)
- Pass/Fail status
- Duration
- Error details (if failed)
- Last 500 characters of output

---

## CI/CD Automation

Tests run automatically on:

1. **Every push** to `claude/*` branches
2. **Every PR** to `main` or `staging`
3. **Manual trigger** via GitHub Actions UI

### GitHub Actions

Workflow: `.github/workflows/test.yml`

Features:
- Installs dependencies
- Runs tests with coverage
- Uploads artifacts (kept for 30 days)
- Posts results as PR comment
- Fails if any test fails

### Viewing Results

1. **GitHub Actions**: `Actions` tab → select workflow run
2. **PR Comments**: Automatically posted on PR
3. **Artifacts**: Downloaded from Actions tab
   - `test-results-{run_id}` (JUnit XML + JSON)
   - `coverage-report-{run_id}` (HTML coverage)

---

## On-Demand Testing

### Via Command Line
```bash
# From project root
node scripts/run-tests.mjs [suite]
# suite: all, api, ui, formulas (default: all)

# Example
node scripts/run-tests.mjs api
```

### Via Claude Code Hook
Tests run automatically when you save files:
```bash
# Save a file → auto-runs quick tests (configured in .claude/settings.json)
```

### Via Claude Code Commands
```bash
/test              # Run full test suite + generate report
/test:api          # Run API tests only
/test:ui           # Run UI tests only
/test:formulas     # Run formula tests only
```

---

## Test Coverage

Minimum coverage thresholds (fail if below):
- **Lines**: 60%
- **Functions**: 60%
- **Branches**: 60%
- **Statements**: 60%

View coverage:
```bash
npm run test:ci --prefix glowmetrics_fresh
# Coverage report in: glowmetrics_fresh/coverage/index.html
```

---

## Test Structure

### API Tests
**Location**: `glowmetrics_fresh/app/api/**/__tests__/`

Tests for:
- `/api/upload` (CSV parsing, platform detection)
- `/api/auth` (auth endpoints)
- `/api/tips` (tip data endpoints)
- Data validation, RLS enforcement, security

### UI Component Tests
**Location**: `glowmetrics_fresh/app/components/**/__tests__/`

Tests for:
- Dashboard components
- Chart rendering
- Form inputs
- Modal/dialog components
- User interactions

### Formula Tests
**Location**: `glowmetrics_fresh/lib/__tests__/`

Tests for:
- Token rate calculations (USD conversion)
- Valid session detection
- Hourly rate computation
- Fan tier classification
- Best time to stream scoring
- Data confidence levels

---

## Adding New Tests

### API Test Example
```js
// glowmetrics_fresh/app/api/upload/__tests__/upload.test.js
describe('POST /api/upload', () => {
  it('should parse Chaturbate CSV correctly', async () => {
    const csv = 'Date,Tips,Total\n2026-01-01,50,500'
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: csv,
    })
    expect(res.status).toBe(200)
  })

  it('should reject invalid platform', async () => {
    const csv = 'invalid data'
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: csv,
    })
    expect(res.status).toBe(400)
  })
})
```

### Component Test Example
```js
// glowmetrics_fresh/app/components/__tests__/Dashboard.test.js
import { render, screen } from '@testing-library/react'
import Dashboard from '../Dashboard'

describe('Dashboard', () => {
  it('should render earnings chart', () => {
    render(<Dashboard data={mockData} />)
    expect(screen.getByText('Total Earnings')).toBeInTheDocument()
  })

  it('should show "no data" message when empty', () => {
    render(<Dashboard data={[]} />)
    expect(screen.getByText(/not enough data/i)).toBeInTheDocument()
  })
})
```

### Formula Test Example
```js
// glowmetrics_fresh/lib/__tests__/analytics.test.js
import { calculateHourlyRate, getValidSessions } from '../analytics'

describe('Formulas', () => {
  it('should calculate hourly rate correctly', () => {
    const rate = calculateHourlyRate(120, 60) // $120 in 60 min
    expect(rate).toBe(120)
  })

  it('should flag invalid sessions', () => {
    const valid = getValidSessions([
      { durationMinutes: 25, tipCount: 5 }, // < 30 min = invalid
      { durationMinutes: 45, tipCount: 2 }, // valid
    ])
    expect(valid.length).toBe(1)
  })
})
```

---

## Monitoring & Alerts

### Test Failure Alerts
- **PR Comments**: Auto-posted when tests fail
- **GitHub Notifications**: If subscribed to repo
- **Email**: Via GitHub (if configured)

### Trends
Check `logs/tests/` for historical data:
- Pass/fail rate over time
- Test duration trends
- Performance regressions

View HTML dashboard:
```bash
npm run test:report
open glowmetrics_fresh/test-results/report.html
```

---

## Troubleshooting

### Tests Won't Run
```bash
# Install dependencies
npm install --prefix glowmetrics_fresh

# Clear Jest cache
npm run test -- --clearCache --prefix glowmetrics_fresh

# Try again
npm run test:ci --prefix glowmetrics_fresh
```

### Coverage Below Threshold
```bash
# See coverage details
npm run test:ci --prefix glowmetrics_fresh
open glowmetrics_fresh/coverage/index.html

# Add tests for uncovered lines
```

### Slow Tests
```bash
# Run with performance breakdown
npm run test:ci --prefix glowmetrics_fresh 2>&1 | grep -E 'PASS|FAIL|ms'

# Use watch mode to iterate faster
npm run test:watch --prefix glowmetrics_fresh
```

### GitHub Actions Failing
1. Check `.github/workflows/test.yml` log
2. Verify environment variables (secrets)
3. Check Node.js version compatibility
4. Run locally first: `npm run test:ci --prefix glowmetrics_fresh`

---

## Best Practices

✅ **DO:**
- Write tests for all API endpoints
- Test edge cases and error states
- Include data validation tests
- Use realistic mock data
- Keep tests under 10 seconds each

❌ **DON'T:**
- Test external services (mock them)
- Hardcode data or credentials
- Write tests for UI styling
- Skip tests to get to production
- Ignore coverage thresholds

---

## CamCash-Specific Test Rules

From `standing-instructions`:

1. **Never test tip data deletion** — tips table is immutable
2. **Formulas must match `lib/constants.js`** — token rates only from there
3. **Platform detection is server-side only** — never test client-side parsing
4. **Valid session rule**: `durationMinutes >= 30 AND tipCount >= 2`
5. **Data confidence levels** must be checked:
   - Very Low: <3 sessions or <3hrs
   - Low: 3–4 sessions
   - Medium: 5–9 sessions
   - High: 10+ sessions, 20+hrs

---

## Next Steps

1. **Set up IDE integrations** (VS Code, etc.) to run tests on file save
2. **Add pre-commit hook** to prevent pushing failing tests
3. **Configure Slack notifications** for test failures
4. **Build dashboard** showing test trends over time
5. **Add performance monitoring** to catch regressions

---

## Files Created

- `.github/workflows/test.yml` — CI/CD pipeline
- `jest.config.js` — Jest configuration
- `jest.setup.js` — Test environment setup
- `scripts/run-tests.mjs` — Test runner with logging
- `scripts/test-reporter.mjs` — Log aggregation & reporting
- `.claude/settings.json` — Claude Code hooks & commands
- `logs/` — Test log directory
- `TEST_AUTOMATION.md` — This guide
