/**
 * Sessions tab: today's KPIs, Today by Platform, and one Session History with
 * type/platform filters. A finalized Live show must never be hidden behind
 * "No sessions yet".
 */
import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import SessionsOverview from '../SessionsOverview'

const NOW = new Date('2026-10-07T20:00:00Z')
const TZ = 'UTC'

const show = {
  id: 'show-a', platform: 'chaturbate', startedAt: '2026-10-07T17:00:00Z', endedAt: '2026-10-07T18:00:00Z',
  finalizedAt: '2026-10-07T18:00:00Z', durationSeconds: 3600, totalUsd: 11.16, publicUsd: 10.5, privateUsd: 0.66,
  privateSeconds: 120, privateIntervals: [], tokens: 260, tipCount: 3, uniqueTippers: 3,
  topTipper: { username: 'Alice', usd: 5 }, largestTipUsd: 5, usdPerHour: 11.16,
  platformRevenue: [
    { platform: 'chaturbate', usd: 5, tips: 1 }, { platform: 'myfreecams', usd: 3, tips: 1 }, { platform: 'bongacams', usd: 2.5, tips: 1 },
  ],
  isNew: true, seenAt: null,
}

const liveTips = [
  { id: 1, date_time: '2026-10-07T17:05:00Z', platform: 'chaturbate', username: 'Alice', usd: 5, tokens: 100, live_session_id: 'show-a', source: 'extension' },
  { id: 2, date_time: '2026-10-07T17:06:00Z', platform: 'myfreecams', username: 'Alice', usd: 3, tokens: 60, live_session_id: 'show-a', source: 'extension' },
  { id: 3, date_time: '2026-10-07T17:07:00Z', platform: 'bongacams', username: 'Bob', usd: 2.5, tokens: 100, live_session_id: 'show-a', source: 'extension' },
]
const freeChat = [
  { id: 4, date_time: '2026-10-07T12:00:00Z', platform: 'bongacams', username: 'Cara', usd: 4, tokens: 160, live_session_id: null, source: 'extension' },
  { id: 5, date_time: '2026-10-07T12:45:00Z', platform: 'bongacams', username: 'Dan', usd: 6, tokens: 240, live_session_id: null, source: 'extension' },
]

const val = (id) => screen.getByTestId(id).textContent
const click = (id) => fireEvent.click(screen.getByTestId(id).querySelector('button'))

const renderTab = (props = {}) => render(
  <SessionsOverview tips={[]} shows={[]} paidSessions={[]} tz={TZ} now={NOW} {...props} />
)

test('a finalized Live show appears and "No sessions yet" does not', () => {
  renderTab({ tips: liveTips, shows: [show] })
  expect(screen.getByTestId('history-live:show-a')).toBeTruthy()
  expect(screen.getByTestId('row-new-badge')).toBeTruthy()
  // Full show card is progressive disclosure behind View details.
  expect(screen.queryByTestId('show-show-a')).toBeNull()
  click('details-live:show-a')
  expect(screen.getByTestId('show-show-a')).toBeTruthy()
  expect(screen.getByTestId('new-badge')).toBeTruthy()
  expect(screen.queryByTestId('history-empty')).toBeNull()
  expect(screen.queryByTestId('latest-shows')).toBeNull()
})

test('today KPIs: total = public + private, live-linked tips counted once', () => {
  renderTab({ tips: [...liveTips, ...freeChat], shows: [show] })
  expect(val('today-public')).toBe('$20.50')
  expect(val('today-private')).toBe('$0.66')
  expect(val('today-total')).toBe('$21.16')
  expect(val('today-tips')).toBe('5')
  expect(val('today-unique')).toBe('5')
  expect(val('today-completed')).toBe('2')
  expect(val('today-streamed')).toBe('~1h 45m')
  expect(val('today-best-platform')).toBe('BongaCams')
  // Exactly two history entries: the Live show and one free-chat session.
  expect(screen.getAllByTestId(/^history-(live|tips|private):/)).toHaveLength(2)
})

test('today by platform', () => {
  renderTab({ tips: [...liveTips, ...freeChat], shows: [show] })
  const bc = screen.getByTestId('today-platform-bongacams')
  expect(bc.textContent).toContain('$12.50') // total
  expect(bc.textContent).toContain('59%') // $12.50 of $21.16 today
  expect(bc.textContent).toContain('$12.50 public · $0.00 private · 3 tips · 3 tippers')
  expect(within(bc).getByTestId('best-platform-badge')).toBeTruthy()
  expect(screen.getByTestId('today-platform-myfreecams')).toBeTruthy()
  expect(screen.getByTestId('today-platform-chaturbate')).toBeTruthy()
})

test('type and platform filters', () => {
  renderTab({ tips: [...liveTips, ...freeChat], shows: [show] })
  click('view-all')
  click('filter-type-free_chat')
  expect(screen.queryByTestId('history-live:show-a')).toBeNull()
  expect(screen.getAllByTestId('type-badge-free_chat')).toHaveLength(1)
  click('filter-type-all')
  click('filter-platform-myfreecams')
  expect(screen.getByTestId('history-live:show-a')).toBeTruthy()
  expect(screen.queryByTestId('type-badge-free_chat')).toBeNull()
  click('filter-type-private')
  expect(screen.getByTestId('history-filter-empty')).toBeTruthy()
})

test('empty account shows the empty state and "Not enough data yet"', () => {
  renderTab()
  expect(screen.getByTestId('history-empty')).toBeTruthy()
  expect(val('today-best-platform')).toBe('Not enough data yet')
  expect(screen.queryByTestId('hero-latest')).toBeNull()
})

test('imported private sessions are badged PRIVATE and count as private', () => {
  renderTab({ paidSessions: [{ id: 7, date_time: '2026-10-07T15:00:00Z', platform: 'bongacams', username: 'Fay', session_type: 'private', usd: 7 }] })
  expect(screen.getByTestId('type-badge-private').textContent).toBe('PRIVATE · PRIVATE')
  expect(val('today-private')).toBe('$7.00')
  expect(val('today-public')).toBe('$0.00')
})

test('top hero: latest finished performance when not live', () => {
  renderTab({ tips: liveTips, shows: [show] })
  expect(screen.getByTestId('hero-latest')).toBeTruthy()
  expect(screen.queryByTestId('hero-live')).toBeNull()
  expect(screen.getByTestId('hero-latest-total').textContent).toBe('$11.16')
  expect(screen.getByTestId('hero-new-badge')).toBeTruthy()
  expect(val('latest-public')).toBe('$10.50')
  expect(val('latest-private')).toBe('$0.66')
  expect(val('latest-unique')).toBe('3')
})

test('top hero: LIVE NOW replaces Latest Performance while a show runs', () => {
  const session = { id: 'run-1', status: 'live', started_at: '2026-10-07T19:00:00Z', active_duration_seconds: 2520 }
  const runTips = [
    { id: 9, date_time: '2026-10-07T19:30:00Z', platform: 'chaturbate', username: 'Gus', usd: 20, tokens: 400, live_session_id: 'run-1', source: 'extension' },
    { id: 10, date_time: '2026-10-07T19:31:00Z', platform: 'bongacams', username: 'Gus', usd: 5, tokens: 200, live_session_id: 'run-1', source: 'extension' },
  ]
  renderTab({ tips: [...liveTips, ...runTips], shows: [show], live: { session, privateInterval: null } })
  expect(screen.getByTestId('hero-live')).toBeTruthy()
  expect(screen.queryByTestId('hero-latest')).toBeNull()
  expect(screen.getByTestId('hero-live-total').textContent).toBe('$25.00')
  expect(val('live-tips')).toBe('2')
  expect(val('live-unique')).toBe('2') // Gus on two platforms = two fans
  expect(val('live-duration')).toBe('42m')
  expect(screen.getByTestId('hero-live').textContent).toContain('LIVE NOW · 42m')
})

test('strongest signal names the leading platform from real shares', () => {
  renderTab({ tips: [...liveTips, ...freeChat], shows: [show] })
  expect(screen.getByTestId('today-signal').textContent).toContain('BongaCams is leading today with 59% of your earnings.')
})

test('no weekday comparison without enough history', () => {
  renderTab({ tips: [...liveTips, ...freeChat], shows: [show] })
  expect(screen.queryByTestId('today-comparison')).toBeNull()
})

test('recent sessions: only the 3 newest by default, View all shows the rest', () => {
  const days = [1, 2, 3, 4, 5].map((d) => [
    { id: 100 + d, date_time: `2026-10-0${d}T10:00:00Z`, platform: 'chaturbate', username: 'A', usd: 1, tokens: 20, live_session_id: null, source: 'extension' },
    { id: 200 + d, date_time: `2026-10-0${d}T10:40:00Z`, platform: 'chaturbate', username: 'B', usd: 1, tokens: 20, live_session_id: null, source: 'extension' },
  ]).flat()
  renderTab({ tips: days })
  expect(screen.getAllByTestId(/^history-tips:/)).toHaveLength(3)
  click('view-all')
  expect(screen.getAllByTestId(/^history-tips:/)).toHaveLength(5)
})

test('View details on a tip session shows fan contribution', () => {
  renderTab({ tips: freeChat })
  const id = screen.getAllByTestId(/^history-tips:/)[0].getAttribute('data-testid').replace('history-', '')
  click(`details-${id}`)
  expect(screen.getByTestId(`history-${id}`).textContent).toContain('Fan contribution')
  expect(screen.getByTestId(`history-${id}`).textContent).toContain('Dan')
})

test('live hero freshness: +$ in the last 10 min from real tip times', () => {
  const session = { id: 'run-1', status: 'live', started_at: '2026-10-07T19:00:00Z', active_duration_seconds: 2520 }
  const runTips = [
    { id: 9, date_time: '2026-10-07T19:55:00Z', platform: 'chaturbate', username: 'Gus', usd: 6.5, tokens: 130, live_session_id: 'run-1', source: 'extension' },
    { id: 10, date_time: '2026-10-07T19:20:00Z', platform: 'chaturbate', username: 'Hal', usd: 5, tokens: 100, live_session_id: 'run-1', source: 'extension' },
  ]
  renderTab({ tips: runTips, live: { session, privateInterval: null } })
  expect(screen.getByTestId('hero-live-fresh').textContent).toBe('+$6.50 in the last 10 min · 1 tip')
})

test('latest hero says when it ended', () => {
  renderTab({ tips: liveTips, shows: [show] })
  expect(screen.getByTestId('hero-latest').textContent).toContain('ended 2h 0m ago')
})
