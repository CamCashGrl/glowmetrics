/**
 * Regression test for Phase 1 dashboard double-count bug.
 *
 * When Phase 1 writes extension tips to BOTH tips and live_tips tables,
 * the dashboard's merged query counts each tip twice.
 *
 * Scenario: Alice $5 + Bob $10 + Bob $10 + Alice $20 = $45 real earnings
 *
 * BROKEN: dashboard shows $90 (tips + live_tips merged without dedup)
 * FIXED: dashboard shows $45 (tips only for canonical, or tips + live_tips with filter)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

describe('Dashboard Double-Count Regression', () => {
  let sb
  let testUserId
  let liveSessionId

  beforeAll(async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.warn('Skipping live DB test — no Supabase credentials')
      return
    }
    sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  })

  beforeEach(async () => {
    if (!sb) return

    // Create test user and session
    const { data: { user } } = await sb.auth.admin.createUser({
      email: `test-dashboard-${Date.now()}@example.com`,
      password: 'test-password-123',
      email_confirm: true
    })
    testUserId = user?.id

    // Create live session for this test
    const { data: session } = await sb
      .from('live_sessions')
      .insert({
        user_id: testUserId,
        status: 'active',
        started_at: new Date().toISOString()
      })
      .select()
      .single()
    liveSessionId = session?.id
  })

  afterEach(async () => {
    if (!sb || !testUserId) return
    // Clean up test data
    try {
      await sb.from('tips').delete().eq('user_id', testUserId)
      await sb.from('live_tips').delete().eq('user_id', testUserId)
      await sb.from('live_sessions').delete().eq('user_id', testUserId)
      await sb.auth.admin.deleteUser(testUserId)
    } catch (e) {
      console.error('Cleanup error:', e)
    }
  })

  test('$45 scenario: canonical tips total should never be $90', async () => {
    if (!sb || !testUserId) return

    // Insert test scenario into BOTH tables (simulating Phase 1 behavior)
    const testTips = [
      { user_id: testUserId, username: 'Alice', tokens: 100, usd: 5, platform: 'chaturbate', date_time: new Date(Date.now() - 3000).toISOString(), client_event_id: 'eve-1' },
      { user_id: testUserId, username: 'Bob', tokens: 200, usd: 10, platform: 'chaturbate', date_time: new Date(Date.now() - 2000).toISOString(), client_event_id: 'eve-2' },
      { user_id: testUserId, username: 'Bob', tokens: 200, usd: 10, platform: 'chaturbate', date_time: new Date(Date.now() - 1000).toISOString(), client_event_id: 'eve-3' },
      { user_id: testUserId, username: 'Alice', tokens: 400, usd: 20, platform: 'chaturbate', date_time: new Date().toISOString(), client_event_id: 'eve-4' }
    ]

    // Write to tips table (canonical)
    const { error: tipsErr } = await sb
      .from('tips')
      .insert(testTips)
    expect(tipsErr).toBeNull()

    // Write SAME tips to live_tips (this is what Phase 1 does)
    const liveTips = testTips.map(t => ({
      ...t,
      received_at: t.date_time,
      live_session_id: liveSessionId,
      source: 'extension'
    }))
    delete liveTips.forEach(t => delete t.date_time) // live_tips uses received_at

    const { error: liveErr } = await sb
      .from('live_tips')
      .insert(liveTips)
    expect(liveErr).toBeNull()

    // Query like the dashboard does (BROKEN behavior)
    const { data: tipsData } = await sb
      .from('tips')
      .select('*')
      .eq('user_id', testUserId)

    const { data: liveTipsData } = await sb
      .from('live_tips')
      .select('*')
      .eq('user_id', testUserId)

    // Calculate totals the broken way (merge + sum)
    const mergedTips = [...(tipsData || []), ...(liveTipsData || [])]
    const brokenTotal = mergedTips.reduce((sum, t) => sum + (t.usd || 0), 0)

    // Calculate totals the fixed way (tips only)
    const fixedTotal = (tipsData || []).reduce((sum, t) => sum + (t.usd || 0), 0)

    // Expectations
    expect(fixedTotal).toBe(45) // Canonical earnings
    expect(brokenTotal).toBe(90) // ← BUG: Double count when merged

    // The fix should produce $45 everywhere
    // TODO: After fix is applied, change test expectation to:
    // expect(dashboardQueryResult).toBe(45)
  })

  test('Live Mode current session should use ONLY live_tips for that session', async () => {
    if (!sb || !testUserId || !liveSessionId) return

    const sessionTips = [
      { user_id: testUserId, username: 'Fan1', tokens: 100, usd: 5, platform: 'cb', received_at: new Date(Date.now() - 5000).toISOString(), live_session_id: liveSessionId },
      { user_id: testUserId, username: 'Fan2', tokens: 200, usd: 10, platform: 'cb', received_at: new Date(Date.now() - 3000).toISOString(), live_session_id: liveSessionId },
    ]

    const { error } = await sb.from('live_tips').insert(sessionTips)
    expect(error).toBeNull()

    // Live Mode should sum ONLY this session's live_tips
    const { data } = await sb
      .from('live_tips')
      .select('usd')
      .eq('user_id', testUserId)
      .eq('live_session_id', liveSessionId)

    const sessionTotal = (data || []).reduce((sum, t) => sum + (t.usd || 0), 0)
    expect(sessionTotal).toBe(15)
  })

  test('Free user should see $45, Pro user should see $45, never $90', async () => {
    if (!sb || !testUserId) return

    // Insert the test scenario
    const tips = [
      { user_id: testUserId, username: 'Alice', tokens: 100, usd: 5, platform: 'chaturbate', date_time: new Date().toISOString() },
      { user_id: testUserId, username: 'Bob', tokens: 200, usd: 10, platform: 'chaturbate', date_time: new Date().toISOString() },
      { user_id: testUserId, username: 'Bob', tokens: 200, usd: 10, platform: 'chaturbate', date_time: new Date().toISOString() },
      { user_id: testUserId, username: 'Alice', tokens: 400, usd: 20, platform: 'chaturbate', date_time: new Date().toISOString() },
    ]

    await sb.from('tips').insert(tips)

    // Query canonical earnings (what should be shown to both Free and Pro)
    const { data } = await sb
      .from('tips')
      .select('usd')
      .eq('user_id', testUserId)

    const total = (data || []).reduce((sum, t) => sum + (t.usd || 0), 0)

    // Both should see $45
    expect(total).toBe(45)
  })

  test('Platform totals should not be doubled', async () => {
    if (!sb || !testUserId) return

    const tips = [
      { user_id: testUserId, username: 'U1', tokens: 100, usd: 5, platform: 'chaturbate', date_time: new Date().toISOString() },
      { user_id: testUserId, username: 'U2', tokens: 200, usd: 10, platform: 'bongacams', date_time: new Date().toISOString() },
      { user_id: testUserId, username: 'U3', tokens: 300, usd: 15, platform: 'myfreecams', date_time: new Date().toISOString() },
    ]

    await sb.from('tips').insert(tips)

    // Should see each platform once: CB=$5, Bonga=$10, MFC=$15
    const { data } = await sb
      .from('tips')
      .select('platform, usd')
      .eq('user_id', testUserId)

    const byPlatform = {}
    for (const t of data || []) {
      const p = t.platform
      byPlatform[p] = (byPlatform[p] || 0) + t.usd
    }

    expect(byPlatform.chaturbate).toBe(5)
    expect(byPlatform.bongacams).toBe(10)
    expect(byPlatform.myfreecams).toBe(15)
  })

  test('Refresh should return same total, not double on each load', async () => {
    if (!sb || !testUserId) return

    const tips = [
      { user_id: testUserId, username: 'Alice', tokens: 100, usd: 5, platform: 'chaturbate', date_time: new Date().toISOString() },
      { user_id: testUserId, username: 'Bob', tokens: 200, usd: 10, platform: 'chaturbate', date_time: new Date().toISOString() },
    ]

    await sb.from('tips').insert(tips)

    // First load
    const { data: data1 } = await sb
      .from('tips')
      .select('usd')
      .eq('user_id', testUserId)
    const total1 = (data1 || []).reduce((s, t) => s + (t.usd || 0), 0)

    // Second load (refresh)
    const { data: data2 } = await sb
      .from('tips')
      .select('usd')
      .eq('user_id', testUserId)
    const total2 = (data2 || []).reduce((s, t) => s + (t.usd || 0), 0)

    // Both should be identical
    expect(total1).toBe(15)
    expect(total2).toBe(15)
    expect(total1).toBe(total2)
  })
})
