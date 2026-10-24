/**
 * Integration tests for onboarding Step 1 — single-select primary platform.
 * Renders the real OnboardingPage component (not a re-implementation) so
 * these exercise the shipped state machine: exactly one platform is ever
 * selected (it becomes Primary), brand-new users save only that platform,
 * and returning users keep their already-saved secondaries, reordered behind
 * the chosen primary, never deleted or duplicated.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'

// The page renders a decorative <canvas> particle background (AmbientParticles)
// that jsdom can't run (no real 2D canvas context) — stub it out so its
// requestAnimationFrame loop doesn't throw. Unrelated to what's under test.
HTMLCanvasElement.prototype.getContext = () => ({
  clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {},
  moveTo: () => {}, lineTo: () => {}, stroke: () => {}, closePath: () => {},
  save: () => {}, restore: () => {}, set fillStyle(v) {}, set strokeStyle(v) {},
  set globalAlpha(v) {}, set lineWidth(v) {},
})

const mockUpserts = []
let mockUpsertError = null
let mockProfile = { plan: 'free', streaming_platforms: null, primary_pro_platform: null }
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'test@example.com', created_at: '2026-01-01' } } }),
      getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
    },
    from: jest.fn((table) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        single: async () => {
          if (table === 'beta_users') return { data: { onboarding_complete: false } }
          if (table === 'profiles') return { data: mockProfile }
          return { data: null }
        },
        upsert: jest.fn(async (v) => { mockUpserts.push({ table, v }); return { data: null, error: table === 'profiles' ? mockUpsertError : null } }),
        update: jest.fn((v) => ({ eq: () => ({ select: () => ({ maybeSingle: async () => { mockUpserts.push({ table, v }); return { data: { id: 'u1' }, error: table === 'profiles' ? mockUpsertError : null } } }) }) })),
      }
      return chain
    }),
  },
}))
jest.mock('../../../lib/track', () => ({ track: jest.fn() }))
// One stable router object, as in the real app — a fresh object per render
// would re-run the page's [router] effect and re-restore the saved selection
// over the user's click.
const mockRouter = { push: jest.fn(), replace: jest.fn() }
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }))

import OnboardingPage from '../page.js'

// Pin the "browser" timezone so expectations don't depend on the CI machine.
let mockBrowserTz = 'America/Los_Angeles'
const realResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions
beforeEach(() => {
  mockBrowserTz = 'America/Los_Angeles'
  jest.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function () {
    return { ...realResolvedOptions.call(this), timeZone: mockBrowserTz }
  })
})
afterEach(() => jest.restoreAllMocks())
const TZ = 'America/Los_Angeles'
const pickTz = (z) => fireEvent.click(within(screen.getByRole('listbox', { name: 'Timezone' })).getByText(z))

const NEW_USER = { plan: 'free', streaming_platforms: null, primary_pro_platform: null }
const card = (name) => screen.getByRole('radio', { name: new RegExp(name) })

describe('Onboarding Step 1 — single-select primary platform', () => {
  beforeEach(() => { mockProfile = NEW_USER })

  test('shows the new headline and the shared PLATFORM / IMPORT / INSIGHTS stepper', async () => {
    render(<OnboardingPage />)
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Let’s get started')
    expect(screen.getByText('Platform')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('Import')).not.toHaveAttribute('aria-current')
    expect(screen.getByText('Insights')).not.toHaveAttribute('aria-current')
    expect(screen.queryByText(/Step 1 of 3/)).not.toBeInTheDocument()
    expect(screen.getByText('You can add more platforms later.')).toBeInTheDocument()
  })

  test('A: selecting Chaturbate selects only it and the CTA names it', async () => {
    render(<OnboardingPage />)
    fireEvent.click(await screen.findByText('Chaturbate'))
    await waitFor(() => expect(card('Chaturbate')).toHaveAttribute('aria-checked', 'true'))
    expect(card('BongaCams')).toHaveAttribute('aria-checked', 'false')
    expect(card('MyFreeCams')).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('button', { name: 'Continue with Chaturbate →' })).toBeEnabled()
  })

  test('B: selecting another platform replaces the selection (never two selected)', async () => {
    render(<OnboardingPage />)
    fireEvent.click(await screen.findByText('Chaturbate'))
    fireEvent.click(screen.getByText('BongaCams'))
    await waitFor(() => expect(card('BongaCams')).toHaveAttribute('aria-checked', 'true'))
    expect(card('Chaturbate')).toHaveAttribute('aria-checked', 'false')
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Continue with BongaCams →' })).toBeInTheDocument()
  })

  test('C: clicking all three in turn still leaves exactly one selected — the last', async () => {
    render(<OnboardingPage />)
    fireEvent.click(await screen.findByText('Chaturbate'))
    fireEvent.click(screen.getByText('BongaCams'))
    fireEvent.click(screen.getByText('MyFreeCams'))
    await waitFor(() => expect(card('MyFreeCams')).toHaveAttribute('aria-checked', 'true'))
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(1)
  })

  test('D: multi-select UI is gone (count, x / 3, primary box, make-primary)', async () => {
    render(<OnboardingPage />)
    fireEvent.click(await screen.findByText('Chaturbate'))
    await waitFor(() => expect(card('Chaturbate')).toHaveAttribute('aria-checked', 'true'))
    expect(screen.queryByText(/platforms? selected/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\/ 3/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Primary platform:/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Make .* primary/ })).not.toBeInTheDocument()
  })

  test('re-clicking the selected platform keeps it selected (no deselect into an empty state)', async () => {
    render(<OnboardingPage />)
    fireEvent.click(await screen.findByText('Chaturbate'))
    fireEvent.click(screen.getByText('Chaturbate'))
    await waitFor(() => expect(card('Chaturbate')).toHaveAttribute('aria-checked', 'true'))
    expect(screen.getByRole('button', { name: 'Continue with Chaturbate →' })).toBeEnabled()
  })

  test('no platform selected: CTA is disabled and does not claim a platform', async () => {
    render(<OnboardingPage />)
    await screen.findByText('Chaturbate')
    expect(screen.getByRole('button', { name: 'Choose a platform' })).toBeDisabled()
  })
})

describe('Onboarding Step 1 — saving platforms and the permanent primary', () => {
  const okJson = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
  beforeEach(() => { mockUpserts.length = 0; mockUpsertError = null; mockProfile = NEW_USER; global.fetch = jest.fn() })
  const profileUpserts = () => mockUpserts.filter((u) => u.table === 'profiles').map((u) => u.v)
  async function chooseAndContinue() {
    render(<OnboardingPage />)
    fireEvent.click(await screen.findByText('Chaturbate'))
    fireEvent.click(await screen.findByText('BongaCams'))
    fireEvent.click(await screen.findByRole('button', { name: /Continue with BongaCams/ }))
  }

  test('browser saves only streaming_platforms; the primary goes through the server route', async () => {
    global.fetch.mockResolvedValue(okJson(200, { primary_pro_platform: 'bongacams' }))
    await chooseAndContinue()
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    // Brand-new user: only the selected primary is saved — the earlier click
    // on Chaturbate was replaced, not kept as a secondary.
    expect(profileUpserts()).toEqual([{ streaming_platforms: ['bongacams'], timezone: TZ }])
    expect(profileUpserts()[0]).not.toHaveProperty('primary_pro_platform')
    const [url, init] = global.fetch.mock.calls[0]
    expect(url).toBe('/api/profile/primary-platform')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ platform: 'bongacams' })
    await waitFor(() => expect(screen.queryByRole('button', { name: /Continue with BongaCams/ })).not.toBeInTheDocument())
    expect(screen.queryByTestId('primary-save-error')).not.toBeInTheDocument()
  })

  test('route failure is shown, onboarding does not advance, and Continue retries', async () => {
    global.fetch.mockResolvedValueOnce(okJson(500, { error: 'Could not save your primary platform.' }))
    await chooseAndContinue()
    expect(await screen.findByTestId('primary-save-error')).toHaveTextContent('Could not save your primary platform.')
    expect(screen.getByRole('button', { name: /Continue with BongaCams/ })).toBeInTheDocument()
    global.fetch.mockResolvedValueOnce(okJson(200, { primary_pro_platform: 'bongacams' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue with BongaCams/ }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Continue with BongaCams/ })).not.toBeInTheDocument())
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  test('network failure is shown and does not advance', async () => {
    global.fetch.mockRejectedValueOnce(new Error('offline'))
    await chooseAndContinue()
    expect(await screen.findByTestId('primary-save-error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continue with BongaCams/ })).toBeInTheDocument()
  })

  test('409 for a DIFFERENT stored primary is shown, not treated as success', async () => {
    global.fetch.mockResolvedValueOnce(okJson(409, { error: 'Your primary platform is already set and cannot be changed.', primary_pro_platform: 'myfreecams' }))
    await chooseAndContinue()
    expect(await screen.findByTestId('primary-save-error')).toHaveTextContent('already set')
    expect(screen.getByRole('button', { name: /Continue with BongaCams/ })).toBeInTheDocument()
  })

  test('409 for the SAME stored primary (retry after an earlier success) continues', async () => {
    global.fetch.mockResolvedValueOnce(okJson(409, { primary_pro_platform: 'bongacams' }))
    await chooseAndContinue()
    await waitFor(() => expect(screen.queryByRole('button', { name: /Continue with BongaCams/ })).not.toBeInTheDocument())
    expect(screen.queryByTestId('primary-save-error')).not.toBeInTheDocument()
  })

  test('platform-list save failure is shown and the route is not called', async () => {
    mockUpsertError = { message: 'permission denied' }
    await chooseAndContinue()
    expect(await screen.findByTestId('primary-save-error')).toHaveTextContent('could not save your platforms and timezone')
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe('Onboarding Step 1 — returning users keep saved secondary platforms', () => {
  const okJson = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
  beforeEach(() => { mockUpserts.length = 0; mockUpsertError = null; global.fetch = jest.fn().mockResolvedValue(okJson(200, {})) })
  const profileUpserts = () => mockUpserts.filter((u) => u.table === 'profiles').map((u) => u.v)

  test('restored primary is pre-selected; only one card is selected', async () => {
    mockProfile = { plan: 'free', streaming_platforms: ['BongaCams', 'MyFreeCams', 'Chaturbate'], primary_pro_platform: null }
    render(<OnboardingPage />)
    await waitFor(() => expect(card('BongaCams')).toHaveAttribute('aria-checked', 'true'))
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(1)
  })

  test('choosing a new primary reorders saved secondaries behind it, no deletes, no duplicates', async () => {
    mockProfile = { plan: 'free', streaming_platforms: ['BongaCams', 'MyFreeCams', 'Chaturbate'], primary_pro_platform: null }
    render(<OnboardingPage />)
    await waitFor(() => expect(card('BongaCams')).toHaveAttribute('aria-checked', 'true'))
    fireEvent.click(screen.getByText('Chaturbate'))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue with Chaturbate →' }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    expect(profileUpserts()).toEqual([{ streaming_platforms: ['chaturbate', 'bongacams', 'myfreecams'], timezone: TZ }])
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ platform: 'chaturbate' })
  })

  test('keeping the restored primary saves the full saved list unchanged in order', async () => {
    mockProfile = { plan: 'free', streaming_platforms: ['MyFreeCams', 'BongaCams'], primary_pro_platform: 'bongacams' }
    render(<OnboardingPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Continue with BongaCams →' }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    expect(profileUpserts()).toEqual([{ streaming_platforms: ['bongacams', 'myfreecams'], timezone: TZ }])
  })

  test('saved secondaries are not walked through in onboarding — only the primary is connected', async () => {
    mockProfile = { plan: 'free', streaming_platforms: ['BongaCams', 'MyFreeCams', 'Chaturbate'], primary_pro_platform: null }
    render(<OnboardingPage />)
    await waitFor(() => expect(card('BongaCams')).toHaveAttribute('aria-checked', 'true'))
    fireEvent.click(screen.getByText('Chaturbate'))
    fireEvent.click(await screen.findByRole('button', { name: 'Continue with Chaturbate →' }))
    // Lands on the primary's connect step with no "(1 of N)" queue position.
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Paste your Chaturbate tip history'))
    expect(screen.queryByText(/\(1 of \d\)/)).not.toBeInTheDocument()
  })
})

describe('Onboarding Step 1 — creator timezone confirmation', () => {
  const okJson = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
  beforeEach(() => { mockUpserts.length = 0; mockUpsertError = null; mockProfile = NEW_USER; global.fetch = jest.fn().mockResolvedValue(okJson(200, {})) })
  const profileUpserts = () => mockUpserts.filter((u) => u.table === 'profiles').map((u) => u.v)
  const shownTz = () => screen.getByTestId('timezone-iana').textContent

  test('no saved timezone: the browser timezone is suggested with a readable label', async () => {
    render(<OnboardingPage />)
    await waitFor(() => expect(shownTz()).toBe('America/Los_Angeles'))
    expect(screen.getByTestId('timezone-card')).toHaveTextContent('Pacific Time')
    expect(screen.getByTestId('timezone-iana')).toHaveTextContent('America/Los_Angeles')
    expect(screen.getByRole('button', { name: 'Change timezone' })).toHaveAttribute('title', 'Used for your best hours, daily earnings, sessions, and stream recommendations.')
  })

  test('a saved creator timezone overrides browser detection', async () => {
    mockProfile = { ...NEW_USER, timezone: 'Europe/Berlin' }
    render(<OnboardingPage />)
    await waitFor(() => expect(shownTz()).toBe('Europe/Berlin'))
    fireEvent.click(screen.getByText('Chaturbate'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Chaturbate →' }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    expect(profileUpserts()[0].timezone).toBe('Europe/Berlin')
  })

  test('an invalid saved timezone is ignored in favour of the browser zone', async () => {
    mockProfile = { ...NEW_USER, timezone: 'GMT-8 PST' }
    render(<OnboardingPage />)
    await waitFor(() => expect(shownTz()).toBe('America/Los_Angeles'))
  })

  test.each([[''], [undefined], ['Not/AZone']])('invalid/empty browser timezone (%p) falls back to UTC', async (bad) => {
    mockBrowserTz = bad
    render(<OnboardingPage />)
    await waitFor(() => expect(shownTz()).toBe('UTC'))
  })

  test('manual change via search + select is shown and saved as an IANA zone', async () => {
    render(<OnboardingPage />)
    await waitFor(() => expect(shownTz()).toBe('America/Los_Angeles'))
    fireEvent.click(screen.getByRole('button', { name: 'Change timezone' }))
    fireEvent.change(screen.getByLabelText('Search timezones'), { target: { value: 'new york' } })
    expect(within(screen.getByRole('listbox', { name: 'Timezone' })).getByText('America/New_York')).toBeInTheDocument()
    pickTz('America/New_York')
    expect(shownTz()).toBe('America/New_York')
    expect(screen.queryByRole('listbox', { name: 'Timezone' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('BongaCams'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue with BongaCams →' }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    expect(profileUpserts()).toEqual([{ streaming_platforms: ['bongacams'], timezone: 'America/New_York' }])
  })

  test('save failure shows an inline error, keeps the selection, and retry succeeds', async () => {
    mockUpsertError = { message: 'network' }
    render(<OnboardingPage />)
    await waitFor(() => expect(shownTz()).toBe('America/Los_Angeles'))
    fireEvent.click(screen.getByRole('button', { name: 'Change timezone' }))
    fireEvent.change(screen.getByLabelText('Search timezones'), { target: { value: 'Tokyo' } })
    pickTz('Asia/Tokyo')
    fireEvent.click(screen.getByText('MyFreeCams'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue with MyFreeCams →' }))
    expect(await screen.findByTestId('primary-save-error')).toHaveTextContent('could not save your platforms and timezone')
    expect(global.fetch).not.toHaveBeenCalled()
    expect(shownTz()).toBe('Asia/Tokyo')
    expect(card('MyFreeCams')).toHaveAttribute('aria-checked', 'true')
    mockUpsertError = null
    fireEvent.click(screen.getByRole('button', { name: 'Continue with MyFreeCams →' }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    expect(profileUpserts().at(-1)).toEqual({ streaming_platforms: ['myfreecams'], timezone: 'Asia/Tokyo' })
  })

  test('after a successful save Step 1 continues to the primary platform connect step', async () => {
    render(<OnboardingPage />)
    await waitFor(() => expect(shownTz()).toBe('America/Los_Angeles'))
    fireEvent.click(screen.getByText('BongaCams'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue with BongaCams →' }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Paste your BongaCams tip history'))
    expect(screen.queryByTestId('primary-save-error')).not.toBeInTheDocument()
  })
})

describe('Onboarding Step 1 — compact reference layout', () => {
  beforeEach(() => { mockProfile = NEW_USER })

  test('compact mockup layout: headline, copy, equal cards CB → MFC → BC, no descriptions or extra boxes', async () => {
    render(<OnboardingPage />)
    await screen.findByText('Chaturbate')
    expect(screen.getByText('Choose your primary platform to import your data and get your first insights.')).toBeInTheDocument()
    expect(screen.queryByText('Why this matters?')).not.toBeInTheDocument()
    expect(screen.queryByText(/STEP 1 OF 3/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Import your tip history/)).not.toBeInTheDocument()
    const cards = screen.getAllByRole('radio')
    expect(cards.map((r) => r.querySelector('.ob-plat-name').textContent)).toEqual(['Chaturbate', 'MyFreeCams', 'BongaCams'])
  })

  test('timezone badge: Selected after a manual pick, Saved for a stored zone', async () => {
    render(<OnboardingPage />)
    await screen.findByTestId('timezone-detected')
    fireEvent.click(screen.getByRole('button', { name: 'Change timezone' }))
    pickTz('America/Chicago')
    expect(screen.getByTestId('timezone-status')).toHaveTextContent('Selected')
    expect(screen.queryByTestId('timezone-detected')).not.toBeInTheDocument()
  })

  test('timezone search matches city names', async () => {
    render(<OnboardingPage />)
    await screen.findByTestId('timezone-iana')
    fireEvent.click(screen.getByRole('button', { name: 'Change timezone' }))
    fireEvent.change(screen.getByLabelText('Search timezones'), { target: { value: 'los angeles' } })
    expect(within(screen.getByRole('listbox', { name: 'Timezone' })).getByText('America/Los_Angeles')).toBeInTheDocument()
  })

  test('the page itself is scroll-locked while onboarding is open', async () => {
    const { unmount } = render(<OnboardingPage />)
    await screen.findByText('Chaturbate')
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.documentElement.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  test('still single-select with the new cards', async () => {
    render(<OnboardingPage />)
    fireEvent.click(await screen.findByText('BongaCams'))
    fireEvent.click(screen.getByText('MyFreeCams'))
    await waitFor(() => expect(card('MyFreeCams')).toHaveAttribute('aria-checked', 'true'))
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Continue with MyFreeCams →' })).toBeEnabled()
  })

  test('no feature/unlock panel and no invented numbers on Step 1', async () => {
    render(<OnboardingPage />)
    await screen.findByText('Chaturbate')
    expect(screen.queryByTestId('unlock-panel')).not.toBeInTheDocument()
    expect(screen.queryByText(/What you’ll unlock/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\$\d|\d+%/)).not.toBeInTheDocument()
  })

  test('timezone picker is closed by default and opens on click', async () => {
    render(<OnboardingPage />)
    await screen.findByTestId('timezone-iana')
    expect(screen.queryByLabelText('Search timezones')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Change timezone' }))
    expect(screen.getByLabelText('Search timezones')).toBeInTheDocument()
  })

  test('no "Step 1 of 3", no login link, close button still present', async () => {
    render(<OnboardingPage />)
    await screen.findByText('Chaturbate')
    expect(screen.queryByText(/Step 1 of 3/)).not.toBeInTheDocument()
    expect(screen.queryByText(/log in/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close onboarding' })).toBeInTheDocument()
  })

  test('Detected badge shows for a browser-detected zone', async () => {
    render(<OnboardingPage />)
    expect(await screen.findByTestId('timezone-detected')).toHaveTextContent('Detected')
  })

  test('no Detected badge for a saved zone', async () => {
    mockProfile = { ...NEW_USER, timezone: 'Europe/Berlin' }
    render(<OnboardingPage />)
    await waitFor(() => expect(screen.getByTestId('timezone-iana')).toHaveTextContent('Europe/Berlin'))
    expect(screen.queryByTestId('timezone-detected')).not.toBeInTheDocument()
    expect(screen.getByTestId('timezone-status')).toHaveTextContent('Saved')
  })

  test('no Detected badge when detection failed and UTC is the fallback', async () => {
    mockBrowserTz = ''
    render(<OnboardingPage />)
    await waitFor(() => expect(screen.getByTestId('timezone-iana')).toHaveTextContent('UTC'))
    expect(screen.queryByTestId('timezone-detected')).not.toBeInTheDocument()
  })

  test('Detected badge disappears after a manual change', async () => {
    render(<OnboardingPage />)
    await screen.findByTestId('timezone-detected')
    fireEvent.click(screen.getByRole('button', { name: 'Change timezone' }))
    fireEvent.change(screen.getByLabelText('Search timezones'), { target: { value: 'tokyo' } })
    pickTz('Asia/Tokyo')
    expect(screen.getByTestId('timezone-iana')).toHaveTextContent('Asia/Tokyo')
    expect(screen.queryByTestId('timezone-detected')).not.toBeInTheDocument()
  })
})

describe('Onboarding Step 1 — timezone picker behaviour', () => {
  beforeEach(() => { mockProfile = NEW_USER })
  const open = async () => {
    await screen.findByTestId('timezone-iana')
    fireEvent.click(screen.getByRole('button', { name: 'Change timezone' }))
    return screen.getByRole('listbox', { name: 'Timezone' })
  }

  test('opens with the current zone first and checked, then common US zones', async () => {
    render(<OnboardingPage />)
    const list = await open()
    const opts = within(list).getAllByRole('option')
    expect(opts[0]).toHaveAttribute('aria-selected', 'true')
    expect(opts[0]).toHaveTextContent('America/Los_Angeles')
    expect(opts.slice(1, 5).map((o) => o.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('America/Denver'), expect.stringContaining('America/Chicago')]))
  })

  test('search matches readable names and IANA ids', async () => {
    render(<OnboardingPage />)
    await open()
    fireEvent.change(screen.getByLabelText('Search timezones'), { target: { value: 'Eastern Time' } })
    expect(within(screen.getByRole('listbox', { name: 'Timezone' })).getByText('America/New_York')).toBeInTheDocument()
  })

  test('Escape closes without changing the zone', async () => {
    render(<OnboardingPage />)
    await open()
    fireEvent.keyDown(screen.getByLabelText('Search timezones'), { key: 'Escape' })
    expect(screen.queryByRole('listbox', { name: 'Timezone' })).not.toBeInTheDocument()
    expect(screen.getByTestId('timezone-iana')).toHaveTextContent('America/Los_Angeles')
  })

  test('clicking outside closes it', async () => {
    render(<OnboardingPage />)
    await open()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('listbox', { name: 'Timezone' })).not.toBeInTheDocument()
  })

  test('keyboard: arrow down + Enter picks the highlighted zone', async () => {
    render(<OnboardingPage />)
    await open()
    const input = screen.getByLabelText('Search timezones')
    fireEvent.change(input, { target: { value: 'tokyo' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId('timezone-iana')).toHaveTextContent('Asia/Tokyo')
    expect(screen.queryByRole('listbox', { name: 'Timezone' })).not.toBeInTheDocument()
  })
})
