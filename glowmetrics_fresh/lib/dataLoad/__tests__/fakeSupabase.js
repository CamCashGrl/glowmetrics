// Minimal in-memory stand-in for the supabase-js query builder used by
// lib/dataLoad/queries.js. It EXECUTES the query: filters, the requested sort,
// range, exact count, an optional server row cap, and failure injection.
// Not a test file (no .test.js suffix).
export function fakeSupabase(tables, { fail = () => null, maxRows = Infinity } = {}) {
  const calls = []
  let n = 0
  return {
    calls,
    from(table) {
      const q = { table, opts: undefined, filters: [], orders: [], range: null }
      const exec = () => {
        n++
        calls.push({ table, range: q.range, orders: q.orders.map((o) => [...o]), count: q.opts?.count || null })
        const f = fail({ table, from: q.range[0], call: n })
        if (f === 'throw') throw new Error('network down')
        if (f) return { data: null, count: null, error: { code: '503', message: 'upstream unavailable' } }
        let rows = (tables[table] || []).map((r, i) => ({ r, i })).filter(({ r }) => q.filters.every(([c, v]) => r[c] === v))
        const total = rows.length
        const hasTiebreak = q.orders.some(([c]) => c === 'id')
        rows.sort((a, b) => {
          for (const [c, asc] of q.orders) {
            if (a.r[c] === b.r[c]) continue
            return (a.r[c] < b.r[c] ? -1 : 1) * (asc ? 1 : -1)
          }
          // Equal sort keys: with a unique tiebreaker this never runs. Without one the
          // database may return ties in ANY order per query: alternate to model that.
          return hasTiebreak ? 0 : (n % 2 ? a.i - b.i : b.i - a.i)
        })
        const [from, to] = q.range
        const data = rows.slice(from, Math.min(to + 1, from + maxRows)).map(({ r }) => r)
        return { data, error: null, count: q.opts?.count === 'exact' ? total : null }
      }
      const api = {
        select(_cols, opts) { q.opts = opts; return api },
        eq(c, v) { q.filters.push([c, v]); return api },
        order(c, o) { q.orders.push([c, o?.ascending !== false]); return api },
        range(a, b) { q.range = [a, b]; return api },
        then(res, rej) { return new Promise((ok, no) => { try { ok(exec()) } catch (e) { no(e) } }).then(res, rej) },
      }
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
