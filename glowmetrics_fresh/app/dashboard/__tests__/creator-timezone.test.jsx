/**
 * Dashboard creator-timezone contract: profiles.timezone is the dashboard's
 * single clock (best hours, day boundaries, session times, recommendations),
 * shown under the plan badge with a Change action that saves and can be
 * retried. Live Mode / the standalone /live page keep their own timezone.
 */
const fs = require('fs')
const path = require('path')
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import Sidebar from '../Sidebar'
import { planWindow } from '../PlannedStreams'

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', '..', '..', rel), 'utf8')

describe('sidebar timezone row (under the Pro/Free badge)', () => {
  const base = { activeTab: 'overview', onTabChange: () => {}, user: { email: 'a@b.c' }, onSignOut: () => {} }

  test('shows the creator timezone compactly with a Change action', () => {
    render(<Sidebar {...base} isPro={false} creatorTz="America/Los_Angeles" onChangeTimezone={jest.fn()} />)
    const rows = screen.getAllByTestId('sidebar-timezone')
    expect(rows[0]).toHaveTextContent('Timezone · Pacific Time')
    expect(screen.getAllByRole('button', { name: 'Change' }).length).toBeGreaterThan(0)
  })

  test('picking a zone saves it as an IANA value', async () => {
    const onChange = jest.fn().mockResolvedValue({})
    render(<Sidebar {...base} isPro creatorTz="America/Los_Angeles" onChangeTimezone={onChange} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Change' })[0])
    fireEvent.change(screen.getAllByLabelText('Search timezones')[0], { target: { value: 'berlin' } })
    fireEvent.change(screen.getAllByLabelText('Timezone')[0], { target: { value: 'Europe/Berlin' } })
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('Europe/Berlin'))
    await waitFor(() => expect(screen.queryAllByLabelText('Timezone')).toHaveLength(0))
  })

  test('a failed save shows a retryable error and keeps the picker open', async () => {
    const onChange = jest.fn().mockResolvedValueOnce({ error: { message: 'network' } }).mockResolvedValueOnce({})
    render(<Sidebar {...base} creatorTz="America/Los_Angeles" onChangeTimezone={onChange} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Change' })[0])
    fireEvent.change(screen.getAllByLabelText('Timezone')[0], { target: { value: 'Asia/Tokyo' } })
    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent("Couldn't save your timezone")
    expect(screen.getAllByLabelText('Timezone').length).toBeGreaterThan(0)
    fireEvent.change(screen.getAllByLabelText('Timezone')[0], { target: { value: 'Asia/Tokyo' } })
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryAllByRole('alert')).toHaveLength(0))
  })

  test('hidden when no timezone handler is provided', () => {
    render(<Sidebar {...base} />)
    expect(screen.queryByTestId('sidebar-timezone')).not.toBeInTheDocument()
  })
})

describe('planned streams are entered on the creator clock', () => {
  test('20:00–22:00 in Los Angeles is stored as the right UTC instants', () => {
    expect(planWindow('2026-01-14', '20:00', '22:00', 'America/Los_Angeles')).toEqual({
      start: '2026-01-15T04:00:00.000Z', end: '2026-01-15T06:00:00.000Z',
    })
  })
  test('an end time before the start runs past midnight', () => {
    expect(planWindow('2026-01-14', '23:00', '01:00', 'Asia/Tokyo')).toEqual({
      start: '2026-01-14T14:00:00.000Z', end: '2026-01-14T16:00:00.000Z',
    })
  })
})

describe('dashboard reads one creator clock (source guard)', () => {
  const page = read('app/dashboard/page.js')

  test('profiles.timezone is loaded and resolved saved → browser → UTC before analytics run', () => {
    expect(page).toMatch(/select\('timezone'\)/)
    expect(page).toMatch(/resolveCreatorTimeZone\(saved\)/)
    expect(page).toMatch(/const userTz = await ensureCreatorTz\(uid\)/)
    expect(page).toMatch(/get_user_insights', \{ p_user_id: uid, p_timezone: userTz \}/)
  })

  test('no creator-time path reads the browser zone or the UTC/device clock directly', () => {
    expect(page).not.toMatch(/resolvedOptions\(\)\.timeZone/)
    expect(page).not.toMatch(/new Date\(\)\.getUTCHours\(\)/)
    expect(page).not.toMatch(/new Date\(\)\.getUTCDay\(\)/)
    expect(page).not.toMatch(/new Date\(\)\.getHours\(\)/)
    expect(page).not.toMatch(/now\.getHours\(\)|now\.getDay\(\)/)
    expect(page).not.toMatch(/liveTimezone/)
  })

  test('time-based children receive the creator timezone', () => {
    for (const el of ['MoneyMap', 'StreamPlanner', 'PlannedStreams', 'AnalyticsCharts', 'DashboardGrowthCharts']) {
      expect(page).toMatch(new RegExp(`<${el}[^>]*tz=\\{creatorTz\\}`))
    }
    expect(page).toMatch(/<CommandCenter\s+tz=\{creatorTz\}/)
    expect(page).toMatch(/creatorTz=\{creatorTz\} onChangeTimezone=\{changeCreatorTimezone\}/)
    expect(page).toMatch(/tz=\{creatorTz\}\s+showsLoading/) // SessionsOverview
  })

  test('changing the timezone saves profiles.timezone before switching the clock', () => {
    const fn = page.slice(page.indexOf('const changeCreatorTimezone'), page.indexOf('const changeCreatorTimezone') + 700)
    expect(fn).toMatch(/update\(\{ timezone: tz \}\)/)
    expect(fn.indexOf('if (error) return { error }')).toBeLessThan(fn.indexOf('setCreatorTz(tz)'))
  })

  test('Live Mode and the standalone /live page are untouched', () => {
    expect(read('app/live/page.js')).toMatch(/cc_live_timezone/)
  })
})
