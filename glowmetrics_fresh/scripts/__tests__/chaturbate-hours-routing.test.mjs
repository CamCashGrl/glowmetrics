import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import test from 'node:test'
import config from '../../next.config.mjs'
import sitemap from '../../app/sitemap.js'

const root = fileURLToPath(new URL('../../', import.meta.url))
const canonical = '/guides/chaturbate-hours'
const origin = 'https://www.camcashgrl.com'
const aliases = [
  '/guides/chaturbate-best-hours',
  '/guides/best-time-to-stream-chaturbate',
  '/guides/best-time-to-stream-on-chaturbate',
]

test('legacy timing URLs redirect directly to the ranking URL on both hosts', async () => {
  const rules = await config.redirects()
  for (const host of ['www.camcashgrl.com', 'camcashgrl.com']) {
    for (const source of aliases) {
      const rule = rules.find(rule =>
        (rule.source === source || rule.source === '/:path((?!api/).*)') &&
        (!rule.has || rule.has.every(condition => condition.type === 'host' && condition.value === host))
      )
      assert.ok(rule, host + source)
      assert.equal(rule.statusCode, 301, host + source)
      assert.equal(new URL(rule.destination, 'https://' + host).href, origin + canonical)
    }
  }
  assert.ok(!rules.some(rule => rule.source === canonical), 'primary URL must not redirect')
})

test('sitemap lists the primary URL once and excludes every timing alias', () => {
  const urls = sitemap().map(page => page.url)
  assert.equal(urls.filter(url => url === origin + canonical).length, 1)
  for (const alias of aliases) assert.ok(!urls.includes(origin + alias), alias)
})

test('primary article exists and shares its canonical across metadata and Article schema', async () => {
  const source = await readFile(path.join(root, 'app', canonical.slice(1), 'page.js'), 'utf8')
  assert.ok(source.includes("const CANONICAL_URL = '" + origin + canonical + "'"))
  assert.ok(source.includes('canonical: CANONICAL_URL'))
  assert.ok(source.includes('url: CANONICAL_URL'))
  assert.ok(source.includes("'@id': CANONICAL_URL"))
  assert.ok(source.includes('Best Time to Stream on Chaturbate: Peak Hours &amp; Best Days'))
})

test('legacy page components redirect instead of publishing duplicate articles', async () => {
  for (const alias of aliases.slice(0, 2)) {
    const source = await readFile(path.join(root, 'app', alias.slice(1), 'page.js'), 'utf8')
    assert.ok(source.includes("permanentRedirect('" + canonical + "')"), alias)
    assert.ok(!source.includes('export const metadata'), alias)
  }
})

test('public content and indexing script link directly to the primary URL', async () => {
  async function check(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name)
      if (entry.isDirectory()) await check(filename)
      else if (/\.(js|jsx|mjs|tsx)$/.test(entry.name)) {
        const source = await readFile(filename, 'utf8')
        const code = source.split('\n').filter(line => !line.trimStart().startsWith('//')).join('\n')
        for (const alias of aliases) {
          assert.ok(!code.includes(alias), path.relative(root, filename) + ' links to ' + alias)
        }
      }
    }
  }
  await check(path.join(root, 'app'))
  const script = await readFile(path.join(root, 'scripts/request-indexing.mjs'), 'utf8')
  assert.ok(script.includes(origin + canonical))
})
