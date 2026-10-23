/**
 * Onboarding activation order: primary import → first insight → trial offer,
 * with secondary platforms optional (never forced before the trial), and
 * beta_users.onboarding_complete written only on the Trial/Free choice.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

HTMLCanvasElement.prototype.getContext = () => ({
  clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {},
  moveTo: () => {}, lineTo: () => {}, stroke: () => {}, closePath: () => {},
  save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {}, set fillStyle(v) {}, set strokeStyle(v) {},
  set globalAlpha(v) {}, set lineWidth(v) {},
})

const upserts = []
const mockPush=jest.fn()
let mockCompletionFailure=false
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
        insert: async () => ({ data: null, error: null }),
        single: async () => {
          if (table === 'beta_users') return { data: { onboarding_complete: false } }
          if (table === 'profiles') return { data: { plan: 'free', streaming_platforms: null, primary_pro_platform: null } }
          return { data: null }
        },
        upsert: async (row) => { upserts.push({ table, row }); return { data: null, error: table==='beta_users'&&mockCompletionFailure?{message:'failed'}:null } },
      }
      return chain
    }),
  },
}))
jest.mock('../../../lib/track', () => ({ track: jest.fn() }))
jest.mock('../../../lib/parseTracking', () => ({ logParseAttempt: jest.fn(), analyzeFormat: jest.fn(() => ({})) }))
jest.mock('../../../lib/analytics-client', () => ({ trackCheckoutEvent: jest.fn() }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }))

import OnboardingPage from '../page.js'
import { track } from '../../../lib/track'
import { controlPaste } from '../../../lib/__tests__/fixtures/onboardingControl'

const CB_HEADER = '"Timestamp","Token change","Token balance","Transaction type","User","Note"'
const row = (ts, n, u) => `"${ts}",${n},0,"Tip received","${u}",""`
const PASTE = [CB_HEADER, row('2026-02-12 06:05:59.000000', 5, 'fanA'), row('2026-02-01 10:23:58.000000', 20, 'fanB')].join('\n')

const completionWrites = () => upserts.filter(u => u.table === 'beta_users' && u.row.onboarding_complete === true)

beforeEach(() => {
  mockPush.mockClear();mockCompletionFailure=false
  upserts.length = 0
  track.mockClear()
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ inserted: 2, skipped: 0 }), text: async () => JSON.stringify({ inserted: 2, skipped: 0 }) })
})

async function importPrimaryWithSecondarySelected(paste=PASTE) {
  render(<OnboardingPage />)
  fireEvent.click(await screen.findByText('Chaturbate'))
  fireEvent.click(await screen.findByText('BongaCams'))
  fireEvent.click(screen.getByRole('button', { name: /Continue with 2 platforms/ }))
  fireEvent.change(await screen.findByPlaceholderText('your_username'), { target: { value: 'me' } })
  fireEvent.click(screen.getByRole('button', { name: /Continue to Tip Import/ }))
  fireEvent.change(await screen.findByPlaceholderText(/Paste|paste/), { target: { value: paste } })
  fireEvent.click(screen.getByRole('button', { name: /Import & build dashboard/ }))
  await screen.findByText(/Your Chaturbate data is ready/, {}, { timeout: 10000 })
}

test('primary success goes to the trial, not the secondary import; completion not yet written', async () => {
  await importPrimaryWithSecondarySelected()
  expect(screen.queryByRole('button', { name: /Continue to BongaCams/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Connect BongaCams later/ })).toBeInTheDocument()
  expect(completionWrites()).toHaveLength(0)
  expect(track).toHaveBeenCalledWith('onboarding_first_insight_viewed', expect.objectContaining({ primary_platform: 'chaturbate' }))

  fireEvent.click(screen.getByRole('button', { name: /^Continue →$/ }))
  expect(await screen.findByText('Keep CamCash updated automatically')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Start free trial/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Continue with Free/ })).toBeInTheDocument()
  expect(screen.queryByText(/Whales/)).not.toBeInTheDocument()
  expect(completionWrites()).toHaveLength(0)
}, 20000)

test('choosing Free marks onboarding complete and goes straight to dashboard', async () => {
  await importPrimaryWithSecondarySelected()
  fireEvent.click(screen.getByRole('button', { name: /Connect BongaCams later/ }))
  fireEvent.click(await screen.findByRole('button', { name: /Continue with Free/ }))
  await waitFor(()=>expect(mockPush).toHaveBeenCalledWith('/dashboard'))
  expect(screen.queryByText(/You're ready to use CamCash Free/)).not.toBeInTheDocument()
  await waitFor(() => expect(completionWrites()).toHaveLength(1))
  expect(track).toHaveBeenCalledWith('onboarding_free_selected', expect.any(Object))
}, 20000)

test('starting the trial marks onboarding complete before the Stripe redirect', async () => {
  await importPrimaryWithSecondarySelected()
  fireEvent.click(screen.getByRole('button', { name: /^Continue →$/ }))
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ error: 'stub' }), text: async () => JSON.stringify({ error: 'stub' }) })
  window.alert = jest.fn()
  fireEvent.click(await screen.findByRole('button', { name: /Start free trial/ }))
  await waitFor(() => expect(completionWrites()).toHaveLength(1))
  expect(track).toHaveBeenCalledWith('onboarding_trial_started', expect.any(Object))
}, 20000)

test('Free completion failure stays recoverable without navigation',async()=>{
  await importPrimaryWithSecondarySelected()
  fireEvent.click(screen.getByRole('button',{name:/^Continue →$/}))
  mockCompletionFailure=true
  fireEvent.click(screen.getByRole('button',{name:/Continue with Free/}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Please try again')
  expect(mockPush).not.toHaveBeenCalled()
  mockCompletionFailure=false
  fireEvent.click(screen.getByRole('button',{name:/Continue with Free/}))
  await waitFor(()=>expect(mockPush).toHaveBeenCalledWith('/dashboard'))
})

test('username is optional, help collapsed, safe fallback and compact paste remains editable',async()=>{
  render(<OnboardingPage/>)
  fireEvent.click(await screen.findByText('Chaturbate'))
  fireEvent.click(screen.getByRole('button',{name:/Continue with 1 platform/}))
  fireEvent.click(await screen.findByRole('button',{name:/Continue to Tip Import/}))
  const help=screen.getByText('How to copy from Chaturbate',{selector:'summary'}).closest('details')
  expect(help).not.toHaveAttribute('open')
  fireEvent.click(help.querySelector('summary'))
  expect(screen.getByRole('link',{name:/Open Chaturbate settings/})).toHaveAttribute('href','https://chaturbate.com/accounts/settings/')
  expect(screen.queryByRole('link',{name:/Open earnings page/})).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole('textbox',{name:'Earning history'}),{target:{value:PASTE.repeat(4)}})
  expect(screen.getByText('Data detected')).toBeInTheDocument()
  expect(screen.queryByRole('textbox',{name:'Earning history'})).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'View or edit data'}))
  expect(screen.getByRole('textbox',{name:'Earning history'})).toHaveValue(PASTE.repeat(4))
  expect(screen.getByText('Platforms',{selector:'.ob-stepper-labels div'})).toBeInTheDocument()
  expect(screen.getByText('Import',{selector:'.ob-stepper-labels div'})).toBeInTheDocument()
  expect(screen.getByText('Dashboard',{selector:'.ob-stepper-labels div'})).toBeInTheDocument()
})

test('trial retains seven days, monthly price and monthly checkout request',async()=>{
  await importPrimaryWithSecondarySelected()
  fireEvent.click(screen.getByRole('button',{name:/^Continue →$/}))
  expect(screen.getByText('7 days free')).toBeInTheDocument()
  expect(screen.getByText(/Then \$9.99\/month/)).toBeInTheDocument()
  const primary=screen.getByRole('button',{name:/Start free trial/})
  const free=screen.getByRole('button',{name:/Continue with Free/})
  expect(primary.compareDocumentPosition(free)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  global.fetch=jest.fn().mockResolvedValue({ok:false,json:async()=>({error:'Checkout unavailable'})})
  fireEvent.click(primary)
  await waitFor(()=>expect(global.fetch).toHaveBeenCalledWith('/api/stripe/checkout',expect.objectContaining({body:JSON.stringify({plan_type:'standard_monthly'})})))
  expect(await screen.findByRole('alert')).toHaveTextContent('Checkout unavailable')
})

test('proof screen displays the classified control totals',async()=>{
  await importPrimaryWithSecondarySelected(controlPaste())
  expect(screen.getByText('Total Earnings')).toBeInTheDocument()
  expect(screen.getByText('$369.40')).toBeInTheDocument()
  expect(screen.getByText('994 · $316.55')).toBeInTheDocument()
  expect(screen.getByText('$42.85 · 95 private transactions')).toBeInTheDocument()
  expect(screen.getByText('2 · $10.00')).toBeInTheDocument()
  expect(screen.getByText('235')).toBeInTheDocument()
  expect(screen.queryByText('$326.55')).not.toBeInTheDocument()
})

test('partial private persistence prevents success and lets the same paste be retried',async()=>{
  render(<OnboardingPage/>)
  fireEvent.click(await screen.findByText('Chaturbate'))
  fireEvent.click(screen.getByRole('button',{name:/Continue with 1 platform/}))
  fireEvent.click(await screen.findByRole('button',{name:/Continue to Tip Import/}))
  const raw='Oct 10, 2026, 8:00 PM\nPrivate Show: fan\n20  200'
  fireEvent.change(screen.getByRole('textbox',{name:'Earning history'}),{target:{value:raw}})
  global.fetch=jest.fn().mockResolvedValue({ok:true,text:async()=>JSON.stringify({ok:false,paidSessionsInserted:0,paidSessionsWarnings:[{error:'storage failed'}]})})
  fireEvent.click(screen.getByRole('button',{name:/Import & build dashboard/}))
  expect(await screen.findByText(/Some rows could not be saved/)).toBeInTheDocument()
  expect(screen.queryByText(/Your Chaturbate data is ready/)).not.toBeInTheDocument()
  expect(screen.getByRole('textbox',{name:'Earning history'})).toHaveValue(raw)
  expect(completionWrites()).toHaveLength(0)
  global.fetch=jest.fn().mockResolvedValue({ok:true,text:async()=>JSON.stringify({ok:true,inserted:0,paidSessionsInserted:0,paidSessionsSkipped:1})})
  fireEvent.click(screen.getByRole('button',{name:/Import & build dashboard/}))
  expect(await screen.findByText(/Your Chaturbate data is ready/)).toBeInTheDocument()
  expect(screen.getByText('$1.00 · 1 private transactions')).toBeInTheDocument()
  const body=global.fetch.mock.calls[0][1].body
  expect(body.get('platform')).toBe('Chaturbate')
  expect(body.get('time_zone')).toBeTruthy()
})
