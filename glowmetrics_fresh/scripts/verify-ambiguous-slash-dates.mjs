// Regression: ambiguous slash dates (D/M/YY) were read US month-first.
//
// FOUND ON A REAL UPLOAD. A BongaCams export mixed two formats:
//
//   29.06.2024 20:55   DD.MM.YYYY  — day-first, 1,305 rows
//   5/7/24 10:55       D/M/YY      — day-first, 607 rows (31.7% of the file)
//
// normalizeDate() only handled the dot form. The slash rows fell through to
// new Date(), which always reads them month-first, so day and month were
// swapped on a third of the file. The file is chronologically ordered, which
// pins the true orientation beyond doubt:
//
//   "5/7/24" sits immediately AFTER "29.06.2024"  -> 5 July, not 7 May
//   "5/1/26" sits between "17.12.2025" and "26.01.2026" -> 5 Jan 2026, not 1 May
//
// That last row became 1 May 2026 — four months past the creator's newest real
// tip. The Free window anchors on each platform's newest row, so it landed on
// an empty future range and the dashboard reported "1 tip · $7.16" after a
// 1,912-row import. Correctly parsed, the same window holds 13 tips.
//
// Run: node --import ./scripts/e2e-loader.mjs scripts/verify-ambiguous-slash-dates.mjs

import { parseCSV, detectPlatform, inferSlashDateOrientation } from '../lib/analytics.js'
import { splitFreeHistory } from '../lib/planLimits.js'

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`) }
}
const HDR = 'DATE,USERNAME,BONGACAMS,tokens,usd\n'
const row = (d, u = 'fan', tok = 2, usd = '0.08') => `${d},${u},Tips,${tok}, $${usd} \n`
const dates = (csv, platform = 'BongaCams') => parseCSV(csv, platform).map(r => r.date_time)

// ── Orientation inference ───────────────────────────────────────────────
check('a component >12 in position 1 proves day-first',
  inferSlashDateOrientation('25/7/24 10:00') === true)
check('a component >12 in position 2 proves month-first',
  inferSlashDateOrientation('7/25/24 10:00') === false)
check('all-ambiguous falls back to day-first (non-US platforms)',
  inferSlashDateOrientation('5/7/24 10:00') === true)
check('a contradictory file still resolves rather than throwing',
  typeof inferSlashDateOrientation('25/7/24 10:00\n7/25/24 10:00') === 'boolean')
check('empty input is safe', inferSlashDateOrientation('') === true)
check('unambiguous evidence beats position in the file',
  inferSlashDateOrientation('5/7/24 10:00\n25/7/24 10:00') === true)

// ── The parse itself ────────────────────────────────────────────────────
check('a day-first slash date is read day-first',
  dates(HDR + row('5/7/24 10:55'))[0] === '07/05/2024 10:55',
  dates(HDR + row('5/7/24 10:55'))[0])
check('dot-format rows are unaffected',
  dates(HDR + row('14.06.2024 15:49'))[0] === '06/14/2024 15:49',
  dates(HDR + row('14.06.2024 15:49'))[0])
check('a mixed file keeps BOTH row kinds',
  dates(HDR + row('14.06.2024 15:49') + row('5/7/24 10:55')).length === 2)
check('a file whose slash rows prove month-first is read month-first',
  dates(HDR + row('7/25/24 10:00') + row('5/7/24 11:00'))[1] === '05/07/2024 11:00',
  dates(HDR + row('7/25/24 10:00') + row('5/7/24 11:00'))[1])
check('2-digit years resolve to this century', dates(HDR + row('5/1/26 13:22'))[0] === '01/05/2026 13:22',
  dates(HDR + row('5/1/26 13:22'))[0])
check('4-digit slash years also work', dates(HDR + row('5/7/2024 10:55'))[0] === '07/05/2024 10:55',
  dates(HDR + row('5/7/2024 10:55'))[0])

// ── IDEMPOTENCY — the bug that broke the first attempt ──────────────────
// normalizeDate() runs twice on the same value (per-platform parser, then
// normalizeTip). A non-idempotent branch swapped day/month back on pass two
// and turned "06/14/2024" into month 14, silently dropping every dot row.
{
  const dot = dates(HDR + row('14.06.2024 15:49'))
  check('IDEMPOTENCY: a dot row survives double normalisation', dot.length === 1, JSON.stringify(dot))
  check('IDEMPOTENCY: its month is not corrupted past 12',
    dot[0] && Number(dot[0].slice(0, 2)) <= 12, dot[0])
  const sl = dates(HDR + row('5/7/24 10:55'))
  check('IDEMPOTENCY: a slash row is not swapped back on the second pass',
    sl[0] === '07/05/2024 10:55', sl[0])
  check('IDEMPOTENCY: every parsed date is a real Date',
    [...dot, ...sl].every(d => Number.isFinite(Date.parse(d))))
}

// ── The exact production scenario, reconstructed ────────────────────────
// Chronologically ordered, mixing both formats, with the outlier that broke it.
{
  const csv = HDR +
    row('17.12.2025 21:09', 'nyc89', 5, '0.12') +
    row('5/1/26 13:22', 'daddy7733', 300, '7.16') +   // 5 Jan 2026
    row('26.01.2026 16:55', 'daddy7733', 1, '0.02')
  const rows = parseCSV(csv, 'BongaCams')
  check('all three rows parse', rows.length === 3, `${rows.length}`)
  const ms = rows.map(r => Date.parse(r.date_time)).sort((a, b) => a - b)
  check('the outlier no longer lands in the future',
    new Date(ms.at(-1)).getUTCFullYear() === 2026 && new Date(ms.at(-1)).getUTCMonth() === 0,
    new Date(ms.at(-1)).toISOString())
  check('chronological order in the file is preserved after parsing',
    ms[0] < ms[1] && ms[1] < ms[2],
    ms.map(m => new Date(m).toISOString().slice(0, 10)).join(' < '))

  // Anchored on the real newest row (26 Jan 2026), the window opens 26 Dec
  // 2025 — so the 17 Dec row is correctly outside it and the other two are in.
  // Pre-fix the anchor was 1 May 2026, which stranded ALL THREE.
  const { visible, excluded } = splitFreeHistory(rows, null)
  check('the Free window is anchored on the real newest row, not a phantom',
    visible.length === 2 && excluded.length === 1,
    `visible=${visible.length} excluded=${excluded.length}`)
  check('the phantom anchor would have stranded every row',
    Date.parse('2026-05-01') - 31 * 86400000 > Date.parse('2026-01-26'))
}

// The pre-fix failure mode, stated as a property: a single mis-parsed row
// four months ahead drags the window off every real row.
{
  const DAY = 86400000
  const real = Date.parse('2026-01-26T00:00:00Z')
  const phantom = Date.parse('2026-05-01T00:00:00Z')
  check('a phantom future row would strand a 31-day window (why this mattered)',
    phantom - 31 * DAY > real)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
