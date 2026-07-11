import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// This PR intentionally collects coaching-outcome and session-context data
// without yet displaying any effectiveness/lift/causal conclusion — those
// are separate, future features once enough real Live Mode sessions exist.
// This test scans every Session Hub source file so a future edit can't
// silently reintroduce a premature performance claim.

const here = dirname(fileURLToPath(import.meta.url))
const SESSION_HUB_LIB_DIR = join(here, '..')
const SESSIONS_UI_DIR = join(here, '..', '..', '..', 'app', 'dashboard', 'sessions')

const FORBIDDEN_PATTERNS = [
  /earnings? (increased|rose|grew) because/i,
  /coaching (effectiveness|worked|works)/i,
  /% (increase|lift|boost) in earnings/i,
  /revenue lift/i,
  /best[- ]performing coaching category/i,
  /caused (a|an|the) (increase|decrease)/i,
  /proof that/i,
  /streaming plan recommendation/i,
  /goal[- ]performance (lift|improvement)/i,
]

function collectJsFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...collectJsFiles(full))
    else if (entry.name.endsWith('.js')) out.push(full)
  }
  return out
}

describe('no premature earnings/coaching/goal/plan effectiveness claims', () => {
  const files = [...collectJsFiles(SESSION_HUB_LIB_DIR), ...collectJsFiles(SESSIONS_UI_DIR)]

  it('scans at least the expected Session Hub source files', () => {
    expect(files.length).toBeGreaterThan (5)
  })

  files.forEach(file => {
    it(`${file.replace(here, '.')} contains no forbidden performance-claim language`, () => {
      const contents = readFileSync(file, 'utf8')
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(pattern.test(contents), `${file} matched forbidden pattern ${pattern}`).toBe(false)
      }
    })
  })
})
