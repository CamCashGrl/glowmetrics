import { renderHook, act, waitFor } from '@testing-library/react'
import { useLiveSessionEngine } from '../useLiveSessionEngine'

const session = (over = {}) => ({ id: 's1', status: 'live', live_substate: 'active', started_at: '2026-03-10T11:00:00Z', total_paused_seconds: 0, stream_platform: 'Chaturbate', ...over })
const allowanceOf = (over = {}) => ({ server_now: '2026-03-10T12:00:00Z', unlimited: false, limits: { starts_per_week: 2, stream_seconds: 2100, warn_seconds: 1500, strong_warn_seconds: 1800 }, week: { starts_used: 1, starts_remaining: 1 }, ...over })

let routes, calls
const json = (data, ok = true, status = 200) => Promise.resolve({ ok, status, json: async () => data })
beforeEach(() => {
  calls = []
  routes = { '/api/live/session/heartbeat': () => json({}) }
  global.fetch = jest.fn((url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null })
    // longest matching route wins (heartbeats and actions share the session prefix)
    const key = Object.keys(routes).filter((k) => url.startsWith(k)).sort((x, y) => y.length - x.length)[0]
    return key ? routes[key](url, opts) : json({})
  })
})
afterEach(() => { delete global.fetch })

const mount = async () => {
  const hook = renderHook(() => useLiveSessionEngine())
  await waitFor(() => expect(hook.result.current.phase).not.toBe('loading'))
  return hook
}

describe('useLiveSessionEngine — allowance (display of the database state)', () => {
  test('restore applies the database allowance and session', async () => {
    routes['/api/live/session'] = () => json({ session: session(), privateInterval: null, allowance: allowanceOf() })
    const { result } = await mount()
    expect(result.current.phase).toBe('active')
    expect(result.current.allowance.week.starts_used).toBe(1)
    expect(result.current.allowanceReceivedAt).toBeGreaterThan(0)
  })

  test('with no session the allowance is still available for the idle bar', async () => {
    routes['/api/live/session'] = () => json({ session: null, privateInterval: null, allowance: allowanceOf({ current: null }) })
    const { result } = await mount()
    expect(result.current.phase).toBe('idle'); expect(result.current.allowance).toBeTruthy()
  })

  test('goLive without a supported platform never calls the server and never defaults', async () => {
    routes['/api/live/session'] = () => json({ session: null, allowance: allowanceOf() })
    const { result } = await mount()
    for (const bad of [undefined, '', null, 'Stripchat', 'chaturbate']) {
      calls.length = 0
      let out
      await act(async () => { out = await result.current.goLive(bad) })
      expect(out).toBeUndefined()
      expect(calls.some((c) => c.url.includes('/start'))).toBe(false)
      expect(result.current.actionErrorCode).toBe('PLATFORM_REQUIRED')
      expect(result.current.actionError).toMatch(/never guesses/)
    }
  })

  test('goLive sends exactly the chosen platform', async () => {
    routes['/api/live/session/start'] = () => json({ session: session({ status: 'starting' }) })
    routes['/api/live/session'] = () => json({ session: null, allowance: allowanceOf() })
    const { result } = await mount()
    await act(async () => { await result.current.goLive('MyFreeCams') })
    const start = calls.find((c) => c.url === '/api/live/session/start')
    expect(start.method).toBe('POST'); expect(start.body).toEqual({ platform: 'MyFreeCams' })
  })

  test('a locked start surfaces the code and the database allowance state', async () => {
    const locked = allowanceOf({ lock_reason: 'FREE_LIVE_WEEKLY_LIMIT', can_start: false, week: { starts_used: 2, starts_remaining: 0 } })
    routes['/api/live/session/start'] = () => json({ error: 'You’ve used both Free Live Mode streams for this week.', code: 'FREE_LIVE_WEEKLY_LIMIT', allowance: locked }, false, 403)
    routes['/api/live/session'] = () => json({ session: null, allowance: allowanceOf() })
    const { result } = await mount()
    await act(async () => { await result.current.goLive('Chaturbate') })
    expect(result.current.actionErrorCode).toBe('FREE_LIVE_WEEKLY_LIMIT')
    expect(result.current.actionError).toMatch(/both Free Live Mode streams/)
    expect(result.current.allowance.week.starts_used).toBe(2)
    expect(result.current.phase).toBe('idle')
  })

  test('refresh() re-reads the database now, even while an action is pending', async () => {
    let n = 0
    routes['/api/live/session'] = () => json({ session: session(), allowance: allowanceOf({ current: { counted: true, active_seconds: 100 + 1000 * n++ } }) })
    const { result } = await mount()
    let a
    await act(async () => { a = await result.current.refresh() })
    expect(a.current.active_seconds).toBe(1100)
    expect(result.current.allowance.current.active_seconds).toBe(1100)
  })

  test('when the database ends the session (e.g. the 35-minute cap) the page returns to idle and reports a finished show', async () => {
    let ended = false
    routes['/api/live/session'] = () => json(ended ? { session: null, allowance: allowanceOf({ current: null, latest_cap_ended: { session_id: 's1', ended_at: '2026-03-10T12:00:00Z' } }) } : { session: session(), allowance: allowanceOf() })
    const { result } = await mount()
    const before = result.current.completedShowsVersion
    ended = true
    await act(async () => { await result.current.refresh() })
    expect(result.current.phase).toBe('idle'); expect(result.current.serverSession).toBeNull()
    expect(result.current.completedShowsVersion).toBe(before + 1)
    expect(result.current.allowance.latest_cap_ended.session_id).toBe('s1')
  })

  test('startPrivate sends the chosen rate, platform and username untouched', async () => {
    routes['/api/live/session/private/start'] = () => json({ privateInterval: { id: 'p1', started_at: '2026-03-10T12:00:00Z', rate_per_minute: 2.5, platform: 'MyFreeCams', username: 'SomeFan' } })
    routes['/api/live/session'] = () => json({ session: session(), allowance: allowanceOf() })
    const { result } = await mount()
    await act(async () => { await result.current.startPrivate(2.5, 'MyFreeCams', 'SomeFan') })
    const call = calls.find((c) => c.url === '/api/live/session/private/start')
    expect(call.body).toEqual({ ratePerMinute: 2.5, platform: 'MyFreeCams', username: 'SomeFan' })
  })

  test('a private start refused by the server shows the reason and keeps the session', async () => {
    routes['/api/live/session/private/start'] = () => json({ error: 'Choose Chaturbate, BongaCams or MyFreeCams. CamCash never guesses your platform.', code: 'PLATFORM_REQUIRED' }, false, 400)
    routes['/api/live/session'] = () => json({ session: session(), allowance: allowanceOf() })
    const { result } = await mount()
    await act(async () => { await result.current.startPrivate(2.5, '', 'x') })
    expect(result.current.actionErrorCode).toBe('PLATFORM_REQUIRED')
    expect(result.current.serverSession.id).toBe('s1')
  })
})
