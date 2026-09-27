#!/usr/bin/env node
/**
 * TIMEZONE GUARD
 *
 * A stream time only means something to a creator as their own wall-clock
 * time. Reading a tip's day or hour in UTC produces a different answer for
 * anyone not on UTC, so two features that read the same timestamp on different
 * clocks will name the same session differently.
 *
 * This has been introduced repeatedly, sometimes deliberately — app/dashboard/
 * page.js still carries comments reading "FIX: use getUTCHours() — tips stored
 * in UTC". That the timestamps are STORED in UTC is true and irrelevant: they
 * must be READ on the creator's clock. Storage format and display basis are
 * different questions.
 *
 * Use instead:
 *   toLocalHour(dateStr, tz) / toLocalDow(dateStr, tz)   from lib/analytics.js
 *   or plain .getHours() / .getDay() in a client component, where the browser
 *   clock is already the creator's.
 *
 * getUTCFullYear/Month/Date are not flagged on their own — they are fine for
 * duration arithmetic — but a UTC *date key* beside a local hour has the same
 * split-clock problem, so prefer local there too when the key labels a day.
 *
 * The baseline below records sites that predate this guard. The check fails
 * only when a file exceeds its baseline or a new file appears, so existing
 * debt does not block every pull request while new occurrences are stopped.
 * Lower a number when you fix one; never raise one.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const PATTERN = /\.getUTC(Day|Hours)\s*\(\s*\)/g

// Known, accepted sites as of this guard's introduction.
const BASELINE = {
  'app/dashboard/page.js': 15,
  'lib/analytics.js': 8,  // Reduced from 9: replaced getUTCHours() with toLocalHour() in identifyWhales()
  'app/dashboard/DashboardGrowthCharts.js': 2,
}

// Genuinely correct uses: the tz helpers' own fallback when Intl is missing,
// and fixtures/demos that are not creator data.
const EXEMPT = [
  /^lib\/analytics\/__tests__\//,
  /^lib\/analytics\/localTime\.js$/, // Fallback for when Intl.DateTimeFormat fails
  /^app\/dashboard\/__tests__\//,
  /^app\/landing\/demo\//,
  /^app\/demo\//,
  /^scripts\//,
  /^node_modules\//,
  /^\.next\//,
]

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '.git') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(js|jsx|mjs|ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

const counts = {}
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file)
  if (EXEMPT.some(re => re.test(rel))) continue
  const hits = (readFileSync(file, 'utf8').match(PATTERN) || []).length
  if (hits > 0) counts[rel] = hits
}

const failures = []
for (const [file, n] of Object.entries(counts)) {
  const allowed = BASELINE[file] ?? 0
  if (n > allowed) {
    failures.push(
      allowed === 0
        ? `  ${file}: ${n} use(s) of getUTCDay()/getUTCHours() in a file with no baseline`
        : `  ${file}: ${n} use(s), baseline allows ${allowed}`
    )
  }
}

// Surface progress so the baseline gets tightened rather than forgotten.
const improved = Object.entries(BASELINE)
  .filter(([file, allowed]) => (counts[file] ?? 0) < allowed)
  .map(([file, allowed]) => `  ${file}: now ${counts[file] ?? 0}, baseline still ${allowed} — lower it`)

if (failures.length) {
  console.error('\nTimezone guard failed — a day or hour is being read in UTC.\n')
  console.error(failures.join('\n'))
  console.error(`
Creator-facing days and hours must be read on the creator's clock:
  toLocalHour(dateStr, tz) / toLocalDow(dateStr, tz)  from lib/analytics.js
  or .getHours() / .getDay() in a client component.

Timestamps being stored in UTC is not a reason to read them in UTC.
If this really is duration arithmetic rather than a label, add the file to
BASELINE in scripts/check-timezone.mjs with a comment saying why.
`)
  process.exit(1)
}

if (improved.length) {
  console.log('Timezone guard passed. Baselines that can now be lowered:\n' + improved.join('\n'))
} else {
  console.log('Timezone guard passed.')
}
