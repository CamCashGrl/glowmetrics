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
  expect(val('today-streamed')).toContain('1h 0m') // exact Live minutes only
  expect(val('today-streamed')).not.toContain('~')
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

test('empty account: activation state, no grid of zeros', () => {
  const onImport = jest.fn(), onStartLive = jest.fn()
  const { container } = renderTab({ onImport, onStartLive })
  expect(screen.getByTestId('sessions-activation').textContent).toMatch(/No performance data yet/)
  expect(screen.queryByTestId('today-stats')).toBeNull()
  expect(screen.queryByTestId('today-by-platform')).toBeNull()
  expect(screen.getAllByTestId('activation-preview')).toHaveLength(4)
  expect(container.textContent).not.toMatch(/\$\d/) // previews describe features, no numbers
  fireEvent.click(screen.getByTestId('activation-import')); expect(onImport).toHaveBeenCalled()
  fireEvent.click(screen.getByTestId('activation-live')); expect(onStartLive).toHaveBeenCalled()
})

test('imported private charges are one PRIVATE session and count as private', () => {
  renderTab({ paidSessions: [
    { id: 7, date_time: '2026-10-07T15:00:00Z', platform: 'bongacams', username: 'Fay', username_lower: 'fay', session_type: 'Private Chat', usd: 0.38 },
    { id: 8, date_time: '2026-10-07T15:01:00Z', platform: 'bongacams', username: 'Fay', username_lower: 'fay', session_type: 'Private Chat', usd: 0.38 },
  ] })
  expect(screen.getAllByTestId(/^history-private:/)).toHaveLength(1)
  // imported-only data → Overall Performance hero
  expect(val('overall-private')).toBe('$0.76')
  expect(val('overall-public')).toBe('$0.00')
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

// ── Adaptive layer (CSV-only / single-platform / mixed) ──────────────────────
const csvTip = (id, iso, platform, username, usd) => ({ id, date_time: iso, platform, username, usd, tokens: 0, live_session_id: null, source: 'upload' })
// 3 meaningful Chaturbate sessions on different days (>= 30 min, >= 2 tips each)
const csvTips = [
  csvTip(101, '2026-09-01T20:00:00Z', 'chaturbate', 'Ann', 10), csvTip(102, '2026-09-01T20:40:00Z', 'chaturbate', 'Ben', 5),
  csvTip(103, '2026-09-03T20:00:00Z', 'chaturbate', 'Ann', 20), csvTip(104, '2026-09-03T20:50:00Z', 'chaturbate', 'Cy', 4),
  csvTip(105, '2026-09-05T20:00:00Z', 'chaturbate', 'Ann', 6), csvTip(106, '2026-09-05T20:35:00Z', 'chaturbate', 'Ben', 9),
  csvTip(107, '2026-09-06T10:00:00Z', 'chaturbate', 'Dee', 1), // lone tip: not a session, still counted in totals
]

test('CSV-only: Overall Performance hero, no Today/range controls, no stream time or $/hr', () => {
  const { container } = renderTab({ tips: csvTips })
  expect(screen.queryByTestId('today-stats')).toBeNull()
  expect(screen.queryByTestId('scope-switch')).toBeNull()
  expect(screen.queryByTestId('range-1')).toBeNull()
  expect(val('overall-source')).toBe('IMPORTED HISTORY')
  expect(val('overall-total')).toBe('$55.00')
  expect(val('overall-public')).toBe('$55.00')
  expect(val('overall-tips')).toBe('7')
  expect(val('overall-unique')).toBe('4')
  expect(val('overall-meaningful')).toBe('3')
  expect(val('overall-median')).toBe('$15.00') // sessions 15, 24, 15
  expect(val('overall-top-tipper')).toBe('Ann')
  expect(val('overall-largest')).toBe('$20.00')
  expect(container.textContent).not.toMatch(/\/hr|per hour|Streamed Time|Best Day|Best Time/i)
  expect(screen.getAllByTestId(/^history-tips:/)).toHaveLength(3)
  expect(container.textContent).toMatch(/Est\. span/)
})

test('single platform: Session Performance cards replace platform comparison', () => {
  renderTab({ tips: csvTips })
  expect(screen.queryByTestId('today-by-platform')).toBeNull()
  expect(val('perf-typical-median')).toBe('$15.00')
  expect(val('perf-typical-count')).toBe('3')
  expect(screen.getByTestId('perf-momentum').textContent).toMatch(/3 more sessions needed for Recent Momentum/)
  expect(val('perf-audience-unique')).toBe('4')
  expect(screen.getByTestId('perf-audience').textContent).toMatch(/2 repeat fans/) // Ann (3 sessions), Ben (2)
  expect(val('perf-audience-top')).toBe('Ann ($36.00), Ben ($14.00), Cy ($4.00)')
  expect(val('perf-audience-share')).toBe('98%') // 54 / 55
})

test('mixed Live + CSV: Today is default, Overall switch shows overall history', () => {
  renderTab({ tips: [...liveTips, ...freeChat, ...csvTips], shows: [show] })
  expect(screen.getByTestId('scope-switch')).toBeTruthy()
  expect(screen.getByTestId('today-stats')).toBeTruthy()
  expect(screen.getByTestId('today-by-platform')).toBeTruthy() // 3 platforms today
  click('scope-overall')
  expect(val('overall-source')).toBe('LIVE + IMPORTED HISTORY')
  expect(val('overall-public')).toBe('$75.50') // 10.5 live + 10 free chat + 55 csv
  expect(val('overall-private')).toBe('$0.66')
  expect(val('overall-total')).toBe('$76.16')
  expect(screen.getByTestId('session-performance')).toBeTruthy()
  expect(screen.queryByTestId('range-1')).toBeNull()
})

test('no data: no scope switch or range controls', () => {
  renderTab({})
  expect(screen.queryByTestId('scope-switch')).toBeNull()
  expect(screen.queryByTestId('range-group')).toBeNull()
})

test('Free history note follows the primary platform', () => {
  const { unmount } = renderTab({ tips: csvTips, isPro: false, primaryPlatform: null })
  expect(val('overall-history-note')).toMatch(/last 31 days on every platform/)
  unmount()
  renderTab({ tips: csvTips, isPro: false, primaryPlatform: 'Chaturbate' })
  expect(val('overall-history-note')).toMatch(/full history on Chaturbate/)
})

// ── UI polish (no numeric change) ────────────────────────────────────────────
test('mixed mode: no two adjacent controls both labeled "Today"', () => {
  renderTab({ tips: [...liveTips, ...freeChat, ...csvTips], shows: [show] })
  expect(val('scope-today')).toBe('Today')
  expect(val('range-1')).toBe('1 Day')
  expect(screen.getByTestId('range-group').textContent).not.toMatch(/Today/)
})

test('one private charge reads "1 charge"', () => {
  renderTab({ paidSessions: [{ id: 9, date_time: '2026-10-07T15:00:00Z', platform: 'bongacams', username: 'Fay', username_lower: 'fay', session_type: 'Private Chat', usd: 0.38 }] })
  expect(val('details-tips')).toBe('1 charge')
  expect(screen.getByTestId('session-history').textContent).toMatch(/1Charge(?!s)/)
})

test('no data: never signals live activity', () => {
  const { container } = renderTab({})
  expect(container.textContent).not.toMatch(/LIVE DATA|LIVE NOW/)
})

test('light data: real numbers kept, empty cells become guidance', () => {
  // one free-chat session today (2 tips, 45 min): fewer than 3 meaningful sessions
  renderTab({ tips: freeChat })
  expect(val('today-total')).toBe('$10.00')
  expect(val('today-tips')).toBe('2')
  expect(screen.getByTestId('today-private').getAttribute('data-hint')).toBe('1')
  expect(val('today-private')).toMatch(/No private earnings yet/)
  expect(screen.getByTestId('today-private-time').getAttribute('data-hint')).toBe('1')
  expect(screen.getByTestId('perf-typical').textContent).toMatch(/2 more sessions needed for Typical Session/)
  expect(screen.getByTestId('perf-momentum').textContent).toMatch(/5 more sessions needed for Recent Momentum/)
})

test('platform cards only for platforms with data', () => {
  const cb = { id: 50, date_time: '2026-10-07T13:00:00Z', platform: 'chaturbate', username: 'Zed', usd: 2, tokens: 40, live_session_id: null, source: 'extension' }
  renderTab({ tips: [...freeChat, cb] })
  expect(screen.getByTestId('today-platform-chaturbate')).toBeTruthy()
  expect(screen.getByTestId('today-platform-bongacams')).toBeTruthy()
  expect(screen.queryByTestId('today-platform-myfreecams')).toBeNull() // no MyFreeCams data → no $0 card
})

test('money values never wrap', () => {
  renderTab({ tips: csvTips })
  expect(screen.getByTestId('overall-public').style.whiteSpace).toBe('nowrap')
})

// ── Session Details tabs: Timeline buckets and Fans ──────────────────────────
test('Details tabs: Overview (default), Timeline buckets, Fans with New/Returning', () => {
  renderTab({ tips: csvTips, isPro: true })
  // newest meaningful session: Sep 5 (Ann 6 @20:00, Ben 9 @20:35)
  expect(screen.getByTestId('details-public')).toBeTruthy()
  click('details-tab-timeline')
  expect(val('buckets-span-label')).toBe('Earning activity span')
  expect(screen.getAllByTestId('bucket-row')).toHaveLength(4) // 35 min → 10-minute buckets
  expect(screen.queryByTestId('buckets-peak')).toBeNull() // only 2 earning buckets
  expect(screen.queryByTestId('details-public')).toBeNull()
  click('details-tab-fans')
  const fans = screen.getAllByTestId('fan-driver')
  expect(fans[0].textContent.startsWith('1Ben')).toBe(true)
  expect(fans[1].textContent.startsWith('2Ann')).toBe(true)
  expect(fans[0].textContent).toMatch(/\$9\.00/)
  expect(fans[0].textContent).toMatch(/60% of session/)
  expect(fans[0].textContent).toMatch(/RETURNING/) // Ben tipped on Sep 1
  expect(fans[1].textContent).toMatch(/RETURNING/) // Ann tipped on Sep 1 and 3
})

test('Fans: first appearance is New; Free outside primary says "in your available history"', () => {
  renderTab({ tips: csvTips.filter((t) => t.date_time.startsWith('2026-09-01')), isPro: false, primaryPlatform: 'BongaCams' })
  click('details-tab-fans')
  expect(screen.getAllByTestId('fan-status-new')).toHaveLength(2)
  expect(screen.getByTestId('fan-drivers').textContent).toMatch(/NEW IN YOUR AVAILABLE HISTORY/)
})
