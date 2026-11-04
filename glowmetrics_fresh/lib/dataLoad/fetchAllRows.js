// Loads EVERY row of a paged query and says, explicitly, whether it got them
// all. It never throws and never returns partial rows as if they were complete.
//
//   fetchPage(from, to, { wantCount }) -> { data, error, count }   (supabase-js shape)
//
// - Offset = rows actually RECEIVED, so a server row cap (smaller than
//   pageSize) cannot be mistaken for "last page".
// - The first page asks for an exact row count; the load is complete only when
//   at least that many distinct rows arrived. If the count is unavailable the
//   fallback is a short/empty page (weaker: a silent server cap cannot be
//   detected), and the result says so (`verifiedCount: false`).
// - Each page is retried with backoff before the load is declared incomplete.
// - Rows are de-duplicated by `id` (concurrent inserts can shift offsets); a
//   shortfall after de-duplication is reported, never hidden.
// - Errors are summarised to { code, message }: no row data is ever logged.

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

export async function fetchAllRows(fetchPage, {
  pageSize = PAGE_SIZE, retryDelaysMs = RETRY_DELAYS_MS, sleep = defaultSleep, maxPages = MAX_PAGES, idKey = 'id',
} = {}) {
  const rows = []
  const seen = new Set()
  let received = 0
  let expected = null
  let retries = 0
  let pages = 0

  const result = (complete, extra = {}) => ({
    complete, rows, expected, received, retries, pages, verifiedCount: expected !== null, reason: null, error: null, failedOffset: null, ...extra,
  })

  while (pages < maxPages) {
    const from = received
    const to = from + pageSize - 1
    let page = null
    let lastError = null
    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
      try {
        const res = await fetchPage(from, to, { wantCount: expected === null })
        if (res && !res.error && Array.isArray(res.data)) { page = res; break }
        lastError = (res && res.error) || new Error('Malformed response (no data and no error)')
      } catch (e) { lastError = e }
      if (attempt < retryDelaysMs.length) { retries++; await sleep(retryDelaysMs[attempt]) }
    }
    if (!page) return result(false, { reason: 'page_failed', error: summarizeError(lastError), failedOffset: from })
    pages++
    if (expected === null && Number.isFinite(page.count)) expected = page.count
    const data = page.data
    received += data.length
    for (const r of data) {
      const key = r?.[idKey]
      if (key === undefined || key === null) rows.push(r)
      else if (!seen.has(key)) { seen.add(key); rows.push(r) }
    }
    if (data.length === 0) break
    if (expected !== null ? received >= expected : data.length < pageSize) break
  }

  if (pages >= maxPages) return result(false, { reason: 'max_pages' })
  if (expected !== null && rows.length < expected) return result(false, { reason: 'row_count_mismatch' })
  return result(true)
}
