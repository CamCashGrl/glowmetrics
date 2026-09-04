// End-to-end production-readiness check for the redesigned dashboard.
//
// Same harness as scripts/verify-dashboard-render.mjs: the entry is JSX using
// Next's automatic runtime, so it is bundled with esbuild and then rendered
// through react-dom/server. Where the per-feature suites prove each piece in
// isolation, this one carries a single synthetic account through the whole
// journey — import, intelligence, each discovery, the contextual ask, the
// checkout payload, the return, and Free vs Pro — and asserts the pieces
// agree with each other.
//
// No database, no network, no Stripe call. Run: node scripts/verify-dashboard-e2e.mjs

import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const ENTRY = join(HERE, 'render', 'dashboard-e2e.entry.jsx')
// The bundle must sit inside the project so its react externals resolve.
const OUT = join(ROOT, '.dashboard-e2e-check.cjs')

try {
  execFileSync('npx', [
    'esbuild', ENTRY,
    '--bundle', '--platform=node', '--format=cjs', '--jsx=automatic',
    '--loader:.js=jsx', `--outfile=${OUT}`,
    '--external:react', '--external:react-dom', '--external:react/jsx-runtime',
  ], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] })
} catch {
  console.error('  ✗ bundle step failed — is esbuild available and node_modules installed?')
  rmSync(OUT, { force: true })
  process.exit(1)
}

let code = 0
try {
  execFileSync('node', [OUT], { cwd: ROOT, stdio: 'inherit' })
} catch (e) {
  code = e.status ?? 1
}
rmSync(OUT, { force: true })
process.exit(code)
