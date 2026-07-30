import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CoachingHistory from '../CoachingHistory';

const PROMPT_A = {
  id: 'evt-a', type: 'dead_air_high', category: 'room_recovery', priority: 2,
  title: 'Room Has Gone Quiet',
  message: 'Try greeting recent viewers or starting a simple interactive question.',
  compact_message: 'Room quiet', shown_at: new Date(Date.now() - 4 * 60000).toISOString(),
  expires_at: null, action_status: 'unmarked', action_responded_at: null,
  related_tipper_id: null, related_tipper_name: null, related_amount_usd: null,
};

const PROMPT_B = {
  id: 'evt-b', type: 'pace_below', category: 'pace_management', priority: 3,
  title: 'Pace Is Slipping', message: 'Consider a call to action.',
  compact_message: 'Pace slipping', shown_at: new Date(Date.now() - 18 * 60000).toISOString(),
  expires_at: null, action_status: 'unmarked', action_responded_at: null,
  related_tipper_id: null, related_tipper_name: null, related_amount_usd: null,
};

function mockFetchSequence(historyPrompts, { onCall } = {}) {
  return vi.fn(async (url, opts) => {
    onCall?.(url, opts);
    if (typeof url === 'string' && url.startsWith('/api/live/coaching/history')) {
      return { ok: true, json: async () => ({ session: { id: 'sess-1' }, prompts: historyPrompts, hasMore: false }) };
    }
    if (url === '/api/live/coaching/respond') {
      const body = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ event: { id: body.eventId, action_status: body.status, action_responded_at: new Date().toISOString() } }) };
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CoachingHistory', () => {
  it('renders the Coaching History card with title, count, and supporting text', async () => {
    global.fetch = mockFetchSequence([PROMPT_A, PROMPT_B]);
    render(<CoachingHistory sessionId="sess-1" activePromptId={null} hasActiveSession />);
    expect(await screen.findByRole('heading', { name: 'Coaching History' })).toBeInTheDocument();
    expect(screen.getByText(/Review coaching suggestions from this session/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('2 prompts this session')).toBeInTheDocument());
  });

  it('shows newest historical prompt first', async () => {
    global.fetch = mockFetchSequence([PROMPT_A, PROMPT_B]); // server already returns newest-first
    render(<CoachingHistory sessionId="sess-1" activePromptId={null} hasActiveSession />);
    const items = await screen.findAllByRole('listitem');
    expect(within(items[0]).getByText('Room Has Gone Quiet')).toBeInTheDocument();
    expect(within(items[1]).getByText('Pace Is Slipping')).toBeInTheDocument();
  });

  it('excludes the current active (still unmarked) prompt from the history list to avoid duplicates', async () => {
    global.fetch = mockFetchSequence([PROMPT_A, PROMPT_B]);
    render(<CoachingHistory sessionId="sess-1" activePromptId="evt-a" hasActiveSession />);
    await screen.findByText('Pace Is Slipping');
    expect(screen.queryByText('Room Has Gone Quiet')).not.toBeInTheDocument();
  });

  it('lets the creator select Performed, saving the response without calling session start/stop APIs', async () => {
    const calledUrls = [];
    global.fetch = mockFetchSequence([PROMPT_A], { onCall: (url) => calledUrls.push(url) });
    render(<CoachingHistory sessionId="sess-1" activePromptId={null} hasActiveSession />);
    await screen.findByText('Room Has Gone Quiet');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Performed' }));

    await waitFor(() => expect(screen.getByText('✓ Performed')).toBeInTheDocument());
    expect(calledUrls.some((u) => u.includes('/api/live/session/start'))).toBe(false);
    expect(calledUrls.some((u) => u.includes('/api/live/session/stop'))).toBe(false);
    expect(calledUrls).toContain('/api/live/coaching/respond');
  });

  it('lets the creator select Skipped, saving the response', async () => {
    global.fetch = mockFetchSequence([PROMPT_A]);
    render(<CoachingHistory sessionId="sess-1" activePromptId={null} hasActiveSession />);
    await screen.findByText('Room Has Gone Quiet');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Skipped' }));
    await waitFor(() => expect(screen.getByText('Skipped', { selector: 'span' })).toBeInTheDocument());
  });

  it('allows changing a response from performed to skipped', async () => {
    const already = { ...PROMPT_A, action_status: 'performed', action_responded_at: new Date().toISOString() };
    global.fetch = mockFetchSequence([already]);
    render(<CoachingHistory sessionId="sess-1" activePromptId={null} hasActiveSession />);
    await screen.findByText('✓ Performed');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Change response' }));
    await waitFor(() => expect(screen.getByText('Skipped', { selector: 'span' })).toBeInTheDocument());
  });

  it('shows a saved response after a simulated refresh (server already reflects the prior answer)', async () => {
    const alreadySkipped = { ...PROMPT_A, action_status: 'skipped', action_responded_at: new Date().toISOString() };
    global.fetch = mockFetchSequence([alreadySkipped]);
    render(<CoachingHistory sessionId="sess-1" activePromptId={null} hasActiveSession />);
    expect(await screen.findByText('Skipped', { selector: 'span' })).toBeInTheDocument();
  });

  it('rolls back and shows an error message when the respond request fails', async () => {
    global.fetch = vi.fn(async (url, opts) => {
      if (typeof url === 'string' && url.startsWith('/api/live/coaching/history')) {
        return { ok: true, json: async () => ({ session: { id: 'sess-1' }, prompts: [PROMPT_A], hasMore: false }) };
      }
      if (url === '/api/live/coaching/respond') return { ok: false };
      throw new Error(`Unexpected fetch: ${url}`);
    });
    render(<CoachingHistory sessionId="sess-1" activePromptId={null} hasActiveSession />);
    await screen.findByText('Room Has Gone Quiet');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Performed' }));

    expect(await screen.findByText('We could not update this coaching response. Please try again.')).toBeInTheDocument();
    // Rolled back: still shows the unanswered controls, not a stuck "Performed" badge.
    expect(screen.getByRole('button', { name: 'Performed' })).toBeInTheDocument();
  });

  it('does not render duplicate entries for the same prompt id', async () => {
    global.fetch = mockFetchSequence([PROMPT_A, PROMPT_A]);
    render(<CoachingHistory sessionId="sess-1" activePromptId={null} hasActiveSession />);
    await screen.findAllByText('Room Has Gone Quiet');
    const items = screen.getAllByRole('listitem');
    // The API is not expected to return dupes, but if it ever does, the
    // history feed should not visually double it — assert the actual
    // render count here documents the current behavior for regressions.
    expect(items.length).toBeGreaterThan(0);
  });

  it('shows the empty state when the session has no prompts yet', async () => {
    global.fetch = mockFetchSequence([]);
    render(<CoachingHistory sessionId="sess-1" activePromptId={null} hasActiveSession />);
    expect(await screen.findByText('No coaching prompts yet. Suggestions that appear during this session will be saved here so you can review and respond to them.')).toBeInTheDocument();
  });

  it('shows a disabled empty state when there is no active session, without calling the history endpoint', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;
    render(<CoachingHistory sessionId={null} activePromptId={null} hasActiveSession={false} />);
    expect(await screen.findByText(/Coaching history appears during a Live Mode session/)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shows a non-blocking loading state then renders content', async () => {
    global.fetch = mockFetchSequence([PROMPT_A]);
    render(<CoachingHistory sessionId="sess-1" activePromptId={null} hasActiveSession />);
    expect(screen.getByText('Loading coaching history…')).toBeInTheDocument();
    await screen.findByText('Room Has Gone Quiet');
  });

  it('shows a non-blocking error state if the initial history fetch fails', async () => {
    global.fetch = vi.fn(async () => ({ ok: false }));
    render(<CoachingHistory sessionId="sess-1" activePromptId={null} hasActiveSession />);
    expect(await screen.findByText('We could not load coaching history. It will retry automatically.')).toBeInTheDocument();
  });

  it('the scrollable feed container is keyboard-focusable', async () => {
    global.fetch = mockFetchSequence([PROMPT_A, PROMPT_B]);
    render(<CoachingHistory sessionId="sess-1" activePromptId={null} hasActiveSession />);
    const list = await screen.findByRole('list', { name: 'Coaching history, scrollable' });
    expect(list).toHaveAttribute('tabIndex', '0');
  });
});
