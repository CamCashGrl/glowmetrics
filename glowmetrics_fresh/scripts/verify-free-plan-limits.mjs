// Regression checks for the Free 3-platform / 31-day conversion boundary.
// This test is intentionally source-level: the final enforcement is split
// between API/import filtering and Supabase trigger/RPC migration.

import fs from 'fs'
import path from 'path'

const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

const plan = read('lib/planLimits.js')
const upload = read('app/api/upload/route.js')
const dashboard = read('app/dashboard/page.js')
const preview = read('app/dashboard/DashboardPreview.js')
const pricing = read('app/pricing/PricingClient.js')
const migration = read('supabase/migrations/20260817_free_plan_three_platform_31_day_history.sql')

const checks = [
  ['Free platform limit is 3', /FREE_MAX_PLATFORMS\s*=\s*3/.test(plan)],
  ['Free history window is 31 days', /FREE_HISTORY_DAYS\s*=\s*31/.test(plan)],
  ['Free history is filtered without deleting rows', /filterFreeHistory/.test(dashboard) && /setTips\(visibleData\)/.test(dashboard)],
  ['Upload route reads plan', /select\('plan'\)/.test(upload)],
  ['Upload route rejects a 4th platform', /combinedPlatforms\.length\s*>\s*FREE_MAX_PLATFORMS/.test(upload)],
  ['Upload route reports history truncation', /historyRemovedCount/.test(upload) && /historyLimited/.test(upload)],
  ['Dashboard imports the same Free history helper', /filterFreeHistory/.test(dashboard)],
  ['Dashboard exposes CSV history upgrade CTA', /csv_history/.test(dashboard) && /Unlock Full History/.test(dashboard)],
  ['Dashboard exposes 3-platform upgrade CTA', /csv_platform_limit/.test(dashboard) && /Compare More Platforms/.test(dashboard)],
  ['Dashboard no longer treats any single existing platform as the limit', /allPlatforms\.length\s*>=\s*FREE_MAX_PLATFORMS/.test(dashboard)],
  ['Preview copy says up to 3 platforms', /up to 3 platforms for free/.test(preview)],
  ['Pricing says up to 3 platforms', /Track up to 3 platforms/.test(pricing) || /up to 3 cam platforms/.test(pricing)],
  ['Pricing says 31-day CSV history', /31 days of tip history per platform/.test(pricing) || /31-day history window per platform/.test(pricing)],
  ['DB trigger uses 3-platform ceiling', /existing_platform_count\s*>=\s*3/.test(migration)],
  ['DB trigger checks tips/live_tips/paid_sessions', /from public\.tips[\s\S]*union[\s\S]*public\.live_tips[\s\S]*union[\s\S]*public\.paid_sessions/.test(migration)],
  ['Live session check uses same 3-platform ceiling', /create or replace function public\.check_free_tier_platform_limit/.test(migration)],
]

let passed = 0
for (const [name, ok] of checks) {
  if (!ok) {
    console.error(`FAIL: ${name}`)
    process.exitCode = 1
  } else {
    console.log(`PASS: ${name}`)
    passed++
  }
}

console.log(`\n${passed}/${checks.length} checks passed`)
if (passed !== checks.length) process.exit(1)
