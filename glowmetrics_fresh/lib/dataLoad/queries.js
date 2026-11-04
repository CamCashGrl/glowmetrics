// Query sources for the dashboard's two full-history tables (S1: keyset paging).
//
// Order: (date_time DESC, id DESC), a total order because `id` is unique.
// Each page after the first asks for the rows strictly AFTER the last row
// received in that order (a keyset / cursor), instead of an offset. Rows
// inserted or deleted elsewhere during the load therefore cannot shift a page
// boundary and silently skip or repeat a row (which offset paging can).
//
// Newest-first, so a partial failure loses the OLDEST rows; the newest rows
// (and the Free 31-day window anchored to each platform's latest row) stay
// correct. Callers reverse the result back to ascending (toAscending).
//
// Cursor values are never round-tripped through JavaScript numbers or Dates:
//   - the database returns exact text copies (`cursor_id:id::text`,
//     `cursor_ts:date_time::text`), validated against strict patterns;
//   - tips.id and paid_sessions.id are both BIGINT in PRODUCTION (verified
//     read-only against the production schema, 2026-11-04). Above 2^53 a JS
//     number would lose precision. Production is the source of truth: the
//     staging project's paid_sessions.id is UUID (schema drift); a UUID id
//     fails the BIGINT check below, so such a load is reported as not
//     provable (coverage 'none'), never as complete;
//   - date_time keeps Postgres microseconds (a JS Date would truncate them);
//   - values inside the PostgREST logic filter are double-quoted and escaped.
// Rows whose date_time is NULL cannot be ordered by a timestamp cursor, so they
// are loaded by a separate id-keyed query (the previous offset loader included
// them; the loaded dataset stays the same). Production declares date_time
// NOT NULL on both tables today; the query is kept as a defence (one extra,
// empty request per table per load).
//
// The 'uuid' id kind is not used by any table; it is kept so that a UUID id
// would be quoted correctly in a filter rather than misread.

export const PAGE_SELECT = '*,cursor_ts:date_time::text,cursor_id:id::text'
export const CURSOR_FIELDS = ['cursor_ts', 'cursor_id']

const TS_TEXT = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)?$/
const ID_TEXT = {
  bigint: /^-?\d{1,19}$/,
  uuid: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
}

// PostgREST logic-tree value quoting: wrap in double quotes; escape \ and ".
export const quoteValue = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'

// The cursor of one returned row, or null when its text values are not exactly
// what the database type allows (the caller then stops and reports the load as
// not provable, instead of guessing).
export function cursorOf(row, idKind) {
  const id = row?.cursor_id
  const ts = row?.cursor_ts
  if (typeof id !== 'string' || !ID_TEXT[idKind] || !ID_TEXT[idKind].test(id)) return null
  if (ts === null || ts === undefined) return { ts: null, id }
  if (typeof ts !== 'string' || !TS_TEXT.test(ts)) return null
  return { ts, id }
}

// bigint ids are validated digits and stay unquoted; uuids are quoted.
export const idLiteral = (id, idKind) => (idKind === 'bigint' ? id : quoteValue(id))

// Rows strictly after `cursor` in (date_time DESC, id DESC) order.
export const keysetFilter = (cursor, idKind) => {
  const ts = quoteValue(cursor.ts)
  return `date_time.lt.${ts},and(date_time.eq.${ts},id.lt.${idLiteral(cursor.id, idKind)})`
}

function tableSource(supabase, table, uid, idKind) {
  return {
    table,
    idKind,
    dated: {
      fetchPage: (cursor, limit, { wantCount } = {}) => {
        let q = supabase.from(table)
          .select(PAGE_SELECT, wantCount ? { count: 'exact' } : undefined)
          .eq('user_id', uid)
          .not('date_time', 'is', null)
          .order('date_time', { ascending: false })
          .order('id', { ascending: false })
          .limit(limit)
        if (cursor) q = q.or(keysetFilter(cursor, idKind))
        return q
      },
      cursorOf: (row) => { const c = cursorOf(row, idKind); return c && c.ts !== null ? c : null },
    },
    undated: {
      fetchPage: (cursor, limit, { wantCount } = {}) => {
        let q = supabase.from(table)
          .select(PAGE_SELECT, wantCount ? { count: 'exact' } : undefined)
          .eq('user_id', uid)
          .is('date_time', null)
          .order('id', { ascending: false })
          .limit(limit)
        if (cursor) q = q.lt('id', cursor.id) // validated digits / uuid: no quoting needed in a simple filter
        return q
      },
      cursorOf: (row) => { const c = cursorOf(row, idKind); return c && c.ts === null ? c : null },
    },
  }
}

export const tipsSource = (supabase, uid) => tableSource(supabase, 'tips', uid, 'bigint')
export const paidSessionsSource = (supabase, uid) => tableSource(supabase, 'paid_sessions', uid, 'bigint')

// Rows come back newest-first; the rest of the app expects ascending.
export const toAscending = (rows) => [...rows].reverse()
