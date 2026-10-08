/**
 * Free-tier history gating (single implementation: applyFreeAnalysisWindow /
 * accessibleDataset in lib/analytics.js).
 *   Primary platform (lib/planLimits.js resolvePlatformRoles) → full history.
 *   Other platforms → rolling 31 days anchored to their own latest row.
 *   No primary on file → every platform windowed (pre-existing rule).
 *   Pro → everything.
 */
import { applyFreeAnalysisWindow, accessibleDataset, aggregateRows } from '../analytics'
import { resolvePlatformRoles } from '../planLimits'
import { buildSessionHistory, dailySessionStats, privateEarningRows, totalEarned } from '../sessions/normalize'

const DAY = 86400000
const at = (iso) => new Date(iso).toISOString()
const tip = (platform, iso, usd, username = 'fan') => ({ platform, date_time: at(iso), usd, tokens: 1, username, tip_type: 'Tip' })

// Chaturbate is primary; BongaCams is secondary. Latest BC row: Oct 1.
const rows = [
  tip('Chaturbate', '2025-01-10T12:00:00Z', 50, 'old_cb'),   // >31 days old, primary
  tip('Chaturbate', '2026-09-20T12:00:00Z', 5, 'cb_new'),
  tip('BongaCams', '2026-08-01T12:00:00Z', 40, 'old_bc'),    // >31 days before BC's latest → hidden
  tip('BongaCams', '2026-09-01T12:00:00Z', 7, 'edge_bc'),    // exactly 30 days before latest → kept (31-day window)
  tip('BongaCams', '2026-08-31T11:59:00Z', 9, 'edge_out'),   // just outside → hidden
  tip('BongaCams', '2026-10-01T12:00:00Z', 3, 'bc_new'),
]

test('primary comes only from primary_pro_platform; none on file → null', () => {
  expect(resolvePlatformRoles(['Chaturbate', 'BongaCams'], null).primary).toBeNull()
  expect(resolvePlatformRoles(null, null).primary).toBeNull()
  expect(resolvePlatformRoles(['BongaCams', 'Chaturbate'], 'Chaturbate').primary).toBe('Chaturbate')
})

test('no primary + streaming_platforms[0] set → every platform gets 31 days', () => {
  const unlimited = resolvePlatformRoles(['Chaturbate', 'BongaCams'], null).primary
  const out = applyFreeAnalysisWindow(rows, { windowDays: 31, unlimitedPlatform: unlimited })
  expect(out.some((r) => r.username === 'old_cb')).toBe(false)
  expect(out.some((r) => r.username === 'old_bc')).toBe(false)
})

test('reordering streaming_platforms does not change gating', () => {
  const gate = (list, primary) => applyFreeAnalysisWindow(rows, { windowDays: 31, unlimitedPlatform: resolvePlatformRoles(list, primary).primary }).map((r) => r.username).sort()
  expect(gate(['Chaturbate', 'BongaCams'], null)).toEqual(gate(['BongaCams', 'Chaturbate'], null))
  expect(gate(['Chaturbate', 'BongaCams'], 'Chaturbate')).toEqual(gate(['BongaCams', 'Chaturbate'], 'Chaturbate'))
  expect(gate(['BongaCams', 'Chaturbate'], 'Chaturbate')).toContain('old_cb')
})

test('1. primary Free platform keeps history older than 31 days', () => {
  const out = applyFreeAnalysisWindow(rows, { windowDays: 31, unlimitedPlatform: 'chaturbate' })
  expect(out.some((r) => r.username === 'old_cb')).toBe(true)
})

test('2 + 3. secondary platform: >31 days hidden, exact boundary kept', () => {
  const out = applyFreeAnalysisWindow(rows, { windowDays: 31, unlimitedPlatform: 'Chaturbate' })
  const bc = out.filter((r) => r.platform === 'BongaCams').map((r) => r.username).sort()
  expect(bc).toEqual(['bc_new', 'edge_bc'])
})

test('no primary on file → every platform windowed (unchanged rule)', () => {
  const out = applyFreeAnalysisWindow(rows, { windowDays: 31 })
  expect(out.some((r) => r.username === 'old_cb')).toBe(false)
  expect(out.filter((r) => r.platform === 'Chaturbate')).toHaveLength(1)
})

test('4. Pro receives full history for every platform', () => {
  const d = accessibleDataset({ tips: rows, isPro: true })
  expect(d.tips).toHaveLength(rows.length)
})

test('8. hidden secondary rows cannot leak through private earnings, Live intervals or shows', () => {
  const paid = [
    { id: 1, platform: 'BongaCams', date_time: at('2026-08-01T13:00:00Z'), usd: 20, username: 'p_old', session_type: 'private' },
    { id: 2, platform: 'BongaCams', date_time: at('2026-09-30T13:00:00Z'), usd: 2, username: 'p_new', session_type: 'private' },
    { id: 3, platform: 'Chaturbate', date_time: at('2025-01-10T13:00:00Z'), usd: 4, username: 'p_cb_old', session_type: 'private' },
  ]
  const liveIntervals = [
    { platform: 'bongacams', ended_at: at('2026-08-02T00:00:00Z'), estimated_earnings_usd: 6 },
    { platform: 'bongacams', ended_at: at('2026-09-30T00:00:00Z'), estimated_earnings_usd: 1 },
  ]
  const shows = [
    { id: 'old', startedAt: at('2026-08-02T00:00:00Z'), endedAt: at('2026-08-02T01:00:00Z'), platform: 'bongacams', platformRevenue: [{ platform: 'bongacams', usd: 30 }] },
    { id: 'new', startedAt: at('2026-09-30T00:00:00Z'), endedAt: at('2026-09-30T01:00:00Z'), platform: 'bongacams', platformRevenue: [{ platform: 'bongacams', usd: 3 }] },
  ]
  const d = accessibleDataset({ tips: rows, paidSessions: paid, liveIntervals, shows, unlimitedPlatform: 'Chaturbate' })
  expect(d.paidSessions.map((p) => p.username).sort()).toEqual(['p_cb_old', 'p_new'])
  expect(d.liveIntervals).toHaveLength(1)
  expect(d.shows.map((s) => s.id)).toEqual(['new'])

  // Totals, fans, tips and sessions computed from the gated set never see old_bc / edge_out.
  const a = aggregateRows(d.tips, 'UTC')
  expect(a.totalUSD).toBeCloseTo(50 + 5 + 7 + 3, 2)
  expect(a.totalTips).toBe(4)
  const history = buildSessionHistory({ tips: d.tips, paidSessions: d.paidSessions, shows: d.shows })
  const allTipUsers = history.flatMap((e) => (e.session?.tips || []).map((t) => t.username))
  expect(allTipUsers).not.toContain('old_bc')
  expect(allTipUsers).not.toContain('edge_out')
  const earned = totalEarned({ publicUSD: a.totalUSD, privateRows: privateEarningRows({ paidSessions: d.paidSessions, liveIntervals: d.liveIntervals }) })
  expect(earned.privateUSD).toBe(4 + 2 + 1)
  const thirty = dailySessionStats({ tips: d.tips, history, paidSessions: d.paidSessions, tz: 'UTC', now: new Date('2026-10-01T23:00:00Z'), days: 400 })
  // 400-day range from Oct 1 2026 starts Aug 28 2025, so old_cb (Jan 2025) is outside it.
  expect(thirty.publicUSD).toBe(5 + 7 + 3)
})
