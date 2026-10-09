/**
 * Post-show dashboard: finalized shows come from the server's persisted view,
 * NEW clears through a per-account acknowledgement, and nothing is counted
 * twice across refreshes, reconnects or repeated Stops.
 */
import React from 'react'
import { render, screen, renderHook, act, waitFor } from '@testing-library/react'
import LatestShows, { LatestShowDelta } from '../LatestShows'
import { useRecentShows } from '../useRecentShows'

const show = (over = {}) => ({
  id: 'show-a', platform: 'Chaturbate', startedAt: '2026-10-07T20:00:00Z', endedAt: '2026-10-07T21:00:00Z',
  finalizedAt: '2026-10-07T21:00:00Z', durationSeconds: 3600, totalUsd: 82.5, publicUsd: 62.5, privateUsd: 20,
  privateSeconds: 600, privateIntervals: [], tokens: 1500, tipCount: 3, uniqueTippers: 2,
  topTipper: { username: 'Alice', usd: 50 }, largestTipUsd: 50, usdPerHour: 82.5,
  platformRevenue: [{ platform: 'chaturbate', usd: 50, tips: 2 }, { platform: 'bongacams', usd: 12.5, tips: 1 }],
  isNew: true, seenAt: null, ...over,
})

// A fake backend holding persisted shows and per-account acknowledgement,
// shared by every "device" (hook instance) that talks to it.
function makeServer(initial) {
  const state = { shows: initial.map((s) => ({ ...s })), recentCalls: 0, ackCalls: [] }
  const fetchImpl = async (url, opts = {}) => {
    if (url.startsWith('/api/live/sessions/recent')) {
      state.recentCalls++
      return { ok: true, json: async () => ({ shows: state.shows.map((s) => ({ ...s })) }) }
    }
    if (url === '/api/live/sessions/acknowledge') {
      const { sessionIds } = JSON.parse(opts.body)
      state.ackCalls.push(sessionIds)
      const acknowledged = []
      for (const s of state.shows) {
        if (sessionIds.includes(s.id)) {
          s.seenAt = s.seenAt || '2026-10-07T21:10:00Z'
          s.isNew = false
          acknowledged.push({ id: s.id, seenAt: s.seenAt })
        }
      }
      return { ok: true, json: async () => ({ acknowledged }) }
    }
    throw new Error(`unexpected ${url}`)
  }
  return { state, fetchImpl }
}

describe('LatestShows rendering', () => {
  test('finalized show shows every persisted value, platform split and NEW', () => {
    render(<LatestShows shows={[show()]} loading={false} error={null} />)
    expect(screen.getByTestId('new-badge')).toHaveTextContent('NEW')
    expect(screen.getByTestId('show-total')).toHaveTextContent('$82.50')
    expect(screen.getByTestId('show-public')).toHaveTextContent('$62.50')
    expect(screen.getByTestId('show-private')).toHaveTextContent('$20.00')
    expect(screen.getByTestId('show-tips')).toHaveTextContent('3')
    expect(screen.getByTestId('show-unique')).toHaveTextContent('2')
    expect(screen.getByTestId('show-top')).toHaveTextContent('Alice ($50.00)')
    expect(screen.getByTestId('show-largest')).toHaveTextContent('$50.00')
    expect(screen.getByTestId('show-duration')).toHaveTextContent('1h 0m')
    expect(screen.getByTestId('show-private-time')).toHaveTextContent('10m')
    expect(screen.getByTestId('platform-chaturbate')).toHaveTextContent('$50.00 · 2 tips')
    expect(screen.getByTestId('platform-bongacams')).toHaveTextContent('$12.50 · 1 tip')
  })

  test('acknowledged show has no NEW badge', () => {
    render(<LatestShows shows={[show({ isNew: false })]} loading={false} error={null} />)
    expect(screen.queryByTestId('new-badge')).toBeNull()
  })

  test('KPI delta matches the new show exactly', () => {
    render(<LatestShowDelta delta={{ sessionId: 'show-a', totalUsd: 82.5, publicUsd: 62.5, privateUsd: 20, tipCount: 3, label: '+$82.50 from latest show' }} />)
    expect(screen.getByTestId('latest-show-delta-label')).toHaveTextContent('+$82.50 from latest show')
  })
})

describe('useRecentShows', () => {
  test('finished show appears immediately when the completed-show version changes', async () => {
    const server = makeServer([])
    const { result, rerender } = renderHook(({ v }) => useRecentShows(v, { fetchImpl: server.fetchImpl }), { initialProps: { v: 0 } })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.shows).toHaveLength(0)
    server.state.shows.push(show())
    rerender({ v: 1 })
    await waitFor(() => expect(result.current.shows.map((s) => s.id)).toEqual(['show-a']))
    expect(result.current.delta.label).toBe('+$82.50 from latest show')
  })

  test('refresh / reconnect / repeated Stop never duplicate a show or its earnings', async () => {
    const server = makeServer([show()])
    const { result, rerender } = renderHook(({ v }) => useRecentShows(v, { fetchImpl: server.fetchImpl }), { initialProps: { v: 1 } })
    await waitFor(() => expect(result.current.shows).toHaveLength(1))
    await act(async () => { await result.current.refresh() })
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    rerender({ v: 2 }) // e.g. a repeated Stop bumping the version again
    await waitFor(() => expect(server.state.recentCalls).toBeGreaterThanOrEqual(4))
    expect(result.current.shows).toHaveLength(1)
    expect(result.current.shows[0].totalUsd).toBe(82.5)
    expect(result.current.delta.totalUsd).toBe(82.5)
  })

  test('acknowledgement clears NEW and persists for a second device', async () => {
    const server = makeServer([show()])
    const deviceA = renderHook(() => useRecentShows(1, { fetchImpl: server.fetchImpl }))
    await waitFor(() => expect(deviceA.result.current.newIds).toEqual(['show-a']))
    await act(async () => { await deviceA.result.current.acknowledge(['show-a']) })
    expect(deviceA.result.current.shows[0].isNew).toBe(false)
    expect(deviceA.result.current.delta).toBeNull()

    const deviceB = renderHook(() => useRecentShows(0, { fetchImpl: server.fetchImpl }))
    await waitFor(() => expect(deviceB.result.current.loading).toBe(false))
    expect(deviceB.result.current.shows[0].isNew).toBe(false)
    expect(deviceB.result.current.delta).toBeNull()
  })

  test('two completed shows produce two distinct sessions and deltas, never one combined', async () => {
    const first = show({ id: 'show-a', endedAt: '2026-10-07T21:00:00Z', totalUsd: 82.5 })
    const second = show({ id: 'show-b', endedAt: '2026-10-07T23:30:00Z', totalUsd: 40, publicUsd: 40, privateUsd: 0 })
    const server = makeServer([first, second])
    const { result } = renderHook(() => useRecentShows(2, { fetchImpl: server.fetchImpl }))
    await waitFor(() => expect(result.current.shows).toHaveLength(2))
    expect(result.current.shows.map((s) => s.id)).toEqual(['show-b', 'show-a'])
    expect(result.current.delta).toMatchObject({ sessionId: 'show-b', totalUsd: 40 })
    await act(async () => { await result.current.acknowledge(['show-b']) })
    expect(result.current.delta).toMatchObject({ sessionId: 'show-a', totalUsd: 82.5 })
  })
})
