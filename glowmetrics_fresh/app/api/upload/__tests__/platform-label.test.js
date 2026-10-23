/**
 * @jest-environment node
 */
// Imports are never stored with platform 'Unknown': the platform comes from
// the user's choice, the file contents, or the file name — else the upload
// is rejected before anything is written.
jest.mock('next/server', () => ({
  NextResponse: { json: (body, init) => ({ status: init?.status ?? 200, json: async () => body }) },
}))

let rpcCalls
let mockPaidMode
function mockSupabase() {
  const chain = { insert: jest.fn(async () => ({ error: null })), delete: jest.fn(() => chain), eq: jest.fn(async () => ({ error: null })) }
  return {
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'creator-1' } }, error: null })) },
    from: jest.fn(() => chain),
    rpc: jest.fn(async (name, params) => {
      rpcCalls.push({ name, params })
      if (name === 'insert_tips_dedup') return { data: { inserted: params.tips.length, skipped: 0 }, error: null }
      if (name === 'insert_paid_sessions_dedup' && mockPaidMode==='failure') return {data:null,error:{message:'simulated paid storage failure'}}
      if (name === 'insert_paid_sessions_dedup' && mockPaidMode==='duplicate') return {data:{inserted:0,skipped:params.sessions.length},error:null}
      if (name === 'insert_paid_sessions_dedup') return { data: { inserted: (params.sessions || params.rows || []).length, skipped: 0 }, error: null }
      return { data: null, error: null }
    }),
  }
}
jest.mock('@supabase/supabase-js', () => ({ createClient: () => mockSupabase() }))

const { POST: upload } = require('../route')
const { POST: uploadPaid } = require('../../upload-paid-sessions/route')

function req(text, { name = 'upload.csv', platform, dateOrder } = {}) {
  const fd = new Map([['file', { name, text: async () => text }]])
  if (platform !== undefined) fd.set('platform', platform)
  if (dateOrder !== undefined) fd.set('date_order', dateOrder)
  return {
    headers: { get: (h) => (h.toLowerCase() === 'authorization' ? 'Bearer t' : null) },
    formData: async () => ({ get: (k) => fd.get(k) ?? null }),
  }
}

// A cleaned CSV with no platform words in it (like MFC2024-2026CLEANEDCSV.csv).
const CLEAN = ['date_time,username,tokens', '2025-05-19 21:04,fanA,900', '2025-07-18 05:43,fanB,50'].join('\n')
const insertedTips = () => rpcCalls.filter((c) => c.name === 'insert_tips_dedup').flatMap((c) => c.params.tips)

beforeEach(() => { rpcCalls = [];mockPaidMode='success' })

describe('/api/upload platform labelling', () => {
  test('undetectable platform with no choice is rejected and nothing is written', async () => {
    const res = await upload(req(CLEAN, { name: 'export.csv' }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('platform_required')
    expect(insertedTips()).toHaveLength(0)
  })

  test('file name identifies the platform when the contents do not', async () => {
    const res = await upload(req(CLEAN, { name: 'MFC2024-2026CLEANEDCSV.csv' }))
    expect(res.status).toBe(200)
    const tips = insertedTips()
    expect(tips).toHaveLength(2)
    expect(tips.every((t) => t.platform === 'MyFreeCams')).toBe(true)
  })

  test('the chosen platform labels the rows and sets the token rate', async () => {
    const res = await upload(req(CLEAN, { platform: 'bongacams' }))
    expect(res.status).toBe(200)
    const tips = insertedTips()
    expect(tips.every((t) => t.platform === 'BongaCams')).toBe(true)
    // BongaCams tokenRate (0.025), not DEFAULT_TOKEN_RATE (0.05)
    expect(tips.find((t) => t.username.toLowerCase() === 'fana').usd).toBe(22.5)
  })

  test('an unsupported chosen platform is rejected', async () => {
    const res = await upload(req(CLEAN, { platform: 'NotAPlatform' }))
    expect(res.status).toBe(400)
    expect(insertedTips()).toHaveLength(0)
  })

  test('no row is ever stored as Unknown', async () => {
    await upload(req(CLEAN, { platform: 'Chaturbate' }))
    expect(insertedTips().some((t) => t.platform === 'Unknown')).toBe(false)
  })
})

describe('/api/upload-paid-sessions platform labelling', () => {
  const PAID = ['date_time,username,session_type,tokens,usd', '2026-03-29 07:46,fanA,Private Chat,600,'].join('\n')
  const insertedPaid = () => rpcCalls.filter((c) => c.name === 'insert_paid_sessions_dedup').map((c) => c.params)

  test('uses the given platform instead of always BongaCams', async () => {
    const res = await uploadPaid(req(PAID, { platform: 'Chaturbate' }))
    expect(res.status).toBe(200)
    expect(JSON.stringify(insertedPaid())).toContain('"platform":"Chaturbate"')
    expect(JSON.stringify(insertedPaid())).not.toContain('BongaCams')
  })

  test('missing platform is rejected', async () => {
    const res = await uploadPaid(req(PAID))
    expect(res.status).toBe(400)
    expect(insertedPaid()).toHaveLength(0)
  })
})

describe('/api/upload date order', () => {
  const AMB = ['date_time,username,tokens', '06/11/2024 11:21,fanA,10', '07/08/2024 04:44,fanB,5'].join('\n')
  const DMY = ['date_time,username,tokens', '06/11/2024 11:21,fanA,10', '25/08/2024 04:44,fanB,5'].join('\n')
  const MIX = ['date_time,username,tokens', '13/11/2024 11:21,fanA,10', '08/25/2024 04:44,fanB,5'].join('\n')
  const day = (t) => { const d = new Date(t.date_time); return `${d.getMonth() + 1}/${d.getDate()}` }

  test('an all-ambiguous file is rejected until the user chooses, nothing written', async () => {
    const res = await upload(req(AMB, { platform: 'BongaCams' }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('date_order_required')
    expect(insertedTips()).toHaveLength(0)
  })

  test('the chosen order is applied', async () => {
    const res = await upload(req(AMB, { platform: 'BongaCams', dateOrder: 'DMY' }))
    expect(res.status).toBe(200)
    expect(insertedTips().map(day).sort()).toEqual(['11/6', '8/7'])
  })

  test('a file that proves day-first is read day-first without asking', async () => {
    const res = await upload(req(DMY, { platform: 'BongaCams' }))
    expect(res.status).toBe(200)
    expect(insertedTips().map(day).sort()).toEqual(['11/6', '8/25'])
  })

  test('a choice contradicting the file is rejected', async () => {
    const res = await upload(req(DMY, { platform: 'BongaCams', dateOrder: 'MDY' }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('date_order_mismatch')
    expect(insertedTips()).toHaveLength(0)
  })

  test('a file mixing both orders is rejected', async () => {
    const res = await upload(req(MIX, { platform: 'BongaCams' }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('date_order_conflict')
    expect(insertedTips()).toHaveLength(0)
  })
})

describe('Chaturbate category-aware persistence',()=>{
  const raw='Oct 10, 2026, 8:00 PM\nPrivate Show: fanA\n857  1000'
  test('private-only paste uses existing paid dedup RPC with actual response counts',async()=>{
    const json=await (await upload(req(raw,{platform:'Chaturbate'}))).json()
    expect(insertedTips()).toHaveLength(0)
    expect(rpcCalls.find(c=>c.name==='insert_paid_sessions_dedup').params.sessions).toEqual([expect.objectContaining({username:'fana',session_type:'Private Show',tokens:857,usd:42.85})])
    expect(json.paidSessionsInserted).toBe(1)
    expect(json.onboardingSummary.full).toMatchObject({tips:0,usd:42.85,fans:1})
  })
  test('duplicate private RPC result is reported as skipped, not inserted',async()=>{
    mockPaidMode='duplicate'
    const json=await (await upload(req(raw,{platform:'Chaturbate'}))).json()
    expect(json.paidSessionsInserted).toBe(0)
    expect(json.paidSessionsSkipped).toBe(1)
    expect(json.onboardingSummary.full.usd).toBe(42.85)
  })
  test('paid failure remains explicit even when tips succeed',async()=>{
    mockPaidMode='failure'
    const mixed=raw+'\nOct 10, 2026, 9:00 PM\nTip From: fanB\n10  1010'
    const json=await (await upload(req(mixed,{platform:'Chaturbate'}))).json()
    expect(json.inserted).toBe(1)
    expect(json.paidSessionsInserted).toBe(0)
    expect(json.paidSessionsWarnings).toEqual([expect.objectContaining({error:'simulated paid storage failure'})])
  })
})
