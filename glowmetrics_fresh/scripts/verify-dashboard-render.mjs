// Render smoke test for the 2C-2 confidence layer.
//
// The other verify-*.mjs scripts mirror logic and run it against fixtures.
// This one is different on purpose: the property under test is that the real
// components actually MOUNT — with real intelligence, with intelligence still
// loading (null), and with an empty account — which mirroring cannot prove.
//
// The components are JSX with Next's automatic runtime, so the entry file is
// bundled with esbuild first and then rendered through react-dom/server. No
// network, no database: the fixture account is built in-process from
// aggregateRows(), the same engine the product uses.
//
// Run: node scripts/verify-dashboard-render.mjs

import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ENTRY = join(HERE, 'render', 'dashboard-render.entry.jsx')
// The bundle must sit inside the project so its `react` / `react-dom`
// externals resolve against node_modules. Written hidden and removed below.
const ROOT = join(HERE, '..')
const OUT = join(ROOT, '.dashboard-render-check.cjs')

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
