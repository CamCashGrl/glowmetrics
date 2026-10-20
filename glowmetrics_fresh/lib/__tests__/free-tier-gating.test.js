import {
  applyFreeAnalysisWindow,
  accessibleDataset,
  aggregateRows,
  summarizeWindowExclusion,
} from '../analytics'

const rows = [
  { platform: 'Chaturbate', date_time: '2026-06-01T12:00:00Z', usd: 100, username: 'old_cb', tokens: 2000 },
  { platform: 'Chaturbate', date_time: '2026-10-01T12:00:00Z', usd: 10, username: 'new_cb', tokens: 200 },
  { platform: 'BongaCams', date_time: '2026-06-01T12:00:00Z', usd: 50, username: 'old_bc', tokens: 2000 },
  { platform: 'BongaCams', date_time: '2026-10-01T12:00:00Z', usd: 5, username: 'new_bc', tokens: 200 },
]

test('Free 31-day window applies to every platform; old unlimitedPlatform argument grants nothing', () => {
  const out = applyFreeAnalysisWindow(rows, { windowDays: 31, unlimitedPlatform: 'Chaturbate' })
  expect(out.map(r => r.username).sort()).toEqual(['new_bc', 'new_cb'])
})

test('Free platform-comparison dataset keeps each platform recent slice, not old history', () => {
  const d = accessibleDataset({ tips: rows, isPro: false, unlimitedPlatform: 'Chaturbate', windowDays: 31 })
  expect(d.tips.map(r => r.username).sort()).toEqual(['new_bc', 'new_cb'])
  const aggregate = aggregateRows(d.tips, 'UTC')
  expect(aggregate.totalUSD).toBe(15)
})

test('Pro receives full stored history unchanged', () => {
  const d = accessibleDataset({ tips: rows, isPro: true })
  expect(d.tips).toBe(rows)
})

test('stored older rows create a truthful exclusion signal for locked teasers', () => {
  const visible = applyFreeAnalysisWindow(rows, { windowDays: 31 })
  const summary = summarizeWindowExclusion(rows, visible)
  expect(summary.excludedCount).toBe(2)
})

test('reordering platform arrays cannot change the actual 31-day data gate', () => {
  const a = applyFreeAnalysisWindow(rows, { windowDays: 31, unlimitedPlatform: 'Chaturbate' }).map(r => r.username).sort()
  const b = applyFreeAnalysisWindow(rows, { windowDays: 31, unlimitedPlatform: 'BongaCams' }).map(r => r.username).sort()
  const c = applyFreeAnalysisWindow(rows, { windowDays: 31, unlimitedPlatform: null }).map(r => r.username).sort()
  expect(a).toEqual(c)
  expect(b).toEqual(c)
})

test('all Free visible dates are within 31 days of each platform latest stored row', () => {
  const visible = applyFreeAnalysisWindow(rows, { windowDays: 31 })
  const latest = new Map()
  for (const row of rows) {
    const t = new Date(row.date_time).getTime()
    latest.set(row.platform, Math.max(latest.get(row.platform) || -Infinity, t))
  }
  for (const row of visible) {
    const ageDays = (latest.get(row.platform) - new Date(row.date_time).getTime()) / 86400000
    expect(ageDays).toBeLessThanOrEqual(30)
  }
})
