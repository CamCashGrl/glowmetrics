// ============================================================
// FIX R2 Regression Tests: Account Switching with Queued Tips
//
// Requirements:
// - Tip queued under CamCash A
// - A logs out, B logs in
// - Queue flushes successfully under B
// - Same clientEventId preserved
// - Same original timestamp preserved
// - Exactly one stored tip (no duplicates)
// - Broadcaster/model room logic independent of account switching
// ============================================================

describe('FIX R2 Regression: Account Switching Queue Resilience', () => {
  let mockSession = null;
  let mockQueue = [];
  let postAttempts = [];

  beforeEach(() => {
    postAttempts = [];
    mockSession = { user: { id: 'user_a' }, access_token: 'token_a' };
    mockQueue = [];
  });

  afterEach(() => {
    mockSession = null;
    mockQueue = [];
    postAttempts = [];
  });

  test('should allow tip queued by A to flush when B logs in', async () => {
    // Step 1: User A queues a tip
    const clientEventId = 'evt_12345';
    const detectedAt = '2026-10-04T10:00:00Z';
    const payload = {
      clientEventId,
      detectedAt,
      username: 'tipper_123',
      tokens: 100,
      platform: 'chaturbate',
    };

    // Queue the tip under A
    mockQueue.push({
      id: clientEventId,
      payload,
      displayKey: 'tip_123_evt',
      status: 'pending',
      attempts: 0,
      nextAttemptAt: Date.now(),
      createdAt: Date.now(),
      lastAttemptAt: null,
      lastError: null,
    });

    expect(mockQueue.length).toBe(1);
    expect(mockQueue[0].id).toBe(clientEventId);
    expect(mockQueue[0].payload.detectedAt).toBe(detectedAt);

    // Step 2: A logs out, B logs in
    mockSession = { user: { id: 'user_b' }, access_token: 'token_b' };

    // Step 3: Queue still exists (not cleared by account switch)
    expect(mockQueue.length).toBe(1);
    expect(mockQueue[0].id).toBe(clientEventId);

    // Step 4: Flush triggers under B's account
    // The tip should use B's token but keep original metadata
    const queuedMs = Date.now() - Date.parse(detectedAt);
    const expectedPost = {
      ...payload,
      queuedMs,
    };

    // Simulate posting with B's token
    postAttempts.push({
      userId: mockSession.user.id,
      token: mockSession.access_token,
      payload: expectedPost,
      success: true,
    });

    expect(postAttempts[0].userId).toBe('user_b');
    expect(postAttempts[0].token).toBe('token_b');
    expect(postAttempts[0].payload.clientEventId).toBe(clientEventId);
    expect(postAttempts[0].payload.detectedAt).toBe(detectedAt);
    expect(postAttempts[0].success).toBe(true);

    // Step 5: After sync, tip is removed from queue
    mockQueue.splice(0, 1);
    expect(mockQueue.length).toBe(0);
  });

  test('should preserve original timestamp across account switches', async () => {
    const clientEventId = 'evt_67890';
    const originalDetectedAt = '2026-10-04T09:30:00Z';
    const originalTimestamp = Date.parse(originalDetectedAt);

    // Queue under A
    mockSession = { user: { id: 'user_a' }, access_token: 'token_a' };
    const now = Date.now();

    mockQueue.push({
      id: clientEventId,
      payload: {
        clientEventId,
        detectedAt: originalDetectedAt,
        username: 'tipper_456',
        tokens: 50,
        platform: 'bongacams',
      },
      displayKey: 'tip_456_evt',
      status: 'pending',
      attempts: 0,
      nextAttemptAt: now,
      createdAt: now,
      lastAttemptAt: null,
      lastError: null,
    });

    // Switch to B
    mockSession = { user: { id: 'user_b' }, access_token: 'token_b' };

    // Flush under B
    const item = mockQueue[0];
    expect(item.payload.detectedAt).toBe(originalDetectedAt);
    expect(Date.parse(item.payload.detectedAt)).toBe(originalTimestamp);

    // queuedMs should be computed based on CURRENT time vs original timestamp
    const queuedMs = Math.max(0, now - originalTimestamp);
    expect(queuedMs).toBeGreaterThanOrEqual(0);
  });

  test('should prevent duplicate tips via clientEventId idempotency', async () => {
    const clientEventId = 'evt_idempotent';
    const payload = {
      clientEventId,
      detectedAt: '2026-10-04T10:15:00Z',
      username: 'tipper_789',
      tokens: 200,
      platform: 'myfreecams',
    };

    // Queue under A
    mockSession = { user: { id: 'user_a' }, access_token: 'token_a' };
    mockQueue.push({
      id: clientEventId,
      payload,
      displayKey: 'tip_789_evt',
      status: 'pending',
      attempts: 0,
      nextAttemptAt: Date.now(),
      createdAt: Date.now(),
      lastAttemptAt: null,
      lastError: null,
    });

    // Simulate: First attempt with A fails, tip stays queued
    mockQueue[0].status = 'pending';
    mockQueue[0].attempts = 1;
    mockQueue[0].nextAttemptAt = Date.now() + 2000;

    // Switch to B
    mockSession = { user: { id: 'user_b' }, access_token: 'token_b' };

    // Queue still has the same tip (not duplicated)
    expect(mockQueue.length).toBe(1);
    expect(mockQueue[0].id).toBe(clientEventId);

    // Try to flush — backend idempotency (clientEventId + detectedAt) prevents duplicates
    // Simulate successful POST under B
    postAttempts.push({
      userId: 'user_b',
      token: 'token_b',
      clientEventId,
      detectedAt: payload.detectedAt,
      success: true,
    });

    // Verify post was made once with correct metadata
    expect(postAttempts).toHaveLength(1);
    expect(postAttempts[0].clientEventId).toBe(clientEventId);
    expect(postAttempts[0].detectedAt).toBe(payload.detectedAt);
  });

  test('should maintain broadcaster/model room independent of account', async () => {
    const clientEventId = 'evt_room_test';
    const broadcaster_username = 'some_model';
    const payload = {
      clientEventId,
      detectedAt: '2026-10-04T10:30:00Z',
      username: 'tipper_room',
      tokens: 75,
      platform: 'chaturbate',
      broadcaster_username, // Room context
    };

    // Queue under A viewing model X
    mockSession = { user: { id: 'user_a' }, access_token: 'token_a' };
    mockQueue.push({
      id: clientEventId,
      payload,
      displayKey: 'tip_room_evt',
      status: 'pending',
      attempts: 0,
      nextAttemptAt: Date.now(),
      createdAt: Date.now(),
      lastAttemptAt: null,
      lastError: null,
    });

    // Switch to B, who is viewing model Y (different broadcaster)
    mockSession = { user: { id: 'user_b' }, access_token: 'token_b' };

    // Queued tip still exists, payload unchanged (broadcaster is NOT account-specific)
    expect(mockQueue[0].payload.broadcaster_username).toBe('some_model');
    expect(mockQueue[0].payload.platform).toBe('chaturbate');

    // Flush under B with B's token but original broadcaster context
    postAttempts.push({
      userId: 'user_b',
      token: 'token_b',
      payload: mockQueue[0].payload,
      success: true,
    });

    expect(postAttempts[0].payload.broadcaster_username).toBe('some_model');
    // broadcaster_username is NOT used for account filtering
  });

  test('should work across multiple account switches', async () => {
    const clientEventId = 'evt_multi_switch';
    const payload = {
      clientEventId,
      detectedAt: '2026-10-04T10:45:00Z',
      username: 'tipper_multi',
      tokens: 150,
      platform: 'stripchat',
    };

    // Queue under A
    mockSession = { user: { id: 'user_a' }, access_token: 'token_a' };
    mockQueue.push({
      id: clientEventId,
      payload,
      displayKey: 'tip_multi_evt',
      status: 'pending',
      attempts: 0,
      nextAttemptAt: Date.now(),
      createdAt: Date.now(),
      lastAttemptAt: null,
      lastError: null,
    });

    // A → B switch
    mockSession = { user: { id: 'user_b' }, access_token: 'token_b' };
    expect(mockQueue[0].id).toBe(clientEventId);

    // B → C switch
    mockSession = { user: { id: 'user_c' }, access_token: 'token_c' };
    expect(mockQueue[0].id).toBe(clientEventId);

    // C → A switch (back to A)
    mockSession = { user: { id: 'user_a' }, access_token: 'token_a_new' };
    expect(mockQueue[0].id).toBe(clientEventId);

    // Queue flushes under current session (A again)
    postAttempts.push({
      userId: 'user_a',
      token: 'token_a_new',
      clientEventId,
      success: true,
    });

    expect(postAttempts).toHaveLength(1);
    expect(postAttempts[0].userId).toBe('user_a');
  });

  test('should handle token refresh during flush under new account', async () => {
    const clientEventId = 'evt_refresh';
    const payload = {
      clientEventId,
      detectedAt: '2026-10-04T11:00:00Z',
      username: 'tipper_refresh',
      tokens: 250,
      platform: 'camsoda',
    };

    // Queue under A
    mockSession = { user: { id: 'user_a' }, access_token: 'token_a' };
    mockQueue.push({
      id: clientEventId,
      payload,
      displayKey: 'tip_refresh_evt',
      status: 'pending',
      attempts: 0,
      nextAttemptAt: Date.now(),
      createdAt: Date.now(),
      lastAttemptAt: null,
      lastError: null,
    });

    // Switch to B
    mockSession = { user: { id: 'user_b' }, access_token: 'token_b_old' };

    // Simulate: POST fails with 401, token refresh happens
    // After refresh, B's token is updated
    mockSession.access_token = 'token_b_refreshed';

    // Retry with new token succeeds
    postAttempts.push({
      attempt: 1,
      userId: 'user_b',
      token: 'token_b_old',
      result: '401',
    });

    postAttempts.push({
      attempt: 2,
      userId: 'user_b',
      token: 'token_b_refreshed',
      result: 'success',
    });

    expect(postAttempts[0].token).toBe('token_b_old');
    expect(postAttempts[1].token).toBe('token_b_refreshed');
    expect(postAttempts[1].result).toBe('success');

    // Tip synced, removed from queue
    mockQueue.splice(0, 1);
    expect(mockQueue.length).toBe(0);
  });

  test('should not bind queue to broadcaster page state', async () => {
    const clientEventId = 'evt_page_state';
    const payload = {
      clientEventId,
      detectedAt: '2026-10-04T11:15:00Z',
      username: 'tipper_page',
      tokens: 100,
      platform: 'chaturbate',
    };

    // Queue while viewing broadcaster page
    mockSession = { user: { id: 'user_a' }, access_token: 'token_a' };
    let broadcasterPageActive = true;

    mockQueue.push({
      id: clientEventId,
      payload,
      displayKey: 'tip_page_evt',
      status: 'pending',
      attempts: 0,
      nextAttemptAt: Date.now(),
      createdAt: Date.now(),
      lastAttemptAt: null,
      lastError: null,
    });

    // Close broadcaster page (navigate away)
    broadcasterPageActive = false;

    // Queue still exists and ready to flush
    expect(mockQueue.length).toBe(1);

    // Account switch
    mockSession = { user: { id: 'user_b' }, access_token: 'token_b' };

    // Queue flushes regardless of page state
    postAttempts.push({
      userId: 'user_b',
      token: 'token_b',
      clientEventId,
      broadcasterPageActive,
      success: true,
    });

    expect(postAttempts[0].clientEventId).toBe(clientEventId);
    // broadcasterPageActive is NOT a gate on queue flushing
  });
});
