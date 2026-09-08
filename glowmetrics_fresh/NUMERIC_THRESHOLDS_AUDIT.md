# Numeric Thresholds Audit — INVENTED vs LOCKED

**Critical Finding:** Several numeric thresholds were added without explicit approval.

---

## LOCKED THRESHOLDS (Approved) ✅

```
- Whale = $50+ lifetime revenue
- Regular = 11+ distinct qualifying tipping sessions
- Regular requires activity within latest 6 months of dataset
- Canonical session gap = 60 minutes
```

---

## INVENTED THRESHOLDS (NOT APPROVED) ❌

### 1. **Relative Value Cutoff for Resurfacing: >= 50**
**Location:** lib/analytics.js:620
```javascript
const isMeaningful = f.tier === 'Whale' || f.tier === 'Regular' || f.relativeValue >= 50
```

**Status:** ❌ NOT APPROVED  
**Used For:** Filtering which fans are eligible for resurfacing detection  
**Rationale Provided:** None (invented threshold)  
**Impact:** Only fans in top 50 percentile can be detected as resurfacing (below that are ignored)  
**Decision Needed:** 
- Keep threshold and define it
- Remove threshold (all non-Whale/Regular fans eligible for resurfacing)
- Use different percentile (75? 60? None?)

---

### 2. **Minimum Tip History for Resurfacing: 4 tips**
**Location:** lib/analytics.js:624, 633
```javascript
if (!f.tips || f.tips.length < 4) return
```

**Status:** ❌ NOT APPROVED  
**Used For:** Rejecting fans with fewer than 4 tips from resurfacing  
**Rationale Provided:** "Must have sufficient tip history to detect a gap" (vague)  
**Impact:** Fans with 1, 2, or 3 tips never detected as resurfacing  
**Decision Needed:**
- What is the minimum tip count required?
- Or remove the check entirely?

---

### 3. **Recent Activity Window: 7 days**
**Location:** lib/analytics.js:659
```javascript
if (f.daysSinceLastTip > 7) return
```

**Status:** ❌ NOT APPROVED (CRITICAL)  
**Used For:** Defining "recent" return (resurfacing must have tipped in last 7 days)  
**Rationale Provided:** "Recent activity within last 7 days" (invented)  
**Impact:** Fan who returned 8 days ago is NOT resurfacing (even if gap was 6 months)  
**Decision Needed:**
- Is 7 days correct?
- Should this be personal history based (e.g., within 2x avgDaysBetweenTips)?
- Should there be NO time limit (gap alone is evidence of return)?

---

### 4. **High-Value Percentile for Priority: >= 75**
**Location:** lib/analytics.js:675
```javascript
} else if (f.relativeValue >= 75) {
  priority = 3
  resurfacingType = 'highValue'
}
```

**Status:** ❌ NOT APPROVED  
**Used For:** Classifying high-value returning fans (priority 3)  
**Rationale Provided:** None  
**Impact:** Only fans in top 25 percentile can be "high-value resurfacing" (priority 3)  
**Decision Needed:**
- Is 75 correct?
- Use different percentile?
- Use different criteria entirely?

---

### 5. **Maximum Display Count: 5 fans**
**Location:** app/dashboard/page.js (resurfacing display)
```javascript
const displayFans = resurfacingFans.slice(0, 5)
```

**Status:** ❌ NOT APPROVED  
**Used For:** Limiting "Welcome Back, VIPs!" card to 5 fans max  
**Rationale Provided:** None  
**Impact:** If 20 fans resurface, only 5 shown (others hidden)  
**Decision Needed:**
- Is 5 correct?
- Show all?
- Use different limit?

---

### 6. **Pro Live Mode Session Tracking**
**Location:** app/live/useResurfacingNotifications.js (seenResurfacingRef tracking)
```javascript
if (newTippersSet.has(fanKey) && !seenResurfacingRef.current.has(fanKey)) {
  seenResurfacingRef.current.add(fanKey)
  // Fire notification
}
```

**Status:** ❌ NOT FULLY SPECIFIED  
**Used For:** Firing notification only once per fan per stream session  
**Rationale Provided:** "Non-intrusive tracking" (assumed design)  
**Impact:** Same resurfacing fan tipping twice in stream gets one notification (not two)  
**Decision Needed:**
- Is this the desired behavior?
- Should every tip from resurfacing fan fire a notification?
- Should notifications be throttled per-fan (e.g., once per hour)?

---

## SUMMARY OF DECISIONS NEEDED

| Threshold | Location | Decision Required |
|-----------|----------|------------------|
| relativeValue >= 50 | lib/analytics.js:620 | Approve, change, or remove |
| tips.length < 4 | lib/analytics.js:624 | Approve, change, or remove |
| daysSinceLastTip > 7 | lib/analytics.js:659 | **CRITICAL** — Approve, change, or remove |
| relativeValue >= 75 | lib/analytics.js:675 | Approve, change, or remove |
| Display max 5 | app/dashboard/page.js | Approve, change, or remove |
| Session tracking | app/live/useResurfacingNotifications.js | Clarify behavior |

---

## RECOMMENDATION

**Do NOT ship with invented numeric thresholds.**

The 7-day "recent activity" window (line 659) is the most problematic:
- It silently rejects valid resurfacing candidates (gap of 6 months, returned 8 days ago)
- No specification exists for this threshold
- It violates the "use personal history, not invented numbers" rule

**Options:**
1. **Remove line 659 entirely** — Let gap detection alone define resurfacing (a 6-month gap IS evidence of return, regardless of when it was detected)
2. **Make it personal history based** — `if (f.daysSinceLastTip > f.avgDaysBetweenTips * 3) return` (only reject if WAY overdue even for them)
3. **Define and document it** — If 7 days is intentional, explain why in comments and get explicit approval

---

## LOCKED RULE VIOLATION

Current implementation violates the locked rule:

> "Do NOT invent, assume, or hard-code numeric thresholds that have not been explicitly approved."

All 6 thresholds above are invented and unapproved.

---

**NEXT STEP:** Clarify which thresholds to keep, change, or remove before shipping.
