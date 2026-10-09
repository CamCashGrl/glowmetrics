/**
 * @jest-environment node
 */
import { toShowSummary, mergeShows, latestShowDelta, unacknowledgedIds } from '../postShow'

const row = (over = {}) => ({
  id: 'show-1',
  user_id: 'u1',
  status: 'ended',
  stream_platform: 'Chaturbate',
  started_at: '2026-10-07T20:00:00.000Z',
  ended_at: '2026-10-07T21:00:00.000Z',
  finalized_at: '2026-10-07T21:00:00.000Z',
  dashboard_seen_at: null,
  final_total_usd: 82.5,
  final_public_usd: 62.5,
  final_private_usd: 20,
  final_private_seconds: 600,
  final_platform_breakdown: { chaturbate: { usd: 50, tips: 2 }, bongacams: { usd: 12.5, tips: 1 } },
  final_tokens: 1500,
  final_tip_count: 3,
  final_unique_tippers: 2,
  final_top_tipper_username: 'Alice',
  final_top_tipper_usd: 50,
  final_largest_tip_usd: 50,
  final_duration_seconds: 3600,
  final_usd_per_hour: 82.5,
  ...over,
})

const intervals = [
  { id: 'p2', live_session_id: 'show-1', platform: 'chaturbate', started_at: '2026-10-07T20:40:00Z', ended_at: '2026-10-07T20:45:00Z', rate_per_minute: '2.00', estimated_earnings_usd: '10.00' },
  { id: 'p1', live_session_id: 'show-1', platform: 'chaturbate', started_at: '2026-10-07T20:10:00Z', ended_at: '2026-10-07T20:15:00Z', rate_per_minute: '2.00', estimated_earnings_usd: '10.00' },
  { id: 'other', live_session_id: 'show-2', platform: 'chaturbate', started_at: '2026-10-07T20:10:00Z', ended_at: '2026-10-07T20:15:00Z', rate_per_minute: '9', estimated_earnings_usd: '45' },
]

describe('toShowSummary', () => {
  test('maps every persisted value without recomputing earnings', () => {
    const s = toShowSummary(row(), intervals)
    expect(s).toMatchObject({
      id: 'show-1', totalUsd: 82.5, publicUsd: 62.5, privateUsd: 20, privateSeconds: 600,
      tipCount: 3, uniqueTippers: 2, tokens: 1500, largestTipUsd: 50, durationSeconds: 3600,
      endedAt: '2026-10-07T21:00:00.000Z', isNew: true,
    })
    expect(s.topTipper).toEqual({ username: 'Alice', usd: 50 })
  })

  test('public + private reconcile to the session total', () => {
    const s = toShowSummary(row(), intervals)
    expect(s.publicUsd + s.privateUsd).toBeCloseTo(s.totalUsd, 10)
  })

  test('only this session\'s private intervals are attached, oldest first', () => {
    const s = toShowSummary(row(), intervals)
    expect(s.privateIntervals.map((i) => i.id)).toEqual(['p1', 'p2'])
    expect(s.privateIntervals.reduce((a, i) => a + i.earningsUsd, 0)).toBe(20)
  })

  test('platform revenue kept per platform, largest first', () => {
    expect(toShowSummary(row(), []).platformRevenue).toEqual([
      { platform: 'chaturbate', usd: 50, tips: 2 },
      { platform: 'bongacams', usd: 12.5, tips: 1 },
    ])
  })

  test('acknowledged session is not new', () => {
    expect(toShowSummary(row({ dashboard_seen_at: '2026-10-07T21:05:00Z' })).isNew).toBe(false)
  })

  test('null / all-null row is not a show', () => {
    expect(toShowSummary(null)).toBeNull()
    expect(toShowSummary({ id: null })).toBeNull()
  })
})

describe('mergeShows / latestShowDelta', () => {
  const a = toShowSummary(row({ id: 'a', ended_at: '2026-10-07T21:00:00Z', final_total_usd: 82.5 }))
  const b = toShowSummary(row({ id: 'b', ended_at: '2026-10-07T23:00:00Z', final_total_usd: 40, final_public_usd: 40, final_private_usd: 0 }))

  test('the same session fetched repeatedly is still one show', () => {
    expect(mergeShows([a, b], [a], [b, a]).map((s) => s.id)).toEqual(['b', 'a'])
  })

  test('delta is the newest unacknowledged show only, never a sum of shows', () => {
    const d = latestShowDelta([a, b])
    expect(d).toMatchObject({ sessionId: 'b', totalUsd: 40, label: '+$40.00 from latest show' })
  })

  test('two completed shows give two distinct deltas as each is acknowledged', () => {
    const d1 = latestShowDelta([a, b])
    const d2 = latestShowDelta([a, { ...b, isNew: false }])
    expect(d1.sessionId).toBe('b')
    expect(d2.sessionId).toBe('a')
    expect(d2.totalUsd).toBe(82.5)
    expect(latestShowDelta([{ ...a, isNew: false }, { ...b, isNew: false }])).toBeNull()
  })

  test('refetching the same data does not change the delta', () => {
    expect(latestShowDelta([a, b, b, a])).toEqual(latestShowDelta([a, b]))
  })

  test('unacknowledgedIds lists each new show once', () => {
    expect(unacknowledgedIds([a, b, a])).toEqual(['b', 'a'])
  })
})
