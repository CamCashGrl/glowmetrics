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

const renderTab = (props = {}) => render(
  <SessionsOverview tips={[]} shows={[]} paidSessions={[]} tz={TZ} now={NOW} {...props} />
)

test('a finalized Live show appears and "No sessions yet" does not', () => {
  renderTab({ tips: liveTips, shows: [show] })
  expect(screen.getByTestId('history-live:show-a')).toBeTruthy()
  expect(screen.getByTestId('show-show-a')).toBeTruthy()
  expect(screen.getByTestId('new-badge')).toBeTruthy()
  expect(screen.queryByTestId('history-empty')).toBeNull()
  expect(screen.queryByTestId('latest-shows')).toBeNull()
})

test('today KPIs: total = public + private, live-linked tips counted once', () => {
  renderTab({ tips: [...liveTips, ...freeChat], shows: [show] })
  expect(screen.getByTestId('today-public').textContent).toBe('$20.50')
  expect(screen.getByTestId('today-private').textContent).toBe('$0.66')
  expect(screen.getByTestId('today-total').textContent).toBe('$21.16')
  expect(screen.getByTestId('today-tips').textContent).toBe('5')
  expect(screen.getByTestId('today-unique').textContent).toBe('5')
  expect(screen.getByTestId('today-completed').textContent).toBe('2')
  expect(screen.getByTestId('today-streamed').textContent).toBe('~1h 45m')
  expect(screen.getByTestId('today-best-platform').textContent).toBe('BongaCams')
  // Exactly two history entries: the Live show and one free-chat session.
  expect(screen.getAllByTestId(/^history-(live|tips|private):/)).toHaveLength(2)
})

test('today by platform', () => {
  renderTab({ tips: [...liveTips, ...freeChat], shows: [show] })
  const bc = screen.getByTestId('today-platform-bongacams')
  expect(within(bc).getByText('$12.50')).toBeTruthy()
  expect(screen.getByTestId('today-platform-myfreecams')).toBeTruthy()
  expect(screen.getByTestId('today-platform-chaturbate')).toBeTruthy()
})

test('type and platform filters', () => {
  renderTab({ tips: [...liveTips, ...freeChat], shows: [show] })
  fireEvent.click(screen.getByTestId('filter-type-free_chat'))
  expect(screen.queryByTestId('history-live:show-a')).toBeNull()
  expect(screen.getAllByTestId('type-badge-free_chat')).toHaveLength(1)
  fireEvent.click(screen.getByTestId('filter-type-all'))
  fireEvent.click(screen.getByTestId('filter-platform-myfreecams'))
  expect(screen.getByTestId('history-live:show-a')).toBeTruthy()
  expect(screen.queryByTestId('type-badge-free_chat')).toBeNull()
  fireEvent.click(screen.getByTestId('filter-type-private'))
  expect(screen.getByTestId('history-filter-empty')).toBeTruthy()
})

test('empty account shows the empty state and "Not enough data yet"', () => {
  renderTab()
  expect(screen.getByTestId('history-empty')).toBeTruthy()
  expect(screen.getByTestId('today-best-platform').textContent).toBe('Not enough data yet')
})

test('imported private sessions are badged PRIVATE and count as private', () => {
  renderTab({ paidSessions: [{ id: 7, date_time: '2026-10-07T15:00:00Z', platform: 'bongacams', username: 'Fay', session_type: 'private', usd: 7 }] })
  expect(screen.getByTestId('type-badge-private').textContent).toBe('PRIVATE · PRIVATE')
  expect(screen.getByTestId('today-private').textContent).toBe('$7.00')
  expect(screen.getByTestId('today-public').textContent).toBe('$0.00')
})
