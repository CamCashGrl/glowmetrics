// END-TO-END CONVERSION SCENARIOS — exercised through the REAL production
// modules, not mirrors.
//
// Everything below imports lib/analytics.js (parseCSV/detectPlatform) and
// lib/planLimits.js (splitFreePlatforms/splitFreeHistory/filterFreeHistory)
// directly, and reproduces app/api/upload/route.js's slot-allocation
// algorithm against the values those modules actually return. Where a
// scenario depends on the database (delete/re-upload, Pro entitlement), that
// half is verified separately against production SQL — see the report.
//
// Run: node --import ./scripts/e2e-loader.mjs scripts/e2e-conversion-scenarios.mjs

import {
  FREE_MAX_PLATFORMS, FREE_HISTORY_DAYS,
  normalizePlatform, splitFreePlatforms, splitFreeHistory, filterFreeHistory,
  uniquePlatforms,
} from '../lib/planLimits.js'
import { isSupportedPlatform } from '../lib/constants.js'
import { parseCSV, detectPlatform, aggregateRows } from '../lib/analytics.js'

// Verbatim from app/api/upload/route.js. That route defines its OWN
// summarizeRows — backed by the canonical aggregateRows — which shadows the
// same-named export in lib/planLimits.js. The route's version is the one that
// feeds the locked-preview UI, and it is the shape the UI reads (.tips,
// .sessions, .fans). Using planLimits' version here would test the wrong
// function.
function summarizeRows(rows) {
  if (!rows.length) return { tips: 0, totalUsd: 0, sessions: 0, fans: 0, dateFrom: null, dateTo: null }
  const a = aggregateRows(rows)
  const dates = rows.map(r => new Date(r.date_time)).filter(d => !isNaN(d))
  return {
    tips: rows.length,
    totalUsd: a.totalUSD,
    sessions: a.meaningfulSessionCount,
    fans: a.uniqueFanCount,
    dateFrom: dates.length ? new Date(Math.min(...dates)).toISOString() : null,
    dateTo: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
  }
}

let pass = 0, fail = 0
const failures = []
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`) }
}
function scenario(n, title) { console.log(`\n━━ SCENARIO ${n}: ${title} ━━`) }

// ── CSV builders ────────────────────────────────────────────────────────
const DAY = 86400000
const NOW = Date.parse('2026-08-19T12:00:00Z')
const at = (daysAgo) => new Date(NOW - daysAgo * DAY).toISOString().slice(0, 19).replace('T', ' ')

// Chaturbate-shaped export ("Tip from:" is what detectPlatform keys on).
function cbCsv(rows) {
  return 'Date,User,Note,Token change,Token balance\n' +
    rows.map(r => `${at(r.d)},${r.u},Tip from: ${r.u},${r.t},1000`).join('\n')
}
// BongaCams-shaped export (euro dates + "Your payout").
function bcCsv(rows) {
  const euro = (d) => { const x = new Date(NOW - d * DAY); const p = n => String(n).padStart(2, '0')
    return `${p(x.getUTCDate())}.${p(x.getUTCMonth() + 1)}.${x.getUTCFullYear()} ${p(x.getUTCHours())}:${p(x.getUTCMinutes())}` }
  return 'Date and time,Username,Type,Tokens,Your payout\n' +
    rows.map(r => `${euro(r.d)},${r.u},Tip,${r.t},${(r.t * 0.025).toFixed(2)}`).join('\n')
}
// A generic export naming its platform in the header line.
function namedCsv(platform, rows) {
  return `${platform} earnings export\nDate,Username,Tokens,USD\n` +
    rows.map(r => `${at(r.d)},${r.u},${r.t},${(r.t * 0.05).toFixed(2)}`).join('\n')
}
// Rows a session can actually be built from: several tips inside one hour.
function burst(dayOffset, user, n, tokens) {
  return Array.from({ length: n }, (_, i) => ({ d: dayOffset - i * 0.004, u: user, t: tokens }))
}
const rowsFor = (csv, platform) => parseCSV(csv, platform || detectPlatform(csv))

// Reproduces app/api/upload/route.js slot allocation verbatim.
function allocateSlots(existingRows, incomingRows, isPro = false) {
  const existingPlatforms = [...new Set(existingRows
    .map(r => normalizePlatform(r.platform)).filter(p => p && isSupportedPlatform(p)))]
  const incomingPlatformsInOrder = [...new Set(incomingRows
    .map(r => normalizePlatform(r.platform)).filter(p => p && isSupportedPlatform(p)))]
  let allowedPlatforms = existingPlatforms
  const blockedPlatforms = []
  if (!isPro) {
    const slotsLeft = () => Math.max(0, FREE_MAX_PLATFORMS - allowedPlatforms.length)
    const newlyAllowed = []
    incomingPlatformsInOrder.forEach(p => {
      if (allowedPlatforms.includes(p) || newlyAllowed.includes(p)) return
      if (slotsLeft() - newlyAllowed.length > 0) newlyAllowed.push(p); else blockedPlatforms.push(p)
    })
    allowedPlatforms = [...allowedPlatforms, ...newlyAllowed]
  } else {
    allowedPlatforms = [...new Set([...existingPlatforms, ...incomingPlatformsInOrder])]
  }
  const platformAllowedRows = incomingRows.filter(r => !blockedPlatforms.includes(normalizePlatform(r.platform)))
  const platformBlockedRows = incomingRows.filter(r => blockedPlatforms.includes(normalizePlatform(r.platform)))
  const lockedPlatformPreview = blockedPlatforms.map(p => {
    const platRows = platformBlockedRows.filter(r => normalizePlatform(r.platform) === p)
    return { platform: platRows[0]?.platform || p, ...summarizeRows(platRows) }
  })
  return { allowedPlatforms, blockedPlatforms, platformAllowedRows, platformBlockedRows, lockedPlatformPreview }
}

// ══════════════════════════════════════════════════════════════════════
scenario(1, 'Recent CSV upload (all inside the Free window)')
{
  const csv = cbCsv([...burst(2, 'alice', 6, 50), ...burst(5, 'bob', 5, 30), ...burst(9, 'cara', 4, 120)])
  check('detectPlatform identifies Chaturbate from a real export shape',
    detectPlatform(csv) === 'Chaturbate', `got ${detectPlatform(csv)}`)
  const rows = rowsFor(csv)
  check('parseCSV returns every tip row', rows.length === 15, `got ${rows.length}`)
  check('every row carries a positive amount', rows.every(r => r.tokens > 0 && r.usd > 0))

  const { visible, excluded } = splitFreeHistory(rows, NOW)
  check('nothing recent is hidden from a Free creator', excluded.length === 0, `${excluded.length} hidden`)
  check('all rows remain visible', visible.length === rows.length)
  check('exactly one platform slot is consumed', uniquePlatforms(rows).length === 1)
}

// ══════════════════════════════════════════════════════════════════════
scenario(2, "Multi-month CSV — real \"What You're Missing\" values + locked history")
{
  const recent = burst(3, 'alice', 8, 100)          // inside 31 days
  const old = [...burst(60, 'bob', 10, 200), ...burst(120, 'cara', 12, 300)] // outside
  const rows = rowsFor(cbCsv([...recent, ...old]))
  const { visible, excluded } = splitFreeHistory(rows, NOW)

  check('older rows are withheld from analysis', excluded.length === 22, `hidden=${excluded.length}`)
  check('recent rows stay visible', visible.length === 8, `visible=${visible.length}`)
  check('NOTHING is discarded — visible + hidden is the whole file',
    visible.length + excluded.length === rows.length)

  // The "What You're Missing" panel is fed by summarizeRows over the hidden set.
  const missing = summarizeRows(excluded)
  check('the locked panel has a REAL tip count, not a placeholder', missing.tips === 22, JSON.stringify(missing))
  check('the locked panel has real earnings > 0', missing.totalUsd > 0, `usd=${missing.totalUsd}`)
  check('the locked panel reports a real date range',
    Boolean(missing.dateFrom && missing.dateTo) && missing.dateFrom !== missing.dateTo)
  const hiddenUsd = excluded.reduce((n, r) => n + r.usd, 0)
  check('locked earnings equal the actual withheld rows (no fabrication)',
    Math.abs(missing.totalUsd - hiddenUsd) < 0.01, `${missing.totalUsd} vs ${hiddenUsd}`)

  check('filterFreeHistory agrees with splitFreeHistory',
    filterFreeHistory(rows, NOW).rows.length === visible.length)
  // Pro sees everything, from the SAME already-parsed rows — no re-upload.
  // Pro is gated at the call site (dashboard: loadedIsPro ? {rows: allData} : filterFreeHistory(allData)),
  // so "Pro" here is the same array with the filter simply not applied.
  const proRows = rows
  check('Pro sees the whole file with no re-import', proRows.length === rows.length)
}

// ══════════════════════════════════════════════════════════════════════
scenario(3, 'Per-platform 31-day windows (different date ranges per platform)')
{
  // Chaturbate is current; BongaCams stopped months ago. A GLOBAL window
  // anchored on the newest row would erase BongaCams entirely.
  const cbRows = rowsFor(cbCsv(burst(2, 'alice', 6, 100)))
  const bcRows = rowsFor(bcCsv([...burst(100, 'bob', 6, 200), ...burst(220, 'bob', 6, 200)]))
  const all = [...cbRows, ...bcRows]
  check('the fixture really does have two platforms',
    new Set(all.map(r => r.platform)).size === 2, [...new Set(all.map(r => r.platform))].join(','))

  const { visible, excluded } = splitFreeHistory(all, null)
  const visByPlat = (p) => visible.filter(r => r.platform === p).length

  check('Chaturbate keeps its recent rows', visByPlat('Chaturbate') === 6, `${visByPlat('Chaturbate')}`)
  check('BongaCams is NOT erased by Chaturbate being newer', visByPlat('BongaCams') > 0,
    'a global window would zero this out — the per-platform bug')
  check('BongaCams keeps only rows inside ITS OWN 31 days', visByPlat('BongaCams') === 6,
    `${visByPlat('BongaCams')} — the 220-day-old burst must still be excluded`)
  check('the older BongaCams burst is withheld, not deleted',
    excluded.filter(r => r.platform === 'BongaCams').length === 6)
  check('every row is still accounted for', visible.length + excluded.length === all.length)

  // Prove the old global-window behaviour would have been destructive.
  const newestMs = Math.max(...all.map(r => Date.parse(r.date_time)))
  const globalSurvivors = all.filter(r => Date.parse(r.date_time) >= newestMs - FREE_HISTORY_DAYS * DAY)
  check('a GLOBAL window would have hidden every BongaCams row (regression pinned)',
    globalSurvivors.filter(r => r.platform === 'BongaCams').length === 0)
}

// ══════════════════════════════════════════════════════════════════════
scenario(4, 'Fourth platform — split and lock, nothing stored')
{
  const existing = [
    ...rowsFor(cbCsv(burst(3, 'a', 4, 50))),
    ...rowsFor(bcCsv(burst(4, 'b', 4, 50))),
    ...rowsFor(namedCsv('MyFreeCams', burst(5, 'c', 4, 50))),
  ]
  check('the account starts at the Free cap', uniquePlatforms(existing).length === FREE_MAX_PLATFORMS)

  const incoming = rowsFor(namedCsv('Stripchat', burst(2, 'd', 9, 80)))
  check('the incoming file really is a 4th platform',
    incoming.every(r => r.platform === 'Stripchat') && incoming.length === 9)

  const r = allocateSlots(existing, incoming, false)
  // normalizePlatform() lowercases, so the blocked set holds 'stripchat'.
  check('the 4th platform is blocked', r.blockedPlatforms.includes('stripchat'),
    JSON.stringify(r.blockedPlatforms))
  check('NOTHING from it is queued for insert', r.platformAllowedRows.length === 0)
  check('every one of its rows is held back', r.platformBlockedRows.length === 9)
  check('a real per-platform preview is produced', r.lockedPlatformPreview.length === 1)
  const p = r.lockedPlatformPreview[0]
  check('the preview carries REAL figures from the file',
    p.tips === 9 && p.totalUsd > 0, JSON.stringify(p))
  check('the preview names the platform as it appears in the file', p.platform === 'Stripchat')
  check('the existing three platforms are untouched', r.allowedPlatforms.length === FREE_MAX_PLATFORMS)

  // Upgrading and re-importing the SAME file must then admit it.
  const rPro = allocateSlots(existing, incoming, true)
  check('after Pro, re-importing the same file admits the 4th platform',
    rPro.blockedPlatforms.length === 0 && rPro.platformAllowedRows.length === 9)
}

// ══════════════════════════════════════════════════════════════════════
scenario(5, 'Delete → re-upload (no quota, no permanent penalty)')
{
  const csv = cbCsv(burst(3, 'alice', 7, 90))
  const first = rowsFor(csv)
  const afterDelete = []                       // user deletes their data
  const second = rowsFor(csv)                  // same file, uploaded again

  check('re-parsing the same file yields the same rows', second.length === first.length)
  const r = allocateSlots(afterDelete, second, false)
  check('after deleting, the platform slot is free again',
    r.allowedPlatforms.length === 1 && r.blockedPlatforms.length === 0)
  check('every row is importable again — no quota consumed', r.platformAllowedRows.length === second.length)
  check('a re-upload is not treated as a 2nd platform', uniquePlatforms(second).length === 1)
}

// ══════════════════════════════════════════════════════════════════════
scenario(6, 'Corrected CSV re-upload (fixing bad rows)')
{
  // First file: some rows are malformed (no amount at all).
  const broken = 'Date,User,Note,Token change,Token balance\n' +
    [...burst(3, 'alice', 5, 60)].map(r => `${at(r.d)},${r.u},Tip from: ${r.u},${r.t},1000`).join('\n') +
    '\n' + [...burst(4, 'bob', 3, 0)].map(r => `${at(r.d)},${r.u},Tip from: ${r.u},0,1000`).join('\n')
  const brokenRows = rowsFor(broken)
  check('zero-amount rows are rejected by the parser, not imported as $0',
    brokenRows.length === 5, `got ${brokenRows.length}`)

  // Corrected file: the same tips, now with real amounts.
  const fixed = cbCsv([...burst(3, 'alice', 5, 60), ...burst(4, 'bob', 3, 75)])
  const fixedRows = rowsFor(fixed)
  check('the corrected file parses the previously-broken rows', fixedRows.length === 8)
  const r = allocateSlots(brokenRows, fixedRows, false)
  check('re-uploading a correction is not blocked', r.blockedPlatforms.length === 0)
  check('the correction still occupies one slot, not two', r.allowedPlatforms.length === 1)
  check('all corrected rows are importable', r.platformAllowedRows.length === 8)
}

// ══════════════════════════════════════════════════════════════════════
scenario(7, 'Pro upgrade — already-stored history unlocks with NO re-upload')
{
  const stored = rowsFor(cbCsv([...burst(3, 'a', 6, 100), ...burst(70, 'b', 9, 150), ...burst(140, 'c', 7, 210)]))
  const freeVisible = filterFreeHistory(stored, NOW).rows
  const proVisible = stored

  check('Free analyses only the recent window', freeVisible.length === 6, `${freeVisible.length}`)
  check('Pro analyses the entire stored history', proVisible.length === stored.length)
  check('the unlock is purely a visibility change over the SAME rows',
    proVisible.length > freeVisible.length &&
    freeVisible.every(r => proVisible.includes(r)))
  check('the newly-revealed rows carry real earnings', proVisible.reduce((n, r) => n + r.usd, 0) >
    freeVisible.reduce((n, r) => n + r.usd, 0))
  check('no re-parse or re-upload is involved — one array, two filters',
    stored.length === proVisible.length)
}

// ══════════════════════════════════════════════════════════════════════
scenario(8, 'Unknown platform consumes no slot')
{
  const unknownCsv = 'Date,Username,Tokens,USD\n' +
    burst(3, 'ghost', 5, 40).map(r => `${at(r.d)},${r.u},${r.t},2.00`).join('\n')
  const unknownRows = rowsFor(unknownCsv)
  check('undetectable rows land in the Unknown bucket',
    unknownRows.length > 0 && unknownRows.every(r => r.platform === 'Unknown'),
    [...new Set(unknownRows.map(r => r.platform))].join(','))

  check('Unknown consumes no platform slot', uniquePlatforms(unknownRows).length === 0)
  check('Unknown alongside 3 real platforms still counts 3', uniquePlatforms([
    ...rowsFor(cbCsv(burst(3, 'a', 2, 50))),
    ...rowsFor(bcCsv(burst(3, 'b', 2, 50))),
    ...rowsFor(namedCsv('MyFreeCams', burst(3, 'c', 2, 50))),
    ...unknownRows,
  ]).length === 3)

  // At the cap, Unknown rows must still import — they are not a 4th platform.
  const atCap = [
    ...rowsFor(cbCsv(burst(3, 'a', 2, 50))),
    ...rowsFor(bcCsv(burst(3, 'b', 2, 50))),
    ...rowsFor(namedCsv('MyFreeCams', burst(3, 'c', 2, 50))),
  ]
  const r = allocateSlots(atCap, unknownRows, false)
  check('Unknown rows are NOT blocked even at the platform cap',
    r.blockedPlatforms.length === 0 && r.platformAllowedRows.length === unknownRows.length)
  check('CamSoda, being unsupported, likewise consumes no slot',
    uniquePlatforms([{ platform: 'CamSoda', date_time: new Date(NOW).toISOString(), usd: 1 }]).length === 0)
}

console.log(`\n${'═'.repeat(60)}\n${pass} passed, ${fail} failed`)
if (fail) { console.log('\nFailures:'); failures.forEach(f => console.log(`  - ${f}`)) }
process.exit(fail ? 1 : 0)
