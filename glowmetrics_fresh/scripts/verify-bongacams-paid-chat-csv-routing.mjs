// Standalone verification for the BongaCams paid-chat/spy-mode CSV-file-
// upload routing fix (lib/analytics.js's parseWithHeaders + BC_PAID_CHAT_TYPES,
// and app/api/upload/route.js's tips/paid_sessions split).
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

// ── Mirrors lib/analytics.js's BC_PAID_CHAT_TYPES + parseWithHeaders' match ─
const BC_PAID_CHAT_TYPES = ['Private Chat', 'Full-Private Chat', 'Group Chat', 'Spy Mode']
function matchBCPaidChatType(tipTypeLower) {
  return BC_PAID_CHAT_TYPES.find(t => t.toLowerCase() === tipTypeLower) || null
}

// Mirrors the relevant slice of parseWithHeaders(): given an already
// header-mapped row (tip_type == the "Chat Type"/"Transaction Type" column,
// tokens == "Tokens Earned", usd == "Your Payout"), returns the same
// tokens/usd/is_paid_session/session_type fields parseCSV() would produce.
function classifyRow({ tip_type = '', tokens = 0, usd = 0, platform = 'BongaCams' }) {
  const tipType = tip_type.toLowerCase()
  const bcPaidChatType = matchBCPaidChatType(tipType)
  const finalTokens = tokens > 0 ? tokens : Math.round(usd / tokenRate(platform))
  const finalUsd = usd > 0 ? parseFloat(usd.toFixed(2)) : parseFloat((tokens * tokenRate(platform)).toFixed(2))
  return {
    tokens: finalTokens,
    usd: finalUsd,
    is_paid_session: !!bcPaidChatType,
    session_type: bcPaidChatType,
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

// ── All four paid-chat types are flagged, exact literal match ─────────────
for (const t of BC_PAID_CHAT_TYPES) {
  const r = classifyRow({ tip_type: t, tokens: 200, usd: 5, platform: 'BongaCams' })
  check(`"${t}" flagged as paid session`, { is_paid_session: r.is_paid_session, session_type: r.session_type }, { is_paid_session: true, session_type: t })
}

// ── Case-insensitive match ─────────────────────────────────────────────────
check('"spy mode" (lowercase) matches Spy Mode',
  classifyRow({ tip_type: 'spy mode', tokens: 10, usd: 1 }).session_type, 'Spy Mode')
check('"PRIVATE CHAT" (uppercase) matches Private Chat',
  classifyRow({ tip_type: 'PRIVATE CHAT', tokens: 10, usd: 1 }).session_type, 'Private Chat')

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
{
  const rawRows = [
    { tip_type: 'Tip', tokens: 500, usd: 12.5 },
    { tip_type: 'Private Chat', tokens: 300, usd: 18.75 },
    { tip_type: 'Spy Mode', tokens: 20, usd: 0 },
    { tip_type: 'Tips', tokens: 100, usd: 2.5 },
    { tip_type: 'Full-Private Chat', tokens: 800, usd: 60 },
    { tip_type: 'Group Chat', tokens: 50, usd: 3.5 },
  ]
  const classified = rawRows.map(classifyRow)
  const { tipRows, paidSessionRows } = splitRows(classified)
  check('mixed file: 2 regular tip rows land in tipRows', tipRows.length, 2)
  check('mixed file: 4 paid-chat/spy rows land in paidSessionRows', paidSessionRows.length, 4)
  check('mixed file: no paid session types leak into tipRows',
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
