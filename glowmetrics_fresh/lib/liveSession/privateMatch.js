// Private Mode matcher — READ-ONLY and DISCONNECTED.
//
// Decides whether a closed Live-mode private interval and imported private
// earnings (paid_sessions rows) describe the same show. It returns evidence;
// it never imports, deduplicates, merges, deletes or writes anything, has no
// database or network access, and is not called from upload/import. Automatic
// matching is enabled only after real match output has been reviewed.
//
// A match needs STRONG agreement on all of:
//   1. canonical platform (Chaturbate / BongaCams / MyFreeCams — never guessed)
//   2. normalized fan username
//   3. creator-local time: both sides as real instants, with imported
//      wall-clock rows converted through the creator's saved IANA timezone
//   4. compatible earnings (the interval's finalized estimate vs the imported
//      amount) — imported rows carry no duration, so earnings are the
//      duration evidence
// Username alone never matches. Anything unclear is `ambiguous` or `no_match`
// with a reason, never a guess.
//
// THE NUMBERS BELOW ARE PROVISIONAL. They exist only so the matcher can be
// exercised; they must be revisited against real Live private intervals
// (there are none in production yet) before anything acts on a match.

import { isValidTimeZone, zonedWallTimeToDate } from '../creatorTimezone'

export const PRIVATE_MATCH_DEFAULTS = Object.freeze({
  // Imported row time may fall this long before the interval started / after it
  // ended (platforms differ in when they stamp a private show's earnings).
  windowBeforeMs: 10 * 60 * 1000,
  windowAfterMs: 15 * 60 * 1000,
  // Earnings compatibility: |imported - expected| <= max(absolute, relative * expected)
  earningsToleranceUsd: 1.0,
  earningsToleranceRatio: 0.1,
})

const PLATFORMS = { chaturbate: 'Chaturbate', bongacams: 'BongaCams', myfreecams: 'MyFreeCams' }

// Exact (case-insensitive) match on the three supported platforms. No
// fallback, no fuzzy matching, no lowercase-then-guess.
export function canonicalPlatform(p) {
  if (typeof p !== 'string') return null
  return PLATFORMS[p.trim().toLowerCase()] || null
}

export function normalizeFanUsername(u) {
  if (typeof u !== 'string') return null
  const n = u.normalize('NFKC').trim().replace(/^@+/, '').replace(/\s+/g, ' ').toLowerCase()
  return n === '' ? null : n
}

// Imported-row time as a real instant (ms), or null if it can't be established.
//   timeBasis 'instant'        — date_time is already a real instant
//   timeBasis 'wallclock_utc'  — legacy import: the export's wall-clock time was
//                                saved as if it were UTC; reinterpret it in the
//                                creator's IANA timezone
//   anything else              — unknown: refuse (never assume)
export function importedInstantMs(row, creatorTimeZone) {
  const t = Date.parse(row?.date_time)
  if (!Number.isFinite(t)) return null
  if (row.timeBasis === 'instant') return t
  if (row.timeBasis === 'wallclock_utc') {
    if (!isValidTimeZone(creatorTimeZone)) return null
    const iso = new Date(t).toISOString()
    const at = zonedWallTimeToDate(iso.slice(0, 10), iso.slice(11, 16), creatorTimeZone).getTime()
    return Number.isFinite(at) ? at : null
  }
  return null
}

const money = (v) => Math.round((Number(v) || 0) * 100) / 100

function compatible(imported, expected, opts) {
  const tol = Math.max(opts.earningsToleranceUsd, opts.earningsToleranceRatio * Math.abs(expected))
  return Math.abs(imported - expected) <= tol + 1e-9
}

/**
 * @param {object} args
 * @param {Array}  args.intervals     closed live_private_intervals {id, platform, username, started_at, ended_at, estimated_earnings_usd}
 * @param {Array}  args.importedRows  paid_sessions-shaped {id, platform, username, date_time, usd, timeBasis}
 * @param {string} args.creatorTimeZone  saved IANA timezone (required)
 * @param {object} [args.options]     overrides for PRIVATE_MATCH_DEFAULTS
 * @returns {{ results: Array, summary: object }}  pure data; inputs are not mutated
 */
export function matchPrivateIntervals({ intervals = [], importedRows = [], creatorTimeZone, options = {} } = {}) {
  const opts = { ...PRIVATE_MATCH_DEFAULTS, ...options }
  const tzOk = isValidTimeZone(creatorTimeZone)

  // Normalize imported rows once.
  const rows = importedRows.map((r) => ({
    id: r.id,
    platform: canonicalPlatform(r.platform),
    username: normalizeFanUsername(r.username),
    atMs: tzOk || r.timeBasis === 'instant' ? importedInstantMs(r, creatorTimeZone) : null,
    usd: money(r.usd),
    timeBasis: r.timeBasis,
  }))

  // Pass 1: per interval, find evidence.
  const evidence = intervals.map((iv) => {
    const base = { intervalId: iv.id, candidates: [], matchedRowIds: [] }
    const platform = canonicalPlatform(iv.platform)
    const username = normalizeFanUsername(iv.username)
    const startMs = Date.parse(iv.started_at)
    const endMs = Date.parse(iv.ended_at)
    if (!tzOk) return { ...base, result: 'no_match', reason: 'timezone_unknown' }
    if (!platform) return { ...base, result: 'no_match', reason: 'platform_unknown' }
    if (!username) return { ...base, result: 'no_match', reason: 'username_missing' }
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || iv.ended_at == null) return { ...base, result: 'no_match', reason: 'interval_not_closed' }
    if (iv.estimated_earnings_usd == null) return { ...base, result: 'no_match', reason: 'interval_earnings_unknown' }
    const expected = money(iv.estimated_earnings_usd)

    const sameIdentity = rows.filter((r) => r.platform === platform && r.username === username)
    if (!sameIdentity.length) return { ...base, result: 'no_match', reason: 'no_rows_for_platform_and_username', expected }
    const unknownTime = sameIdentity.filter((r) => r.atMs == null)
    const inWindow = sameIdentity
      .filter((r) => r.atMs != null && r.atMs >= startMs - opts.windowBeforeMs && r.atMs <= endMs + opts.windowAfterMs)
      .sort((a, b) => a.atMs - b.atMs)
    if (!inWindow.length) {
      return { ...base, result: 'no_match', reason: unknownTime.length ? 'time_basis_unknown' : 'no_rows_in_time_window', expected }
    }

    const total = money(inWindow.reduce((s, r) => s + r.usd, 0))
    const cand = { rowIds: inWindow.map((r) => r.id), importedUsd: total, expectedUsd: expected }
    if (compatible(total, expected, opts)) {
      return { ...base, result: 'match', reason: 'platform_username_time_earnings_agree', candidates: [cand], matchedRowIds: cand.rowIds, expected }
    }
    // Not compatible as a whole: is some contiguous subset compatible? Then
    // the rows are entangled with something else — flag, don't pick.
    const subsets = []
    for (let i = 0; i < inWindow.length; i++) {
      let sum = 0
      for (let j = i; j < inWindow.length; j++) {
        sum += inWindow[j].usd
        if (compatible(money(sum), expected, opts)) subsets.push({ rowIds: inWindow.slice(i, j + 1).map((r) => r.id), importedUsd: money(sum), expectedUsd: expected })
      }
    }
    if (subsets.length) return { ...base, result: 'ambiguous', reason: 'only_part_of_the_window_agrees', candidates: subsets, expected }
    return { ...base, result: 'no_match', reason: 'earnings_incompatible', candidates: [cand], expected }
  })

  // Pass 2: a row claimed by more than one interval makes every claimant ambiguous.
  const claims = new Map()
  for (const e of evidence) {
    if (e.result !== 'match') continue
    for (const id of e.matchedRowIds) claims.set(id, [...(claims.get(id) || []), e.intervalId])
  }
  const results = evidence.map((e) => {
    if (e.result !== 'match') return e
    const contested = e.matchedRowIds.filter((id) => claims.get(id).length > 1)
    if (!contested.length) return e
    return { ...e, result: 'ambiguous', reason: 'rows_claimed_by_multiple_intervals', matchedRowIds: [], contestedRowIds: contested }
  })

  const count = (k) => results.filter((r) => r.result === k).length
  return {
    results,
    summary: { intervals: results.length, match: count('match'), ambiguous: count('ambiguous'), no_match: count('no_match'), options: opts },
  }
}
