/**
 * One source of truth for primary-platform identity (lib/planLimits.js), never
 * inferred from earnings; and every Free-facing tab consumes the gated dataset.
 */
const fs = require('fs')
const path = require('path')
import { resolvePlatformRoles } from '../planLimits'
import { resolvePlatformRoles as previewRoles, computeDataVaultStats } from '../../app/dashboard/DashboardPreview'
import { accessibleDataset, aggregateRows } from '../analytics'

const ROOT = path.join(__dirname, '..', '..')
const src = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const tips = [
  { platform: 'BongaCams', date_time: '2026-10-01T12:00:00Z', usd: 900, username: 'big', tokens: 1 },
  { platform: 'Chaturbate', date_time: '2026-10-01T12:00:00Z', usd: 1, username: 'small', tokens: 1 },
]

test('canonical field primary_pro_platform wins; streaming_platforms[0] is only a fallback', () => {
  expect(resolvePlatformRoles(['bongacams', 'chaturbate'], 'chaturbate')).toEqual({ primary: 'chaturbate', secondary: ['bongacams'] })
  expect(resolvePlatformRoles(['myfreecams', 'chaturbate'], null).primary).toBe('myfreecams')
  expect(resolvePlatformRoles(null, null)).toEqual({ primary: null, secondary: [] })
})

test('DashboardPreview never infers primary from earnings', () => {
  // BongaCams earns 900x more, but nothing was selected → no primary.
  const r = previewRoles({ primaryProPlatform: null, streamingPlatforms: null, tips })
  expect(r.primary).toBeNull()
  expect(r.secondary).toEqual(['Chaturbate', 'BongaCams']) // fixed order, not revenue order
  expect(previewRoles({ primaryProPlatform: 'chaturbate', streamingPlatforms: ['chaturbate', 'bongacams'], tips }).primary).toBe('Chaturbate')
})

test('no dashboard code ranks platforms by revenue to pick a primary', () => {
  const files = ['app/dashboard/DashboardPreview.js', 'lib/planLimits.js']
  for (const f of files) {
    const s = src(f)
    expect(s).not.toMatch(/byUsd/)
    expect(s).not.toMatch(/primary:\s*ranked\[0\]/)
  }
  expect(src('app/dashboard/DashboardPreview.js')).toMatch(/resolvePlanPlatformRoles\(/)
})

test('growth charts, Platforms and Title Generator receive the gated dataset', () => {
  const page = src('app/dashboard/page.js')
  expect(page).toMatch(/<DashboardGrowthCharts tips=\{accessible\.tips\}/)
  expect(page).toMatch(/<PlatformsIntelligence\s+analytics=\{analytics\}\s+tips=\{accessible\.tips\}/)
  expect(page).toMatch(/<TitleGenerator [^>]*tips=\{accessible\.tips\}/)
  expect(page).toMatch(/<SessionsOverview\s+tips=\{accessible\.tips\}\s+shows=\{accessible\.shows\}\s+paidSessions=\{accessible\.paidSessions\}/)
  expect(page).not.toMatch(/tips=\{tips\}/)
})

test('hidden secondary rows do not affect coverage, platform totals or fan counts', () => {
  const rows = [
    { platform: 'Chaturbate', date_time: '2024-01-01T12:00:00Z', usd: 10, username: 'cb_old', tokens: 1 },
    { platform: 'BongaCams', date_time: '2026-06-01T12:00:00Z', usd: 50, username: 'bc_hidden', tokens: 1 },
    { platform: 'BongaCams', date_time: '2026-10-01T12:00:00Z', usd: 5, username: 'bc_new', tokens: 1 },
  ]
  const d = accessibleDataset({ tips: rows, unlimitedPlatform: 'Chaturbate' })
  const a = aggregateRows(d.tips, 'UTC')
  expect(a.platforms.find((p) => p.platform === 'BongaCams').totalUSD).toBe(5)
  expect(a.totalUSD).toBe(15)
  expect((a.topTippers || []).some((f) => f.username === 'bc_hidden')).toBe(false)
  const vault = computeDataVaultStats(d.tips)
  expect(JSON.stringify(vault)).not.toMatch(/2026-06-01/)
  // Pro: identical input passes through untouched.
  expect(accessibleDataset({ tips: rows, isPro: true }).tips).toBe(rows)
})
