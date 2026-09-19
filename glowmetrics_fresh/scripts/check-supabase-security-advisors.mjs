#!/usr/bin/env node
// Fails (non-zero exit) if Supabase reports any security advisory at WARN
// or ERROR level — the RLS/SECURITY DEFINER class of bug found and fixed in
// the Sept 19 audit. INFO-level findings are printed but don't fail the
// run, matching the severity levels Supabase's own advisor UI uses.
//
// Requires SUPABASE_ACCESS_TOKEN (a personal/service access token from
// https://supabase.com/dashboard/account/tokens) as an env var — this
// script never reads or logs it.
//
// A non-zero exit here fails the GitHub Actions run it's called from,
// which GitHub emails to the repo's watchers by default for a scheduled
// workflow — the same mechanism Dependabot and build-check.yml already
// rely on, so no separate notification wiring is needed here.

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'hlsdlaibnayzbfflxclj'
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN

if (!ACCESS_TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN is not set — cannot check advisors.')
  process.exit(1)
}

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/advisors/security`, {
  headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
})

if (!res.ok) {
  console.error(`Supabase Management API returned ${res.status}: ${await res.text()}`)
  process.exit(1)
}

const { lints = [] } = await res.json()

const blocking = lints.filter(l => l.level === 'WARN' || l.level === 'ERROR')
const info = lints.filter(l => l.level === 'INFO')

for (const lint of info) {
  console.log(`[INFO] ${lint.title}: ${lint.count} finding(s) — ${lint.remediation}`)
}

if (blocking.length === 0) {
  console.log('No WARN/ERROR-level Supabase security advisories. Clean.')
  process.exit(0)
}

console.error(`Found ${blocking.length} WARN/ERROR-level Supabase security advisory type(s):\n`)
for (const lint of blocking) {
  console.error(`[${lint.level}] ${lint.title} (${lint.count} finding${lint.count === 1 ? '' : 's'})`)
  console.error(`  ${lint.description}`)
  console.error(`  ${lint.remediation}`)
  for (const finding of lint.findings || []) {
    console.error(`    - ${finding.detail}`)
  }
  console.error('')
}
process.exit(1)
