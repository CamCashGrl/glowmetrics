// In-memory stand-in for the supabase-js client that EXECUTES queries the way
// PostgREST + Postgres would, closely enough to test keyset paging honestly:
//   - filters: eq/neq/gt/gte/lt/lte/in/is(null)/not(is null) and the PostgREST
//     logic tree in .or('a.lt."x",and(b.eq."y",c.lt.1)') with quoted values and
//     backslash escapes (a malformed tree returns PGRST100, like PostgREST);
//   - typed comparison: `date_time` as microsecond timestamps (ISO or Postgres
//     text), `id` as BIGINT (exact BigInt) or UUID per table; a literal of the
//     wrong type returns 22P02, like Postgres;
//   - ORDER BY with Postgres NULL placement (NULLS FIRST for DESC, LAST for ASC);
//   - select '*' plus `alias:col::text` casts, rendering timestamps in Postgres
//     text format ('YYYY-MM-DD HH:MM:SS[.ffffff]+00') and BIGINT ids exactly,
//     while the plain `id` of a BigInt row comes back as a (lossy) JS number,
//     exactly like JSON over the wire;
//   - limit / range, exact count (+ head), maybeSingle/single, a server row cap;
//   - fail(ctx) to inject errors or throws, and onQuery(ctx, tables) to change
//     the data between requests (concurrent inserts / deletes / updates).
// Writes succeed without changing data. auth / rpc / channel exist for
// rendering the dashboard. Not a test file.

const TS = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}(?::?\d{2})?)?$/
export function tsToMicros(s) {
  const m = TS.exec(String(s))
  if (!m) return null
  const [, y, mo, d, h, mi, se, frac = '', zone = 'Z'] = m
  let offMin = 0
  if (zone !== 'Z') {
    const sign = zone[0] === '-' ? -1 : 1
    const hh = Number(zone.slice(1, 3)); const mm = Number(zone.slice(3).replace(':', '') || 0)
    offMin = sign * (hh * 60 + mm)
  }
  const ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se) - offMin * 60000
  return BigInt(ms) * 1000n + BigInt((frac + '000000').slice(0, 6))
}
export function microsToPgText(us) {
  // Postgres prints timestamptz in the session zone (UTC here): 'YYYY-MM-DD HH:MM:SS[.ffffff]+00'.
  const iso = new Date(Number(us / 1000n)).toISOString() // UTC by definition
  const frac = String(us % 1000000n).padStart(6, '0').replace(/0+$/, '')
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}${frac ? '.' + frac : ''}+00`
}
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

class PgError extends Error { constructor(code, message) { super(message); this.code = code } }

// PostgREST logic tree: list := term (',' term)* ; term := ('and'|'or') '(' list ')' | col '.' op '.' value
function parseLogic(src) {
  let i = 0
  const fail = () => { throw new PgError('PGRST100', `failed to parse logic tree (${src})`) }
  const list = () => { const items = [term()]; while (src[i] === ',') { i++; items.push(term()) } return items }
  const term = () => {
    const m = /^(and|or)\(/.exec(src.slice(i))
    if (m) { i += m[0].length; const items = list(); if (src[i] !== ')') fail(); i++; return { kind: m[1], items } }
    const col = /^[a-z_][a-z0-9_]*/i.exec(src.slice(i)); if (!col) fail(); i += col[0].length
    if (src[i] !== '.') fail(); i++
    const op = /^(eq|neq|gt|gte|lt|lte|is)/.exec(src.slice(i)); if (!op) fail(); i += op[0].length
    if (src[i] !== '.') fail(); i++
    let value = ''
    if (src[i] === '"') {
      i++
      for (;;) {
        if (i >= src.length) fail()
        const ch = src[i]
        if (ch === '\\') { if (i + 1 >= src.length) fail(); value += src[i + 1]; i += 2; continue }
        if (ch === '"') { i++; break }
        value += ch; i++
      }
    } else {
      while (i < src.length && src[i] !== ',' && src[i] !== ')') value += src[i++]
      if (!value) fail()
    }
    return { kind: 'cond', col: col[0], op: op[0], value }
  }
  const items = list()
  if (i !== src.length) fail()
  return { kind: 'or', items }
}

export function fakeSupabase(tables, { fail = () => null, onQuery = () => {}, maxRows = Infinity, user = null, rpc = {}, idTypes = {} } = {}) {
  const calls = []
  let n = 0
  const noopChannel = () => { const ch = { on: () => ch, subscribe: () => ch, unsubscribe: () => {} }; return ch }
  const idTypeOf = (table) => {
    if (idTypes[table]) return idTypes[table]
    const first = (tables[table] || []).find((r) => r && r.id !== undefined && r.id !== null)
    if (!first) return 'bigint'
    return typeof first.id === 'string' && UUID.test(first.id) ? 'uuid' : typeof first.id === 'string' ? 'text' : 'bigint'
  }
  // typed value for comparisons; throws PgError for a literal of the wrong type
  const typed = (table, col, v, literal = false) => {
    if (v === null || v === undefined) return null
    if (col === 'date_time') {
      const us = tsToMicros(v)
      if (us === null) throw new PgError('22007', `invalid input syntax for type timestamp with time zone: "${v}"`)
      return us
    }
    if (col === 'id') {
      const t = idTypeOf(table)
      if (t === 'bigint') {
        if (literal && !/^-?\d+$/.test(String(v))) throw new PgError('22P02', `invalid input syntax for type bigint: "${v}"`)
        return BigInt(v)
      }
      if (t === 'uuid') {
        if (literal && !UUID.test(String(v))) throw new PgError('22P02', `invalid input syntax for type uuid: "${v}"`)
        return String(v).toLowerCase()
      }
    }
    return v
  }
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
  const test = (table, row, col, op, lit) => {
    if (op === 'is') return lit === null || lit === 'null' ? row[col] === null || row[col] === undefined : false
    const a = typed(table, col, row[col]); const b = typed(table, col, lit, true)
    if (a === null) return false // SQL: comparisons with NULL are not true
    const c = cmp(a, b)
    return op === 'eq' ? c === 0 : op === 'neq' ? c !== 0 : op === 'gt' ? c > 0 : op === 'gte' ? c >= 0 : op === 'lt' ? c < 0 : c <= 0
  }
  const evalLogic = (table, row, node) => {
    if (node.kind === 'cond') return test(table, row, node.col, node.op, node.value)
    const r = node.items.map((x) => evalLogic(table, row, x))
    return node.kind === 'and' ? r.every(Boolean) : r.some(Boolean)
  }
  const project = (table, row, cols) => {
    const out = {}
    for (const item of cols) {
      if (item === '*') {
        for (const [k, v] of Object.entries(row)) out[k] = typeof v === 'bigint' ? Number(v) : v
        continue
      }
      const m = /^(?:([a-z_][a-z0-9_]*):)?([a-z_][a-z0-9_]*)(?:::([a-z]+))?$/i.exec(item)
      if (!m) continue
      const [, alias, col, cast] = m
      let v = row[col]
      if (cast === 'text' && v !== null && v !== undefined) v = col === 'date_time' ? microsToPgText(tsToMicros(v)) : String(v)
      else if (typeof v === 'bigint') v = Number(v)
      out[alias || col] = v
    }
    return out
  }
  return {
    calls,
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      getSession: async () => ({ data: { session: user ? { user } : null }, error: null }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    rpc: async (name) => ({ data: rpc[name] ?? null, error: null }),
    channel: noopChannel,
    removeChannel: () => {},
    from(table) {
      const q = { table, cols: ['*'], opts: undefined, filters: [], logic: [], orders: [], range: null, limit: null, single: null, write: false }
      const exec = () => {
        n++
        const cursor = q.logic.length > 0 || q.filters.some(([op, c]) => op === 'lt' && c === 'id')
        const ctx = {
          table, call: n, head: !!q.opts?.head, write: q.write, paged: q.limit !== null || !!q.range, cursor,
          undated: q.filters.some(([op, c]) => op === 'isnull' && c === 'date_time'),
          from: q.range ? q.range[0] : q.limit !== null ? (cursor ? 1 : 0) : null,
        }
        calls.push({ table, orders: q.orders.map((o) => [...o]), limit: q.limit, range: q.range, count: q.opts?.count || null, logic: [...q.logic], filters: q.filters.map((f) => [...f]), select: q.cols.join(',') })
        onQuery(ctx, tables)
        const f = fail(ctx)
        if (f === 'throw') throw new Error('network down')
        if (f) return { data: null, count: null, error: { code: '503', message: 'upstream unavailable' } }
        if (q.write) return { data: null, error: null, count: null }
        try {
          const trees = q.logic.map(parseLogic)
          let rows = (tables[table] || []).filter((r) => q.filters.every(([op, c, v]) => {
            if (op === 'isnull') return r[c] === null || r[c] === undefined
            if (op === 'notnull') return r[c] !== null && r[c] !== undefined
            if (op === 'in') return v.map((x) => String(x)).includes(String(r[c]))
            return test(table, r, c, op, v)
          }) && trees.every((t) => evalLogic(table, r, t)))
          const total = rows.length
          rows = [...rows].sort((a, b) => {
            for (const [c, asc] of q.orders) {
              const x = typed(table, c, a[c]); const y = typed(table, c, b[c])
              if (x === null && y === null) continue
              if (x === null) return asc ? 1 : -1 // NULLS LAST for ASC, NULLS FIRST for DESC
              if (y === null) return asc ? -1 : 1
              const r = cmp(x, y); if (r !== 0) return asc ? r : -r
            }
            return 0
          })
          const [from, to] = q.range || [0, Infinity]
          let end = Math.min(to + 1, rows.length)
          if (q.limit !== null) end = Math.min(end, from + q.limit)
          end = Math.min(end, from + maxRows)
          const data = rows.slice(from, end).map((r) => project(table, r, q.cols))
          const count = q.opts?.count === 'exact' ? total : null
          if (q.opts?.head) return { data: null, error: null, count }
          if (q.single) return { data: data[0] ?? null, error: null, count }
          return { data, error: null, count }
        } catch (e) {
          if (e instanceof PgError) return { data: null, count: null, error: { code: e.code, message: e.message } }
          throw e
        }
      }
      const api = new Proxy({}, {
        get(_t, prop) {
          if (prop === 'then') return (res, rej) => new Promise((ok, no) => { try { ok(exec()) } catch (e) { no(e) } }).then(res, rej)
          if (prop === 'select') return (cols, opts) => { q.cols = String(cols || '*').split(',').map((s) => s.trim()); q.opts = opts; return api }
          if (['eq', 'neq', 'gt', 'gte', 'lt', 'lte'].includes(prop)) return (c, v) => { q.filters.push([prop, c, v]); return api }
          if (prop === 'in') return (c, v) => { q.filters.push(['in', c, v]); return api }
          if (prop === 'is') return (c, v) => { if (v === null) q.filters.push(['isnull', c]); return api }
          if (prop === 'not') return (c, op, v) => { if (op === 'is' && v === null) q.filters.push(['notnull', c]); return api }
          if (prop === 'or') return (expr) => { q.logic.push(String(expr)); return api }
          if (prop === 'order') return (c, o) => { q.orders.push([c, o?.ascending !== false]); return api }
          if (prop === 'range') return (a, b) => { q.range = [a, b]; return api }
          if (prop === 'limit') return (k) => { q.limit = k; return api }
          if (prop === 'maybeSingle') return () => { q.single = 'maybe'; return api }
          if (prop === 'single') return () => { q.single = 'single'; return api }
          if (['insert', 'update', 'delete', 'upsert'].includes(prop)) return () => { q.write = true; return api }
          return () => api // any other builder method is a harmless no-op
        },
      })
      return api
    },
  }
}

// Realistic fixtures: BIGINT tip ids, UUID private-session ids.
export const uuidFor = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
export const mkTips = (n, { uid = 'u1', sameTime = false, platform = 'chaturbate', idBase = 1 } = {}) =>
  Array.from({ length: n }, (_, i) => ({
    id: idBase + i, user_id: uid, platform, username: `fan${i % 40}`, usd: 0.025 * ((i % 9) + 1), tokens: (i % 9) + 1,
    date_time: sameTime ? '2026-10-01T00:00:00.000Z' : new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString(),
  }))
export const mkPaid = (n, { uid = 'u1' } = {}) =>
  Array.from({ length: n }, (_, i) => ({
    id: uuidFor(i + 1), user_id: uid, platform: 'bongacams', username: `vip${i % 5}`, session_type: 'private', usd: 7.575,
    date_time: new Date(Date.UTC(2026, 5, 1) + i * 60000).toISOString(),
  }))
