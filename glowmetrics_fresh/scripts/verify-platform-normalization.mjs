// Standalone verification for canonicalPlatform() / normalizeRowPlatforms()
// (lib/constants.js) and the session-fragmentation they fix.
//
// Same convention as scripts/verify-canonical-analytics.mjs: no test framework
// in this repo, so the logic is mirrored here and run against fixtures.
// Keep in sync with lib/constants.js if the alias map changes.

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`) }
}

// ── mirrored from lib/constants.js ──────────────────────────────────────────
const PLATFORM_TOKEN_RATES = { Chaturbate: 0.05, BongaCams: 0.025, MyFreeCams: 0.05, Stripchat: 0.05, CamSoda: 0.05 }
const DEFAULT_TOKEN_RATE = 0.05
const UNDETECTED_PLATFORM = 'Unknown'
const PLATFORM_ALIASES = {
  cb: 'Chaturbate', bc: 'BongaCams', mfc: 'MyFreeCams', sc: 'Stripchat', cs: 'CamSoda',
  'bonga cams': 'BongaCams', 'bonga-cams': 'BongaCams', bongamodels: 'BongaCams',
  'my free cams': 'MyFreeCams', 'strip chat': 'Stripchat', 'cam soda': 'CamSoda',
}
const PLATFORM_SUBSTRINGS = [
  ['bonga', 'BongaCams'], ['chaturbate', 'Chaturbate'], ['freecams', 'MyFreeCams'],
  ['stripchat', 'Stripchat'], ['camsoda', 'CamSoda'],
]
const CANONICAL_BY_LOWER = Object.fromEntries(Object.keys(PLATFORM_TOKEN_RATES).map(n => [n.toLowerCase(), n]))
function canonicalPlatform(value) {
  if (value == null) return UNDETECTED_PLATFORM
  const raw = String(value).trim()
  if (!raw) return UNDETECTED_PLATFORM
  const lower = raw.toLowerCase()
  if (CANONICAL_BY_LOWER[lower]) return CANONICAL_BY_LOWER[lower]
  if (PLATFORM_ALIASES[lower]) return PLATFORM_ALIASES[lower]
  for (const [needle, canonical] of PLATFORM_SUBSTRINGS) if (lower.includes(needle)) return canonical
  return raw
}
function normalizeRowPlatforms(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return rows
  let changed = false
  const out = rows.map(row => {
    if (!row || typeof row !== 'object') return row
    const c = canonicalPlatform(row.platform)
    if (c === row.platform) return row
    changed = true
    return { ...row, platform: c }
  })
  return changed ? out : rows
}
const PLATFORM_TOKEN_RATES_LOWER = Object.fromEntries(Object.entries(PLATFORM_TOKEN_RATES).map(([k, v]) => [k.toLowerCase(), v]))
function tokenRate(platform) {
  if (!platform) return DEFAULT_TOKEN_RATE
  return PLATFORM_TOKEN_RATES_LOWER[platform.toLowerCase()] ?? DEFAULT_TOKEN_RATE
}

// ── mirrored from lib/analytics/sessions.js (gap rule only) ─────────────────
function countSessions(rows) {
  const sorted = [...rows].sort((a, b) => new Date(a.date_time) - new Date(b.date_time))
  let n = 0, prev = null
  for (const r of sorted) {
    const t = new Date(r.date_time).getTime()
    if (!prev || r.platform !== prev.platform || t - prev.t > 3 * 60 * 60 * 1000) n++
    prev = { platform: r.platform, t }
  }
  return n
}

console.log('\nALIASES FOUND IN PRODUCTION')
{
  check("'BC' -> BongaCams (519 rows in production)", canonicalPlatform('BC'), 'BongaCams')
  check("'chaturbate' -> Chaturbate (casing from the extension path)", canonicalPlatform('chaturbate'), 'Chaturbate')
  check("'myfreecams' -> MyFreeCams", canonicalPlatform('myfreecams'), 'MyFreeCams')
  check("'CB' -> Chaturbate", canonicalPlatform('CB'), 'Chaturbate')
  check("'MFC' -> MyFreeCams", canonicalPlatform('MFC'), 'MyFreeCams')
  check('already-canonical names are unchanged', ['Chaturbate', 'BongaCams', 'MyFreeCams'].map(canonicalPlatform), ['Chaturbate', 'BongaCams', 'MyFreeCams'])
}

console.log('\nSPACING AND SUBSTRING VARIANTS')
{
  check("'Bonga Cams' -> BongaCams", canonicalPlatform('Bonga Cams'), 'BongaCams')
  check("'bongamodels' -> BongaCams", canonicalPlatform('bongamodels'), 'BongaCams')
  check("'  Chaturbate.com  ' -> Chaturbate", canonicalPlatform('  Chaturbate.com  '), 'Chaturbate')
  check("'Strip Chat' -> Stripchat", canonicalPlatform('Strip Chat'), 'Stripchat')
}

console.log('\nSAFETY — never guess')
{
  check('unknown platform passes through unchanged', canonicalPlatform('SomeNewSite'), 'SomeNewSite')
  check('empty string -> Unknown', canonicalPlatform(''), 'Unknown')
  check('null -> Unknown', canonicalPlatform(null), 'Unknown')
  check("'Unknown' stays Unknown (absence, not a platform)", canonicalPlatform('Unknown'), 'Unknown')
}

console.log('\nTOKEN RATE — the bug this fixes')
{
  check("tokenRate('BC') was falling back to the 0.05 default", tokenRate('BC'), 0.05)
  check('after normalization it resolves to BongaCams 0.025', tokenRate(canonicalPlatform('BC')), 0.025)
  check('a 1000-token BongaCams tip: $50 wrong vs $25 correct', [1000 * tokenRate('BC'), 1000 * tokenRate(canonicalPlatform('BC'))], [50, 25])
}

console.log('\nSESSION FRAGMENTATION — the reason this runs before detectSessions()')
{
  // One real 2-hour stream whose rows alternate between the two spellings.
  const stream = [
    { date_time: '2026-03-04T20:00:00Z', platform: 'BongaCams' },
    { date_time: '2026-03-04T20:30:00Z', platform: 'BC' },
    { date_time: '2026-03-04T21:00:00Z', platform: 'BongaCams' },
    { date_time: '2026-03-04T21:40:00Z', platform: 'BC' },
  ]
  check('before: one stream splits into four sessions', countSessions(stream), 4)
  check('after: it is one session', countSessions(normalizeRowPlatforms(stream)), 1)

  // A genuine platform switch must still split.
  const real = [
    { date_time: '2026-03-04T20:00:00Z', platform: 'BongaCams' },
    { date_time: '2026-03-04T20:30:00Z', platform: 'Chaturbate' },
  ]
  check('a real platform switch still splits', countSessions(normalizeRowPlatforms(real)), 2)

  // A >3h gap must still split, normalization or not.
  const gapped = [
    { date_time: '2026-03-04T10:00:00Z', platform: 'BC' },
    { date_time: '2026-03-04T20:00:00Z', platform: 'BongaCams' },
  ]
  check('a >3h gap still splits after normalization', countSessions(normalizeRowPlatforms(gapped)), 2)
}

console.log('\nPLATFORM COUNT')
{
  const rows = [
    { platform: 'BongaCams' }, { platform: 'BC' }, { platform: 'bc' },
    { platform: 'Chaturbate' }, { platform: 'chaturbate' }, { platform: 'Unknown' },
  ]
  const before = new Set(rows.map(r => r.platform)).size
  const after = new Set(normalizeRowPlatforms(rows).map(r => r.platform)).size
  check('5 spellings collapse to 2 platforms plus Unknown', [before, after], [6, 3])
}

console.log('\nNON-MUTATION')
{
  const rows = [{ platform: 'BC', usd: 5 }]
  const out = normalizeRowPlatforms(rows)
  check('input rows are not mutated', rows[0].platform, 'BC')
  check('output is canonical', out[0].platform, 'BongaCams')
  check('other fields are preserved', out[0].usd, 5)
  const clean = [{ platform: 'Chaturbate' }]
  check('unchanged input returns the same array reference', normalizeRowPlatforms(clean) === clean, true)
}

console.log('\nINGESTION BOUNDARY — the client-supplied platform field')
{
  // /api/upload writes fd.get('platform') straight to tips.platform when the
  // caller supplies one, bypassing parseCSV(). An empty field must stay falsy
  // so the detectPlatform(raw) fallback still fires.
  const canonicalPlatformName = (v) => (v ? canonicalPlatform(v) : '')
  check("a client sending 'bc' now writes BongaCams", canonicalPlatformName('bc'), 'BongaCams')
  check("a client sending 'chaturbate' now writes Chaturbate", canonicalPlatformName('chaturbate'), 'Chaturbate')
  check('an absent field stays falsy so text detection still runs', canonicalPlatformName(''), '')
}

console.log('\nDISPLAY — platform colour lookup survives canonical names')
{
  const PLATFORM_COLORS = { chaturbate: '#f97316', myfreecams: '#3b82f6', stripchat: '#ec4899', bongacams: '#8b5cf6', camsoda: '#10b981', other: '#64748b' }
  const SLATE = '#64748b'
  const platformColorFor = (p) => PLATFORM_COLORS[String(p || '').toLowerCase()] || SLATE
  // Before the case-insensitive lookup, canonical title-case names missed the
  // lowercase keys and every platform rendered grey.
  check('canonical name finds its colour', platformColorFor('Chaturbate'), '#f97316')
  check('BongaCams finds its colour', platformColorFor('BongaCams'), '#8b5cf6')
  check('an old lowercase spelling still resolves', platformColorFor('chaturbate'), '#f97316')
  check('an unknown platform falls back to slate', platformColorFor('SomeNewSite'), SLATE)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
