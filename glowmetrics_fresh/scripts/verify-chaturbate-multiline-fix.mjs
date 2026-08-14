// Regression tests for the Chaturbate multi-line paste-parsing fix.
//
// Real funnel data (analytics_events, queried directly): of 56
// onboarding_paste_parse_failed events, 49 were Chaturbate — by far the
// single largest activation blocker in the product. This script covers the
// two confirmed root causes found by comparing the client-side preview
// parser (app/onboarding/page.js's parseRows) against the server-side
// import parser (lib/analytics.js's parseChaturbateMultiLine):
//
//   1. Day-of-month ordinal suffixes ("Jun 18th, 2026, 8:27 PM") — the
//      client accepted these but the server did not, so some pastes showed
//      a successful preview and then silently imported zero/fewer rows —
//      invisible in the failure metrics, since onboarding_paste_parse_failed
//      only fires on the client preview step.
//   2. A running-balance number over 999 formatted with a thousands-comma
//      ("500  12,345") — same bug class already fixed for BongaCams
//      (scripts/verify-bongacams-tokens-thousands-separator.mjs), which
//      neither Chaturbate parser handled.
//
// Also covers a tokens-only line (no running balance) as an added fallback.
//
// Mirrors both parsers exactly (same convention as the repo's other
// verify-*.mjs scripts — no test framework, ESM/CJS boundary issue), run
// against the SAME fixture text in both to prove client preview and server
// import now agree.

const CB_MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 }

// ── mirrors lib/analytics.js (server / actual import) ──────────────────────
const CB_DATE_LINE_RE_SERVER = /^([A-Za-z]{3})\s+(\d{1,2})(?:st|nd|rd|th)?,\s+(\d{4}),\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i
const CB_TIP_FROM_RE = /^Tip From:\s*(.+)$/i
const CB_TOKENS_LINE_RE = /^([\d,]+)\s+([\d,]+)$/
const CB_TOKENS_SINGLE_RE = /^([\d,]+)$/

function parseChaturbateMultiLine_SERVER(lines) {
  const results = []
  let i = 0
  while (i < lines.length) {
    const dateMatch = lines[i].trim().match(CB_DATE_LINE_RE_SERVER)
    if (!dateMatch) { i++; continue }
    const [, mon, day, year, hr, min, ampm] = dateMatch
    const actionLine = (lines[i + 1] || '').trim()
    const tipMatch = actionLine.match(CB_TIP_FROM_RE)
    if (!tipMatch) { i++; continue }
    const username = tipMatch[1].trim()
    let tokensLine = (lines[i + 2] || '').trim()
    let tMatch = tokensLine.match(CB_TOKENS_LINE_RE)
    let singleMatch = !tMatch ? tokensLine.match(CB_TOKENS_SINGLE_RE) : null
    if (!tMatch && !singleMatch && lines[i + 3]) {
      tokensLine = (lines[i + 3] || '').trim()
      tMatch = tokensLine.match(CB_TOKENS_LINE_RE)
      singleMatch = !tMatch ? tokensLine.match(CB_TOKENS_SINGLE_RE) : null
    }
    const tokensRaw = tMatch ? tMatch[1] : (singleMatch ? singleMatch[1] : null)
    if (tokensRaw) {
      const tokens = parseInt(tokensRaw.replace(/,/g, ''), 10)
      if (username && tokens >= 1) {
        let h = parseInt(hr, 10)
        if (/pm/i.test(ampm) && h !== 12) h += 12
        if (/am/i.test(ampm) && h === 12) h = 0
        const monthNum = CB_MONTHS[mon.toLowerCase()] || 1
        const dateRaw = `${year}-${String(monthNum).padStart(2, '0')}-${String(parseInt(day, 10)).padStart(2, '0')} ${String(h).padStart(2, '0')}:${min}:00`
        results.push({ dateRaw, username, tokens })
      }
    }
    i++
  }
  return results
}

// ── mirrors app/onboarding/page.js (client / preview) ───────────────────────
function tryParseDate_CLIENT(str) {
  const s = (str || '').trim()
  const cbMatch = s.match(/^([A-Za-z]{3})\s+(\d{1,2})(?:st|nd|rd|th)?,\s+(\d{4}),\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i)
  if (cbMatch) {
    const [, mon, day, year, hr, min, ampm] = cbMatch
    let h = parseInt(hr, 10)
    if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12
    if (ampm.toUpperCase() === 'AM' && h === 12) h = 0
    const d = new Date(parseInt(year), CB_MONTHS[mon.toLowerCase()] - 1, parseInt(day), h, parseInt(min))
    if (!isNaN(d.getTime())) return d
  }
  return null
}
const dateLineRe_CLIENT = /^([A-Za-z]{3}\s+\d{1,2}(?:st|nd|rd|th)?,\s+\d{4},\s+\d{1,2}:\d{2}\s+[AP]M)/i
const tipFromRe_CLIENT = /^Tip From:\s*(.+)/i
const tokensLineRe_CLIENT = /^([\d,]+)\s+([\d,]+)$/
const tokensSingleRe_CLIENT = /^([\d,]+)$/

function parseRows_CLIENT(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)
  const rows = []
  let i = 0
  while (i < lines.length) {
    const dateMatch = lines[i].match(dateLineRe_CLIENT)
    if (dateMatch) {
      const ts = tryParseDate_CLIENT(dateMatch[1])
      const actionLine = lines[i + 1] || ''
      const tipMatch = actionLine.match(tipFromRe_CLIENT)
      if (ts && tipMatch) {
        const username = tipMatch[1].trim()
        let tokensLine = lines[i + 2] || ''
        let tMatch = tokensLine.match(tokensLineRe_CLIENT)
        let singleMatch = !tMatch ? tokensLine.match(tokensSingleRe_CLIENT) : null
        if (!tMatch && !singleMatch && lines[i + 3]) {
          tokensLine = lines[i + 3] || ''
          tMatch = tokensLine.match(tokensLineRe_CLIENT)
          singleMatch = !tMatch ? tokensLine.match(tokensSingleRe_CLIENT) : null
        }
        const tokensRaw = tMatch ? tMatch[1] : (singleMatch ? singleMatch[1] : null)
        if (tokensRaw) {
          const tokens = parseInt(tokensRaw.replace(/,/g, ''), 10)
          if (tokens >= 1) rows.push({ ts, username, tokens })
        }
      }
      i++
    } else i++
  }
  return rows
}

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`) }
}

// ══════════════════════════════════════════════════════════════════════
// 1. Baseline format (already worked before this fix) — must still work.
// ══════════════════════════════════════════════════════════════════════
{
  const text = 'Jun 18, 2026, 8:27 PM\nTip From: username123\n500  12345'
  const server = parseChaturbateMultiLine_SERVER(text.split('\n'))
  const client = parseRows_CLIENT(text)
  check('baseline: server parses 1 row', server.length, 1)
  check('baseline: client parses 1 row', client.length, 1)
  check('baseline: server tokens correct', server[0].tokens, 500)
}

// ══════════════════════════════════════════════════════════════════════
// 2. Ordinal day suffix — root cause #1. Previously: client parsed it,
//    server silently dropped it (preview/import divergence bug).
// ══════════════════════════════════════════════════════════════════════
{
  const text = 'Jun 18th, 2026, 8:27 PM\nTip From: username123\n500  12345'
  const server = parseChaturbateMultiLine_SERVER(text.split('\n'))
  const client = parseRows_CLIENT(text)
  check('ordinal suffix: server now parses 1 row (previously 0 — the silent-drop bug)', server.length, 1)
  check('ordinal suffix: client parses 1 row', client.length, 1)
  check('ordinal suffix: server and client now AGREE', server.length, client.length)
}

// ══════════════════════════════════════════════════════════════════════
// 3. Thousands-comma in the running balance — root cause #2.
// ══════════════════════════════════════════════════════════════════════
{
  const text = 'Jun 18, 2026, 8:27 PM\nTip From: whaleking99\n500  12,345'
  const server = parseChaturbateMultiLine_SERVER(text.split('\n'))
  const client = parseRows_CLIENT(text)
  check('thousands-comma balance: server now parses 1 row', server.length, 1)
  check('thousands-comma balance: tokens correctly read as 500 (not truncated)', server[0]?.tokens, 500)
  check('thousands-comma balance: client parses 1 row', client.length, 1)
}

// ══════════════════════════════════════════════════════════════════════
// 4. Thousands-comma in the TOKEN count itself (e.g. a $50+ single tip).
// ══════════════════════════════════════════════════════════════════════
{
  const text = 'Jun 18, 2026, 8:27 PM\nTip From: whaleking99\n1,500  12,345'
  const server = parseChaturbateMultiLine_SERVER(text.split('\n'))
  check('thousands-comma token count: correctly parsed as 1500, not truncated to 1', server[0]?.tokens, 1500)
}

// ══════════════════════════════════════════════════════════════════════
// 5. Tokens-only line (no running balance shown) — added fallback.
// ══════════════════════════════════════════════════════════════════════
{
  const text = 'Jun 18, 2026, 8:27 PM\nTip From: username123\n500'
  const server = parseChaturbateMultiLine_SERVER(text.split('\n'))
  const client = parseRows_CLIENT(text)
  check('tokens-only line: server now parses 1 row', server.length, 1)
  check('tokens-only line: tokens correct', server[0]?.tokens, 500)
  check('tokens-only line: client parses 1 row', client.length, 1)
}

// ══════════════════════════════════════════════════════════════════════
// 6. Multi-tip paste with mixed variants — the realistic case: several tips
//    pasted together, some with ordinals, some with comma balances.
// ══════════════════════════════════════════════════════════════════════
{
  const text = [
    'Jun 18, 2026, 8:27 PM', 'Tip From: username123', '500  12345', '',
    'Jun 18th, 2026, 9:14 PM', 'Tip From: whaleking99', '1,000  13,345', '',
    'Jun 19, 2026, 10:02 AM', 'Tip From: regularfan', '25',
  ].join('\n')
  const server = parseChaturbateMultiLine_SERVER(text.split('\n'))
  const client = parseRows_CLIENT(text)
  check('mixed-variant paste: server parses all 3 tips', server.length, 3)
  check('mixed-variant paste: client parses all 3 tips', client.length, 3)
  check('mixed-variant paste: server and client agree on total tokens', server.reduce((s, r) => s + r.tokens, 0), client.reduce((s, r) => s + r.tokens, 0))
  check('mixed-variant paste: total tokens correct (500+1000+25)', server.reduce((s, r) => s + r.tokens, 0), 1525)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
