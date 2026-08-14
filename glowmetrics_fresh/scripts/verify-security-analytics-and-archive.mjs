// Security regressions for the two findings raised during the redesign.
//
// A. /analytics had NO authentication. It was a client page that queried
//    Supabase directly with the browser anon key and read cross-user data
//    (beta_users counts, every user_id in tips, analytics_events, and other
//    creators' profiles -- display_name and chaturbate_username), while
//    describing itself as "internal only". Anyone who typed the URL got it;
//    what came back depended purely on whichever RLS policy each table
//    happened to carry, not on anything the page enforced.
//
// B. public.test_tips_archive had RLS disabled, zero policies, and SELECT
//    granted to anon and authenticated. It holds archived tip rows with the
//    same shape as production tip data.
//
// These checks are static so they run offline in the normal suite. The B
// fix is a migration, so the assertions pin the migration's content and the
// fact that it touches no production table; the live database state was
// verified separately with the Supabase advisors before it was committed.

import { readFileSync, readdirSync } from 'fs'

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}`) }
  else { fail++; console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ''}`) }
}
const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

// ══════════════════════════════════════════════════════════════════════
// A. /analytics is gated, and the browser no longer queries across users.
// ══════════════════════════════════════════════════════════════════════
{
  const pageRaw = read('../app/analytics/page.js')
  const page = strip(pageRaw)

  check('A: /analytics no longer imports the browser Supabase client',
    !page.includes("from '../../lib/supabase'"))
  check('A: /analytics issues no Supabase query of its own',
    !/supabase\s*\.\s*from\(/.test(page))
  for (const table of ['beta_users', 'analytics_events', 'profiles']) {
    check(`A: /analytics no longer names the ${table} table client-side`,
      !page.includes(`'${table}'`))
  }
  check('A: /analytics redirects to the admin login without the admin cookie',
    page.includes("document.cookie.includes('gm_admin=')") && page.includes("router.replace('/admin/login')"))
  check('A: /analytics reads its data from the gated API route',
    page.includes("fetch('/api/admin/funnel'"))
  check('A: /analytics renders a refusal when the server denies it',
    page.includes('setDenied(true)') && pageRaw.includes('Not authorised'))
  // The cookie check is a redirect, not a gate. Say so in the file, so the
  // next reader does not mistake it for the security boundary.
  check('A: the page documents that the cookie check is UX only',
    pageRaw.includes('UX redirect only'))

  const route = strip(read('../app/api/admin/funnel/route.js'))
  check('A: the funnel route verifies the signed admin token',
    route.includes('verifyAdminToken('))
  check('A: it reads that token from the request cookie header',
    route.includes('getAdminTokenFromCookieHeader(req.headers.get('))
  check('A: it returns 401 when the token does not verify',
    /if \(!verifyAdminToken\(token\)\) \{[\s\S]{0,120}status: 401/.test(route))
  check('A: it runs server-side with the service-role key, not the anon key',
    route.includes('process.env.SUPABASE_SERVICE_ROLE_KEY') &&
    !route.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY'))
  // The auth check must come BEFORE any query, or an unauthorised caller
  // still causes the reads.
  check('A: the token is verified before the first query runs',
    route.indexOf('verifyAdminToken(') < route.indexOf(".from('beta_users')"),
    `verify at ${route.indexOf('verifyAdminToken(')}, first query at ${route.indexOf(".from('beta_users')")}`)
  // Functionality preserved: the route still produces all three sections
  // the page renders.
  check('A: the route still returns the totals the page renders',
    route.includes('signups') && route.includes('onboarded') && route.includes('activated'))
  check('A: the route still returns the step funnel', route.includes('stepFunnel'))
  check('A: the route still returns the drop-off list', route.includes('dropoffs'))
}

// ══════════════════════════════════════════════════════════════════════
// A2. No admin API route may skip the gate. /analytics was not special --
//     it was just the one nobody had checked.
// ══════════════════════════════════════════════════════════════════════
{
  // Deliberately unauthenticated, with the reason. Anything NOT listed here
  // must verify the token, so a new admin route cannot ship ungated.
  const UNGATED_BY_DESIGN = {
    // Called from the public signup flow by users who are not signed in.
    // It reads nothing and returns nothing — it posts a Telegram
    // notification to the operator — so an admin gate would break signup.
    // (It does let an anonymous caller push arbitrary text into that
    // Telegram channel; noted as an abuse vector, not a data exposure.)
    'notify-signup': 'posts an operator notification during public signup',
  }

  const dir = new URL('../app/api/admin/', import.meta.url)
  const routes = readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
  check('A2: admin API routes were found to check', routes.length > 0, `found ${routes.length}`)
  for (const name of routes) {
    let src
    try { src = strip(read(`../app/api/admin/${name}/route.js`)) } catch { continue }
    if (UNGATED_BY_DESIGN[name]) {
      check(`A2: /api/admin/${name} is ungated by design (${UNGATED_BY_DESIGN[name]})`,
        !/\.from\(|SUPABASE_SERVICE_ROLE_KEY/.test(src),
        'an ungated route must not read the database or hold the service-role key')
      continue
    }
    check(`A2: /api/admin/${name} verifies the admin token`, src.includes('verifyAdminToken('))
  }
}

// ══════════════════════════════════════════════════════════════════════
// B. test_tips_archive is locked down, and production access is not.
// ══════════════════════════════════════════════════════════════════════
{
  const mig = read('../supabase/migrations/20260814d_secure_test_tips_archive.sql')
  const sql = mig.replace(/^\s*--.*$/gm, '')   // statements only, not the rationale

  check('B: the migration revokes anon access to the archive',
    /revoke\s+all\s+on\s+table\s+public\.test_tips_archive\s+from\s+anon/i.test(sql))
  check('B: the migration revokes authenticated access to the archive',
    /revoke\s+all\s+on\s+table\s+public\.test_tips_archive\s+from\s+authenticated/i.test(sql))
  check('B: the migration enables RLS on the archive',
    /alter\s+table\s+public\.test_tips_archive\s+enable\s+row\s+level\s+security/i.test(sql))
  check('B: RLS is FORCEd, so a table owner cannot read around it',
    /alter\s+table\s+public\.test_tips_archive\s+force\s+row\s+level\s+security/i.test(sql))
  check('B: no policy is added — deny-all is the intended end state',
    !/create\s+policy/i.test(sql))

  // The instruction was explicit: do not weaken production data access to
  // solve a test-table problem. Nothing but the archive may appear here.
  const touched = [...sql.matchAll(/\bpublic\.([a-z_][a-z0-9_]*)/gi)].map(m => m[1].toLowerCase())
  check('B: the migration touches ONLY test_tips_archive',
    touched.length > 0 && touched.every(t => t === 'test_tips_archive'),
    `touched: ${[...new Set(touched)].join(', ')}`)
  for (const prod of ['tips', 'profiles', 'beta_users', 'analytics_events', 'live_tips', 'uploads']) {
    check(`B: the migration does not alter public.${prod}`,
      !new RegExp(`public\\.${prod}\\b`, 'i').test(sql))
  }
  check('B: no GRANT widens access anywhere in the migration', !/\bgrant\b/i.test(sql))

  // The app never referenced this table, which is why removing access is
  // safe rather than a functionality change. Pin that.
  const appFiles = []
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name === '.git') continue
      const full = new URL(`${e.name}${e.isDirectory() ? '/' : ''}`, d)
      if (e.isDirectory()) walk(full)
      else if (/\.(js|jsx|ts|tsx)$/.test(e.name)) appFiles.push(full)
    }
  }
  walk(new URL('../app/', import.meta.url))
  walk(new URL('../lib/', import.meta.url))
  const referencing = appFiles.filter(f => readFileSync(f, 'utf8').includes('test_tips_archive'))
  check('B: no application code reads test_tips_archive (so revoking breaks nothing)',
    referencing.length === 0, referencing.map(String).join(', '))
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
