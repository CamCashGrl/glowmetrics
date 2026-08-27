// Regression test for app/sitemap.js — catches exactly the class of bug
// found during the SEO/indexing audit: sitemap entries that don't match
// any real page (guaranteed 404s for Google) and legacy/redirect-source
// slugs that shouldn't be listed at all (a sitemap should only list final
// canonical destinations). Run this whenever blog/guide content changes.
//
// Imports the real app/sitemap.js rather than mirroring it. sitemap.js has
// no JSX or CJS/ESM boundary issue, but it does use Next's extensionless
// import resolution, which plain Node ESM does not do — so the source is
// copied to a temp file with those specifiers resolved before importing.

import { readdirSync, statSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function dirSlugs(relDir) {
  const full = path.join(root, relDir)
  return readdirSync(full)
    .filter(name => statSync(path.join(full, name)).isDirectory())
    .filter(name => name !== '[slug]')
}

// Next resolves extensionless relative imports; plain Node ESM does not.
// Copy sitemap.js to a temp file with '.js' appended to those specifiers so
// this script can import the real file instead of a drifting mirror.
const sitemapPath = await (async () => {
  const fs = await import('fs')
  const os = await import('os')
  const srcPath = path.join(root, 'app', 'sitemap.js')
  const src = fs.readFileSync(srcPath, 'utf8')
  const resolved = src.replace(
    /(from\s+['"])(\.[^'"]*?)(['"])/g,
    (match, pre, spec, post) => (path.extname(spec) ? match : `${pre}${spec}.js${post}`),
  )
  if (resolved === src) return srcPath
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-verify-'))
  const out = path.join(tmp, 'sitemap.mjs')
  // Relative specifiers still have to resolve against app/, so rewrite them
  // to absolute paths rooted at the real file's directory.
  fs.writeFileSync(out, resolved.replace(
    /(from\s+['"])(\.[^'"]*)(['"])/g,
    (_m, pre, spec, post) => `${pre}${path.resolve(path.dirname(srcPath), spec)}${post}`,
  ))
  return out
})()

const sitemapModule = await import(sitemapPath)
const entries = sitemapModule.default()
const urls = entries.map(e => e.url)

let pass = 0, fail = 0
function check(name, cond) { if (cond) { pass++; console.log(`PASS  ${name}`) } else { fail++; console.log(`FAIL  ${name}`) } }

// ══════════════════════════════════════════════════════════════════════
// 1. Basic shape — every entry has a real https URL under the production
//    host, no accidental relative paths or localhost leaking in.
// ══════════════════════════════════════════════════════════════════════
check('every sitemap entry starts with https://www.camcashgrl.com', urls.every(u => u.startsWith('https://www.camcashgrl.com')))
check('no duplicate URLs in the sitemap', new Set(urls).size === urls.length)
check('sitemap has a sane number of entries (not empty, not obviously truncated)', entries.length > 80)

// ══════════════════════════════════════════════════════════════════════
// 2. Blog slugs — every /blog/<slug> entry must have either a real static
//    folder (app/blog/<slug>/page.js) since blog_posts (Supabase) is
//    currently empty and the [slug] dynamic fallback has nothing to serve.
// ══════════════════════════════════════════════════════════════════════
{
  const blogDirs = new Set(dirSlugs('app/blog'))
  const blogUrls = urls.filter(u => u.includes('/blog/'))
  const missing = blogUrls.filter(u => !blogDirs.has(u.split('/blog/')[1]))
  check(`all ${blogUrls.length} sitemap blog URLs have a matching static folder`, missing.length === 0)
  if (missing.length) console.log('      missing:', missing)
}

// ══════════════════════════════════════════════════════════════════════
// 3. Guide slugs — either a static folder OR a key in the guides/[slug]
//    hardcoded GUIDES object (a legitimate second valid source, unlike
//    blog's empty DB table).
// ══════════════════════════════════════════════════════════════════════
{
  const fs = await import('fs')
  const guideDirs = new Set(dirSlugs('app/guides'))
  const guideSlugSrc = fs.readFileSync(path.join(root, 'app', 'guides', '[slug]', 'page.js'), 'utf8')
  const guideKeys = new Set([...guideSlugSrc.matchAll(/^\s*'([a-z0-9-]+)':\s*\{/gm)].map(m => m[1]))
  const guideUrls = urls.filter(u => u.includes('/guides/'))
  const missing = guideUrls.filter(u => {
    const slug = u.split('/guides/')[1]
    return !guideDirs.has(slug) && !guideKeys.has(slug)
  })
  check(`all ${guideUrls.length} sitemap guide URLs resolve to a static folder or a GUIDES key`, missing.length === 0)
  if (missing.length) console.log('      missing:', missing)
}

// ══════════════════════════════════════════════════════════════════════
// 4. Redirect sources — no sitemap entry may be a URL that next.config.mjs
//    redirects away from. A sitemap should only ever list final canonical
//    destinations.
// ══════════════════════════════════════════════════════════════════════
{
  const fs = await import('fs')
  const cfgSrc = fs.readFileSync(path.join(root, 'next.config.mjs'), 'utf8')
  const redirectSources = new Set(
    [...cfgSrc.matchAll(/source:\s*'([^']+)'/g)]
      .map(m => m[1])
      .filter(s => !s.includes('(') && !s.includes(':')) // drop the host-matcher catch-all pattern
  )
  const offenders = urls.filter(u => {
    const path_ = u.replace('https://www.camcashgrl.com', '')
    return redirectSources.has(path_)
  })
  check('no sitemap URL is a next.config.mjs redirect source', offenders.length === 0)
  if (offenders.length) console.log('      offenders:', offenders)
}

// ══════════════════════════════════════════════════════════════════════
// 5. Known previously-broken slugs stay fixed — explicit regression guard
//    for the exact bugs found in this audit pass, so they can't silently
//    come back via a careless future edit.
// ══════════════════════════════════════════════════════════════════════
check('bongacams-camscore-exsplained (real slug, typo and all) IS in the sitemap', urls.includes('https://www.camcashgrl.com/blog/bongacams-camscore-exsplained'))
check('bongacams-camscore-explained (the "corrected" but non-existent slug) is NOT in the sitemap', !urls.includes('https://www.camcashgrl.com/blog/bongacams-camscore-explained'))
check('live-mode-coaching-for-cam-models (dead — no page, empty blog_posts table) is NOT in the sitemap', !urls.includes('https://www.camcashgrl.com/blog/live-mode-coaching-for-cam-models'))
check('/analytics (internal funnel dashboard, not public content) is NOT in the sitemap', !urls.includes('https://www.camcashgrl.com/analytics'))

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
