import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import LiveModeAllowanceBar from '../LiveModeAllowanceBar'

const limits = { starts_per_week: 2, stream_seconds: 2100, warn_seconds: 1500, strong_warn_seconds: 1800 }
const week = { start: '2026-03-09T04:00:00Z', end: '2026-03-16T04:00:00Z', starts_used: 1, starts_remaining: 1 }
const base = {
  server_now: '2026-03-10T12:00:00Z', entitlement: 'capped', unlimited: false, limits,
  timezone: { value: 'America/New_York', source: 'profile', required: false }, week,
  can_start: true, lock_reason: null, latest_cap_ended: null, current: null,
}
const cur = (over = {}) => ({ session_id: 's1', status: 'live', counted: true, paused: false, active_seconds: 600, remaining_seconds: 1500, warning_level: 'none', cap_at: null, ...over })
const live = (over) => ({ ...base, current: cur(over) })

describe('LiveModeAllowanceBar', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-03-10T12:00:00Z')) })
  afterEach(() => { jest.useRealTimers() })

  test('renders nothing until the database state arrives', () => {
    const { container } = render(<LiveModeAllowanceBar allowance={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('paid unlimited Pro shows a pill and no limits', () => {
    render(<LiveModeAllowanceBar allowance={{ unlimited: true, entitlement: 'unlimited' }} />)
    expect(screen.getByTestId('allowance-unlimited')).toHaveTextContent('Unlimited Live Mode')
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  test('ready: shows streams used this week, per-stream minutes, and the creator-local reset', () => {
    render(<LiveModeAllowanceBar allowance={base} receivedAt={Date.now()} />)
    const el = screen.getByTestId('allowance-ready')
    expect(el).toHaveTextContent('1 of 2 Free streams used this week')
    expect(el).toHaveTextContent('35 active minutes per stream')
    expect(el).toHaveTextContent('1 left')
    expect(el).toHaveTextContent(/Mon.*12:00 AM/)
  })

  test('live: stream 1 of 2, minutes used / 35:00, remaining, no warning early on', () => {
    render(<LiveModeAllowanceBar allowance={live()} receivedAt={Date.now()} />)
    const el = screen.getByTestId('allowance-live')
    expect(el).toHaveTextContent('Stream 1 of 2 this week')
    expect(screen.getByTestId('allowance-minutes')).toHaveTextContent('10:00 / 35:00 active')
    expect(screen.getByTestId('allowance-remaining')).toHaveTextContent('25:00 remaining')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '600')
    expect(screen.queryByTestId('allowance-note-warn25')).toBeNull()
  })

  test('second stream shows 2 of 2', () => {
    render(<LiveModeAllowanceBar allowance={{ ...live(), week: { ...week, starts_used: 2, starts_remaining: 0 } }} receivedAt={Date.now()} />)
    expect(screen.getByTestId('allowance-live')).toHaveTextContent('Stream 2 of 2 this week')
  })

  test('the clock ticks forward between database reads and crosses 25 then 30 minutes', () => {
    render(<LiveModeAllowanceBar allowance={live({ active_seconds: 1495 })} receivedAt={Date.now()} />)
    expect(screen.queryByTestId('allowance-note-warn25')).toBeNull()
    act(() => { jest.advanceTimersByTime(6000) })
    expect(screen.getByTestId('allowance-note-warn25')).toHaveTextContent(/Heads up.*minutes left of your 35 active minutes/)
    act(() => { jest.advanceTimersByTime(300_000) })
    const strong = screen.getByTestId('allowance-note-warn30')
    expect(strong).toHaveTextContent(/Almost out of time.*will end automatically at 35:00/)
    expect(screen.queryByTestId('allowance-note-warn25')).toBeNull()
  })

  test('warning wording follows the database level at load (34 minutes in)', () => {
    render(<LiveModeAllowanceBar allowance={live({ active_seconds: 2040 })} receivedAt={Date.now()} />)
    expect(screen.getByTestId('allowance-note-warn30')).toHaveTextContent('Only 1 minute left')
    expect(screen.getByTestId('allowance-remaining')).toHaveTextContent('1:00 remaining')
  })

  test('at 35:00 it shows the ended state and asks for a fresh database read exactly once', () => {
    const onRefresh = jest.fn()
    render(<LiveModeAllowanceBar allowance={live({ active_seconds: 2095 })} receivedAt={Date.now()} onRefresh={onRefresh} />)
    expect(onRefresh).not.toHaveBeenCalled()
    act(() => { jest.advanceTimersByTime(6000) })
    expect(screen.getByTestId('allowance-note-limit')).toHaveTextContent(/35-minute Free limit has been reached/)
    expect(screen.getByTestId('allowance-remaining')).toHaveTextContent('0:00 remaining')
    act(() => { jest.advanceTimersByTime(10_000) })
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  test('a paused stream does not tick and says pauses do not use time', () => {
    render(<LiveModeAllowanceBar allowance={live({ paused: true, active_seconds: 900 })} receivedAt={Date.now()} />)
    act(() => { jest.advanceTimersByTime(120_000) })
    expect(screen.getByTestId('allowance-minutes')).toHaveTextContent('15:00 / 35:00')
    expect(screen.getByTestId('allowance-remaining')).toHaveTextContent(/paused/)
  })

  test('a connecting session is not counted yet', () => {
    render(<LiveModeAllowanceBar allowance={{ ...base, current: cur({ counted: false, status: 'starting' }) }} receivedAt={Date.now()} />)
    expect(screen.getByTestId('allowance-connecting')).toHaveTextContent(/isn’t counted until it goes live/)
  })

  test('weekly lock: no streams left, creator-local reset, upgrade link', () => {
    render(<LiveModeAllowanceBar allowance={{ ...base, can_start: false, lock_reason: 'FREE_LIVE_WEEKLY_LIMIT', week: { ...week, starts_used: 2, starts_remaining: 0 } }} />)
    const el = screen.getByTestId('allowance-weekly-locked')
    expect(el).toHaveTextContent('no streams left'); expect(el).toHaveTextContent(/Mon.*12:00 AM/); expect(el).toHaveTextContent('America/New York')
    expect(screen.getByRole('link', { name: /Upgrade to Pro/ })).toHaveAttribute('href', '/pricing')
  })

  test('after the cap ended a stream, the ready state says so', () => {
    render(<LiveModeAllowanceBar allowance={{ ...base, latest_cap_ended: { session_id: 'x', ended_at: '2026-03-10T11:50:00Z' } }} />)
    expect(screen.getByTestId('allowance-cap-ended')).toHaveTextContent(/ended automatically at the 35-minute Free limit/)
  })
})

describe('timezone prompt (most existing profiles have no saved timezone)', () => {
  const tzReq = { ...base, timezone: { value: null, source: 'missing', required: true }, week: null, can_start: false, lock_reason: 'TIMEZONE_REQUIRED' }

  test('shown instead of the bar, with the Monday-in-your-timezone explanation', () => {
    render(<LiveModeAllowanceBar allowance={tzReq} onSaveTimezone={jest.fn()} onRefresh={jest.fn()} />)
    const el = screen.getByTestId('allowance-timezone-required')
    expect(el).toHaveTextContent('Choose your timezone to go live'); expect(el).toHaveTextContent(/Monday at 12:00 AM/)
    expect(screen.getByTestId('allowance-timezone-save')).toBeDisabled()
  })

  test('an invalid saved timezone is explained', () => {
    render(<LiveModeAllowanceBar allowance={{ ...tzReq, timezone: { value: 'Mars/Phobos', source: 'invalid', required: true } }} onSaveTimezone={jest.fn()} onRefresh={jest.fn()} />)
    expect(screen.getByTestId('allowance-timezone-required')).toHaveTextContent(/isn’t valid/)
  })

  test('pick -> save -> re-read the allowance', async () => {
    const onSave = jest.fn().mockResolvedValue({})
    const onRefresh = jest.fn().mockResolvedValue({ ...base })
    render(<LiveModeAllowanceBar allowance={tzReq} onSaveTimezone={onSave} onRefresh={onRefresh} />)
    fireEvent.change(screen.getByLabelText('Timezone'), { target: { value: 'America/New_York' } })
    const save = screen.getByTestId('allowance-timezone-save')
    expect(save).toBeEnabled(); expect(save).toHaveTextContent('Use America/New York')
    await act(async () => { fireEvent.click(save) })
    expect(onSave).toHaveBeenCalledWith('America/New_York')
    expect(onRefresh).toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  test('a failed save is reported and nothing is refreshed', async () => {
    const onSave = jest.fn().mockResolvedValue({ error: 'rls' })
    const onRefresh = jest.fn()
    render(<LiveModeAllowanceBar allowance={tzReq} onSaveTimezone={onSave} onRefresh={onRefresh} />)
    fireEvent.change(screen.getByLabelText('Timezone'), { target: { value: 'Europe/London' } })
    await act(async () => { fireEvent.click(screen.getByTestId('allowance-timezone-save')) })
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn’t save that timezone/)
    expect(onRefresh).not.toHaveBeenCalled()
  })

  test('if the database still does not accept the zone, the user is told, not looped', async () => {
    const onSave = jest.fn().mockResolvedValue({})
    const onRefresh = jest.fn().mockResolvedValue(tzReq)
    render(<LiveModeAllowanceBar allowance={tzReq} onSaveTimezone={onSave} onRefresh={onRefresh} />)
    fireEvent.change(screen.getByLabelText('Timezone'), { target: { value: 'Europe/London' } })
    await act(async () => { fireEvent.click(screen.getByTestId('allowance-timezone-save')) })
    expect(screen.getByRole('alert')).toHaveTextContent(/isn’t supported for the weekly allowance yet/)
  })
})
