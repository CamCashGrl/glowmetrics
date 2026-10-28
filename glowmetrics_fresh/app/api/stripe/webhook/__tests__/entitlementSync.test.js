/**
 * Entitlement sync: only a paid active Stripe subscription maps to Pro.
 * Trialing stays on the capped trial entitlement path (profile plan remains
 * free while subscription_status=trialing), failures are retryable, and
 * repeated Stripe events are idempotent.
 */
jest.mock('next/server', () => ({ NextResponse: { json: (body, init) => ({ body, status: init?.status || 200 }) } }))

const mockStripe = {
  webhooks: { constructEvent: jest.fn((body) => JSON.parse(body)) },
  customers: { retrieve: jest.fn(async () => ({ email: null })) },
  subscriptions: { retrieve: jest.fn() },
}
jest.mock('stripe', () => jest.fn().mockImplementation(() => mockStripe))

let db
let failProfileWrites
function query(table) {
  const filters = []
  let op = 'select', payload = null, onConflict = null
  const rows = () => db[table].filter((r) => filters.every(([k, v]) => r[k] === v))
  const run = () => {
    if (op === 'update') {
      if (table === 'profiles' && failProfileWrites) return { data: null, error: { message: 'boom' } }
      rows().forEach((r) => Object.assign(r, payload))
      return { data: null, error: null }
    }
    if (op === 'upsert') {
      const existing = db[table].find((r) => r[onConflict] === payload[onConflict])
      existing ? Object.assign(existing, payload) : db[table].push({ ...payload })
      return { data: null, error: null }
    }
    return { data: rows(), error: null }
  }
  const b = {
    select: () => b,
    eq: (k, v) => { filters.push([k, v]); return b },
    limit: () => b,
    update: (p) => { op = 'update'; payload = p; return b },
    upsert: (p, o) => { op = 'upsert'; payload = p; onConflict = o.onConflict; return b },
    maybeSingle: async () => ({ data: run().data?.[0] ?? null, error: null }),
    then: (res, rej) => Promise.resolve(run()).then(res, rej),
  }
  return b
}
const fakeSupabase = {
  from: (t) => query(t),
  rpc: async (_fn, args) => { db.subscription_events.push({ stripe_event_id: args.p_stripe_event_id, event_type: args.p_event_type }); return { error: null } },
  auth: { admin: {
    getUserById: async (id) => (db.users.find((u) => u.id === id) ? { data: { user: db.users.find((u) => u.id === id) }, error: null } : { data: null, error: { message: 'nf' } }),
    listUsers: async () => ({ data: { users: db.users }, error: null }),
  } },
}
jest.mock('@supabase/supabase-js', () => ({ createClient: () => fakeSupabase }))
global.fetch = jest.fn(async () => ({ ok: true }))

const { POST } = require('../route')

const USER = 'user-1'
const CUS = 'cus_1'
beforeEach(() => {
  failProfileWrites = false
  mockStripe.subscriptions.retrieve.mockReset()
  db = {
    users: [{ id: USER, email: 'model@example.com' }],
    profiles: [{ id: USER, plan: 'pro', subscription_status: 'active', stripe_customer_id: CUS, stripe_subscription_id: 'sub_1' }],
    subscriptions: [],
    webhook_events: [],
    subscription_events: [],
  }
})

let n = 0
const sub = (status, extra = {}) => ({ id: 'sub_1', customer: CUS, status, metadata: { userId: USER }, created: 1000, items: { data: [{ price: { id: 'price_x', recurring: { interval: 'month' } } }] }, ...extra })
const send = (type, object) => POST({ text: async () => JSON.stringify({ id: `evt_${++n}`, type, data: { object } }), headers: { get: () => 'sig' } })
const profile = () => db.profiles[0]

describe.each([
  ['active', 'pro'],
  ['trialing', 'free'],
  ['past_due', 'free'],
  ['unpaid', 'free'],
  ['canceled', 'free'],
  ['incomplete_expired', 'free'],
])('customer.subscription.updated → %s', (status, plan) => {
  test(`sets plan=${plan} and subscription_status=${status}`, async () => {
    const res = await send('customer.subscription.updated', sub(status))
    expect(res.status).toBe(200)
    expect(profile().plan).toBe(plan)
    expect(profile().subscription_status).toBe(status)
  })
})

test('trialing keeps capped entitlement until successful payment', async () => {
  await send('customer.subscription.updated', sub('trialing', { trial_end: 2000 }))
  expect(profile().plan).toBe('free')
  expect(profile().subscription_status).toBe('trialing')
  await send('customer.subscription.updated', sub('active'))
  expect(profile().plan).toBe('pro')
  expect(profile().subscription_status).toBe('active')
})

test('successful payment recovery: past_due → active restores Pro', async () => {
  await send('customer.subscription.updated', sub('past_due'))
  expect(profile().plan).toBe('free')
  await send('customer.subscription.updated', sub('active'))
  expect(profile().plan).toBe('pro')
  expect(profile().subscription_status).toBe('active')
})

test('customer.subscription.deleted downgrades to free/canceled', async () => {
  const res = await send('customer.subscription.deleted', sub('canceled'))
  expect(res.status).toBe(200)
  expect(profile()).toMatchObject({ plan: 'free', subscription_status: 'canceled' })
})

test('missing metadata.userId resolves by Stripe customer id (no email needed)', async () => {
  const res = await send('customer.subscription.updated', sub('past_due', { metadata: {} }))
  expect(res.status).toBe(200)
  expect(profile().plan).toBe('free')
})

test('completely unresolved customer is NOT acknowledged — Stripe must retry', async () => {
  const res = await send('customer.subscription.updated', sub('past_due', { metadata: {}, customer: 'cus_unknown' }))
  expect(res.status).toBeGreaterThanOrEqual(500)
  expect(profile().plan).toBe('pro')
  expect(db.webhook_events[0].status).toBe('user_resolution_failed')
})

test('failed profile write is NOT acknowledged — Stripe must retry', async () => {
  failProfileWrites = true
  const res = await send('customer.subscription.updated', sub('past_due'))
  expect(res.status).toBeGreaterThanOrEqual(500)
})

test('no failure path returns a 2xx', async () => {
  failProfileWrites = true
  for (const type of ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted']) {
    const res = await send(type, sub('active'))
    expect(res.status).toBeGreaterThanOrEqual(500)
  }
})

test('idempotent: a retried event after success changes nothing and logs once', async () => {
  const event = { id: 'evt_dup', type: 'customer.subscription.updated', data: { object: sub('past_due') } }
  const req = () => ({ text: async () => JSON.stringify(event), headers: { get: () => 'sig' } })
  await POST(req())
  profile().plan = 'pro'
  const res = await POST(req())
  expect(res.body.status).toBe('duplicate')
  expect(profile().plan).toBe('pro')
  expect(db.subscription_events.filter((e) => e.stripe_event_id === 'evt_dup')).toHaveLength(1)
  expect(db.webhook_events.filter((e) => e.stripe_event_id === 'evt_dup')).toHaveLength(1)
})

test('retry after a failure is processed and the event row flips to success', async () => {
  const event = { id: 'evt_retry', type: 'customer.subscription.updated', data: { object: sub('past_due') } }
  const req = () => ({ text: async () => JSON.stringify(event), headers: { get: () => 'sig' } })
  failProfileWrites = true
  expect((await POST(req())).status).toBe(500)
  failProfileWrites = false
  expect((await POST(req())).status).toBe(200)
  expect(profile().plan).toBe('free')
  expect(db.webhook_events.find((e) => e.stripe_event_id === 'evt_retry').status).toBe('success')
})

test('late event for an older subscription cannot overwrite the newer one', async () => {
  profile().stripe_subscription_id = 'sub_new'
  mockStripe.subscriptions.retrieve.mockResolvedValue({ id: 'sub_new', created: 5000 })
  const res = await send('customer.subscription.deleted', sub('canceled', { id: 'sub_old', created: 1000 }))
  expect(res.status).toBe(200)
  expect(profile().plan).toBe('pro')
})

test('out-of-order: update for a NEWER subscription is applied even before its created event', async () => {
  mockStripe.subscriptions.retrieve.mockResolvedValue({ id: 'sub_1', created: 1000 })
  await send('customer.subscription.updated', sub('active', { id: 'sub_2', created: 9000 }))
  expect(profile().stripe_subscription_id).toBe('sub_2')
  expect(profile().plan).toBe('pro')
})
