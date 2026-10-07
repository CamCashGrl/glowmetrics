/**
 * @jest-environment node
 *
 * CamCash has no cross-creator dataset, so no screen may claim a creator's
 * rank among other models/creators. This scans every app/component/lib
 * source file for ranking copy and for the removed derived "percentile"
 * (100 - revenue / 50) that used to back "Top X% of models on this platform".
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', '..')
const DIRS = ['app', 'components', 'lib']
const SELF = path.resolve(__filename)

function sourceFiles(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...sourceFiles(full))
    else if (/\.(js|jsx|ts|tsx)$/.test(entry.name) && path.resolve(full) !== SELF) out.push(full)
  }
  return out
}

const FILES = DIRS.flatMap((d) => sourceFiles(path.join(ROOT, d)))

const RANKING_COPY = [
  /top\s*(\$\{[^}]*\}|\d+)\s*%\s*of\s*(models|creators|performers|cam\s*models|streamers)/i,
  /(models|creators|performers)\s+on\s+this\s+platform/i,
  /upload\s+more\s+data\s+to\s+rank/i,
]
const FAKE_PERCENTILE = /100\s*-\s*\(?\s*\w+\s*\/\s*50\s*\)?/

test('scans a meaningful number of source files', () => {
  expect(FILES.length).toBeGreaterThan(50)
  expect(FILES.some((f) => f.endsWith(path.join('app', 'dashboard', 'page.js')))).toBe(true)
})

test('no cross-creator ranking copy renders anywhere', () => {
  const hits = []
  for (const f of FILES) {
    const src = fs.readFileSync(f, 'utf8')
    for (const re of RANKING_COPY) if (re.test(src)) hits.push(`${path.relative(ROOT, f)} ~ ${re}`)
  }
  expect(hits).toEqual([])
})

test('the derived fake percentile (100 - revenue / 50) is gone', () => {
  const hits = FILES.filter((f) => FAKE_PERCENTILE.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f))
  expect(hits).toEqual([])
})
