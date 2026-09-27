# Verify Before Claiming Success

**Trigger:** Before ending any task, before pushing to main, before claiming a bug is fixed, before saying a metric/formula change is working.

**Core Rule:** No task completion claim without documented verification proof. Never say "it's fixed" — say "I tested X, Y, Z and here's what I found."

---

## VERIFICATION CHECKLIST BY TASK TYPE

### 🐛 Bug Fix Tasks

**Before claiming "FIXED":**

- [ ] **Build verification**: Run full build (`npm run build` or equivalent). Show build output confirming 0 errors.
- [ ] **Local test account validation**: If user-facing feature, test with actual test account on dev/staging:
  - Reproduce original bug exactly as reported
  - Confirm bug no longer occurs
  - Take screenshot/recording showing before + after
- [ ] **Related features check**: Test adjacent features that might break from the fix:
  - If you fixed dashboard error, test all dashboard components
  - If you fixed analytics tracking, test all event types in 3 platforms (Chaturbate/MFC/Bonga)
  - If you fixed pricing logic, test on 5 different price points
- [ ] **Error logs**: Check browser console (dev tools) + server logs for any warnings/errors after fix
- [ ] **Data integrity check**: If the bug involved data:
  - Verify no data corruption from the original bug
  - Verify no data loss from your fix
  - Check affected database records (if applicable)
- [ ] **Performance impact**: Time the fixed feature (load time, response time). Confirm no slowdown introduced.

**What you report:**
```
✅ FIXED: [Bug name]

Test Results:
- Build: ✅ 0 errors
- Reproduction test: ✅ Bug no longer occurs (screenshot attached)
- Related features: ✅ Dashboard stats, analytics tracking, 3 platforms tested
- Error logs: ✅ No new warnings
- Data integrity: ✅ Verified 47 affected records intact
- Performance: ✅ Load time 340ms (was 340ms, no degradation)

Verified by: [your test account / specific test]
```

---

### 📊 Metrics/Analytics/Formula Changes

**Before claiming "WORKING":**

- [ ] **Formula audit**: 
  - Show the old formula
  - Show the new formula
  - Show the mathematical difference (what changed and why)
  - Verify no circular references, no divisions by zero, no scope issues
- [ ] **Data integrity check**: 
  - Pull 10 historical records and manually verify formula output matches expected value
  - Check edge cases (zero values, negative values, empty fields)
  - Verify formulas work across ALL affected records (not just a sample)
- [ ] **Test with multiple data scenarios**:
  - Test with max values (highest possible input)
  - Test with min values (lowest/zero)
  - Test with typical values (normal case)
  - Test with edge cases (nulls, blanks, extreme outliers)
- [ ] **Dashboard/UI verification**:
  - Load the page where metric displays
  - Confirm number renders correctly
  - Confirm color/status indicators reflect correct values
  - Test on 3 different browsers (Chrome, Firefox, Safari) if user-facing
- [ ] **Cross-reference**: If this metric feeds other metrics, verify downstream metrics still work
- [ ] **No silent corruption**: 
  - Verify the change didn't accidentally zero out, hide, or misrepresent any data
  - Check: are all expected data points visible? None hidden?

**What you report:**
```
✅ METRICS UPDATED: [Metric name]

Formula Change:
- Old: [formula]
- New: [formula]
- Why changed: [reason]

Validation:
- Manual spot-check: ✅ 10 records tested, all correct
- Edge cases: ✅ Zero, negative, max values tested
- Dashboard render: ✅ Displays correctly (Chrome, Firefox, Safari)
- Downstream impact: ✅ 3 dependent metrics verified working
- Data integrity: ✅ No records zeroed/corrupted

Test data: [specific record IDs checked]
Screenshots: [Before/after dashboard comparisons]
```

---

### 🌐 Website/Feature Deployments

**Before claiming "DEPLOYED AND WORKING":**

- [ ] **Build pass**: Full build with 0 errors/warnings
- [ ] **Staging test**: Deploy to staging first. Test in staging for 5 minutes:
  - All user flows work end-to-end
  - No 404 errors
  - No broken images/links
  - Mobile responsive check (if applicable)
- [ ] **Production deploy**: Push to main (not just staging)
- [ ] **Smoke test on production**:
  - Load production URL
  - Test primary user flow
  - Check for errors in production console
  - Verify no downtime during deploy
- [ ] **Analytics tracking**: If tracking events changed:
  - Trigger the event
  - Verify it logs to analytics
  - Confirm correct event type/data in events table
- [ ] **SEO/metadata check** (for blog/landing pages):
  - Check page metadata (title, description, OG tags)
  - Verify structured data (schema.org) renders correctly
  - Check canonical URLs are correct
  - Verify robots.txt allows crawling
- [ ] **Performance check**: 
  - Page load time < target (usually < 3s)
  - No memory leaks (check browser memory usage)
- [ ] **Related features**: Test 3 related features still work

**What you report:**
```
✅ DEPLOYED: [Feature/page name]

Deployment Status:
- Build: ✅ 0 errors
- Staging test: ✅ All flows working (5 min test)
- Production deploy: ✅ Completed, no downtime
- Smoke test: ✅ Primary flow verified working
- Analytics: ✅ Event tracking verified (sample event IDs: xxx, yyy, zzz)
- SEO: ✅ Metadata correct, schema valid, robots.txt allows
- Performance: ✅ 1.8s load time (target: < 3s)
- Related features: ✅ Navigation, search, CTAs all working

Verification timestamp: [time]
Deployed to: production
```

---

### 📝 Blog/Content Updates (SEO/AEO Optimization)

**Before claiming "OPTIMIZED":**

- [ ] **Build passes**: No build errors
- [ ] **Metadata verification**: 
  - Title matches target keyword + brand (< 70 chars)
  - Description includes 2-3 target keywords, compelling (< 160 chars)
  - Open Graph tags present and correct
  - Canonical URL correct
- [ ] **Content structure**:
  - H1 present and unique (once per page)
  - H2s/H3s logical hierarchy (no skipping levels)
  - Word count meets target (e.g., 2,500+ for blog)
  - AEO questions in FAQ/content
  - GEOSEO content if applicable
- [ ] **Schema markup**:
  - Article schema validates (check: https://validator.schema.org)
  - FAQPage schema has ≥5 Q&As
  - BreadcrumbList correct
  - No duplicate/conflicting schemas
- [ ] **Internal/external links**:
  - All internal links point to valid pages (no 404 targets)
  - External links point to working URLs (spot-check 3)
  - Link anchor text is descriptive (not "click here")
  - CTA buttons link to correct destinations
- [ ] **Image optimization**:
  - Images present and load (no broken img tags)
  - Alt text descriptive and includes keywords where natural
  - Image file size reasonable (< 500KB for web images)
  - Images display correctly on mobile
- [ ] **Mobile responsiveness**:
  - Test on phone (actual device or Chrome DevTools)
  - Text readable without zooming
  - CTAs tappable (not too small)
  - No horizontal scroll
- [ ] **Analytics tracking**:
  - If page has CTAs/downloads, verify tracking events work
  - Test with analytics tool (CamCash event tracker, etc.)
- [ ] **Performance**:
  - Page load < 3 seconds
  - Lighthouse score ≥ 80 (if applicable)

**What you report:**
```
✅ OPTIMIZED: [Blog post title]

SEO Metadata:
- Title: [title] (68 chars, includes keyword)
- Description: [description] (157 chars, 2 keywords)
- Keywords: [list]
- OG Tags: ✅ Present

Content:
- Word count: 2,847 words
- H1: ✅ [title]
- H2/H3 hierarchy: ✅ Proper structure
- AEO coverage: ✅ 12 Q&A items, 3 regional sections
- GEOSEO: ✅ Timezone/regional considerations included

Technical:
- Schema validation: ✅ All schemas valid
- Internal links: ✅ 12/12 links valid (no 404s)
- External links: ✅ 5/5 sampled links working
- Image optimization: ✅ 8 images, all ≤ 400KB, alt text present
- Mobile: ✅ Responsive, tested on iPhone 12
- Performance: ✅ 1.9s load time, Lighthouse 91

Analytics:
- CTA tracking: ✅ 3 CTA events verified firing
- Event data: ✅ Correct properties logged

Screenshots: [mobile view, schema validation, lighthouse score]
```

---

## 🚨 CRITICAL DATA INTEGRITY CHECKS

**For ANY task touching:**
- Database queries or formulas
- Pricing/earnings calculations
- User account data
- Analytics event structure
- Authentication/permissions logic

**ALWAYS do:**

1. **Before touching**: Show the original code/formula with line numbers
2. **After changing**: Show the new code/formula with line numbers
3. **Verify no data loss**: 
   - Count affected records before/after
   - Spot-check 5 random records manually
   - Confirm no NULLs introduced
4. **Verify no logic corruption**:
   - Test with edge case inputs (0, negative, max, null)
   - Run the query/formula on sample data, manually verify result
   - Confirm formula scope is correct (no circular refs, no undefined vars)
5. **Backup/recovery**: 
   - Confirm you can roll back if needed
   - Document the rollback command
6. **Report comprehensively**:
   - Show before/after code
   - Show manual test results
   - Show affected record count
   - Show zero data corruption evidence

---

## NEVER CLAIM SUCCESS WITHOUT THIS

| Task Type | Minimum Verification | Proof Required |
|-----------|---------------------|----------------|
| Bug fix | Build + local test + error log check | Screenshots of before/after, console clean |
| Metric/formula | Manual spot-check 10 records + edge cases | Test results showing input → output |
| Deployment | Staging test + production smoke test | Production URL verification + analytics |
| Blog post | Build + schema validation + mobile test | Lighthouse score + mobile screenshot |
| Data change | Backup made + record count verified + manual spot-check | SQL results showing affected rows + sample record values |

---

## TEMPLATE: WHAT TO SAY AT TASK END

Instead of: "I fixed it" / "It's done" / "Should be working now"

Say:
```
✅ VERIFIED: [Task name]

Tests run:
- [Test 1]: ✅ Result
- [Test 2]: ✅ Result
- [Test 3]: ✅ Result

Proof:
- [Screenshot/data showing success]
- [Specific result numbers/values]
- [Verification method used]

Status: Ready for production / Ready to merge / Ready for user testing
```

---

## WHEN TO ESCALATE INSTEAD OF CLAIMING SUCCESS

If ANY of these occur:

- [ ] Test results show the issue is NOT fixed
- [ ] Data appears corrupted or missing after the change
- [ ] Build has warnings/errors
- [ ] Related features break from the fix
- [ ] Performance degraded significantly
- [ ] Tracking/analytics data looks wrong
- [ ] Schema validation fails
- [ ] You can't verify for any reason (missing test account, can't access staging, etc.)

**Do NOT say "it's probably fine"** — report the blocker and ask the user.

---

## EXAMPLES

### ❌ BAD (No verification):
"Fixed the dashboard crash. The error was in the scope of the variables, removed the duplicate declaration. Should work now."

### ✅ GOOD (With verification):
"✅ FIXED: Dashboard meaningfulSessions error

Verification:
- Built project: ✅ 0 errors
- Reproduced original error: ✅ ReferenceError: meaningfulSessions is not defined (in console)
- Applied fix (removed scope issue in Daily Brief IIFE)
- Re-tested with test account: ✅ Dashboard loads, no errors in console, all stats display
- Tested related features: ✅ Profile builder, analytics page, landing page all working
- Performance: ✅ No slowdown, dashboard loads in 1.2s (was 1.1s)

Screenshots: [before/after console, dashboard loading]
Deployed to: main via PR #590"

---

## HOW THIS SKILL WORKS

1. **At task start**: Review this checklist for your task type
2. **While working**: Keep verification checklist visible
3. **Before claiming done**: Run all checks in your task's section
4. **Document findings**: Screenshot, record, save results
5. **Report with proof**: Show verification results, not assumptions
6. **If anything fails**: Escalate instead of claiming success

---

**Last Updated:** 2026-09-27
**Project:** GlowMetrics (CamCash)
**Criticality:** HIGH — Data integrity, user trust, metrics accuracy depend on rigorous verification
