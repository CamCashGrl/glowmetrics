/**
 * Session Pulse CTA regression: "View session" must open the record the Pulse
 * selected, even when that record is older than the first five history rows.
 */
import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import SessionsOverview from '../SessionsOverview'

const NOW = new Date('2026-10-10T20:00:00Z')
const TZ = 'UTC'

// One meaningful free-chat session (45 min, two tips) from September.
const freeChat = [
  { id: 4, date_time: '2026-09-20T12:00:00Z', platform: 'bongacams', username: 'Cara', usd: 4, tokens: 160, live_session_id: null, source: 'extension' },
  { id: 5, date_time: '2026-09-20T12:45:00Z', platform: 'bongacams', username: 'Dan', usd: 6, tokens: 240, live_session_id: null, source: 'extension' },
]

// Six standalone private charges on six different days in October: newer than
// the session, and enough to push it out of the first five listed rows.
const privateCharges = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].map((name, i) => ({
  id: 100 + i, date_time: `2026-10-0${i + 1}T10:00:00Z`, platform: 'bongacams', username: name, username_lower: name.toLowerCase(),
  session_type: 'Private Chat', usd: 2, tokens: 80,
}))

test('View session opens the selected session even when it is outside the first five rows', () => {
  render(<SessionsOverview tips={freeChat} shows={[]} paidSessions={privateCharges} tz={TZ} now={NOW} />)
  // The Pulse picks the September session (private charges are never a session) and names the newer private activity separately.
  expect(screen.getByTestId('session-pulse').getAttribute('data-kind')).toBe('recap')
  fireEvent.click(screen.getByTestId('pulse-action'))
  const details = screen.getByTestId('session-details')
  expect(within(details).queryByText(/Dan/)).toBeTruthy()
  expect(within(details).queryByText(/P6/)).toBeNull()
})
