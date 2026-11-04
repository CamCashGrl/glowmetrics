// Minimal in-memory stand-in for the supabase-js client. It EXECUTES queries:
// filters (eq/neq/in/gt/gte/lt/lte/is/not), the requested sort, range, limit,
// exact count (+ head), maybeSingle/single, an optional server row cap, and
// failure injection. Writes (insert/update/delete/upsert) succeed without
// changing data. Unknown builder methods are harmless no-ops. auth / rpc /
// channel are provided for rendering the dashboard. Not a test file.
export function fakeSupabase(tables, { fail = () => null, maxRows = Infinity, user = null, rpc = {} } = {}) {
  const calls = []
  let n = 0
  const noopChannel = () => { const ch = { on: () => ch, subscribe: () => ch, unsubscribe: () => {} }; return ch }
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
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
      const q = { table, opts: undefined, filters: [], orders: [], range: null, limit: null, single: null, write: false }
      const exec = () => {
        n++
        calls.push({ table, range: q.range, orders: q.orders.map((o) => [...o]), count: q.opts?.count || null })
        const f = fail({ table, from: q.range ? q.range[0] : null, call: n, head: !!q.opts?.head, write: q.write })
        if (f === 'throw') throw new Error('network down')
        if (f) return { data: null, count: null, error: { code: '503', message: 'upstream unavailable' } }
        if (q.write) return { data: null, error: null, count: null }
        let rows = (tables[table] || []).map((r, i) => ({ r, i })).filter(({ r }) => q.filters.every(([op, c, v]) => {
          const x = r[c]
          if (op === 'eq') return x === v
          if (op === 'neq') return x !== v
          if (op === 'in') return v.includes(x)
          if (op === 'gt') return x > v
          if (op === 'gte') return x >= v
          if (op === 'lt') return x < v
          if (op === 'lte') return x <= v
          if (op === 'notnull') return x !== null && x !== undefined
          if (op === 'isnull') return x === null || x === undefined
          return true
        }))
        const total = rows.length
        const hasTiebreak = q.orders.some(([c]) => c === 'id')
        rows.sort((a, b) => {
          for (const [c, asc] of q.orders) {
            if (a.r[c] === b.r[c]) continue
            return cmp(a.r[c], b.r[c]) * (asc ? 1 : -1)
          }
          // Equal sort keys: with a unique tiebreaker this never runs. Without one the
          // database may return ties in ANY order per query: alternate to model that.
          return hasTiebreak ? 0 : (n % 2 ? a.i - b.i : b.i - a.i)
        })
        const [from, to] = q.range || [0, Infinity]
        let data = rows.slice(from, Math.min(to + 1, from + maxRows)).map(({ r }) => r)
        if (q.limit != null) data = data.slice(0, q.limit)
        const count = q.opts?.count === 'exact' ? total : null
        if (q.opts?.head) return { data: null, error: null, count }
        if (q.single) return { data: data[0] ?? null, error: null, count }
        return { data, error: null, count }
      }
      const api = new Proxy({}, {
        get(_t, prop) {
          if (prop === 'then') return (res, rej) => new Promise((ok, no) => { try { ok(exec()) } catch (e) { no(e) } }).then(res, rej)
          if (prop === 'select') return (_c, opts) => { q.opts = opts; return api }
          if (prop === 'eq' || prop === 'neq' || prop === 'gt' || prop === 'gte' || prop === 'lt' || prop === 'lte') return (c, v) => { q.filters.push([prop, c, v]); return api }
          if (prop === 'in') return (c, v) => { q.filters.push(['in', c, v]); return api }
          if (prop === 'is') return (c, v) => { if (v === null) q.filters.push(['isnull', c]); return api }
          if (prop === 'not') return (c, op, v) => { if (op === 'is' && v === null) q.filters.push(['notnull', c]); return api }
          if (prop === 'order') return (c, o) => { q.orders.push([c, o?.ascending !== false]); return api }
          if (prop === 'range') return (a, b) => { q.range = [a, b]; return api }
          if (prop === 'limit') return (k) => { q.limit = k; return api }
          if (prop === 'maybeSingle') return () => { q.single = 'maybe'; return api }
          if (prop === 'single') return () => { q.single = 'single'; return api }
          if (prop === 'insert' || prop === 'update' || prop === 'delete' || prop === 'upsert') return () => { q.write = true; return api }
          return () => api // any other builder method (or, ilike, ...) is a harmless no-op
        },
      })
      return api
    },
  }
}

export const mkTips = (n, { uid = 'u1', sameTime = false, platform = 'chaturbate' } = {}) =>
  Array.from({ length: n }, (_, i) => ({
    id: `t${String(i).padStart(6, '0')}`, user_id: uid, platform, username: `fan${i % 40}`, usd: 0.025 * ((i % 9) + 1), tokens: (i % 9) + 1,
    date_time: sameTime ? '2026-10-01T00:00:00.000Z' : new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString(),
  }))
export const mkPaid = (n, { uid = 'u1' } = {}) =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${String(i).padStart(6, '0')}`, user_id: uid, platform: 'bongacams', username: `vip${i % 5}`, session_type: 'private', usd: 7.575,
    date_time: new Date(Date.UTC(2026, 5, 1) + i * 60000).toISOString(),
  }))
