# Comprehensive Test Suite & Data Integrity Validation

**Trigger:** Before pushing ANY code, especially anything touching:
- Metrics calculations
- Formulas
- Analytics events
- Database operations
- Earnings/revenue logic
- User data
- Dashboard rendering/calculations

**Core Rule:** NO CODE PUSHED WITHOUT RUNNING FULL TEST SUITE + DATA INTEGRITY VALIDATION.

---

## TESTING HIERARCHY

Run tests in this order. Stop at first failure and fix before proceeding.

```
1. Syntax/Lint Checks (catches typos, style issues)
2. Type Checking (catches undefined variables, scope issues)
3. Unit Tests (individual functions work)
4. Integration Tests (functions work together)
5. Data Validation Tests (formulas produce correct results)
6. End-to-End Tests (full feature works in browser)
7. Performance Tests (no slowdown)
8. Data Integrity Audit (no corruption, no data loss)
```

---

## QUICK START: Run All Tests

```bash
# Load environment
source .env.local

# Run full test suite
npm run test:full

# This runs all tests below in sequence
# If any test fails, the suite stops and reports the failure
```

**If `npm run test:full` doesn't exist yet, run tests individually (see sections below).**

---

## 1️⃣ SYNTAX & LINTING

**Why:** Catch typos, formatting issues, obviously broken code before wasting time on deeper tests.

```bash
# Check for syntax errors and style issues
npm run lint

# Expected output:
# ✅ 0 errors
# ✅ 0 warnings (or acceptable warnings)
```

**What to look for:**
- No red errors (❌)
- All files pass linting rules
- No undefined variables flagged

**If it fails:**
- Read error messages carefully — they tell you exactly what's wrong
- Fix syntax errors first
- Re-run: `npm run lint`

---

## 2️⃣ TYPE CHECKING

**Why:** Catch scope issues, undefined variables, type mismatches (critical for math/formulas).

```bash
# TypeScript/JSDoc type checking
npm run type-check

# Expected output:
# ✅ Type checking passed
# ✅ 0 type errors
```

**What to look for:**
- No "is not defined" errors
- No "unexpected type" errors
- No scope issues

**Common issues that fail here:**
- Variable used before declaration
- Function called with wrong number of arguments
- Math operation on wrong type (string + number)
- Missing required parameters

**If it fails:**
- Error message shows exact line number
- Fix the type issue
- Re-run: `npm run type-check`

---

## 3️⃣ UNIT TESTS (Individual Functions)

**Why:** Verify each function produces correct output for given input (critical for metrics/formulas).

```bash
# Run unit tests
npm test -- --testPathPattern=__tests__

# Expected output:
# ✅ PASS src/utils/earnings-calculator.test.js
# ✅ PASS src/utils/analytics-parser.test.js
# ✅ All test suites passed (X tests)
```

**What each test checks:**
- Function returns expected output
- Edge cases handled (zero, negative, max values)
- Error conditions caught
- Formula accuracy

**Critical test categories for CamCash:**

### Earnings/Revenue Calculations:
```
Test: calculateEarningsPerHour()
- Input: tips=[50,100,50], hours=1 → Expected: $200/hr ✅
- Input: tips=[], hours=1 → Expected: $0/hr ✅
- Input: tips=[1000], hours=0.5 → Expected: $2000/hr ✅
- Input: negative tip → Should error ✅
```

### Analytics Events:
```
Test: parseAnalyticsEvent()
- Valid event → Returns parsed object ✅
- Missing fields → Returns error ✅
- Invalid timestamp → Returns error ✅
- Duplicate event ID → Detected ✅
```

### Data Transformations:
```
Test: normalizeUserData()
- Null values → Handled correctly ✅
- Duplicate entries → Deduplicated ✅
- Missing fields → Default values applied ✅
- Data not corrupted → Verified ✅
```

**If a test fails:**
```bash
# Run single test for debugging
npm test -- --testNamePattern="calculateEarningsPerHour"

# Shows detailed failure message:
# Expected: $200/hr
# Received: $100/hr
# ❌ FAIL
```

**Fix the code, then re-run the test.**

---

## 4️⃣ INTEGRATION TESTS

**Why:** Verify functions work together correctly (end-to-end logic flow).

```bash
# Run integration tests
npm test -- --testPathPattern=integration

# Expected output:
# ✅ PASS src/__tests__/integration/earnings-flow.test.js
# ✅ PASS src/__tests__/integration/analytics-pipeline.test.js
# ✅ All integration tests passed
```

**What integration tests check:**
- Data flows correctly from input → process → output
- Database queries return expected data
- Analytics events trigger correctly
- Multiple components work together

**Example integration test (earnings calculation):**
```
1. Load sample user data from database
2. Trigger analytics events (tips, views, etc.)
3. Calculate earnings using those events
4. Verify calculation matches expected value
5. Confirm no data corruption in process
```

**If a test fails:**
- Error message shows which step failed
- Could be: data loading issue, calculation error, or output mismatch
- Fix the broken step
- Re-run: `npm test -- --testPathPattern=integration`

---

## 5️⃣ DATA VALIDATION TESTS (Critical for Metrics)

**Why:** Verify metrics calculations are mathematically correct and formulas don't corrupt data.

### Manual Data Validation (Do This For Every Metrics Change):

```bash
# Load environment
source .env.local

# Test with sample data
node scripts/validate-metrics.js

# This script:
# 1. Loads 10 sample records
# 2. Runs each formula on them
# 3. Manually verifies output is correct
# 4. Checks for NULLs, corruption, edge cases
# 5. Reports results
```

**Expected output:**
```
✅ Testing earnings calculation with 10 sample records:
   Record 1: tips=50 → earnings=$50 ✅
   Record 2: tips=100 → earnings=$100 ✅
   Record 3: tips=0 → earnings=$0 ✅
   ...
✅ All 10 records passed validation
✅ No NULL values introduced
✅ No data corruption detected
```

### Specific Tests For Metrics/Formulas:

**Before ANY formula change:**

```bash
# 1. Show the old formula
echo "Old formula: ${OLD_FORMULA}"
# Output: SELECT SUM(tokens) * 0.05 FROM tips WHERE...

# 2. Show the new formula
echo "New formula: ${NEW_FORMULA}"
# Output: SELECT SUM(tokens) * 0.05 FROM tips WHERE...

# 3. Test old formula on 10 records
node scripts/test-formula.js --formula="old" --records=10
# Output: Sample results from old formula

# 4. Test new formula on same 10 records
node scripts/test-formula.js --formula="new" --records=10
# Output: Sample results from new formula

# 5. Compare results
# Old vs New: Should match (if just refactoring)
# Or: Should show expected difference (if intentional change)

# 6. Check for data loss
# Old: 150 records processed
# New: 150 records processed ✅ (same count)

# 7. Check edge cases
# Zero value: Old=$0, New=$0 ✅
# Negative value: Old=Error, New=Error ✅
# NULL value: Old=NULL, New=NULL ✅
```

**What must be true:**
- ✅ Same number of records processed
- ✅ Edge cases handled identically
- ✅ No records silently dropped
- ✅ No unexpected NULLs introduced
- ✅ Mathematical accuracy verified
- ✅ Performance not degraded

**If validation fails:**
- Identifies exactly which record failed
- Shows expected vs actual value
- Shows the formula that failed
- Fix the formula and re-test

---

## 6️⃣ END-TO-END TESTS (Browser/Full Feature)

**Why:** Verify the entire feature works in the actual browser, with real UI.

```bash
# Start dev server
npm run dev

# Run e2e tests (in separate terminal)
npm run test:e2e

# This uses Playwright to:
# 1. Open browser
# 2. Load app
# 3. Perform user actions (click, type, submit)
# 4. Verify expected results appear
# 5. Check no errors in console
```

**Example E2E test flow:**
```
1. Load dashboard with test account
2. Click "Add Tip" button
3. Enter tip amount (100 tokens)
4. Submit form
5. Verify: ✅ Tip appears in list
6. Verify: ✅ Earnings total updated
7. Verify: ✅ No console errors
8. Verify: ✅ Analytics event tracked
```

**If E2E test fails:**
```
❌ FAIL: Earnings total did not update after adding tip

Steps:
1. ✅ Loaded dashboard
2. ✅ Clicked "Add Tip"
3. ✅ Entered 100 tokens
4. ✅ Submitted form
5. ❌ Earnings total: expected $5.00, got $0.00

Error: Calculation not triggered on form submit
```

**Fix the issue and re-run test.**

---

## 7️⃣ PERFORMANCE TESTS

**Why:** Ensure changes don't slow down critical operations (especially for large data sets).

```bash
# Run performance benchmarks
npm run test:performance

# Expected output:
# ✅ Earnings calculation: 45ms (target: <100ms) ✅
# ✅ Dashboard load: 1.2s (target: <3s) ✅
# ✅ Analytics parse: 120ms (target: <500ms) ✅
```

**Critical performance thresholds:**
- Earnings calculation: < 100ms
- Dashboard page load: < 3 seconds
- Analytics event processing: < 500ms
- Database query: < 2 seconds
- API response: < 1 second

**If performance test fails:**
```
❌ FAIL: Earnings calculation
Expected: < 100ms
Actual: 250ms

This is 2.5x slower than target. Investigate:
- Did you add a database query inside a loop?
- Did you add regex/string processing on large data sets?
- Did you add synchronous operations where async would work?
```

**Fix the performance issue and re-test.**

---

## 8️⃣ DATA INTEGRITY AUDIT (Most Critical)

**Why:** Final check that NO DATA WAS CORRUPTED, LOST, or SILENTLY MODIFIED.

### Pre-Change Audit:

```bash
# BEFORE making changes:
# Count all records
SELECT COUNT(*) FROM users; → 234 ✅
SELECT COUNT(*) FROM tips; → 5,847 ✅
SELECT COUNT(*) FROM analytics_events; → 18,293 ✅

# Verify no NULLs in critical fields
SELECT COUNT(*) FROM tips WHERE amount IS NULL; → 0 ✅
SELECT COUNT(*) FROM users WHERE user_id IS NULL; → 0 ✅

# Take snapshot of sample data
SELECT * FROM tips ORDER BY created_at DESC LIMIT 10;
→ Save this as BEFORE_SNAPSHOT.json
```

### Post-Change Audit:

```bash
# AFTER making changes:
# Recount all records
SELECT COUNT(*) FROM users; → 234 ✅ (same as before)
SELECT COUNT(*) FROM tips; → 5,847 ✅ (same as before)
SELECT COUNT(*) FROM analytics_events; → 18,293 ✅ (same as before)

# Verify no new NULLs introduced
SELECT COUNT(*) FROM tips WHERE amount IS NULL; → 0 ✅
SELECT COUNT(*) FROM users WHERE user_id IS NULL; → 0 ✅

# Compare sample data with before
SELECT * FROM tips ORDER BY created_at DESC LIMIT 10;
→ Compare with BEFORE_SNAPSHOT.json
→ All values unchanged? ✅
```

**Checklist:**
- [ ] Record counts match before/after
- [ ] No new NULLs introduced
- [ ] Sample records unchanged (or changed exactly as intended)
- [ ] Data types correct (no strings where should be numbers)
- [ ] No duplicate records created
- [ ] No records silently deleted
- [ ] Metrics calculations produce expected values
- [ ] All formulas reference correct columns

**If any audit check fails:**

```
❌ FAIL: Data Integrity Audit

Before: users = 234
After:  users = 231

3 records were deleted or hidden. Investigate:
- Did the code have a WHERE clause that filtered records?
- Did an UPDATE accidentally NULL out values?
- Did a JOIN drop records with missing values?

DO NOT PUSH CODE. Fix the data loss and re-audit.
```

---

## 🚨 CRITICAL RULES FOR METRICS/DATA CHANGES

**These are non-negotiable:**

1. **Always show before/after counts**
   ```
   Before: 5,847 tip records
   After:  5,847 tip records ✅
   ```

2. **Always verify formulas with sample data**
   ```
   Formula: earnings = tips * 0.05
   Sample:  100 tokens → $5.00 ✅
   ```

3. **Always check for NULLs introduced**
   ```
   NULL check: SELECT COUNT(*) WHERE column IS NULL
   Result: 0 ✅
   ```

4. **Always validate edge cases**
   ```
   Zero:     0 tokens → $0.00 ✅
   Large:    1,000,000 tokens → $50,000.00 ✅
   Negative: Should error ✅
   ```

5. **Always document the change**
   ```
   Old: earnings = tips * 0.05
   New: earnings = tips * 0.06 (rate increased from 5% to 6%)
   Impact: All earnings will be ~20% higher
   Data loss: None
   ```

---

## TEST FAILURE SCENARIOS & FIXES

### Scenario 1: Unit Test Fails

```
❌ FAIL: calculateEarningsPerHour()

Input: [100, 200, 100]
Expected: $400/hr
Actual: $300/hr

Fix:
- Check the calculation logic
- Verify formula is correct
- Check for off-by-one errors
- Re-run test
```

### Scenario 2: Integration Test Fails

```
❌ FAIL: earnings-flow integration

Step 3 failed: Database returned 0 records

Fix:
- Check database connection
- Verify test data was inserted
- Check query syntax
- Verify user_id references
```

### Scenario 3: Formula Produces Wrong Result

```
❌ FAIL: Data Validation

Formula: earnings = tips * rate
Record 1: tips=100, rate=0.05 → expected $5, got $100

Fix:
- Verify rate variable is set correctly (0.05, not 5)
- Check for type conversion issues
- Verify decimal precision
- Test with known-correct data
```

### Scenario 4: Data Corruption Detected

```
❌ FAIL: Data Integrity Audit

Before: 5,847 records
After:  5,840 records (7 deleted)

Fix:
- Review code for DELETE/UPDATE statements
- Check WHERE clauses for unintended filtering
- Restore from backup if needed
- DO NOT PUSH THIS CODE
```

---

## COMPLETE TEST CHECKLIST

Before pushing ANY code change:

```
Code Quality:
- [ ] npm run lint → ✅ 0 errors
- [ ] npm run type-check → ✅ passed
- [ ] npm run build → ✅ 0 errors

Functionality:
- [ ] npm test → ✅ all unit tests pass
- [ ] npm run test:e2e → ✅ all e2e tests pass
- [ ] npm run test:integration → ✅ all integration tests pass

Data Integrity (Especially Important!):
- [ ] Manual formula validation → ✅ sample data correct
- [ ] Record count before/after → ✅ no loss
- [ ] NULL check → ✅ no new NULLs
- [ ] Edge case testing → ✅ zero, negative, max all work
- [ ] Performance test → ✅ meets thresholds
- [ ] Database audit → ✅ no corruption detected

Documentation:
- [ ] Changes documented
- [ ] Formula changes shown (old → new)
- [ ] Impact documented
- [ ] Verified by test account

Status: ✅ READY TO PUSH
```

---

## TEMPLATE: Test Results Report

```
✅ FULL TEST SUITE PASSED

Code Quality Tests:
- Linting: ✅ 0 errors
- Type checking: ✅ passed
- Build: ✅ 0 errors

Functionality Tests:
- Unit tests: ✅ 47 passed
- Integration tests: ✅ 12 passed
- E2E tests: ✅ 5 passed

Data Integrity Tests:
- Formula validation: ✅ 10/10 records correct
- Record count: ✅ Before: 5,847 → After: 5,847
- NULL check: ✅ 0 new NULLs introduced
- Edge cases: ✅ Zero, negative, max values tested
- Performance: ✅ 45ms (target: <100ms)
- Database audit: ✅ No corruption detected

Tested by: test account claudetest@camcash.com
Test data verified: 10 sample records
Performance baseline: Within threshold
Data integrity: Confirmed

Ready to merge: ✅ YES
```

---

## When NOT to Push Code

❌ **Stop and fix before pushing if:**

- Any linting error (not warning, error)
- Any type checking failure
- Any unit test failure
- Any integration test failure
- Record count changed unexpectedly
- New NULLs introduced
- Formula produces incorrect output
- Performance degraded >20%
- Data corruption detected
- E2E test fails in browser

---

## Quick Command Reference

```bash
# Run everything
npm run test:full

# Or run individually:
npm run lint              # Syntax/style
npm run type-check        # Type checking
npm test                  # Unit tests
npm run test:e2e          # Browser tests
npm run test:integration  # Integration tests
npm run test:performance  # Performance benchmarks

# Validate metrics/formulas specifically
node scripts/validate-metrics.js

# Check data integrity
node scripts/audit-data-integrity.js
```

---

**Last Updated:** 2026-09-27
**Project:** GlowMetrics (CamCash)
**Criticality:** MAXIMUM — Data integrity, metrics accuracy, user trust depend on comprehensive testing
**Applies To:** ALL code changes, especially metrics/formulas/analytics/database operations
**Test Account:** claudetest@camcash.com (use for E2E and manual verification)
