// Loads EVERY row of one table for the dashboard with keyset (cursor) paging,
// and says, explicitly and conservatively, what the result covers. It never
// throws and never returns partial rows as if they were complete.
//
//   source = { dated: { fetchPage, cursorOf }, undated?: { fetchPage, cursorOf } }
//   fetchPage(cursor, limit, { wantCount }) -> { data, error, count } (supabase-js shape)
//   (see lib/dataLoad/queries.js for the real sources)
//
// ── What the result guarantees ───────────────────────────────────────────
// Each page is its own database request (its own snapshot). A multi-page load
// is therefore NOT one consistent snapshot, and nothing below claims it is.
//
// coverage.kind === 'all'   (complete: true)
//   Every page succeeded, the end of the data was reached, no row was seen
//   twice, and at least as many distinct rows arrived as the exact count taken
//   with the first page. Guarantee: every row that existed when the load
//   started and was not deleted before the load finished is included exactly
//   once. Rows inserted, updated or deleted WHILE the load ran may or may not
//   be reflected.
//
// coverage.kind === 'since' (complete: false)
//   Pages 1..k of the dated rows succeeded, a later page failed (or the page
//   limit was hit), no row was seen twice, and the NULL-dated rows loaded
//   completely. Guarantee, with the same "existed for the whole load" caveat:
//   every row with date_time STRICTLY AFTER `oldestExclusive` (the timestamp of
//   the last row received, as exact database text) is included. Rows that share
//   that exact timestamp may continue on the failed page, so that timestamp
//   itself is NOT covered. `coveredFromMs` = floor(that instant to the
//   millisecond) + 1 ms: only ever later than the true boundary, never earlier.
//   `coveredToMs` = when the load started (client clock): rows newer than that
//   are not covered.
//
// coverage.kind === 'none'  (complete: false)
//   Nothing can be claimed: the first page failed; the row count came up short
//   (rows deleted or changed mid-load, or an inconsistent read); a row was seen
//   twice (its sort position changed mid-load) or a page added no new row (the
//   cursor did not advance); a cursor value was not exactly
//   what the database type allows; the NULL-dated rows did not load; or the
//   boundary timestamp could not be read.
//
// Retries: each page is retried with backoff (500/1000/2000 ms) before the
// load is declared incomplete. Errors are summarised to { code, message }; no
// row data is ever logged. Cursor helper fields are stripped from the rows.

import { CURSOR_FIELDS } from './queries'

export const PAGE_SIZE = 1000
export const RETRY_DELAYS_MS = [500, 1000, 2000]
const MAX_PAGES = 5000

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function summarizeError(e) {
  if (!e) return null
  const code = e.code ?? e.status ?? e.name ?? null
  const message = String(e.message ?? e).slice(0, 200)
  return { code: code == null ? null : String(code).slice(0, 40), message }
}

async function withRetries(fn, retryDelaysMs, sleep) {
  let lastError = null
  let retries = 0
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    try {
      const res = await fn()
      if (res && !res.error && Array.isArray(res.data)) return { res, retries }
      lastError = (res && res.error) || new Error('Malformed response (no data and no error)')
    } catch (e) { lastError = e }
    if (attempt < retryDelaysMs.length) { retries++; await sleep(retryDelaysMs[attempt]) }
  }
  return { res: null, retries, error: lastError }
}

// One ordered part (dated or NULL-dated) of a table.
async function fetchPart({ fetchPage, cursorOf }, { pageSize, retryDelaysMs, sleep, maxPages }) {
  const rows = []
  const seen = new Set()
  let received = 0
  let expected = null
  let retries = 0
  let pages = 0
  let duplicates = 0
  let cursor = null
  const out = (complete, reason, extra = {}) => ({
    complete, reason, rows, expected, received, retries, pages, duplicates, lastCursor: cursor,
    verifiedCount: expected !== null, error: null, ...extra,
  })
  for (;;) {
    if (pages >= maxPages) return out(false, 'max_pages')
    const r = await withRetries(() => fetchPage(cursor, pageSize, { wantCount: pages === 0 }), retryDelaysMs, sleep)
    retries += r.retries
    if (!r.res) return out(false, 'page_failed', { error: summarizeError(r.error) })
    pages++
    if (pages === 1 && Number.isFinite(r.res.count)) expected = r.res.count
    const data = r.res.data
    received += data.length
    if (data.length === 0) break
    let added = 0
    for (const row of data) {
      const c = cursorOf(row)
      if (!c) return out(false, 'cursor_invalid')
      if (seen.has(c.id)) duplicates++
      else { seen.add(c.id); rows.push(row); added++ }
      cursor = c
    }
    // A non-empty page with no new row means the cursor is not advancing (the
    // data shifted under it, or the server ignored the cursor): stop now
    // rather than re-reading the same rows until the page limit.
    if (added === 0) return out(false, 'concurrent_change')
    // Stop early only when the exact count is met and the page was short;
    // otherwise read until an empty page (a server row cap cannot fake "the end").
    if (expected !== null && rows.length >= expected && data.length < pageSize) break
  }
  if (duplicates > 0) return out(false, 'concurrent_change')
  if (expected !== null && rows.length < expected) return out(false, 'row_count_mismatch')
  return out(true, null)
}

// Postgres timestamptz text or ISO → epoch milliseconds (floor), or null.
export function tsTextToMs(ts) {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}(?::?\d{2})?)?$/.exec(String(ts || ''))
  if (!m) return null
  const frac = m[3] ? m[3].slice(0, 4).padEnd(4, '0') : '.000'
  let zone = m[4] || 'Z'
  if (zone !== 'Z') zone = zone.length === 3 ? `${zone}:00` : zone.includes(':') ? zone : `${zone.slice(0, 3)}:${zone.slice(3)}`
  const ms = Date.parse(`${m[1]}T${m[2]}${frac}${zone}`)
  return Number.isFinite(ms) ? ms : null
}

const stripCursorFields = (rows) => rows.map((r) => {
  const copy = { ...r }
  for (const k of CURSOR_FIELDS) delete copy[k]
  return copy
})

export async function fetchAllRows(source, {
  pageSize = PAGE_SIZE, retryDelaysMs = RETRY_DELAYS_MS, sleep = defaultSleep, maxPages = MAX_PAGES, now = () => Date.now(),
} = {}) {
  const opts = { pageSize, retryDelaysMs, sleep, maxPages }
  const startedAt = now()
  const dated = await fetchPart(source.dated, opts)
  const undated = source.undated
    ? await fetchPart(source.undated, opts)
    : { complete: true, reason: null, rows: [], expected: 0, received: 0, retries: 0, pages: 0, duplicates: 0, verifiedCount: true, error: null }
  const finishedAt = now()
  const complete = dated.complete && undated.complete
  const failing = !dated.complete ? dated : !undated.complete ? undated : null

  let coverage = { kind: 'none' }
  if (complete) coverage = { kind: 'all' }
  else if (!dated.complete && undated.complete && (dated.reason === 'page_failed' || dated.reason === 'max_pages')
    && dated.duplicates === 0 && dated.rows.length > 0 && dated.lastCursor?.ts) {
    const boundaryMs = tsTextToMs(dated.lastCursor.ts)
    if (boundaryMs !== null) {
      coverage = { kind: 'since', oldestExclusive: dated.lastCursor.ts, coveredFromMs: boundaryMs + 1, coveredToMs: startedAt }
    }
  }

  return {
    complete,
    // NULL-dated rows first: after toAscending they come last, matching the
    // previous loader (Postgres sorts NULLs first for DESC).
    rows: stripCursorFields([...undated.rows, ...dated.rows]),
    reason: failing ? failing.reason : null,
    error: failing ? failing.error : null,
    expected: dated.expected !== null && undated.expected !== null ? dated.expected + undated.expected : null,
    received: dated.received + undated.received,
    retries: dated.retries + undated.retries,
    pages: dated.pages + undated.pages,
    verifiedCount: dated.verifiedCount && undated.verifiedCount,
    coverage,
    startedAt,
    finishedAt,
  }
}
