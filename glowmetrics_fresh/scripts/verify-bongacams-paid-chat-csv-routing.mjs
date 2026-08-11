// Standalone verification for the paid-chat/spy-mode CSV-file-upload
// routing (lib/analytics.js's parseWithHeaders + detectPaidSessionType,
// and app/api/upload/route.js's tips/paid_sessions split), across all
// three platforms (BongaCams, Chaturbate, MyFreeCams).
//
// This repo has no test framework configured (no jest/vitest, no "test"
// script in package.json), and lib/analytics.js can't be `import`-ed
// directly by plain Node because it's authored as ESM (`export function`)
// inside a CommonJS-default package (Node resolves the imported file's own
// module type from the nearest package.json, which has no "type": "module").
// scripts/verify-estimated-hourly-rate.mjs hit the same wall and solved it
// by mirroring the real logic — this script follows that same precedent.
//
// Keep the mirrored functions below in sync with lib/analytics.js /
// app/api/upload/route.js if that logic changes, or replace this with a
// real test runner (vitest has zero config overhead) if the project adopts
// one — see the header comment in verify-estimated-hourly-rate.mjs.

// ── Mirrors lib/constants.js tokenRate() ────────────────────────────────
const PLATFORM_TOKEN_RATES = { Chaturbate: 0.05, BongaCams: 0.025, MyFreeCams: 0.05, Stripchat: 0.05, CamSoda: 0.05 }
const DEFAULT_TOKEN_RATE = 0.05
const PLATFORM_TOKEN_RATES_LOWER = Object.fromEntries(
  Object.entries(PLATFORM_TOKEN_RATES).map(([k, v]) => [k.toLowerCase(), v])
)
function tokenRate(platform) {
  if (!platform) return DEFAULT_TOKEN_RATE
  return PLATFORM_TOKEN_RATES_LOWER[platform.toLowerCase()] ?? DEFAULT_TOKEN_RATE
}

// ── Mirrors lib/analytics.js's PAID_SESSION_TYPE_PATTERNS + detectPaidSessionType() ─
// Keyword-based (not exact-string) so it matches every platform's own label
// text: BongaCams ("Private Chat"/"Full-Private Chat"/"Group Chat"/"Spy
// Mode"), Chaturbate & MyFreeCams ("Private Show"/"Spy Show"/"Group Show").
const PAID_SESSION_TYPE_PATTERNS = [
  { re: /full[\s-]?private/i, label: 'Full-Private Chat' },
  { re: /private/i,           label: 'Private Chat' },
  { re: /spy/i,                label: 'Spy Mode' },
  { re: /group/i,              label: 'Group Chat' },
]
function detectPaidSessionType(tipType) {
  if (!tipType) return null
  const found = PAID_SESSION_TYPE_PATTERNS.find(p => p.re.test(tipType))
  return found ? found.label : null
}

// Mirrors the relevant slice of parseWithHeaders(): given an already
// header-mapped row (tip_type == the "Chat Type"/"Transaction Type" column,
// tokens == "Tokens Earned", usd == "Your Payout"), returns the same
// tokens/usd/is_paid_session/session_type fields parseCSV() would produce.
function classifyRow({ tip_type = '', tokens = 0, usd = 0, platform = 'BongaCams' }) {
  const paidSessionType = detectPaidSessionType(tip_type)
  const finalTokens = tokens > 0 ? tokens : Math.round(usd / tokenRate(platform))
  const finalUsd = usd > 0 ? parseFloat(usd.toFixed(2)) : parseFloat((tokens * tokenRate(platform)).toFixed(2))
  return {
    tokens: finalTokens,
    usd: finalUsd,
    is_paid_session: !!paidSessionType,
    session_type: paidSessionType,
  }
}

// Mirrors app/api/upload/route.js's tips/paid_sessions split.
function splitRows(rows) {
  return {
    tipRows: rows.filter(r => !r.is_paid_session),
    paidSessionRows: rows.filter(r => r.is_paid_session),
  }
}

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`) }
}

// ── BongaCams: all four paid-chat types are flagged, exact literal match ──
const BC_PAID_CHAT_TYPES = ['Private Chat', 'Full-Private Chat', 'Group Chat', 'Spy Mode']
for (const t of BC_PAID_CHAT_TYPES) {
  const r = classifyRow({ tip_type: t, tokens: 200, usd: 5, platform: 'BongaCams' })
  check(`BongaCams "${t}" flagged as paid session`, { is_paid_session: r.is_paid_session, session_type: r.session_type }, { is_paid_session: true, session_type: t })
}

// ── Chaturbate & MyFreeCams: platform-native labels also flagged, ─────────
// canonicalized to the same 4 labels PrivateSessions.js's TYPE_COLORS/filter
// expect (this is the actual fix — these platforms previously fell through
// to plain tips because their label text never exactly matched BongaCams').
for (const platform of ['Chaturbate', 'MyFreeCams']) {
  check(`${platform} "Private Show" flagged as Private Chat`,
    classifyRow({ tip_type: 'Private Show', tokens: 100, usd: 5, platform }).session_type, 'Private Chat')
  check(`${platform} "Spy Show" flagged as Spy Mode`,
    classifyRow({ tip_type: 'Spy Show', tokens: 20, usd: 1, platform }).session_type, 'Spy Mode')
  check(`${platform} "Group Show" flagged as Group Chat`,
    classifyRow({ tip_type: 'Group Show', tokens: 50, usd: 2.5, platform }).session_type, 'Group Chat')
  check(`${platform} "Full Private Show" flagged as Full-Private Chat`,
    classifyRow({ tip_type: 'Full Private Show', tokens: 300, usd: 15, platform }).session_type, 'Full-Private Chat')
}

// ── Case-insensitive match ─────────────────────────────────────────────────
check('"spy mode" (lowercase) matches Spy Mode',
  classifyRow({ tip_type: 'spy mode', tokens: 10, usd: 1 }).session_type, 'Spy Mode')
check('"PRIVATE CHAT" (uppercase) matches Private Chat',
  classifyRow({ tip_type: 'PRIVATE CHAT', tokens: 10, usd: 1 }).session_type, 'Private Chat')
check('"private show" (lowercase, Chaturbate wording) matches Private Chat',
  classifyRow({ tip_type: 'private show', tokens: 10, usd: 1, platform: 'Chaturbate' }).session_type, 'Private Chat')

// ── Regular tip rows are NOT flagged, and continue to tips unchanged ──────
for (const t of ['Tip', 'Tips', 'Freechat', 'Sale', '']) {
  const r = classifyRow({ tip_type: t, tokens: 500, usd: 12.5 })
  check(`tip_type "${t || '(empty)'}" is not a paid session`, r.is_paid_session, false)
}

// ── usd from "Your Payout" is used as-is when present, not recalculated ───
{
  const r = classifyRow({ tip_type: 'Private Chat', tokens: 1000, usd: 45.5, platform: 'BongaCams' })
  // 1000 tokens * 0.025 would be $25 — trusted payout of $45.50 must win.
  check('trusted usd (45.50) is used as-is, not tokens*0.025 (25.00)', r.usd, 45.5)
}

// ── tokenRate('bongacams') fallback ONLY when usd is missing/zero ─────────
{
  const r = classifyRow({ tip_type: 'Spy Mode', tokens: 40, usd: 0, platform: 'BongaCams' })
  check('usd=0 falls back to tokens(40) * tokenRate(bongacams)(0.025) = 1.00', r.usd, 1.0)
}
{
  const r = classifyRow({ tip_type: 'Group Chat', tokens: 0, usd: 3, platform: 'BongaCams' })
  check('tokens=0 falls back to usd(3) / tokenRate(bongacams)(0.025) = 120', r.tokens, 120)
}

// ── Full-file routing: mixed CSV splits tips vs paid sessions correctly ───
// Mixed across all three platforms — this is the scenario from the bug
// report (private chats from all 3 platforms not reaching paid_sessions).
{
  const rawRows = [
    { tip_type: 'Tip', tokens: 500, usd: 12.5, platform: 'BongaCams' },
    { tip_type: 'Private Chat', tokens: 300, usd: 18.75, platform: 'BongaCams' },
    { tip_type: 'Spy Mode', tokens: 20, usd: 0, platform: 'BongaCams' },
    { tip_type: 'Tip', tokens: 100, usd: 5, platform: 'Chaturbate' },
    { tip_type: 'Private Show', tokens: 400, usd: 20, platform: 'Chaturbate' },
    { tip_type: 'Spy Show', tokens: 60, usd: 3, platform: 'Chaturbate' },
    { tip_type: 'Tip', tokens: 200, usd: 10, platform: 'MyFreeCams' },
    { tip_type: 'Group Show', tokens: 150, usd: 7.5, platform: 'MyFreeCams' },
  ]
  const classified = rawRows.map(classifyRow)
  const { tipRows, paidSessionRows } = splitRows(classified)
  check('3-platform mixed file: 3 regular tip rows land in tipRows', tipRows.length, 3)
  check('3-platform mixed file: 5 private/spy/group rows land in paidSessionRows', paidSessionRows.length, 5)
  check('3-platform mixed file: no paid session types leak into tipRows',
    tipRows.some(r => r.session_type), false)
}

// ── Regression: CSV with no Chat Type column at all (row.tip_type undefined) ─
// This is the shape onboarding's paste flow already sends to /api/upload
// today (pasteToCSVBlob's `date_time,username,tokens,usd,note` header has no
// tip_type/chat_type column), and also plain non-BongaCams CSVs. Nothing
// should ever be flagged as a paid session in this case.
{
  const rawRows = [
    { tokens: 500, usd: 12.5 },
    { tokens: 1000, usd: 50 },
    { tokens: 25, usd: 1.25 },
  ]
  const classified = rawRows.map(classifyRow)
  check('no chat-type column: nothing flagged as paid session',
    classified.every(r => !r.is_paid_session), true)
  const { tipRows, paidSessionRows } = splitRows(classified)
  check('no chat-type column: all rows land in tipRows', tipRows.length, 3)
  check('no chat-type column: paidSessionRows is empty', paidSessionRows.length, 0)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
