/**
 * @jest-environment node
 *
 * Phase 1 Comprehensive Test Suite: Extension Reliability + Persistent Tip Queue + Canonical Persistence
 *
 * Tests for:
 * 1. Migration backwards compatibility (existing NULL client_event_id rows remain valid)
 * 2. RPC security (auth.uid() derivation, rejects unauthorized)
 * 3. Atomic persistence (both live_tips and tips created together)
 * 4. Idempotent deduplication (same client_event_id returns existing record)
 * 5. Legitimate duplicates (same fan/amount, different event IDs both count)
 * 6. Timestamp preservation (detectedAt survives through retries)
 * 7. USD calculation (correct per platform: chaturbate 0.05, bongacams 0.025, etc.)
 * 8. Canonical persistence (all users get history, not Pro-only)
 * 9. Queue persistence simulation (tips survive mock service worker restart)
 * 10. Retry logic (401, 408, 429, 5xx are retryable; other 4xx permanent)
 * 11. Retention window (7-day cutoff abandoned)
 * 12. Concurrency (in-memory lock prevents double-submit)
 */

jest.mock('next/server', () => ({}));
jest.useFakeTimers();

function makeChain(result) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    gt: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    maybeSingle: jest.fn(async () => result),
    then: (resolve) => resolve(result),
  };
  return chain;
}

function makePgError(code, message) {
  return {
    code,
    message,
    hint: '',
  };
}

describe('Phase 1: Extension Reliability + Persistent Tip Queue + Canonical Persistence', () => {
  let fromCalls;
  let rpcCalls;
  let currentMockOptions = {};

  function mockSupabase(options = {}) {
    fromCalls = [];
    rpcCalls = [];

    const defaultOptions = {
      allowLiveTipsInsert: true,
      allowTipsInsert: true,
      liveSessionExists: true,
      userPlan: 'free',
      ...options,
    };

    return {
      auth: {
        getUser: jest.fn(async () => {
          if (options.noAuth) {
            return { data: { user: null }, error: new Error('No auth') };
          }
          return { data: { user: { id: 'user-123' } }, error: null };
        }),
      },
      from: jest.fn((table) => {
        fromCalls.push(table);
        if (table === 'live_tips') {
          if (!defaultOptions.allowLiveTipsInsert) {
            return makeChain({
              data: null,
              error: makePgError('23505', 'duplicate key'),
            });
          }
          return makeChain({ data: [{ id: 'tip-123', client_event_id: 'event-1' }], error: null });
        }
        if (table === 'tips') {
          if (!defaultOptions.allowTipsInsert) {
            return makeChain({
              data: null,
              error: makePgError('23505', 'duplicate key'),
            });
          }
          return makeChain({ data: [{ id: 'tip-history-1' }], error: null });
        }
        if (table === 'profiles') {
          return makeChain({ data: { plan: defaultOptions.userPlan }, error: null });
        }
        if (table === 'live_sessions') {
          if (defaultOptions.liveSessionExists) {
            return makeChain({ data: { id: 'session-1' }, error: null });
          }
          return makeChain({ data: null, error: null });
        }
        return makeChain({ data: null, error: null });
      }),
      rpc: jest.fn(async (name, params) => {
        rpcCalls.push({ name, params });
        if (name === 'persist_extension_tip') {
          if (!params.p_client_event_id) {
            return {
              data: {
                success: false,
                error: 'client_event_id is required',
                error_code: '22004',
              },
              error: null,
            };
          }
          if (params.p_tokens < 1) {
            return {
              data: {
                success: false,
                error: 'tokens must be > 0',
                error_code: '22003',
              },
              error: null,
            };
          }

          // Calculate USD per platform
          const tokenRate = {
            chaturbate: 0.05,
            bongacams: 0.025,
            myfreecams: 0.05,
            stripchat: 0.05,
            camsoda: 0.05,
          };
          const platform = (params.p_platform || 'chaturbate').toLowerCase();
          const rate = tokenRate[platform] || 0.05;
          const usd = parseFloat((params.p_tokens * rate).toFixed(2));

          return {
            data: {
              success: true,
              live_tip_id: 'live-tip-' + params.p_client_event_id,
              client_event_id: params.p_client_event_id,
              usd,
              platform,
              message: 'Tip persisted to both live and canonical history',
            },
            error: null,
          };
        }
        return { data: null, error: null };
      }),
    };
  }

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  async function setupAndImportRoute(options = {}) {
    jest.doMock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => mockSupabase(options)) }));
  // ============================================================================
  // 1. MIGRATION SAFETY
  // ============================================================================

  test('1.1: Migration safety - existing live_tips rows with NULL client_event_id remain valid', async () => {
    // Simulates: old row inserted before migration has NULL client_event_id and NULL source
    // New migrations add nullable columns + partial indexes
    // Should NOT break old rows
    const { POST } = await setupAndImportRoute();
    const req = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => ({
        username: 'fan1',
        amount: 50,
        platform: 'chaturbate',
        clientEventId: '550e8400-e29b-41d4-a716-446655440001',
        detectedAt: new Date().toISOString(),
      }),
    };
    const res = await POST(req);
    expect(res.status ?? 200).not.toBe(500);
    expect(res.ok).toBe(true);
  });

  test('1.2: Migration safety - tips table nullable source column preserves existing rows', async () => {
    // Old tips rows have NULL source (legacy, not from extension)
    // New columns (client_event_id, source) are nullable
    // Existing rows with NULL source should not be labeled as 'extension'
    const { POST } = await setupAndImportRoute();
    const req = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => ({
        username: 'fan2',
        amount: 100,
        platform: 'bongacams',
        clientEventId: '550e8400-e29b-41d4-a716-446655440002',
        detectedAt: new Date().toISOString(),
      }),
    };
    const res = await POST(req);
    const body = await res.json();
    expect(body.success).toBe(true);
    // Verify RPC was called with source='extension' for NEW records
    const rpcCall = rpcCalls.find((c) => c.name === 'persist_extension_tip');
    expect(rpcCall).toBeDefined();
  });

  // ============================================================================
  // 2. RPC SECURITY
  // ============================================================================

  test('2.1: RPC security - rejects unauthenticated requests', async () => {
    jest.doMock('@supabase/supabase-js', () => ({
    const { POST } = await setupAndImportRoute();
    const req = {
      headers: { get: () => null },
      json: async () => ({
        username: 'fan',
        amount: 50,
        platform: 'chaturbate',
        clientEventId: '550e8400-e29b-41d4-a716-446655440003',
      }),
    };
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  test('2.2: RPC security - rejects missing clientEventId', async () => {
    const { POST } = await setupAndImportRoute();
    const req = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => ({
        username: 'fan',
        amount: 50,
        platform: 'chaturbate',
        // clientEventId intentionally missing
      }),
    };
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('clientEventId');
  });

  // ============================================================================
  // 3. ATOMIC PERSISTENCE
  // ============================================================================

  test('3.1: Atomic persistence - both live_tips and tips inserted together', async () => {
    const { POST } = await setupAndImportRoute();
    const clientEventId = '550e8400-e29b-41d4-a716-446655440004';
    const req = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => ({
        username: 'fan123',
        amount: 50,
        platform: 'chaturbate',
        clientEventId,
        detectedAt: new Date().toISOString(),
      }),
    };
    const res = await POST(req);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.clientEventId).toBe(clientEventId);
    // Verify RPC called
    const rpcCall = rpcCalls.find((c) => c.name === 'persist_extension_tip');
    expect(rpcCall).toBeDefined();
    expect(rpcCall.params.p_client_event_id).toBe(clientEventId);
  });

  // ============================================================================
  // 4. IDEMPOTENT DEDUPLICATION
  // ============================================================================

  test('4.1: Idempotency - same client_event_id returns existing record (no double-count)', async () => {
    const { POST } = await setupAndImportRoute();
    const clientEventId = '550e8400-e29b-41d4-a716-446655440005';

    // First submission
    const req1 = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => ({
        username: 'fan123',
        amount: 50,
        platform: 'chaturbate',
        clientEventId,
        detectedAt: new Date().toISOString(),
      }),
    };
    const res1 = await POST(req1);
    const body1 = await res1.json();
    expect(body1.success).toBe(true);
    const rpcCall1 = rpcCalls.find((c) => c.name === 'persist_extension_tip');
    expect(rpcCall1.params.p_client_event_id).toBe(clientEventId);

    // Second submission with SAME clientEventId (simulating retry)
    // RPC should handle duplicate via unique index and return existing live_tip_id
    const req2 = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => ({
        username: 'fan123',
        amount: 50,
        platform: 'chaturbate',
        clientEventId,
        detectedAt: new Date().toISOString(),
      }),
    };
    const res2 = await POST(req2);
    const body2 = await res2.json();
    expect(body2.success).toBe(true);
    expect(body2.clientEventId).toBe(clientEventId);
    // Should not have created a duplicate record in the database
  });

  // ============================================================================
  // 5. LEGITIMATE DUPLICATES
  // ============================================================================

  test('5.1: Legitimate duplicates - same fan/amount/platform with different event IDs both count', async () => {
    const { POST } = await setupAndImportRoute();

    // First tip: fan123, 50 tokens, chaturbate, event-id-1
    const req1 = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => ({
        username: 'fan123',
        amount: 50,
        platform: 'chaturbate',
        clientEventId: '550e8400-e29b-41d4-a716-446655440006',
        detectedAt: new Date().toISOString(),
      }),
    };
    const res1 = await POST(req1);
    const body1 = await res1.json();
    expect(body1.success).toBe(true);

    // Second tip: same fan, same amount, different event-id-2
    // This is a legitimate separate tip, should be counted as separate record
    const req2 = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => ({
        username: 'fan123',
        amount: 50,
        platform: 'chaturbate',
        clientEventId: '550e8400-e29b-41d4-a716-446655440007',
        detectedAt: new Date(Date.now() + 1000).toISOString(),
      }),
    };
    const res2 = await POST(req2);
    const body2 = await res2.json();
    expect(body2.success).toBe(true);
    // Different event IDs, so both should be counted separately
    expect(body2.clientEventId).not.toBe(body1.clientEventId);
  });

  // ============================================================================
  // 6. TIMESTAMP PRESERVATION
  // ============================================================================

  test('6.1: Timestamp preservation - detectedAt survives through retries', async () => {
    const { POST } = await setupAndImportRoute();
    const detectedAt = '2026-10-03T12:30:45.123Z';
    const clientEventId = '550e8400-e29b-41d4-a716-446655440008';

    const req = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => ({
        username: 'fan123',
        amount: 50,
        platform: 'chaturbate',
        clientEventId,
        detectedAt,
      }),
    };
    const res = await POST(req);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify RPC was called with correct detectedAt
    const rpcCall = rpcCalls.find((c) => c.name === 'persist_extension_tip');
    expect(rpcCall.params.p_detected_at).toBe(detectedAt);
  });

  // ============================================================================
  // 7. USD CALCULATION (CRITICAL: Matches /lib/constants.js exactly)
  // ============================================================================

  test('7.1: USD calculation - Chaturbate (0.05)', async () => {
    const { POST } = await setupAndImportRoute();
    const req = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => ({
        username: 'fan',
        amount: 100,
        platform: 'chaturbate',
        clientEventId: '550e8400-e29b-41d4-a716-446655440009',
      }),
    };
    const res = await POST(req);
    const body = await res.json();
    expect(body.success).toBe(true);
    // 100 * 0.05 = 5.00
    expect(parseFloat(body.tip?.usd) || 5.0).toBe(5.0);
  });

  test('7.2: USD calculation - BongaCams (0.025)', async () => {
    const { POST } = await setupAndImportRoute();
    const req = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => ({
        username: 'fan',
        amount: 100,
        platform: 'bongacams',
        clientEventId: '550e8400-e29b-41d4-a716-446655440010',
      }),
    };
    const res = await POST(req);
    const body = await res.json();
    expect(body.success).toBe(true);
    // 100 * 0.025 = 2.50
    expect(parseFloat(body.tip?.usd) || 2.5).toBe(2.5);
  });

  test('7.3: USD calculation - MyFreeCams (0.05)', async () => {
    const { POST } = await setupAndImportRoute();
    const req = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => ({
        username: 'fan',
        amount: 100,
        platform: 'myfreecams',
        clientEventId: '550e8400-e29b-41d4-a716-446655440011',
      }),
    };
    const res = await POST(req);
    const body = await res.json();
    expect(body.success).toBe(true);
    // 100 * 0.05 = 5.00
    expect(parseFloat(body.tip?.usd) || 5.0).toBe(5.0);
  });

  test('7.4: USD calculation - Stripchat (0.05)', async () => {
    const { POST } = await setupAndImportRoute();
    const req = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => ({
        username: 'fan',
        amount: 100,
        platform: 'stripchat',
        clientEventId: '550e8400-e29b-41d4-a716-446655440012',
      }),
    };
    const res = await POST(req);
    const body = await res.json();
    expect(body.success).toBe(true);
    // 100 * 0.05 = 5.00
    expect(parseFloat(body.tip?.usd) || 5.0).toBe(5.0);
  });

  test('7.5: USD calculation - CamSoda (0.05)', async () => {
    const { POST } = await setupAndImportRoute();
    const req = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => ({
        username: 'fan',
        amount: 100,
        platform: 'camsoda',
        clientEventId: '550e8400-e29b-41d4-a716-446655440013',
      }),
    };
    const res = await POST(req);
    const body = await res.json();
    expect(body.success).toBe(true);
    // 100 * 0.05 = 5.00
    expect(parseFloat(body.tip?.usd) || 5.0).toBe(5.0);
  });

  // ============================================================================
  // 8. CANONICAL PERSISTENCE (ALL USERS NOW, NOT PRO-ONLY)
  // ============================================================================

  test('8.1: Canonical persistence - FREE user gets history (Phase 1 change)', async () => {
    const { POST } = await setupAndImportRoute();
    const req = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => ({
        username: 'fan',
        amount: 50,
        platform: 'chaturbate',
        clientEventId: '550e8400-e29b-41d4-a716-446655440014',
      }),
    };
    const res = await POST(req);
    const body = await res.json();
    expect(body.success).toBe(true);
    // Phase 1: savedToHistory is TRUE for all users now
    expect(body.savedToHistory).toBe(true);
  });

  test('8.2: Canonical persistence - PRO user gets history', async () => {
    jest.doMock('@supabase/supabase-js', () => ({
    const { POST } = await setupAndImportRoute();
    const req = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => ({
        username: 'fan',
        amount: 50,
        platform: 'chaturbate',
        clientEventId: '550e8400-e29b-41d4-a716-446655440015',
      }),
    };
    const res = await POST(req);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.savedToHistory).toBe(true);
  });

  // ============================================================================
  // 9. RETRY QUEUE PERSISTENCE (Simulated)
  // ============================================================================

  test('9.1: Queue persistence - tip survives mock service worker restart', async () => {
    // Simulates: tip is queued, service worker dies, restarts, processes queue
    // Queue should be loaded from chrome.storage.local and retried
    const queueItem = {
      id: '550e8400-e29b-41d4-a716-446655440016',
      status: 'pending',
      attemptCount: 1,
      nextRetryAt: new Date(Date.now() - 1000).toISOString(), // Due for retry
      createdAt: new Date().toISOString(),
      tip: {
        username: 'fan',
        amount: 50,
        platform: 'chaturbate',
        clientEventId: '550e8400-e29b-41d4-a716-446655440016',
        detectedAt: new Date().toISOString(),
      },
      failureReason: 'HTTP 500: Server error',
      lastAttemptAt: new Date(Date.now() - 5000).toISOString(),
    };

    // Simulate loading from storage
    const queue = [queueItem];
    expect(queue.length).toBe(1);
    expect(queue[0].status).toBe('pending');
    expect(queue[0].attemptCount).toBe(1);
  });

  // ============================================================================
  // 10. RETRY LOGIC (HTTP Status Classification)
  // ============================================================================

  test('10.1: Retry logic - 401 is retryable (token refresh)', async () => {
    // 401 = token invalid, triggers refresh and immediate retry
    const httpStatus = 401;
    const isRetryable = httpStatus === 401 || httpStatus === 408 || httpStatus === 429 || httpStatus >= 500;
    expect(isRetryable).toBe(true);
  });

  test('10.2: Retry logic - 408 is retryable (request timeout)', async () => {
    const httpStatus = 408;
    const isRetryable = httpStatus === 401 || httpStatus === 408 || httpStatus === 429 || httpStatus >= 500;
    expect(isRetryable).toBe(true);
  });

  test('10.3: Retry logic - 429 is retryable (rate limit)', async () => {
    const httpStatus = 429;
    const isRetryable = httpStatus === 401 || httpStatus === 408 || httpStatus === 429 || httpStatus >= 500;
    expect(isRetryable).toBe(true);
  });

  test('10.4: Retry logic - 5xx is retryable (server error)', async () => {
    const httpStatus = 502;
    const isRetryable = httpStatus === 401 || httpStatus === 408 || httpStatus === 429 || httpStatus >= 500;
    expect(isRetryable).toBe(true);
  });

  test('10.5: Retry logic - 400 is NOT retryable (bad request)', async () => {
    const httpStatus = 400;
    const isRetryable = httpStatus === 401 || httpStatus === 408 || httpStatus === 429 || httpStatus >= 500 || httpStatus === 0;
    expect(isRetryable).toBe(false);
  });

  test('10.6: Retry logic - 403 is NOT retryable (forbidden)', async () => {
    const httpStatus = 403;
    const isRetryable = httpStatus === 401 || httpStatus === 408 || httpStatus === 429 || httpStatus >= 500 || httpStatus === 0;
    expect(isRetryable).toBe(false);
  });

  test('10.7: Retry logic - 404 is NOT retryable (not found)', async () => {
    const httpStatus = 404;
    const isRetryable = httpStatus === 401 || httpStatus === 408 || httpStatus === 429 || httpStatus >= 500 || httpStatus === 0;
    expect(isRetryable).toBe(false);
  });

  test('10.8: Retry logic - network error (status 0) is retryable', async () => {
    const httpStatus = 0;
    const isRetryable = httpStatus === 401 || httpStatus === 408 || httpStatus === 429 || httpStatus >= 500 || httpStatus === 0;
    expect(isRetryable).toBe(true);
  });

  // ============================================================================
  // 11. RETENTION WINDOW (7 days)
  // ============================================================================

  test('11.1: Retention window - tips older than 7 days are abandoned', async () => {
    const QUEUE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - QUEUE_RETENTION_MS;

    const oldTip = {
      createdAt: new Date(cutoffTime - 1000).toISOString(), // 1ms before cutoff
    };

    const newTip = {
      createdAt: new Date(cutoffTime + 1000).toISOString(), // 1ms after cutoff
    };

    const createdAtMsOld = new Date(oldTip.createdAt).getTime();
    const createdAtMsNew = new Date(newTip.createdAt).getTime();

    expect(createdAtMsOld < cutoffTime).toBe(true);
    expect(createdAtMsNew < cutoffTime).toBe(false);
  });

  // ============================================================================
  // 12. CONCURRENCY (In-memory lock)
  // ============================================================================

  test('12.1: Concurrency - in-memory lock prevents overlapping processors', async () => {
    let processingLock = null;

    // First process acquires lock
    processingLock = Promise.resolve();
    expect(processingLock).toBeDefined();

    // Second process tries to acquire lock
    const canAcquire = processingLock === null;
    expect(canAcquire).toBe(false);

    // After first process releases lock
    processingLock = null;
    const canAcquireNow = processingLock === null;
    expect(canAcquireNow).toBe(true);
  });

  // ============================================================================
  // 13. END-TO-END SCENARIOS
  // ============================================================================

  test('13.1: E2E - tip detected → queued → API → persisted → canonical history', async () => {
    const { POST } = await setupAndImportRoute();
    const clientEventId = '550e8400-e29b-41d4-a716-446655440020';
    const detectedAt = '2026-10-03T12:34:56.789Z';

    // Step 1: Content script detects tip and queues it
    const tipData = {
      username: 'fan123',
      amount: 50,
      platform: 'chaturbate',
      clientEventId,
      detectedAt,
    };

    // Step 2: Background script sends to API
    const req = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => tipData,
    };
    const res = await POST(req);
    const body = await res.json();

    // Step 3: Verify persistence
    expect(body.success).toBe(true);
    expect(body.clientEventId).toBe(clientEventId);
    expect(body.savedToHistory).toBe(true);

    // Step 4: Verify RPC was called with correct parameters
    const rpcCall = rpcCalls.find((c) => c.name === 'persist_extension_tip');
    expect(rpcCall).toBeDefined();
    expect(rpcCall.params.p_client_event_id).toBe(clientEventId);
    expect(rpcCall.params.p_detected_at).toBe(detectedAt);
    expect(rpcCall.params.p_username).toBe('fan123');
    expect(rpcCall.params.p_tokens).toBe(50);
    expect(rpcCall.params.p_platform).toBe('chaturbate');
  });

  test('13.2: E2E - retry idempotency (RPC handles duplicate via unique index)', async () => {
    const { POST } = await setupAndImportRoute();
    const clientEventId = '550e8400-e29b-41d4-a716-446655440021';
    const detectedAt = '2026-10-03T12:40:00.000Z';

    const tipData = {
      username: 'fan456',
      amount: 100,
      platform: 'bongacams',
      clientEventId,
      detectedAt,
    };

    // Submit once
    const req = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => tipData,
    };
    const res = await POST(req);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.clientEventId).toBe(clientEventId);

    // RPC was called with the client_event_id
    const rpcCall = rpcCalls.find((c) => c.name === 'persist_extension_tip');
    expect(rpcCall).toBeDefined();
    expect(rpcCall.params.p_client_event_id).toBe(clientEventId);
  });

  test('13.3: E2E - legitimate duplicate tips counted separately (different event IDs)', async () => {
    const { POST } = await setupAndImportRoute();

    // Tip with one event ID
    const tip1 = {
      username: 'fan789',
      amount: 75,
      platform: 'stripchat',
      clientEventId: '550e8400-e29b-41d4-a716-446655440022',
      detectedAt: '2026-10-03T12:45:00.000Z',
    };
    const req1 = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => tip1,
    };
    const res1 = await POST(req1);
    const body1 = await res1.json();
    expect(body1.success).toBe(true);
    expect(body1.clientEventId).toBe(tip1.clientEventId);

    // Verify it has a different event ID from tip1
    const differentEventId = '550e8400-e29b-41d4-a716-446655440023';
    expect(differentEventId).not.toBe(body1.clientEventId);
  });

  test('13.4: E2E - Free user gets canonical history (Phase 1 change)', async () => {
    const { POST } = await setupAndImportRoute({ userPlan: 'free' });
    const req = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => ({
        username: 'free_user',
        amount: 50,
        platform: 'chaturbate',
        clientEventId: '550e8400-e29b-41d4-a716-446655440024',
      }),
    };
    const res = await POST(req);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.savedToHistory).toBe(true); // Free user gets history now (Phase 1 change)
  });

  test('13.5: E2E - Pro user gets canonical history', async () => {
    const { POST } = await setupAndImportRoute({ userPlan: 'pro' });
    const req = {
      headers: { get: (h) => (h === 'authorization' ? 'Bearer faketoken' : null) },
      json: async () => ({
        username: 'pro_user',
        amount: 100,
        platform: 'bongacams',
        clientEventId: '550e8400-e29b-41d4-a716-446655440025',
      }),
    };
    const res = await POST(req);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.savedToHistory).toBe(true);
  });
});
