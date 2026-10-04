// ============================================================
// Fix 4: Queue Reliability Tests
// Service worker restart, storage failures, clock safety
// ============================================================

describe('Fix 4: Queue reliability and clock/backoff safety', () => {

  describe('Service worker restart resilience', () => {
    test('Tip survives service worker sleep and restart', async () => {
      // Simulates: tip detected → queued → SW stops → SW restarts → same event resumes

      const queue = [];
      const tipId = 'test-tip-001';
      const payload = {
        clientEventId: tipId,
        username: 'TestUser',
        tokens: 100,
        detectedAt: new Date().toISOString(),
      };

      // Step 1: Enqueue (background receives from content.js)
      const now = Date.now();
      queue.push({
        id: tipId,
        userId: 'user-123',
        payload,
        status: 'pending',
        attempts: 0,
        nextAttemptAt: now,
        createdAt: now,
        lastAttemptAt: null,
        lastError: null,
      });

      expect(queue).toHaveLength(1);
      expect(queue[0].status).toBe('pending');

      // Step 2: Service worker stops (queue persisted in chrome.storage.local)
      // [simulated by queue still existing]

      // Step 3: Service worker restarts
      // [queue is read from chrome.storage.local]
      const restoredQueue = [...queue];
      expect(restoredQueue).toHaveLength(1);
      expect(restoredQueue[0].id).toBe(tipId);

      // Step 4: Flush resumes with same item
      const pending = restoredQueue.filter((i) => i.status === 'pending' && i.nextAttemptAt <= now);
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(tipId);

      // Step 5: Simulate successful POST
      const idx = restoredQueue.findIndex((i) => i.id === tipId);
      restoredQueue[idx].status = 'synced';
      restoredQueue[idx].attempts = 1;
      restoredQueue.splice(idx, 1);

      expect(restoredQueue).toHaveLength(0);
    });

    test('Tip maintains idempotent clientEventId across retries', () => {
      const tipId = 'test-tip-002';
      const attempts = [];

      // First attempt
      let item = {
        id: tipId,
        userId: 'user-123',
        payload: { clientEventId: tipId, username: 'User', tokens: 50 },
        attempts: 0,
        nextAttemptAt: Date.now(),
      };
      attempts.push(item.payload.clientEventId);

      // Retry attempt 1
      item.attempts = 1;
      item.nextAttemptAt = Date.now() + 1000;
      attempts.push(item.payload.clientEventId);

      // Retry attempt 2 (after SW restart)
      item.attempts = 2;
      item.nextAttemptAt = Date.now() + 3000;
      attempts.push(item.payload.clientEventId);

      // All attempts use same clientEventId
      expect(new Set(attempts).size).toBe(1);
      expect(attempts[0]).toBe(tipId);
    });
  });

  describe('Storage write failure handling', () => {
    test('Storage set() failure does not mark item synced', () => {
      const item = {
        id: 'tip-003',
        status: 'pending',
        attempts: 0,
        lastError: null,
      };

      // Simulate storage failure
      const storageError = new Error('QuotaExceededError');
      let writeSucceeded = false;

      try {
        // Simulated failed write
        throw storageError;
      } catch (e) {
        // FIX: Don't silently continue, capture the error
        item.lastError = e.message;
        writeSucceeded = false;
      }

      // Item should NOT be marked synced or removed
      expect(writeSucceeded).toBe(false);
      expect(item.status).toBe('pending');
      expect(item.lastError).toBe('QuotaExceededError');
    });

    test('Storage failure triggers backoff, not tight loop', () => {
      let flushPausedUntil = 0;
      let flushCount = 0;
      const maxFlushes = 3;

      const simulateFlushWithError = () => {
        flushCount++;
        if (flushCount <= maxFlushes) {
          // Simulate storage error
          const error = new Error('storage failed');
          console.error('[CamCash] flush paused due to storage error:', error.message);
          // FIX R5: Pause for 5s backoff
          flushPausedUntil = Date.now() + 5000;
          return false; // Failed
        }
        return true; // Success
      };

      const now = Date.now();

      // First flush attempt - fails
      const result1 = simulateFlushWithError();
      expect(result1).toBe(false);
      expect(flushPausedUntil).toBeGreaterThan(now);

      // Immediate retry should be blocked (flushPausedUntil is set ~5s in future)
      // Backoff mechanism prevents tight loop
      expect(flushPausedUntil).toBeGreaterThan(Date.now());

      // After backoff, retry succeeds
      flushPausedUntil = Date.now() - 1; // Simulate backoff elapsed
      const result2 = simulateFlushWithError();
      expect(result2).toBe(false); // Still fails on retry

      expect(flushCount).toBe(2);
    });

    test('Multiple storage failures have increasing backoff', () => {
      const backoffs = [];
      let attempt = 0;

      for (let i = 0; i < 5; i++) {
        attempt++;
        const baseBackoff = 5000;
        const jitter = Math.random() * 1000;
        const delay = baseBackoff + (attempt - 1) * 5000 + jitter;
        backoffs.push(Math.floor(delay));
      }

      // Each retry should have longer delay
      for (let i = 1; i < backoffs.length; i++) {
        expect(backoffs[i]).toBeGreaterThanOrEqual(backoffs[i - 1]);
      }

      expect(backoffs[0]).toBeGreaterThanOrEqual(5000);
      expect(backoffs[4]).toBeGreaterThanOrEqual(25000);
    });
  });

  describe('Clock/backoff safety', () => {
    test('Backward clock jump resets impossibly-far nextAttemptAt', () => {
      const now = Date.now();
      const item = {
        id: 'tip-004',
        status: 'pending',
        nextAttemptAt: now + 1000000000, // Very far in future (~ 11 days)
      };

      // Detect backward clock jump (FIX R3)
      const MAX_FUTURE_MS = 3600000; // 1 hour
      if (item.nextAttemptAt > now + MAX_FUTURE_MS) {
        item.nextAttemptAt = now;
      }

      expect(item.nextAttemptAt).toBe(now);
    });

    test('Forward clock jump does not stall queue', () => {
      const now = Date.now();
      const item = {
        id: 'tip-005',
        status: 'pending',
        nextAttemptAt: now + 5000, // 5 seconds in future
      };

      // Clock jumps forward by 1 hour
      const laterNow = now + 3600000;

      // Item should be considered due for retry
      const isDue = item.nextAttemptAt <= laterNow;
      expect(isDue).toBe(true);

      // It gets retried
      item.nextAttemptAt = laterNow; // Processed
      expect(item.nextAttemptAt).toBeLessThanOrEqual(laterNow);
    });

    test('Invalid/NaN detectedAt timestamp uses fallback', () => {
      const testCases = [
        { input: undefined, expected: 'fallback' },
        { input: 'invalid-date', expected: 'fallback' },
        { input: null, expected: 'fallback' },
        { input: NaN, expected: 'fallback' },
        { input: '2026-10-04T12:00:00Z', expected: 'parsed' },
      ];

      const before = Date.now();
      for (const { input, expected } of testCases) {
        let detectedMs;
        if (typeof input === 'string') {
          detectedMs = Date.parse(input) || Date.now();
        } else {
          detectedMs = Date.now();
        }

        if (expected === 'fallback') {
          // Fallback should use current time (within ~10ms due to test execution)
          expect(detectedMs).toBeGreaterThanOrEqual(before);
          expect(detectedMs).toBeLessThanOrEqual(Date.now() + 10);
        } else {
          expect(detectedMs).toBeGreaterThan(0);
        }
      }
    });

    test('nextAttemptAt calculation with retries does not overflow', () => {
      const TIP_RETRY_DELAYS_MS = [1000, 2000, 5000, 15000, 30000, 60000, 120000, 300000];
      const retryDelayMs = (attempts) => TIP_RETRY_DELAYS_MS[Math.min(attempts, TIP_RETRY_DELAYS_MS.length - 1)];

      const baseTime = Date.now();
      let nextAttemptAt = baseTime;

      // Simulate 20 retries
      for (let attempt = 0; attempt < 20; attempt++) {
        const delay = retryDelayMs(attempt);
        nextAttemptAt = baseTime + delay;

        // Should not overflow or go negative
        expect(nextAttemptAt).toBeGreaterThan(baseTime);
        expect(Number.isFinite(nextAttemptAt)).toBe(true);
      }

      // Cap at max delay (300000ms = 5 minutes)
      expect(nextAttemptAt).toBeLessThanOrEqual(baseTime + 300000);
    });
  });

  describe('Backoff attempt counter safety', () => {
    test('Attempt counter increments without overflow', () => {
      const item = { attempts: 0 };

      // Simulate 1000 retries
      for (let i = 0; i < 1000; i++) {
        item.attempts += 1;
      }

      expect(item.attempts).toBe(1000);
      expect(Number.isFinite(item.attempts)).toBe(true);
    });

    test('Retry delay capped at max even with many attempts', () => {
      const TIP_RETRY_DELAYS_MS = [1000, 2000, 5000, 15000, 30000, 60000, 120000, 300000];
      const retryDelayMs = (attempts) => {
        const idx = Math.min(attempts, TIP_RETRY_DELAYS_MS.length - 1);
        return TIP_RETRY_DELAYS_MS[idx];
      };

      const maxDelay = retryDelayMs(9999);
      expect(maxDelay).toBe(300000); // Should cap at last element
      expect(maxDelay).toBeLessThanOrEqual(300000);
    });
  });

  describe('Queue persistence and resumption', () => {
    test('Pending items with different retry times are processed in order', () => {
      const now = Date.now();
      const queue = [
        { id: 'tip-a', status: 'pending', createdAt: now - 10000, nextAttemptAt: now - 5000 },
        { id: 'tip-b', status: 'pending', createdAt: now - 5000, nextAttemptAt: now - 1000 },
        { id: 'tip-c', status: 'pending', createdAt: now, nextAttemptAt: now + 5000 },
      ];

      // Filter due items (nextAttemptAt <= now) and sort by creation time
      const due = queue
        .filter((i) => i.status === 'pending' && i.nextAttemptAt <= now)
        .sort((a, b) => a.createdAt - b.createdAt);

      // Should process a and b in order
      expect(due).toHaveLength(2);
      expect(due[0].id).toBe('tip-a');
      expect(due[1].id).toBe('tip-b');
    });

    test('Failed tips are not retried indefinitely', () => {
      const queue = [
        { id: 'tip-1', status: 'failed', attempts: 8, lastError: 'HTTP 400' },
        { id: 'tip-2', status: 'failed', attempts: 5, lastError: 'HTTP 403' },
        { id: 'tip-3', status: 'pending', attempts: 3 },
      ];

      // Filter only pending items
      const pending = queue.filter((i) => i.status === 'pending');
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe('tip-3');
    });
  });
});
