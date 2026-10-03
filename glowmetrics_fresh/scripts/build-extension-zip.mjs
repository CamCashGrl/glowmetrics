#!/usr/bin/env node
// Builds the downloadable extension (served at /camcash-extension.zip) from
// the real extension source in ../chrome-extension. Output is byte-for-byte
// reproducible (sorted entries, fixed timestamps) so a rebuild with unchanged
// source produces an identical file.
//
//   node scripts/build-extension-zip.mjs          rebuild public/camcash-extension.zip
//   node scripts/build-extension-zip.mjs --check  exit 1 if the committed zip is stale
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(here, '..', '..', 'chrome-extension')
const OUT = path.resolve(here, '..', 'public', 'camcash-extension.zip')

// Exactly what Chrome loads — never the tests/ folder or anything else.
const RUNTIME_FILES = ['manifest.json', 'background.js', 'content.js', 'popup.html', 'popup.js']
const ICON_DIR = 'icons'

function filesToShip() {
  const icons = fs.readdirSync(path.join(SRC, ICON_DIR)).filter((f) => f.endsWith('.png')).sort().map((f) => `${ICON_DIR}/${f}`)
  const all = [...RUNTIME_FILES, ...icons].sort()
  for (const f of all) if (!fs.existsSync(path.join(SRC, f))) throw new Error(`missing ${f} in ${SRC}`)
  const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'))
  if (manifest.background?.service_worker !== 'background.js') throw new Error('manifest service_worker is not background.js')
  if (!manifest.content_scripts?.some((c) => c.js?.includes('content.js'))) throw new Error('manifest does not load content.js')
  for (const perm of ['storage', 'alarms']) if (!manifest.permissions?.includes(perm)) throw new Error(`manifest missing "${perm}" permission`)
  return all
}

function build(target) {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-ext-'))
  try {
    const files = filesToShip()
    for (const f of files) {
      const dest = path.join(stage, f)
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.copyFileSync(path.join(SRC, f), dest)
      const fixed = new Date('2026-01-01T00:00:00Z')
      fs.utimesSync(dest, fixed, fixed)
    }
    if (fs.existsSync(target)) fs.rmSync(target)
    // -X drops extra attributes, -D no directory entries: reproducible output.
    execFileSync('zip', ['-q', '-X', '-D', target, ...files], { cwd: stage, env: { ...process.env, TZ: 'UTC' } })
    return files
  } finally {
    fs.rmSync(stage, { recursive: true, force: true })
  }
}

if (process.argv.includes('--check')) {
  const tmp = path.join(os.tmpdir(), `cc-ext-check-${process.pid}.zip`)
  build(tmp)
  const same = fs.existsSync(OUT) && Buffer.compare(fs.readFileSync(tmp), fs.readFileSync(OUT)) === 0
  fs.rmSync(tmp)
  if (!same) {
    console.error('public/camcash-extension.zip is out of date with chrome-extension/ — run: node scripts/build-extension-zip.mjs')
    process.exit(1)
  }
  console.log('public/camcash-extension.zip matches chrome-extension/')
} else {
  const files = build(OUT)
  console.log(`Wrote ${path.relative(process.cwd(), OUT)} with ${files.length} files:\n  ${files.join('\n  ')}`)
}
