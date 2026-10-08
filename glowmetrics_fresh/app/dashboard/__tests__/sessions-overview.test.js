/**
 * Sessions tab (reference layout): Today hero with 8 inset cells, three equal
 * platform cards, Recent Sessions | Session Details master–detail. Figures
 * come from lib/sessions/normalize.js; this checks what renders.
 */
import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import SessionsOverview from '../SessionsOverview'

const NOW = new Date('2026-10-07T20:00:00Z')
const TZ = 'UTC'

const show = {
  id: 'show-a', platform: 'chaturbate', startedAt: '2026-10-07T17:00:00Z', endedAt: '2026-10-07T18:00:00Z',
  finalizedAt: '2026-10-07T18:00:00Z', durationSeconds: 3600, totalUsd: 11.16, publicUsd: 10.5, privateUsd: 0.66,
  privateSeconds: 120,
  privateIntervals: [{ id: 'iv', platform: 'chaturbate', startedAt: '2026-10-07T17:30:00Z', endedAt: '2026-10-07T17:32:00Z', earningsUsd: 0.66 }],
  tokens: 260, tipCount: 3, uniqueTippers: 3,
  topTipper: { username: 'Alice', usd: 5 }, largestTipUsd: 5, usdPerHour: 11.16,
  platformRevenue: [
    { platform: 'chaturbate', usd: 5, tips: 1 }, { platform: 'myfreecams', usd: 3, tips: 1 }, { platform: 'bongacams', usd: 2.5, tips: 1 },
  ],
  isNew: true, seenAt: null,
}

const liveTips = [
  { id: 1, date_time: '2026-10-07T17:05:00Z', platform: 'chaturbate', username: 'Alice', usd: 5, tokens: 100, live_session_id: 'show-a', source: 'extension' },
  { id: 2, date_time: '2026-10-07T17:06:00Z', platform: 'myfreecams', username: 'Alice', usd: 3, tokens: 60, live_session_id: 'show-a', source: 'extension' },
  { id: 3, date_time: '2026-10-07T17:40:00Z', platform: 'bongacams', username: 'Bob', usd: 2.5, tokens: 100, live_session_id: 'show-a', source: 'extension' },
]
const freeChat = [
  { id: 4, date_time: '2026-10-07T12:00:00Z', platform: 'bongacams', username: 'Cara', usd: 4, tokens: 160, live_session_id: null, source: 'extension' },
  { id: 5, date_time: '2026-10-07T12:45:00Z', platform: 'bongacams', username: 'Dan', usd: 6, tokens: 240, live_session_id: null, source: 'extension' },
]

const val = (id) => screen.getByTestId(id).textContent
const click = (id) => fireEvent.click(screen.getByTestId(id).querySelector('button') || screen.getByTestId(id))
const renderTab = (props = {}) => render(<SessionsOverview tips={[]} shows={[]} paidSessions={[]} tz={TZ} now={NOW} {...props} />)

test('hero: total = public + private, live-linked tips counted once, 8 cells', () => {
  renderTab({ tips: [...liveTips, ...freeChat], shows: [show] })
  expect(val('today-total')).toBe('$21.16')
  expect(val('today-public')).toBe('$20.50')
  expect(val('today-private')).toBe('$0.66')
  expect(val('today-tips')).toBe('5')
  expect(val('today-unique')).toBe('5')
  expect(val('today-streamed')).toBe('~1h 45m')
  expect(val('today-private-time')).toBe('2m')
  expect(val('today-completed')).toBe('2')
  expect(val('today-best-platform')).toBe('BongaCams')
})

test('three equal platform cards with share and BEST TODAY on the real leader', () => {
  renderTab({ tips: [...liveTips, ...freeChat], shows: [show] })
  for (const p of ['bongacams', 'chaturbate', 'myfreecams']) expect(screen.getByTestId(`today-platform-${p}`)).toBeTruthy()
  const bc = screen.getByTestId('today-platform-bongacams')
  expect(bc.textContent).toContain('59%')
  expect(bc.textContent).toContain('$12.50')
  expect(within(bc).getByTestId('best-platform-badge').textContent).toBe('BEST TODAY')
  expect(within(screen.getByTestId('today-platform-chaturbate')).queryByTestId('best-platform-badge')).toBeNull()
})

test('a finalized Live show is listed and selected by default; never "No sessions yet"', () => {
  renderTab({ tips: liveTips, shows: [show] })
  const row = screen.getByTestId('history-live:show-a')
  expect(row.getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByTestId('row-new-badge')).toBeTruthy()
  expect(row.textContent).toContain('JUST ENDED')
  expect(screen.queryByTestId('history-empty')).toBeNull()
  expect(val('details-total')).toBe('$11.16')
  expect(val('details-public')).toBe('$10.50')
  expect(val('details-private')).toBe('$0.66')
  expect(val('details-unique')).toBe('3')
  expect(val('details-largest')).toBe('$5.00')
  expect(val('details-top')).toBe('Alice')
  expect(val('details-duration')).toBe('1h 0m')
  expect(val('details-private-time')).toBe('2m')
})

test('selecting another session updates the details panel (no expansion)', () => {
  renderTab({ tips: [...liveTips, ...freeChat], shows: [show] })
  const fc = screen.getAllByTestId(/^history-tips:/)[0]
  fireEvent.click(fc)
  expect(fc.getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByTestId('history-live:show-a').getAttribute('aria-pressed')).toBe('false')
  expect(val('details-total')).toBe('$10.00')
  expect(val('details-top')).toBe('Dan')
})

test('earnings timeline uses real data; honest empty state otherwise', () => {
  const { unmount } = renderTab({ tips: liveTips, shows: [show] })
  expect(screen.getByTestId('details-timeline')).toBeTruthy()
  unmount()
  renderTab({ paidSessions: [{ id: 7, date_time: '2026-10-07T15:00:00Z', platform: 'bongacams', username: 'Fay', session_type: 'Private Chat', usd: 7 }] })
  expect(screen.getByTestId('details-timeline-empty')).toBeTruthy()
})

test('type filters', () => {
  renderTab({ tips: [...liveTips, ...freeChat], shows: [show] })
  click('filter-type-free_chat')
  expect(screen.queryByTestId('history-live:show-a')).toBeNull()
  expect(screen.getAllByTestId('type-badge-free_chat')).toHaveLength(1)
  click('filter-type-private')
  expect(screen.getByTestId('history-filter-empty')).toBeTruthy()
})

test('7 Days range widens the same formulas', () => {
  const older = [{ id: 9, date_time: '2026-10-03T12:00:00Z', platform: 'chaturbate', username: 'Zed', usd: 9, tokens: 180, live_session_id: null, source: null }]
  renderTab({ tips: [...freeChat, ...older] })
  expect(val('today-total')).toBe('$10.00')
  click('range-7')
  expect(val('today-total')).toBe('$19.00')
})

test('empty account: empty state and "Not enough data yet"', () => {
  renderTab()
  expect(screen.getByTestId('history-empty')).toBeTruthy()
  expect(val('today-best-platform')).toBe('Not enough data yet')
  expect(screen.queryByTestId('today-comparison')).toBeNull()
})

test('imported private charges are one PRIVATE session and count as private', () => {
  renderTab({ paidSessions: [
    { id: 7, date_time: '2026-10-07T15:00:00Z', platform: 'bongacams', username: 'Fay', username_lower: 'fay', session_type: 'Private Chat', usd: 0.38 },
    { id: 8, date_time: '2026-10-07T15:01:00Z', platform: 'bongacams', username: 'Fay', username_lower: 'fay', session_type: 'Private Chat', usd: 0.38 },
  ] })
  expect(screen.getAllByTestId(/^history-private:/)).toHaveLength(1)
  expect(val('today-private')).toBe('$0.76')
  expect(val('today-public')).toBe('$0.00')
  expect(val('details-tips')).toBe('2 charges')
})

test('LIVE NOW: running show leads the list and the hero chip shows it', () => {
  const session = { id: 'run-1', status: 'live', started_at: '2026-10-07T19:00:00Z', active_duration_seconds: 2520 }
  const runTips = [
    { id: 9, date_time: '2026-10-07T19:30:00Z', platform: 'chaturbate', username: 'Gus', usd: 20, tokens: 400, live_session_id: 'run-1', source: 'extension' },
    { id: 10, date_time: '2026-10-07T19:31:00Z', platform: 'bongacams', username: 'Gus', usd: 5, tokens: 200, live_session_id: 'run-1', source: 'extension' },
  ]
  renderTab({ tips: [...liveTips, ...runTips], shows: [show], live: { session, privateInterval: null } })
  expect(val('hero-live')).toContain('LIVE NOW · 42m')
  expect(screen.getAllByTestId(/^history-/)[0].getAttribute('data-testid')).toBe('history-running:run-1')
  expect(val('details-total')).toBe('$25.00')
  expect(val('details-unique')).toBe('2') // Gus on two platforms = two fans
})

test('vs-yesterday comparison only with real yesterday data', () => {
  const y = [{ id: 11, date_time: '2026-10-06T11:00:00Z', platform: 'bongacams', username: 'Y', usd: 8, tokens: 320, live_session_id: null, source: null }]
  renderTab({ tips: [...freeChat, ...y] })
  expect(val('today-comparison')).toContain('25%') // $10 today vs $8 yesterday by 20:00
})

test('strongest signal from real shares', () => {
  renderTab({ tips: [...liveTips, ...freeChat], shows: [show] })
  expect(val('today-signal')).toContain('BongaCams is leading today with 59% of your earnings.')
  expect(val('today-signal')).toContain('$12.50 of today')
})
