// Generates 20 synthetic, anonymized tip-history CSVs for testing CamCash imports.
// Deterministic (seeded) so the files and expected totals never drift.
import fs from 'fs'
import path from 'path'

const OUT = process.argv[2]
fs.mkdirSync(OUT, { recursive: true })

let seed = 42
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
const pick = (a) => a[Math.floor(rnd() * a.length)]
const AMTS = [1, 1, 1, 2, 5, 5, 10, 11, 25, 50, 100]
const pad = (n) => String(n).padStart(2, '0')
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const ord = (d) => d + ((d % 10 === 1 && d !== 11) ? 'st' : (d % 10 === 2 && d !== 12) ? 'nd' : (d % 10 === 3 && d !== 13) ? 'rd' : 'th')
const ampm = (dt) => { let h = dt.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${pad(dt.getMinutes())} ${ap}` }
const cbDate = (dt) => `${MON[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}, ${ampm(dt)}`
const euDate = (dt) => `${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}.${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
const isoLocal = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
const mfcDate = (dt) => `${MON[dt.getMonth()]} ${ord(dt.getDate())}, ${dt.getFullYear()} ${ampm(dt)}`

// sessions: [{start: Date, minutes, tips}] → tip events spread across the session
function events(sessions, fans, amts = AMTS) {
  const out = []
  for (const s of sessions) {
    for (let i = 0; i < s.tips; i++) {
      const off = s.tips === 1 ? 0 : Math.round((s.minutes * i) / (s.tips - 1))
      out.push({ dt: new Date(s.start.getTime() + off * 60000), user: pick(fans), tokens: pick(amts) })
    }
  }
  return out.sort((a, b) => a.dt - b.dt)
}
const fansN = (n, p = 'fan') => Array.from({ length: n }, (_, i) => `${p}${pad(i + 1)}`)
function sessionsOf(n, { from = new Date(2026, 8, 1, 21, 0), everyDays = 2, minutes = 90, tips = 25 } = {}) {
  return Array.from({ length: n }, (_, i) => ({ start: new Date(from.getTime() + i * everyDays * 86400000), minutes, tips }))
}

const files = []
const add = (name, scenario, content, expect) => files.push({ name, scenario, content, expect })
const sum = (ev) => ev.reduce((a, e) => a + e.tokens, 0)

// Generic header format, Chaturbate ($0.05/token)
const generic = (ev, platform = 'Chaturbate', rate = 0.05) =>
  'Date,Platform,Username,Tokens,USD_Amount\n' + ev.map(e => `${isoLocal(e.dt)},${e.platform || platform},${e.user},${e.tokens},${(e.tokens * (e.rate || rate)).toFixed(2)}`).join('\n') + '\n'
// Native Chaturbate token-history paste format
const cbNative = (rows) => 'Date\tAction\tTokens\tToken Balance\n' + rows.map(r => `${cbDate(r.dt)}\t\n${r.action}\n${r.tokens}\t${r.bal}`).join('\n') + '\n'
// BongaCams income export
const bonga = (ev) => 'Date and Time\tMember\tType\tTokens Earned\tYour Payout\n' + ev.map(e => `${euDate(e.dt)}\t${e.user}\t${e.type || 'Tip'}\t${e.tokens}\t${(e.tokens * 0.025).toFixed(3)}`).join('\n') + '\n'

// 1–2: empty / tiny
add('01-cb-headers-only.csv', 'Header row only, no tips → "no-data" stage, no $0/NaN on screen', 'Date,Platform,Username,Tokens,USD_Amount\n', { tips: 0, tokens: 0 })
let ev = events(sessionsOf(1, { tips: 5, minutes: 20 }), fansN(3)); add('02-cb-tiny-import.csv', '5 tips, 1 short session → "tiny-import" stage, locked cards explain what is needed', generic(ev), { tips: 5, tokens: sum(ev) })
// 3–5: dashboard stages
ev = events(sessionsOf(2, { tips: 15, minutes: 60 }), fansN(8), [5, 10, 25, 50]); add('03-cb-first-valid-data.csv', '30 tips, 2 valid sessions, ≥$10 → "first-valid-data" stage', generic(ev), { tips: 30, tokens: sum(ev) })
ev = events(sessionsOf(6, { tips: 20 }), fansN(15), [5, 10, 25, 50, 100]); add('04-cb-growing-insights.csv', '120 tips, 6 valid sessions, ≥$50 → "growing-insights" stage', generic(ev), { tips: 120, tokens: sum(ev) })
ev = events(sessionsOf(12, { tips: 25 }), fansN(30), [5, 10, 25, 50, 100]); add('05-cb-full-dashboard.csv', '300 tips, 12 valid sessions, ≥$100 → "full-dashboard" stage', generic(ev), { tips: 300, tokens: sum(ev) })
// 6: whales
{ const s = sessionsOf(10, { tips: 20 }); ev = events(s, fansN(20), [1, 2, 5]); for (let i = 0; i < 12; i++) ev.push({ dt: new Date(s[i % 10].start.getTime() + 30 * 60000 + i * 1000), user: 'whale01', tokens: 200 }); for (let i = 0; i < 6; i++) ev.push({ dt: new Date(s[i].start.getTime() + 40 * 60000), user: 'shark01', tokens: 100 }); ev.sort((a, b) => a.dt - b.dt)
  add('06-cb-whale-and-shark.csv', 'whale01 = $120 over 12 tips (Whale); shark01 = $30 over 6 tips (Shark); rest small tippers', generic(ev), { tips: ev.length, tokens: sum(ev) }) }
// 7: invalid sessions
ev = events(sessionsOf(8, { tips: 6, minutes: 15 }), fansN(10)); add('07-cb-short-sessions-invalid.csv', '8 sessions of 15 min → none pass the 30-min valid-session rule; hourly rate must say "Not enough data yet"', generic(ev), { tips: 48, tokens: sum(ev) })
// 8: midnight crossing
ev = events(sessionsOf(5, { from: new Date(2026, 8, 1, 23, 15), minutes: 120, tips: 20 }), fansN(12)); add('08-cb-midnight-crossing.csv', 'Sessions 11:15 PM → 1:15 AM; one session must not split into two days', generic(ev), { tips: 100, tokens: sum(ev) })
// 9: DST
ev = events([{ start: new Date(2026, 10, 1, 0, 30), minutes: 150, tips: 30 }], fansN(10)); add('09-cb-dst-fallback.csv', 'Stream across US DST end (Nov 1, 2026 1–2 AM repeats); hours must stay on the creator clock', generic(ev), { tips: 30, tokens: sum(ev) })
// 10: duplicates
ev = events(sessionsOf(3, { tips: 20 }), fansN(10)); { const g = generic(ev); add('10-cb-duplicate-rows.csv', 'Every row appears twice → dedup must keep 60 tips, not 120', g + g.split('\n').slice(1).join('\n'), { parsedRows: 120, tipsAfterDbDedup: 60, tokens: sum(ev), note: 'parseCSV keeps all rows; insert_tips_dedup removes duplicates on import' }) }
// 11: native CB with transfers / outbound / admin
{ const rows = []; let bal = 0, earn = 0, n = 0; const base = new Date(2026, 9, 5, 20, 0)
  for (let i = 0; i < 40; i++) { const t = pick(AMTS); bal += t; earn += t; n++; rows.push({ dt: new Date(base.getTime() + i * 120000), action: `Tip From: ${pick(fansN(12))}`, tokens: t, bal })
    if (i % 10 === 9) { rows.push({ dt: new Date(base.getTime() + i * 120000 + 60000), action: `Transfer tokens to $${(bal * 0.05).toFixed(2)} cash.`, tokens: -bal, bal: 0 }); bal = 0 } }
  rows.push({ dt: new Date(base.getTime() + 81 * 120000), action: 'Outbound Tip: friend01', tokens: -1, bal: bal - 1 })
  rows.push({ dt: new Date(base.getTime() + 82 * 120000), action: 'Admin Adjustment: Deduction', tokens: -2, bal: bal - 3 })
  add('11-cb-native-with-transfers.csv', 'Native Chaturbate paste; transfers, outbound tips and admin deductions are NOT earnings', cbNative(rows.reverse()), { tips: n, tokens: earn }) }
// 12: CB private shows
{ const rows = []; let bal = 0, tip = 0, priv = 0; const base = new Date(2026, 9, 10, 21, 0)
  for (let i = 0; i < 30; i++) { const isP = i % 6 === 5; const t = isP ? 180 : pick(AMTS); bal += t; isP ? (priv += t) : (tip += t)
    rows.push({ dt: new Date(base.getTime() + i * 180000), action: isP ? `Private Show: ${pick(fansN(5))}` : `Tip From: ${pick(fansN(12))}`, tokens: t, bal }) }
  add('12-cb-native-private-shows.csv', 'Private shows mixed with tips; Top Tipper must exclude private revenue, Top Spender includes it', cbNative(rows.reverse()), { rows: 30, tokens: tip + priv, tipTokens: tip, privateTokens: priv }) }
// 13–15: BongaCams
ev = events(sessionsOf(6, { tips: 20 }), fansN(15)); add('13-bonga-free-chat.csv', 'BongaCams DD.MM.YYYY dates, $0.025/token', bonga(ev), { tips: 120, tokens: sum(ev), usdExact: +(sum(ev) * 0.025).toFixed(3), usdParsed: 63.23, note: 'parser rounds each row to cents; see README known issue' })
ev = events(sessionsOf(4, { tips: 15 }), fansN(10)).map((e, i) => ({ ...e, type: ['Tip', 'Private Chat', 'Group Chat', 'Spy Mode', 'Full-Private Chat'][i % 5] })); add('14-bonga-paid-chat-types.csv', 'Mix of Tip / Private / Full-Private / Group / Spy Mode; paid chat is not a manual tip', bonga(ev), { rows: 60, tokens: sum(ev) })
ev = events(sessionsOf(6, { from: new Date(2026, 2, 3, 21, 0), everyDays: 31, tips: 10 }), fansN(8)); add('15-bonga-day-month-ambiguous.csv', 'Dates like 03.04 must read as 3 April (DD.MM), never 4 March', bonga(ev), { tips: 60, tokens: sum(ev) })
// 16: MFC ordinal
ev = events(sessionsOf(5, { tips: 16 }), fansN(10)); add('16-mfc-ordinal-dates.csv', 'MyFreeCams "Sep 1st, 2026 9:00 PM" ordinal dates', 'Date\tPlatform\tUsername\tTokens\tUSD_Amount\n' + ev.map(e => `${mfcDate(e.dt)}\tMyFreeCams\t${e.user}\t${e.tokens}\t${(e.tokens * 0.05).toFixed(2)}`).join('\n') + '\n', { tips: 80, tokens: sum(ev) })
// 17–18: multi-platform / free limit
const multi = (plats) => { const all = []; plats.forEach((p, k) => events(sessionsOf(3, { from: new Date(2026, 9, 1 + k, 20, 0), tips: 10 }), fansN(6, p.slice(0, 2).toLowerCase())).forEach(e => all.push({ ...e, platform: p, rate: p === 'BongaCams' ? 0.025 : 0.05 }))); return all.sort((a, b) => a.dt - b.dt) }
ev = multi(['Chaturbate', 'BongaCams', 'MyFreeCams']); add('17-multi-3-platforms.csv', '3 platforms → allowed on Free (1 Primary + 2 Secondary)', generic(ev), { tips: 90, platforms: 3 })
ev = multi(['Chaturbate', 'BongaCams', 'MyFreeCams', 'Stripchat']); add('18-multi-4-platforms-free-limit.csv', '4 platforms → Free must block the 4th with the platform-limit message; Pro allows', generic(ev), { tips: 120, platforms: 4 })
// 19: 31-day window
{ const old = events(sessionsOf(4, { from: new Date(2026, 5, 1, 21, 0), tips: 10 }), fansN(6)).map(e => ({ ...e, platform: 'BongaCams', rate: 0.025 }))
  const recent = events(sessionsOf(4, { from: new Date(2026, 9, 10, 21, 0), tips: 10 }), fansN(6)).map(e => ({ ...e, platform: 'BongaCams', rate: 0.025 }))
  ev = [...old, ...recent]; add('19-secondary-older-than-31-days.csv', 'Secondary platform with June + October data → Free shows only the last 31 days; Pro shows all', generic(ev), { tips: 80, recentTips: 40 }) }
// 20: malformed
add('20-malformed-rows.csv', 'Bad date, missing tokens, text in tokens, negative, blank line, extra column → bad rows skipped, no crash, no NaN',
  'Date,Platform,Username,Tokens,USD_Amount\n2026-10-01 21:00,Chaturbate,fan01,10,0.50\nnot-a-date,Chaturbate,fan02,5,0.25\n2026-10-01 21:05,Chaturbate,fan03,,\n2026-10-01 21:06,Chaturbate,fan04,abc,\n\n2026-10-01 21:07,Chaturbate,fan05,-5,-0.25\n2026-10-01 21:08,Chaturbate,fan06,25,1.25,EXTRA\n2026-10-01 21:30,Chaturbate,fan01,5,0.25\n', { parsedRows: 3, tokens: 40, note: 'keeps fan01 x2 and fan06 (extra column ignored); drops bad date, blank, text and negative tokens' })

for (const f of files) fs.writeFileSync(path.join(OUT, f.name), f.content)
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(files.map(({ name, scenario, expect }) => ({ name, scenario, expect })), null, 2) + '\n')
console.log(files.length, 'files')
