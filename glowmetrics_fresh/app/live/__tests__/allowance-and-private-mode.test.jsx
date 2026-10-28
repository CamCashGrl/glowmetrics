import React from 'react'
import fs from 'fs'
import path from 'path'
import { render, screen, fireEvent } from '@testing-library/react'
import LiveModeAllowanceBar, { freeAllowanceLevel } from '../LiveModeAllowanceBar'
import PrivateShowControl, { privateEstimateUsd } from '../PrivateShowControl'

const FREE = {
  unlimited: false, timezone: 'America/Los_Angeles', streams_per_week: 2, streams_used: 1,
  active_seconds_per_stream: 2100, resets_at: '2026-11-02T08:00:00Z',
}
const running = (activeSeconds, extra = {}) => ({
  allowance: FREE, limitEnded: null, phase: 'active', dismissLimitEnded: jest.fn(),
  duration: { active_duration_seconds: activeSeconds, live_substate: 'active', ...extra },
})

describe('LiveModeAllowanceBar', () => {
  test('warning thresholds: 25 min warn, 30 min strong', () => {
    expect(freeAllowanceLevel(24 * 60 + 59)).toBe('ok')
    expect(freeAllowanceLevel(25 * 60)).toBe('warn')
    expect(freeAllowanceLevel(29 * 60 + 59)).toBe('warn')
    expect(freeAllowanceLevel(30 * 60)).toBe('strong')
  })

  test('shows active minutes from the canonical session timing', () => {
    render(<LiveModeAllowanceBar engine={running(12 * 60 + 5)} />)
    expect(screen.getByTestId('live-allowance-active').dataset.level).toBe('ok')
    expect(screen.getByText(/12:05 of 35:00 active minutes used/)).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('725')
  })

  test('25-minute warning and 30-minute stronger upgrade warning', () => {
    const { rerender } = render(<LiveModeAllowanceBar engine={running(26 * 60)} />)
    expect(screen.getByTestId('live-allowance-active').dataset.level).toBe('warn')
    expect(screen.getByText(/9:00 of Free Live Mode left/)).toBeTruthy()
    rerender(<LiveModeAllowanceBar engine={running(31 * 60)} />)
    expect(screen.getByTestId('live-allowance-active').dataset.level).toBe('strong')
    expect(screen.getByText(/4:00 left\. Your Free stream ends automatically at 35 active minutes/)).toBeTruthy()
  })

  test('paused: says time is not counting', () => {
    render(<LiveModeAllowanceBar engine={running(10 * 60, { live_substate: 'paused' })} />)
    expect(screen.getByText(/Paused — time isn’t counting/)).toBeTruthy()
  })

  test('idle Free: streams used this week; reset shown when both are used', () => {
    const { rerender } = render(<LiveModeAllowanceBar engine={{ allowance: FREE, phase: 'idle', duration: null }} />)
    expect(screen.getByText(/1 of 2 streams used this week/)).toBeTruthy()
    rerender(<LiveModeAllowanceBar engine={{ allowance: { ...FREE, streams_used: 2 }, phase: 'idle', duration: null }} />)
    expect(screen.getByText(/resets Monday/)).toBeTruthy()
  })

  test('Pro (unlimited) shows nothing', () => {
    const { container } = render(<LiveModeAllowanceBar engine={{ allowance: { unlimited: true }, phase: 'active', duration: { active_duration_seconds: 99999 } }} />)
    expect(container.innerHTML).toBe('')
  })

  test('limit-ended notice', () => {
    const engine = { ...running(0), limitEnded: { id: 's1' } }
    render(<LiveModeAllowanceBar engine={engine} />)
    expect(screen.getByText(/ended at 35 active minutes/)).toBeTruthy()
    fireEvent.click(screen.getByText('Dismiss'))
    expect(engine.dismissLimitEnded).toHaveBeenCalled()
  })
})

describe('PrivateShowControl', () => {
  const liveEngine = (over = {}) => ({
    actionPending: false, privateInterval: null, startPrivate: jest.fn(async () => true), endPrivate: jest.fn(),
    serverSession: { status: 'live', stream_platform: 'BongaCams' }, ...over,
  })

  test('start needs a username and a rate; sends both, never a platform', () => {
    const engine = liveEngine()
    render(<PrivateShowControl engine={engine} />)
    const start = screen.getByTestId('private-start')
    expect(start.textContent).toMatch(/BongaCams/)
    fireEvent.change(screen.getByTestId('private-rate'), { target: { value: '2.5' } })
    expect(start.disabled).toBe(true) // no username yet
    fireEvent.change(screen.getByTestId('private-username'), { target: { value: '  fan_one ' } })
    expect(start.disabled).toBe(false)
    fireEvent.click(start)
    expect(engine.startPrivate).toHaveBeenCalledWith(2.5, 'fan_one')
  })

  test('not startable until the stream is live', () => {
    render(<PrivateShowControl engine={liveEngine({ serverSession: { status: 'starting', stream_platform: 'BongaCams' } })} />)
    fireEvent.change(screen.getByTestId('private-rate'), { target: { value: '2' } })
    fireEvent.change(screen.getByTestId('private-username'), { target: { value: 'fan' } })
    expect(screen.getByTestId('private-start').disabled).toBe(true)
  })

  test('open interval: elapsed time and the DB estimate model (rate x minutes); End only ends private', () => {
    const started = new Date(Date.now() - 90 * 1000).toISOString()
    const engine = liveEngine({ privateInterval: { started_at: started, rate_per_minute: 2, platform: 'BongaCams', username: 'fan_one' } })
    render(<PrivateShowControl engine={engine} />)
    expect(screen.getByTestId('private-elapsed').textContent).toMatch(/^1:3\d$/)
    expect(screen.getByTestId('private-estimate').textContent).toMatch(/~\$3\.0\d/)
    expect(screen.getByText(/Private with fan_one · BongaCams/)).toBeTruthy()
    fireEvent.click(screen.getByTestId('private-end'))
    expect(engine.endPrivate).toHaveBeenCalled()
  })

  test('no estimate is invented without a rate', () => {
    expect(privateEstimateUsd({ started_at: new Date().toISOString(), rate_per_minute: null })).toBeNull()
    expect(privateEstimateUsd({ started_at: '2026-10-28T10:00:00Z', rate_per_minute: 3 }, Date.parse('2026-10-28T10:10:00Z'))).toBe(30)
  })
})

describe('Dashboard Live Mode uses only the server session', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../dashboard/page.js'), 'utf8')
  test('no local-only Live state writers remain', () => {
    expect(src).not.toMatch(/setLiveActive|setLiveStartTime/)
  })
  test('Go Live / End / Pause / Resume call the engine', () => {
    expect(src).toMatch(/liveEngine\.goLive\(livePlatform\)/)
    expect(src).toMatch(/onClick=\{liveEngine\.stop\}/)
    expect(src).toMatch(/onClick=\{liveEngine\.pause\}/)
    expect(src).toMatch(/onClick=\{liveEngine\.resume\}/)
  })
  test('Private Mode and the allowance bar sit inside the dashboard Live experience', () => {
    expect(src).toMatch(/<PrivateShowControl engine=\{liveEngine\} \/>/)
    expect(src).toMatch(/<LiveModeAllowanceBar engine=\{liveEngine\} \/>/)
  })
})
