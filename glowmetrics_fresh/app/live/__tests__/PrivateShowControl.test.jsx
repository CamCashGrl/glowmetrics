import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import PrivateShowControl from '../PrivateShowControl'

const mkEngine = (over = {}) => ({ actionPending: false, privateInterval: null, startPrivate: jest.fn(), endPrivate: jest.fn(), allowance: null, allowanceReceivedAt: null, ...over })

describe('PrivateShowControl', () => {
  test('Start needs username, a supported platform and a rate — nothing is defaulted', () => {
    const engine = mkEngine()
    render(<PrivateShowControl engine={engine} platform={undefined} />)
    const start = screen.getByTestId('private-start')
    expect(screen.getByTestId('private-platform')).toHaveValue('')
    expect(start).toBeDisabled()
    fireEvent.change(screen.getByTestId('private-rate'), { target: { value: '2.5' } })
    expect(start).toBeDisabled()
    fireEvent.change(screen.getByTestId('private-username'), { target: { value: 'SomeFan' } })
    expect(start).toBeDisabled()   // still no platform
    fireEvent.change(screen.getByTestId('private-platform'), { target: { value: 'BongaCams' } })
    expect(start).toBeEnabled()
    fireEvent.click(start)
    expect(engine.startPrivate).toHaveBeenCalledWith(2.5, 'BongaCams', 'SomeFan')
  })

  test('the platform is pre-selected only from a supported session platform', () => {
    const { unmount } = render(<PrivateShowControl engine={mkEngine()} platform="MyFreeCams" />)
    expect(screen.getByTestId('private-platform')).toHaveValue('MyFreeCams'); unmount()
    render(<PrivateShowControl engine={mkEngine()} platform="Stripchat" />)
    expect(screen.getByTestId('private-platform')).toHaveValue('')
  })

  test('a username that is only @ is not valid; a rate over 1000 is not valid', () => {
    render(<PrivateShowControl engine={mkEngine()} platform="Chaturbate" />)
    fireEvent.change(screen.getByTestId('private-rate'), { target: { value: '2' } })
    fireEvent.change(screen.getByTestId('private-username'), { target: { value: ' @@ ' } })
    expect(screen.getByTestId('private-start')).toBeDisabled()
    fireEvent.change(screen.getByTestId('private-username'), { target: { value: '@fan' } })
    expect(screen.getByTestId('private-start')).toBeEnabled()
    fireEvent.change(screen.getByTestId('private-rate'), { target: { value: '1001' } })
    expect(screen.getByTestId('private-start')).toBeDisabled()
  })

  describe('while private', () => {
    beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-03-10T12:05:00Z')) })
    afterEach(() => jest.useRealTimers())
    const open = { id: 'p1', started_at: '2026-03-10T12:00:00Z', rate_per_minute: 2, platform: 'MyFreeCams', username: 'SomeFan' }

    test('elapsed time is derived from the stored start; earnings are labeled an estimate', () => {
      render(<PrivateShowControl engine={mkEngine({ privateInterval: open })} platform="MyFreeCams" />)
      expect(screen.getByTestId('private-elapsed')).toHaveTextContent('5:00')
      expect(screen.getByTestId('private-estimate')).toHaveTextContent('≈ $10.00 (estimate)')
      expect(screen.getByTestId('private-status')).toHaveTextContent('SomeFan')
      act(() => { jest.advanceTimersByTime(60_000) })
      expect(screen.getByTestId('private-elapsed')).toHaveTextContent('6:00')
      expect(screen.getByTestId('private-estimate')).toHaveTextContent('≈ $12.00 (estimate)')
    })

    test('uses the server clock, so a wrong device clock cannot distort elapsed time', () => {
      // The device thinks it is 12:05, the server said it was 12:03 when the data was read.
      const engine = mkEngine({ privateInterval: open, allowance: { server_now: '2026-03-10T12:03:00Z' }, allowanceReceivedAt: Date.now() })
      render(<PrivateShowControl engine={engine} platform="MyFreeCams" />)
      expect(screen.getByTestId('private-elapsed')).toHaveTextContent('3:00')
    })

    test('End Private only ends the private interval — it never stops the Live session', () => {
      const engine = { ...mkEngine({ privateInterval: open }), stop: jest.fn() }
      render(<PrivateShowControl engine={engine} platform="MyFreeCams" />)
      fireEvent.click(screen.getByTestId('private-end'))
      expect(engine.endPrivate).toHaveBeenCalledTimes(1); expect(engine.stop).not.toHaveBeenCalled()
    })
  })
})
