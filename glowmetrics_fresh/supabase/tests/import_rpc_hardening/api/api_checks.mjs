// Real-API checks for 20261101_harden_dedup_rpc_grants.sql and
// 20261102_import_links_on_delete_set_null.sql, sent through PostgREST with
// signed anonymous, authenticated and service_role JWTs.
//
// STATUS: written but NOT YET EXECUTED (needs a PostgREST binary; see run_api.sh).
//
// Usage (run_api.sh orchestrates this):  node api_checks.mjs baseline|after
// Env: API_URL, JWT_SECRET, PGHOST, PGPORT, PGDATABASE
import { createHmac } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const { API_URL, JWT_SECRET, PGHOST, PGPORT, PGDATABASE } = process.env
if (!API_URL || !JWT_SECRET || !PGHOST || !PGDATABASE) throw new Error('API_URL, JWT_SECRET, PGHOST, PGDATABASE are required')
if (/supabase\.(co|com)/.test(`${PGHOST} ${API_URL}`)) throw new Error('Refusing to run against a Supabase host.')

const A = '00000000-0000-0000-0000-00000000000a'
const B = '00000000-0000-0000-0000-00000000000b'
const UP_A1 = '10000000-0000-0000-0000-0000000000a1'
const UP_A2 = '10000000-0000-0000-0000-0000000000a2'
const UP_B1 = '10000000-0000-0000-0000-0000000000b1'

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (claims) => {
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64({ ...claims, exp: Math.floor(Date.now() / 1000) + 3600 })
  return `${head}.${body}.${createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url')}`
}
const TOKENS = {
  anon: jwt({ role: 'anon' }),
  A: jwt({ role: 'authenticated', sub: A }),
  B: jwt({ role: 'authenticated', sub: B }),
  service: jwt({ role: 'service_role' }),
}

const sql = (q) => execFileSync('psql', ['-X', '-q', '-tA', '-v', 'ON_ERROR_STOP=1', '-h', PGHOST, '-p', PGPORT || '5432', '-U', 'postgres', '-d', PGDATABASE, '-c', q], { encoding: 'utf8' }).trim()
async function call(who, method, path, body, headers = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKENS[who]}`, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { json = text }
  return { status: res.status, json }
}
const rpc = (who, fn, body) => call(who, 'POST', `/rpc/${fn}`, body)

let fails = 0
const check = (cond, label) => { if (cond) console.log(`PASS: ${label}`); else { fails++; console.log(`FAIL: ${label}`) } }
const denied = (r) => r.status === 401 || r.status === 403            // permission denied (42501)
const rejected = (r) => r.status >= 400 || (r.json && typeof r.json === 'object' && 'error' in r.json) // insert_tips_dedup returns errors in a 200 body
const tip = (user, name, tokens, minute, extra = {}) => ({ user_id: user, date_time: `2026-06-01T10:${String(minute).padStart(2, '0')}:00Z`, platform: 'Chaturbate', username: name, tokens: String(tokens), ...extra })
const paid = (user, name, minute, extra = {}) => ({ user_id: user, date_time: `2026-06-01T11:${String(minute).padStart(2, '0')}:00Z`, platform: 'Chaturbate', username: name, session_type: 'Private Chat', tokens: 10, usd: 0.5, ...extra })
const cnt = (table, where) => Number(sql(`SELECT count(*) FROM public.${table} WHERE ${where}`))
const totals = () => sql(`SELECT (SELECT count(*)||'/'||coalesce(sum(usd),0) FROM tips WHERE username NOT LIKE 'api_%')||' ; '||(SELECT count(*)||'/'||coalesce(sum(usd),0) FROM paid_sessions WHERE username NOT LIKE 'api_%')`)
const cleanup = () => sql(`DELETE FROM public.tips WHERE username LIKE 'api_%'; DELETE FROM public.paid_sessions WHERE username LIKE 'api_%'`)

const phase = process.argv[2]
const before = totals()

if (phase === 'baseline') {
  // Production-identical functions and grants: confirm the holes through the real API.
  const r1 = await rpc('anon', 'insert_paid_sessions_dedup', { sessions: [paid(B, 'api_intruder', 1)] })
  check(r1.status === 200 && cnt('paid_sessions', "username='api_intruder'") === 1, `baseline: anonymous API call writes private earnings into another account (status ${r1.status}) — hole confirmed`)
  const r2 = await rpc('A', 'insert_tips_dedup', { tips: [tip(A, 'api_link', 5, 1)], p_upload_id: UP_B1 })
  check(r2.status === 200 && sql("SELECT upload_id FROM public.tips WHERE username='api_link'") === UP_B1, 'baseline: A can link a tip to B\'s import via the API — gap confirmed')
  cleanup()
} else if (phase === 'after') {
  // ── Function permissions through the API ──────────────────────────────
  let r = await rpc('anon', 'insert_paid_sessions_dedup', { sessions: [paid(B, 'api_intruder', 2)] })
  check(denied(r) && cnt('paid_sessions', "username='api_intruder'") === 0, `anon: insert_paid_sessions_dedup refused (HTTP ${r.status})`)
  r = await rpc('anon', 'insert_tips_dedup', { tips: [tip(B, 'api_intruder', 5, 2)] })
  check(denied(r) && cnt('tips', "username='api_intruder'") === 0, `anon: insert_tips_dedup refused (HTTP ${r.status})`)

  // ── Cross-account writes ──────────────────────────────────────────────
  r = await rpc('A', 'insert_paid_sessions_dedup', { sessions: [paid(B, 'api_cross', 3)] })
  check(r.status >= 400 && cnt('paid_sessions', "username='api_cross'") === 0, `A cannot write private earnings for B (HTTP ${r.status})`)
  r = await rpc('A', 'insert_tips_dedup', { tips: [tip(A, 'api_mine', 5, 3), tip(B, 'api_theirs', 5, 3)] })
  check(rejected(r) && cnt('tips', "username IN ('api_mine','api_theirs')") === 0, 'A cannot write tips for B; the mixed batch saves nothing')

  // ── Legitimate imports, duplicates, provenance ────────────────────────
  const file = [tip(A, 'api_rep', 10, 4, { tip_seq: '1' }), tip(A, 'api_rep', 10, 4, { tip_seq: '2' }), tip(A, 'api_one', 7, 5)]
  r = await rpc('A', 'insert_tips_dedup', { tips: file, p_upload_id: UP_A1 })
  check(r.status === 200 && r.json?.inserted === 3, `A imports its own file under its own import (inserted ${r.json?.inserted})`)
  check(sql("SELECT string_agg(tip_seq::text, ',' ORDER BY tip_seq) FROM public.tips WHERE username='api_rep'") === '1,2', 'identical tips keep occurrence sequences 1,2')
  r = await rpc('A', 'insert_tips_dedup', { tips: file, p_upload_id: UP_A2 })
  check(r.status === 200 && r.json?.inserted === 0, `re-upload under a second import adds nothing (inserted ${r.json?.inserted})`)
  check(sql("SELECT count(*) FROM public.tips WHERE username LIKE 'api_%' AND upload_id = '" + UP_A1 + "'") === '3', 'tips keep the first import\'s link after the re-upload')

  // ── Import ownership ──────────────────────────────────────────────────
  r = await rpc('A', 'insert_tips_dedup', { tips: [tip(A, 'api_foreign', 5, 6)], p_upload_id: UP_B1 })
  check(rejected(r) && cnt('tips', "username='api_foreign'") === 0, 'A cannot link tips to B\'s import')
  r = await rpc('A', 'insert_paid_sessions_dedup', { sessions: [paid(A, 'api_foreign_pv', 6, { upload_id: UP_B1 })] })
  check(r.status >= 400 && cnt('paid_sessions', "username='api_foreign_pv'") === 0, `A cannot link private earnings to B's import (HTTP ${r.status})`)
  r = await rpc('A', 'insert_tips_dedup', { tips: [tip(A, 'api_ghost', 5, 7)], p_upload_id: '10000000-0000-0000-0000-0000000000ff' })
  check(rejected(r) && cnt('tips', "username='api_ghost'") === 0, 'a non-existent import id is rejected')
  r = await rpc('A', 'insert_paid_sessions_dedup', { sessions: [paid(A, 'api_own_pv', 7, { upload_id: UP_A1 })] })
  check(r.status === 200 && r.json?.inserted === 1 && sql("SELECT upload_id FROM public.paid_sessions WHERE username='api_own_pv'") === UP_A1, 'A can link private earnings to its own import')

  // ── service_role (server-side code) ───────────────────────────────────
  r = await rpc('service', 'insert_tips_dedup', { tips: [tip(A, 'api_svc_ok', 5, 8)], p_upload_id: UP_A1 })
  check(r.status === 200 && r.json?.inserted === 1, 'service_role: own-import link works')
  r = await rpc('service', 'insert_tips_dedup', { tips: [tip(A, 'api_svc_bad', 5, 9)], p_upload_id: UP_B1 })
  check(rejected(r) && cnt('tips', "username='api_svc_bad'") === 0, 'service_role: a foreign import link is rejected too')

  // ── Row-level isolation through the REST API ──────────────────────────
  for (const table of ['tips', 'paid_sessions', 'csv_uploads']) {
    const ra = await call('A', 'GET', `/${table}?select=user_id&limit=5000`)
    check(ra.status === 200 && Array.isArray(ra.json) && ra.json.length > 0 && ra.json.every((x) => x.user_id === A), `A reads only its own ${table} rows (${ra.json?.length})`)
    const rb = await call('B', 'GET', `/${table}?select=user_id&limit=5000`)
    check(rb.status === 200 && Array.isArray(rb.json) && rb.json.every((x) => x.user_id === B), `B reads only its own ${table} rows (${rb.json?.length})`)
    const rn = await call('anon', 'GET', `/${table}?select=user_id&limit=5`)
    check(denied(rn) || (rn.status === 200 && Array.isArray(rn.json) && rn.json.length === 0), `anon reads no ${table} rows (HTTP ${rn.status})`)
  }

  // ── Anonymous writes through table endpoints change nothing ───────────
  const pre = totals()
  const pre_up = cnt('csv_uploads', 'true')
  await call('anon', 'DELETE', `/tips?user_id=eq.${B}`)
  await call('anon', 'DELETE', `/paid_sessions?user_id=eq.${A}`)
  await call('anon', 'DELETE', `/csv_uploads?user_id=eq.${B}`)
  await call('anon', 'PATCH', `/tips?user_id=eq.${B}`, { usd: 0 })
  await call('anon', 'POST', '/tips', { user_id: B, date_time: '2026-06-02T00:00:00Z', platform: 'Chaturbate', username: 'api_anon_row', tokens: 1, usd: 0.05 })
  await call('anon', 'POST', '/paid_sessions', paid(B, 'api_anon_pv', 10))
  check(totals() === pre && cnt('csv_uploads', 'true') === pre_up && cnt('tips', "username='api_anon_row'") + cnt('paid_sessions', "username='api_anon_pv'") === 0, 'anonymous DELETE/PATCH/POST on tips, paid_sessions, csv_uploads change nothing')

  // ── Deleting imports ──────────────────────────────────────────────────
  r = await call('A', 'DELETE', `/csv_uploads?id=eq.${UP_B1}`, undefined, { Prefer: 'return=representation' })
  check(cnt('csv_uploads', `id='${UP_B1}'`) === 1, `A cannot delete B's import (HTTP ${r.status}, ${Array.isArray(r.json) ? r.json.length : '?'} rows)`)
  const tipsLinked = cnt('tips', `upload_id='${UP_A1}'`)
  const pvLinked = cnt('paid_sessions', `upload_id='${UP_A1}'`)
  r = await call('A', 'DELETE', `/csv_uploads?id=eq.${UP_A1}`, undefined, { Prefer: 'return=representation' })
  check(cnt('csv_uploads', `id='${UP_A1}'`) === 0, 'A can delete its own import record')
  check(tipsLinked > 0 && cnt('tips', "username LIKE 'api_%' AND upload_id IS NULL") >= tipsLinked && cnt('tips', "username LIKE 'api_%'") >= tipsLinked, `deleting the import keeps its ${tipsLinked} tips and clears their link`)
  check(pvLinked > 0 && cnt('paid_sessions', "username='api_own_pv' AND upload_id IS NULL") === 1, `deleting the import keeps its ${pvLinked} private earning(s) and clears the link`)
  cleanup()
  check(totals() === before, `existing tip and private-earnings counts and USD totals unchanged (${before})`)
} else {
  throw new Error('usage: node api_checks.mjs baseline|after')
}

console.log(`${phase}: ${fails === 0 ? 'ALL PASSED' : fails + ' FAILED'}`)
process.exit(fails === 0 ? 0 : 1)
