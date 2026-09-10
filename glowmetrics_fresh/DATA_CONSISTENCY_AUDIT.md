# DATA CONSISTENCY & TIMEZONE AUDIT

**Date:** 2026-09-08  
**Status:** BLOCKING ISSUES IDENTIFIED - Fix required before feature additions

---

## CRITICAL ISSUES FOUND

### 1. BROWSER TIMEZONE INSTEAD OF CREATOR TIMEZONE ⚠️ CRITICAL

**Location:** `app/dashboard/page.js` lines 1789, 1869, 1984

**Issue:**
```javascript
const userTz = typeof Intl !== 'undefined' 
  ? Intl.DateTimeFormat().resolvedOptions().timeZone 
  : 'UTC'
```

This gets the **BROWSER'S timezone**, not the **CREATOR'S configured timezone**.

**Scenario:**
- Creator is in Los Angeles (America/Los_Angeles)
- Creator views dashboard from New York (America/New_York)
- System calculates analytics using New York timezone
- "Best time to go live: 9 PM" is shown as UTC-5 (EST), not UTC-8 (PST)
- Creator's actual optimal window is at 6 PM their time, but system says 9 PM
- Result: Incorrect timing recommendations, wrong daily/weekly patterns

**Root Cause:**
Intl.DateTimeFormat().resolvedOptions().timeZone reads browser locale, not creator profile data.

**Solution Required:**
1. Fetch creator's configured timezone from database profile
2. Pass CREATOR TIMEZONE to aggregateRows, not browser timezone
3. Create canonical timezone utility that uses creator timezone, not browser timezone

**Affected Calculations:**
- Best time windows (uses toLocalHour, toLocalDow, toLocalDateStr)
- Daily patterns (grouped by DOW)
- Hourly patterns (grouped by hour)
- Session local dates
- "Days ago" calculations for fans
- Monthly boundaries
- All "creator-facing" time intelligence

---

### 2. STALE SHARK TIER REFERENCES ⚠️ DATA DISPLAY ISSUE

**Locations:**
- `lib/analytics.js` line 875: Fallback filter for Shark tier
- `lib/analytics.js` line 1061: Render mapping includes Shark emoji
- `app/dashboard/page.js` line 6743: Tier icon includes Shark

**Current Tier Assignment Logic (lib/analytics.js lines 523-537):**
```javascript
let tier = 'New'
if (f.totalUSD >= 50) {
  tier = 'Whale'
}
else if (qualifyingSessionCount >= 11 && isActiveInLast6Months) {
  tier = 'Regular'
}
else if (qualifyingSessionCount >= 3) {
  tier = 'Emerging'
}
```

**No code assigns 'Shark' tier**, but three locations still reference it:

1. Line 875: `whales.filter(w => w.tier === 'Shark')` - DEAD CODE, no fans have this tier
2. Line 1061: `w.tier === 'Shark' ? '🦈 SHARK'` - DEAD RENDER PATH
3. Line 6743: `w.tier === 'Shark' ? '🦈'` - DEAD RENDER PATH

**Issue:** 
If display logic reaches these code paths, it's rendering an obsolete tier. Also mentions 'Dormant' tier on line 1061 which is also not assigned anywhere.

**Example from User:**
Fan Profile shows:
```
"Shark"
MyFreeCams
$35.00 lifetime
1 tip
Top 10% of supporters
"New supporter"
```

This fan should NOT show "Shark" — they're in the 'New' tier with $35 lifetime (< $50 Whale threshold) and only 1 tip (< 11 Regular threshold).

**Solution Required:**
1. Remove all Shark tier references from display logic
2. Verify tier assignment only produces: Whale, Regular, Emerging, New
3. Test: $35 / 1 tip fan should display as 'New', not 'Shark'
4. Remove 'Dormant' tier references (also not assigned)
5. Add regression test: No fan displays Shark tier

---

### 3. SESSION DURATION SOURCE OF TRUTH UNCLEAR ⚠️ CALCULATION ISSUE

**Location:** `lib/analytics/sessions.js` lines 42-47

**Current Logic:**
```javascript
const durationMs = s.endTime - s.startTime  // First tip to last tip
const durationMinutes = Math.round(durationMs / 60000)
const durationUnknown = durationMinutes === 0
const durationMinutes = Math.max(durationMinutes, 1)
```

**Issue:**
Session duration is calculated from **tip timestamps only**. If creator:
- Tips at 9:00 PM (first tip)
- Goes idle for 30 minutes
- Tips at 9:50 PM (second tip)
- Takes 1-hour break
- Tips at 10:50 PM (third tip)

The system thinks session duration is 1 hour 50 minutes (first to last tip), but actual streaming might be 2.5 hours or 1 hour (creator's reported value).

**Documented Limitation (Line 9-10):**
> "CSV/tip data never carries a real stream start/end time, so this is always an inferred boundary, not a verified one."

**User-Reported Example:**
```
Platform: MFC
Total revenue: $116
Sessions: 1
Streamed hours: 1h
Calculated hourly rate: $87.99/hr (not $116/hr)
```

If actual hours = 1 and total = $116, then $116 ÷ 1 = $116/hr. But system shows $87.99/hr.

Possible causes:
- durationMinutes ≠ 60 (calculated from tips, not actual stream)
- Multiple tips in different sessions aggregated incorrectly
- Floating-point rounding error
- Platform has different revenue split

**Solution Required:**
1. Audit whether streaming hours come from: tip-inferred duration, database uptime field, or creator input
2. If using tip-inferred duration, document this clearly: "Based on first-to-last tip"
3. If database has actual uptime data, use that instead of tip inference
4. Verify MFC example: trace $87.99/hr back to source calculation
5. Ensure hourly rate label matches denominator: "$/hr (based on inferred streaming duration)"

---

### 4. UTC HOUR/DAY USED IN SOME CALCULATIONS ⚠️ INCONSISTENCY

**Locations (UTC direct use):**
- `lib/analytics.js` line 551: `getUTCHours()` for hour counting
- `lib/analytics.js` line 798-799: `getUTCDay()` for today's DOW
- `lib/analytics.js` line 819: `getUTCHours()` for peak hour matching
- `lib/analytics.js` line 851: `getUTCDay()` for day name
- `lib/analytics.js` line 933: `getUTCHours()` for current hour
- `lib/analytics.js` line 1182: `getUTCHours()` for best hour matching
- `lib/analytics.js` line 1427: `getUTCHours()` for hourly analysis

**Issue:**
These code paths use UTC directly, NOT the timezone-converted toLocalHour() / toLocalDow() functions.

**Result:**
Two different calculations might produce different results:
- aggregateRows() uses toLocalHour/toLocalDow (creator timezone)
- Other functions use getUTCHours/getUTCDay (UTC)

If creator is in PST and best hour calculated as:
- Via toLocalHour: 9 PM PST (9 = local hour)
- Via getUTCHours: 4 AM UTC (4 = UTC hour)

These are **the same moment** but code treating them as different hours.

**Solution Required:**
1. Remove all direct getUTCHours() / getUTCDay() calls
2. Replace with toLocalHour() / toLocalDow() calls
3. Pass timezone parameter consistently
4. Add regression test: same timestamp analyzed in two creator timezones produces same insight

---

### 5. DATE DISPLAY INCONSISTENCIES ⚠️ DISPLAY ISSUE

**Issue: Missing AM/PM in time displays**

**Locations without AM/PM:**
- Fan Profile: "7:00 - 9:00" (should be "7:00 AM – 9:00 AM")
- Best Time: "9:00" (should be "9:00 PM")
- Expected Next Tip: shown as bare hour without AM/PM
- Command Center: time windows shown as numbers without AM/PM
- Stream Planner: sessions shown without AM/PM

**Locations with AM/PM:**
- StreamPlanner.js line 516: "times shown in your local timezone" (caption, but times might not have AM/PM)

**Issue:**
Creator sees "9:00" and doesn't know if it's 9 AM or 9 PM, or what timezone that is.

**Solution Required:**
1. Add AM/PM to all creator-facing hour displays
2. Include timezone indicator where space permits: "9:00 PM (PST)"
3. For ranges: "7:00 AM – 9:00 AM PST" not "7:00 - 9:00"
4. Add regression test: all time displays include AM/PM

---

### 6. "LOCKED" BEST TIME THRESHOLD ⚠️ UNEXPLAINED PRODUCT RULE

**Location:** Command Center display

**Text Shows:**
```
"Locked"
"Peak Earning Windows unlock after 25+ tips and 3+ meaningful sessions."
```

**Issue:**
This threshold (25 tips, 3 sessions) is NOT in the locked specification:

**Locked Rules (Verified):**
- Whale = $50+ lifetime
- Regular = 11+ canonical sessions + 6-month activity
- Canonical session gap = 60 minutes

**Unspecified Rule (in display):**
- Best Time unlock = 25+ tips AND 3+ meaningful sessions

**Problem:**
1. This rule not documented in locked spec
2. Unexplained why 25 tips chosen
3. Doesn't match tier logic (3+ sessions = Emerging tier, not Best Time requirement)
4. Creates separate eligibility gate outside canonical tier system

**Solution Required:**
1. Verify this threshold is intentional product rule (not ancient cargo cult code)
2. Document where it comes from
3. If intentional: explain why different from tier thresholds
4. If not intentional: remove and use evidence quality instead
5. Do NOT invent arbitrary threshold — use calculated evidence metrics

---

### 7. MONTHLY DATA BOUNDARIES ⚠️ TIMEZONE DEPENDENT

**Issue:**
Monthly growth calculation depends on month boundaries, which shift with timezone.

Example:
- Creator in PST views at 11:59 PM PST on Jan 31
- Browser sends Dec 1 00:00 UTC ... Jan 31 23:59 UTC
- But PST sees Dec 1 4:00 PM PST ... Jan 31 3:59 PM PST
- Month start/end are different

**Current Code (line 2637):**
```javascript
// Use UTC day to avoid timezone shifts (DB stores UTC timestamps)
```

**Issue:**
Comment says "use UTC to avoid shifts" but then earlier code uses creator timezone for hour/day analytics. Contradiction.

**Solution Required:**
1. Clarify: are month boundaries UTC or creator-local?
2. If creator-local: recalculate month boundaries in creator timezone
3. If UTC: document this clearly and show UTC month boundaries
4. Don't mix: calculate all using one timezone consistently

---

### 8. "DAYS AGO" CALCULATION INCONSISTENCY ⚠️ FAN PROFILE ISSUE

**Example from User:**
```
First tip: Dec 16, 2025
Last tip: Dec 16, 2025
Days ago: 265 days ago
```

Both tips on same date but "265 days ago" is shown.

**Issue:**
- "265 days ago" should be calculated from today's date
- If today is 2026-09-08, and last tip is 2025-12-16:
  - Days = 2026-09-08 minus 2025-12-16 = ~265 days ✓ Math checks out
  
But the display is confusing because both "first tip" and "last tip" show 2025-12-16, implying same day, but then "265 days ago" references only "last tip".

**Root Issue:**
Calculation might be using UTC dates while display is using creator-local dates. Or vice versa.

**Solution Required:**
1. Verify timestamps: raw vs converted
2. Ensure both first-tip and last-tip displays use same timezone
3. Verify "days ago" uses current application time (not server time)
4. Add timezone to Fan Profile display: "Last tip: Dec 16, 2025 (your timezone)"
5. Add regression test: same fan viewed in different creator timezones shows same "days ago"

---

### 9. "NOT ENOUGH DATA YET" STATE INCONSISTENCY ⚠️ CALCULATION ISSUE

**Example from User:**
```
Avg days between tips: "Not enough data yet"
```

**Issue:**
- This fan has 2 tips
- 2 tips = 1 gap = 265 days gap
- Average = 265 days

Why is this shown as "Not enough data"?

**Possible Reasons:**
1. Arbitrary threshold: requires 3+ tips to calculate average
2. Threshold: requires gap > 7 days (removed in Phase D)
3. No gap calculation performed
4. "Not enough data" is placeholder when calculation fails

**Solution Required:**
1. Verify actual threshold/rule for when to show average
2. If 2 tips = insufficient for average, document this rule
3. If 3+ required, use that consistently
4. If calculation fails, show error, not vague placeholder
5. Regression test: fan with 2 tips shows exact average days or honest insufficient-data state

---

## SUMMARY OF ISSUES

| Issue | Severity | Type | Affected Metric | Status |
|-------|----------|------|-----------------|--------|
| Browser timezone instead of creator timezone | 🔴 CRITICAL | Data | All creator-facing time analytics | BLOCKING |
| Stale Shark tier references | 🟡 HIGH | Display | Fan tier display | BLOCKING |
| UTC vs creator timezone in some calculations | 🟡 HIGH | Data | Hour/day patterns, peak hours | BLOCKING |
| Session duration source unclear | 🟡 HIGH | Data | Platform hourly rate | BLOCKING |
| Missing AM/PM in displays | 🟠 MEDIUM | Display | Time recommendations | FIXABLE |
| "Locked" Best Time threshold unexplained | 🟠 MEDIUM | Logic | Best Time feature | FIXABLE |
| Monthly boundaries timezone dependent | 🟠 MEDIUM | Data | Monthly growth | FIXABLE |
| Days ago calculation inconsistency | 🟠 MEDIUM | Data | Fan Profile | FIXABLE |
| Not enough data thresholds | 🟠 MEDIUM | Logic | Evidence quality | FIXABLE |

---

## BEFORE/AFTER VERIFICATION NEEDED

### Example 1: Creator in PST
- **Before:** "Best time: 9:00 (calculated using EST browser timezone)"
- **After:** "Best time: 6:00 PM PST (calculated using creator's PST timezone)"

### Example 2: MFC Hourly Rate
- **Before:** "$116 total / 1 hour = $87.99/hr" ❌
- **After:** "$116 total / [actual hours from database or tips] = [correct rate]/hr" ✓

### Example 3: Shark Tier
- **Before:** Fan Profile shows "Shark" for $35/1-tip fan
- **After:** Fan Profile shows "New" for same fan

---

## NEXT STEPS

1. **Identify creator timezone source:** Database field, profile, or Supabase schema
2. **Create timezone utility:** Single canonical function for all creator-timezone conversions
3. **Remove Shark references:** Replace with correct tier display logic
4. **Audit streaming duration:** Document whether tip-inferred or database-sourced
5. **Replace UTC calls:** Replace getUTCHours/getUTCDay with timezone-aware functions
6. **Add AM/PM:** Update all time displays
7. **Verify calculations:** Trace each discrepancy to source
8. **Add regression tests:** Cover timezone conversions, DST, UTC rollover
9. **Document limitations:** If tip-inferred duration is unavoidable, clearly state this

---

**DO NOT ADD NEW FEATURES UNTIL THESE ISSUES ARE RESOLVED**

The "Your Next Best Move" feature and carousel cannot be reliably added until:
- Creator timezone is correctly determined (not browser timezone)
- All time calculations use creator timezone consistently
- Stale tier references are removed
- All time displays include AM/PM
- Calculation discrepancies (like MFC $87.99/hr) are resolved

