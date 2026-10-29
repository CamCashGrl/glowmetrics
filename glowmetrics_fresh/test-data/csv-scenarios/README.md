# Test CSV scenarios (20 files)

Synthetic, anonymized tip histories for testing imports, dashboard stages, plan limits and edge cases.
Not real data: usernames are `fan01`-style pseudonyms. Expected values for each file are in `manifest.json`.

Regenerate (the output is deterministic):

```bash
cd glowmetrics_fresh && TZ=America/New_York node test-data/generate-csv-scenarios.mjs test-data/csv-scenarios
```

| # | File | What it tests |
|---|---|---|
| 01 | cb-headers-only | No tips: "no-data" stage, never $0/NaN on screen |
| 02 | cb-tiny-import | 5 tips: "tiny-import" stage |
| 03 | cb-first-valid-data | 30 tips, 2 valid sessions: "first-valid-data" |
| 04 | cb-growing-insights | 120 tips, 6 sessions: "growing-insights" |
| 05 | cb-full-dashboard | 300 tips, 12 sessions: "full-dashboard" |
| 06 | cb-whale-and-shark | Whale ($120 / 12 tips) and Shark ($30 / 6 tips) tiers |
| 07 | cb-short-sessions-invalid | 15-min sessions: fail the 30-min valid-session rule |
| 08 | cb-midnight-crossing | 11:15 PM to 1:15 AM sessions stay one session |
| 09 | cb-dst-fallback | Stream across US daylight-saving end, Nov 1 2026 |
| 10 | cb-duplicate-rows | Every row twice: database dedup must keep 60 |
| 11 | cb-native-with-transfers | Native Chaturbate paste: transfers, outbound tips, admin deductions are not earnings |
| 12 | cb-native-private-shows | Private shows: excluded from Top Tipper, included in Top Spender |
| 13 | bonga-free-chat | BongaCams DD.MM.YYYY dates, $0.025/token |
| 14 | bonga-paid-chat-types | Tip / Private / Full-Private / Group / Spy Mode |
| 15 | bonga-day-month-ambiguous | 03.04 must read as 3 April |
| 16 | mfc-ordinal-dates | MyFreeCams "Sep 1st, 2026" dates |
| 17 | multi-3-platforms | 3 platforms: allowed on Free |
| 18 | multi-4-platforms-free-limit | 4 platforms: Free blocks the 4th, Pro allows |
| 19 | secondary-older-than-31-days | Free shows only the last 31 days of a secondary platform |
| 20 | malformed-rows | Bad rows skipped without crashing |

## Checked against the real parser (`parseCSV`, Oct 29, 2026)
Row counts and token totals matched the expected values in all 20 files. No NaN amounts were found.

## Known issue found (not fixed, needs owner approval)
BongaCams payouts are rounded to whole cents on every row (`lib/analytics.js`, `usd.toFixed(2)`).
A 1-token tip ($0.025) is stored as $0.03, which is 20% too high for that tip. On file 13 the total
comes out as $63.23 instead of the exact $62.90 (+0.5%). Odd-token BongaCams tips are inflated.
