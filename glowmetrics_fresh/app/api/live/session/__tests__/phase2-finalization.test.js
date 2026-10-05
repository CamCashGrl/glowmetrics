/**
 * Phase 2 finalization tests
 *
 * Tests for atomic finalization, delayed-tip reconciliation, and metric calculation.
 * Requires a test database with proper migrations applied.
 */

import { createClient } from '@supabase/supabase-js';

describe('Phase 2: Atomic Finalization & Delayed-Tip Reconciliation', () => {
  let supabaseAdmin;
  let testUserId;

  beforeAll(async () => {
    supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Create test user (use deterministic ID or create in test)
    testUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; // Use fixed test UUID
  });

  describe('finalize_live_session', () => {
    it('should finalize active session and calculate metrics', async () => {
      // Start session
      const { data: startData, error: startErr } = await supabaseAdmin.rpc(
        'start_live_session',
        { p_platform: 'Chaturbate' },
        { headers: { 'x-user-id': testUserId } }
      );
      expect(startErr).toBeNull();
      const sessionId = startData.id;

      // Send tip
      const { data: tipData, error: tipErr } = await supabaseAdmin.rpc(
        'persist_extension_tip',
        {
          p_user_id: testUserId,
          p_client_event_id: '11111111-1111-1111-1111-111111111111',
          p_deduplication_key: 'test-tip-1',
          p_username: 'tipper1',
          p_tokens: 100,
          p_usd: 10.00,
          p_platform: 'chaturbate',
          p_event_at: new Date().toISOString(),
        }
      );
      expect(tipErr).toBeNull();
      expect(tipData.success).toBe(true);
      expect(tipData.duplicate).toBe(false);

      // Finalize session
      const { data: finalData, error: finalErr } = await supabaseAdmin.rpc(
        'finalize_live_session',
        { p_session_id: sessionId },
        { headers: { 'x-user-id': testUserId } }
      );
      expect(finalErr).toBeNull();
      expect(finalData.status).toBe('ended');
      expect(finalData.finalized_at).not.toBeNull();
      expect(finalData.final_total_usd).toBe(10.00);
      expect(finalData.final_tokens).toBe(100);
      expect(finalData.final_tip_count).toBe(1);
      expect(finalData.final_unique_tippers).toBe(1);
      expect(finalData.final_top_tipper_username).toBe('tipper1');
      expect(finalData.final_top_tipper_usd).toBe(10.00);
    });

    it('should be idempotent on repeated Stop calls', async () => {
      // Start and finalize session
      const { data: startData, error: startErr } = await supabaseAdmin.rpc(
        'start_live_session',
        { p_platform: 'Chaturbate' },
        { headers: { 'x-user-id': testUserId } }
      );
      expect(startErr).toBeNull();
      expect(startData).toBeDefined();
      const sessionId = startData.id;

      // First stop
      const { data: stop1Data, error: stop1Err } = await supabaseAdmin.rpc(
        'finalize_live_session',
        { p_session_id: sessionId },
        { headers: { 'x-user-id': testUserId } }
      );
      expect(stop1Err).toBeNull();
      expect(stop1Data.status).toBe('ended');

      // Second stop (repeated call)
      const { data: stop2Data, error: stop2Err } = await supabaseAdmin.rpc(
        'finalize_live_session',
        { p_session_id: sessionId },
        { headers: { 'x-user-id': testUserId } }
      );
      expect(stop2Err).toBeNull();
      // Should return the same finalized session
      expect(stop2Data.id).toBe(sessionId);
      expect(stop2Data.status).toBe('ended');
      expect(stop2Data.finalized_at).toEqual(stop1Data.finalized_at);
    });

    it('should return exact session when p_session_id provided on repeat call', async () => {
      // Create and finalize two sessions
      const { data: session1, error: err1 } = await supabaseAdmin.rpc(
        'start_live_session',
        { p_platform: 'Chaturbate' },
        { headers: { 'x-user-id': testUserId } }
      );
      expect(err1).toBeNull();
      expect(session1).toBeDefined();

      // Finalize session 1
      const { error: finErr1 } = await supabaseAdmin.rpc(
        'finalize_live_session',
        { p_session_id: session1.id },
        { headers: { 'x-user-id': testUserId } }
      );
      expect(finErr1).toBeNull();

      // Create session 2
      const { data: session2, error: err2 } = await supabaseAdmin.rpc(
        'start_live_session',
        { p_platform: 'Chaturbate' },
        { headers: { 'x-user-id': testUserId } }
      );
      expect(err2).toBeNull();
      expect(session2).toBeDefined();

      // Finalize session 2
      const { error: finErr2 } = await supabaseAdmin.rpc(
        'finalize_live_session',
        { p_session_id: session2.id },
        { headers: { 'x-user-id': testUserId } }
      );
      expect(finErr2).toBeNull();

      // Call finalize on session 1 again (it's already ended)
      const { data: result, error: resultErr } = await supabaseAdmin.rpc(
        'finalize_live_session',
        { p_session_id: session1.id },
        { headers: { 'x-user-id': testUserId } }
      );
      expect(resultErr).toBeNull();
      expect(result).toBeDefined();

      // Should return session 1, NOT session 2
      expect(result.id).toBe(session1.id);
    });
  });

  describe('persist_extension_tip with delayed reconciliation', () => {
    it('should assign tip to active session when event_at >= started_at', async () => {
      const now = new Date();
      const { data: session, error: sessionErr } = await supabaseAdmin.rpc(
        'start_live_session',
        { p_platform: 'Chaturbate' },
        { headers: { 'x-user-id': testUserId } }
      );
      expect(sessionErr).toBeNull();
      expect(session).toBeDefined();

      // Tip with event_at during session
      const { data: tipData, error } = await supabaseAdmin.rpc(
        'persist_extension_tip',
        {
          p_user_id: testUserId,
          p_client_event_id: '22222222-2222-2222-2222-222222222222',
          p_deduplication_key: 'test-tip-2',
          p_username: 'tipper2',
          p_tokens: 50,
          p_usd: 5.00,
          p_platform: 'chaturbate',
          p_event_at: new Date(now.getTime() + 1000).toISOString(),
        }
      );
      expect(error).toBeNull();
      expect(tipData).toBeDefined();
      expect(tipData.live_session_id).toBe(session.id);
    });

    it('should reconcile tip to previous session when event_at predates current session', async () => {
      const baseTime = new Date('2024-01-01T10:00:00Z');

      // Session A: 10:00 - 10:30
      const { data: sessionA, error: errA } = await supabaseAdmin.rpc(
        'start_live_session',
        { p_platform: 'Chaturbate' },
        { headers: { 'x-user-id': testUserId } }
      );
      expect(errA).toBeNull();
      expect(sessionA).toBeDefined();

      // Manually set start/end times for testing (in real tests, use fixtures)
      // For now, assume timing works naturally

      // Finalize session A
      const { error: finErrA } = await supabaseAdmin.rpc(
        'finalize_live_session',
        { p_session_id: sessionA.id },
        { headers: { 'x-user-id': testUserId } }
      );
      expect(finErrA).toBeNull();

      // Session B: 10:35 - active
      const { data: sessionB, error: errB } = await supabaseAdmin.rpc(
        'start_live_session',
        { p_platform: 'Chaturbate' },
        { headers: { 'x-user-id': testUserId } }
      );
      expect(errB).toBeNull();
      expect(sessionB).toBeDefined();

      // Delayed tip with event_at from session A
      // In real test, use a timestamp that falls within A's window
      // This is a simplified test; actual test needs timestamp control

      const { data: tipData, error: tipErr } = await supabaseAdmin.rpc(
        'persist_extension_tip',
        {
          p_user_id: testUserId,
          p_client_event_id: '33333333-3333-3333-3333-333333333333',
          p_deduplication_key: 'test-tip-3',
          p_username: 'tipper3',
          p_tokens: 75,
          p_usd: 7.50,
          p_platform: 'chaturbate',
          p_event_at: new Date(baseTime.getTime() + 15 * 60 * 1000).toISOString(), // 10:15 (during A)
        }
      );
      expect(tipErr).toBeNull();
      expect(tipData).toBeDefined();

      // Tip should be assigned to session A (the previous one with matching event_at)
      expect(tipData.live_session_id).toBe(sessionA.id);
    });

    it('should handle duplicate retry of delayed tip (idempotency)', async () => {
      const eventId = '44444444-4444-4444-4444-444444444444';
      const dedupeKey = 'test-tip-dupe-1';

      // First send
      const { data: tipData1, error: err1 } = await supabaseAdmin.rpc(
        'persist_extension_tip',
        {
          p_user_id: testUserId,
          p_client_event_id: eventId,
          p_deduplication_key: dedupeKey,
          p_username: 'tipper4',
          p_tokens: 200,
          p_usd: 20.00,
          p_platform: 'chaturbate',
          p_event_at: new Date().toISOString(),
        }
      );
      expect(err1).toBeNull();
      expect(tipData1.duplicate).toBe(false);

      // Retry (same clientEventId)
      const { data: tipData2, error: err2 } = await supabaseAdmin.rpc(
        'persist_extension_tip',
        {
          p_user_id: testUserId,
          p_client_event_id: eventId,
          p_deduplication_key: dedupeKey,
          p_username: 'tipper4',
          p_tokens: 200,
          p_usd: 20.00,
          p_platform: 'chaturbate',
          p_event_at: new Date().toISOString(),
        }
      );
      expect(err2).toBeNull();
      expect(tipData2.duplicate).toBe(true);
      expect(tipData2.live_tip_id).toBe(tipData1.live_tip_id);
    });

    it('should leave tip unattributed if multiple sessions match event_at (ambiguous)', async () => {
      // Create two ended sessions with overlapping time windows
      const baseTime = new Date();
      const session1StartMs = baseTime.getTime() - 60 * 60 * 1000; // 1 hour ago
      const session1EndMs = baseTime.getTime() - 30 * 60 * 1000; // 30 minutes ago
      const session2StartMs = baseTime.getTime() - 45 * 60 * 1000; // 45 minutes ago
      const session2EndMs = baseTime.getTime() - 15 * 60 * 1000; // 15 minutes ago

      // Sessions overlap: session2 (45min-15min) overlaps with session1 (60min-30min)
      // Overlap window: 45min to 30min ago

      // Create and finalize session 1
      const { data: session1, error: err1 } = await supabaseAdmin.rpc(
        'start_live_session',
        { p_platform: 'Chaturbate' },
        { headers: { 'x-user-id': testUserId } }
      );
      expect(err1).toBeNull();
      expect(session1).toBeDefined();

      // Manually update session1 timestamps to create the overlap
      const { error: updateErr1 } = await supabaseAdmin
        .from('live_sessions')
        .update({
          started_at: new Date(session1StartMs).toISOString(),
          ended_at: new Date(session1EndMs).toISOString(),
          status: 'ended',
        })
        .eq('id', session1.id);
      expect(updateErr1).toBeNull();

      // Create and finalize session 2
      const { data: session2, error: err2 } = await supabaseAdmin.rpc(
        'start_live_session',
        { p_platform: 'Chaturbate' },
        { headers: { 'x-user-id': testUserId } }
      );
      expect(err2).toBeNull();
      expect(session2).toBeDefined();

      // Manually update session2 timestamps to create the overlap
      const { error: updateErr2 } = await supabaseAdmin
        .from('live_sessions')
        .update({
          started_at: new Date(session2StartMs).toISOString(),
          ended_at: new Date(session2EndMs).toISOString(),
          status: 'ended',
        })
        .eq('id', session2.id);
      expect(updateErr2).toBeNull();

      // Create a tip with event_at in the overlap window (40 minutes ago)
      // This timestamp falls within both session1 (60min-30min) and session2 (45min-15min)
      const ambiguousTipTime = new Date(baseTime.getTime() - 40 * 60 * 1000).toISOString();

      const { data: tipData, error: tipErr } = await supabaseAdmin.rpc(
        'persist_extension_tip',
        {
          p_user_id: testUserId,
          p_client_event_id: '77777777-7777-7777-7777-777777777777',
          p_deduplication_key: 'test-tip-ambiguous-1',
          p_username: 'tippera',
          p_tokens: 50,
          p_usd: 5.00,
          p_platform: 'chaturbate',
          p_event_at: ambiguousTipTime,
        }
      );
      expect(tipErr).toBeNull();
      expect(tipData.success).toBe(true);
      expect(tipData.live_session_id).toBeNull(); // Should NOT be assigned to either session

      // Verify exactly one canonical tip exists
      const { data: tips, error: tipsErr } = await supabaseAdmin
        .from('tips')
        .select('*')
        .eq('user_id', testUserId)
        .eq('deduplication_key', 'test-tip-ambiguous-1');
      expect(tipsErr).toBeNull();
      expect(tips.length).toBe(1);
      expect(tips[0].live_session_id).toBeNull();

      // Verify exactly one live_tip exists
      const { data: liveTips, error: liveTipsErr } = await supabaseAdmin
        .from('live_tips')
        .select('*')
        .eq('user_id', testUserId)
        .eq('deduplication_key', 'test-tip-ambiguous-1');
      expect(liveTipsErr).toBeNull();
      expect(liveTips.length).toBe(1);
      expect(liveTips[0].live_session_id).toBeNull();

      // Verify ambiguity was logged
      const { data: ambiguityLogs, error: logsErr } = await supabaseAdmin
        .from('unattributed_tips_log')
        .select('*')
        .eq('user_id', testUserId)
        .eq('deduplication_key', 'test-tip-ambiguous-1');
      expect(logsErr).toBeNull();
      expect(ambiguityLogs.length).toBeGreaterThan(0);
      const logEntry = ambiguityLogs.find(l => l.reason && l.reason.includes('multiple'));
      expect(logEntry).toBeDefined();

      // No duplicate/zero-USD sibling should exist
      const { data: siblings } = await supabaseAdmin
        .from('tips')
        .select('*')
        .eq('user_id', testUserId)
        .eq('deduplication_key', 'test-tip-ambiguous-1')
        .eq('usd', 0);
      expect(siblings.length).toBe(0);
    });

    it('should leave tip unattributed if no session matches event_at', async () => {
      // Event time from 1 hour ago, no matching sessions
      const oldTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { data: tipData, error: tipErr } = await supabaseAdmin.rpc(
        'persist_extension_tip',
        {
          p_user_id: testUserId,
          p_client_event_id: '55555555-5555-5555-5555-555555555555',
          p_deduplication_key: 'test-tip-orphan-1',
          p_username: 'tipper5',
          p_tokens: 25,
          p_usd: 2.50,
          p_platform: 'chaturbate',
          p_event_at: oldTime,
        }
      );
      expect(tipErr).toBeNull();
      expect(tipData).toBeDefined();

      expect(tipData.live_session_id).toBeNull();
    });
  });

  describe('metric calculations', () => {
    it('should calculate correct metrics for single-tipper session', async () => {
      const { data: session, error: sessionErr } = await supabaseAdmin.rpc(
        'start_live_session',
        { p_platform: 'Chaturbate' },
        { headers: { 'x-user-id': testUserId } }
      );
      expect(sessionErr).toBeNull();
      expect(session).toBeDefined();

      const { error: tipErr } = await supabaseAdmin.rpc(
        'persist_extension_tip',
        {
          p_user_id: testUserId,
          p_client_event_id: '66666666-6666-6666-6666-666666666666',
          p_deduplication_key: 'metric-tip-1',
          p_username: 'alice',
          p_tokens: 100,
          p_usd: 10.00,
          p_platform: 'chaturbate',
          p_event_at: new Date().toISOString(),
        }
      );
      expect(tipErr).toBeNull();

      const { data: finalized, error: finalErr } = await supabaseAdmin.rpc(
        'finalize_live_session',
        { p_session_id: session.id },
        { headers: { 'x-user-id': testUserId } }
      );
      expect(finalErr).toBeNull();
      expect(finalized).toBeDefined();

      expect(finalized.final_total_usd).toBe(10.00);
      expect(finalized.final_tokens).toBe(100);
      expect(finalized.final_tip_count).toBe(1);
      expect(finalized.final_unique_tippers).toBe(1);
      expect(finalized.final_top_tipper_username).toBe('alice');
      expect(finalized.final_top_tipper_usd).toBe(10.00);
      expect(finalized.final_largest_tip_usd).toBe(10.00);
      expect(finalized.final_avg_tip_usd).toBe(10.00);
    });

    it('should calculate correct metrics for multiple-tipper session', async () => {
      const { data: session, error: sessionErr } = await supabaseAdmin.rpc(
        'start_live_session',
        { p_platform: 'Chaturbate' },
        { headers: { 'x-user-id': testUserId } }
      );
      expect(sessionErr).toBeNull();
      expect(session).toBeDefined();

      // Tip 1: alice, $10
      const { error: tip1Err } = await supabaseAdmin.rpc(
        'persist_extension_tip',
        {
          p_user_id: testUserId,
          p_client_event_id: '77777777-7777-7777-7777-777777777777',
          p_deduplication_key: 'multi-tip-1',
          p_username: 'alice',
          p_tokens: 100,
          p_usd: 10.00,
          p_platform: 'chaturbate',
          p_event_at: new Date().toISOString(),
        }
      );
      expect(tip1Err).toBeNull();

      // Tip 2: bob, $15
      const { error: tip2Err } = await supabaseAdmin.rpc(
        'persist_extension_tip',
        {
          p_user_id: testUserId,
          p_client_event_id: '88888888-8888-8888-8888-888888888888',
          p_deduplication_key: 'multi-tip-2',
          p_username: 'bob',
          p_tokens: 150,
          p_usd: 15.00,
          p_platform: 'chaturbate',
          p_event_at: new Date().toISOString(),
        }
      );
      expect(tip2Err).toBeNull();

      // Tip 3: alice again, $5
      const { error: tip3Err } = await supabaseAdmin.rpc(
        'persist_extension_tip',
        {
          p_user_id: testUserId,
          p_client_event_id: '99999999-9999-9999-9999-999999999999',
          p_deduplication_key: 'multi-tip-3',
          p_username: 'alice',
          p_tokens: 50,
          p_usd: 5.00,
          p_platform: 'chaturbate',
          p_event_at: new Date().toISOString(),
        }
      );
      expect(tip3Err).toBeNull();

      const { data: finalized, error: finalErr } = await supabaseAdmin.rpc(
        'finalize_live_session',
        { p_session_id: session.id },
        { headers: { 'x-user-id': testUserId } }
      );
      expect(finalErr).toBeNull();
      expect(finalized).toBeDefined();

      expect(finalized.final_total_usd).toBe(30.00);
      expect(finalized.final_tokens).toBe(300);
      expect(finalized.final_tip_count).toBe(3);
      expect(finalized.final_unique_tippers).toBe(2); // alice, bob
      expect(finalized.final_top_tipper_username).toBe('alice'); // alice: $15 total > bob: $15... tie, alice first
      expect(finalized.final_largest_tip_usd).toBe(15.00);
      expect(finalized.final_avg_tip_usd).toBe(10.00); // $30 / 3
    });
  });

  afterAll(async () => {
    // Cleanup test data if needed
  });
});
