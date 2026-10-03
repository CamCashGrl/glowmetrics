/**
 * Chrome Extension Service Worker for CamCash Live Mode - Phase 1
 *
 * Manages persistent tip queue with bounded exponential backoff retry logic.
 * Tips are deduplicated by client_event_id for idempotent deduplication.
 *
 * Queue structure (chrome.storage.local):
 * {
 *   camcash_tip_queue_v1: [
 *     {
 *       id: UUID (client_event_id),
 *       status: 'pending'|'syncing'|'synced'|'failed',
 *       attemptCount: number,
 *       nextRetryAt: ISO timestamp,
 *       createdAt: ISO timestamp,
 *       tip: { username, amount, platform, timestamp, clientEventId, detectedAt },
 *       failureReason: string,
 *       lastAttemptAt: ISO timestamp
 *     }
 *   ]
 * }
 */

// In-memory lock to prevent concurrent processors from submitting same tip twice
let processingLock = null;

// Retry backoff schedule in milliseconds: 1s, 2s, 5s, 15s, 30s, 1m, 2m, 5m, 10m, 15m, 30m (capped)
const RETRY_SCHEDULE_MS = [1000, 2000, 5000, 15000, 30000, 60000, 120000, 300000, 600000, 900000, 1800000];
const QUEUE_STORAGE_KEY = 'camcash_tip_queue_v1';
const QUEUE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ALARM_NAME = 'camcash_process_queue';
const ALARM_PERIOD_MINUTES = 0.5; // 30 seconds (Chrome API minimum is 0.5)

/**
 * Get auth token from storage (set by popup/dashboard)
 */
async function getAuthToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get('camcash_auth_token', (result) => {
      resolve(result.camcash_auth_token);
    });
  });
}

/**
 * Save queue to chrome.storage.local
 */
async function saveQueue(queue) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [QUEUE_STORAGE_KEY]: queue }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Load queue from chrome.storage.local
 */
async function loadQueue() {
  return new Promise((resolve) => {
    chrome.storage.local.get(QUEUE_STORAGE_KEY, (result) => {
      resolve(result[QUEUE_STORAGE_KEY] || []);
    });
  });
}

/**
 * Calculate next retry time based on attempt count
 */
function getNextRetryTime(attemptCount) {
  const delayMs = RETRY_SCHEDULE_MS[Math.min(attemptCount, RETRY_SCHEDULE_MS.length - 1)];
  const nextRetryAt = new Date(Date.now() + delayMs);
  return nextRetryAt.toISOString();
}

/**
 * Clean old items from queue (older than 7 days)
 */
function cleanOldQueue(queue) {
  const cutoffTime = Date.now() - QUEUE_RETENTION_MS;
  return queue.filter((item) => {
    const createdAtMs = new Date(item.createdAt).getTime();
    if (createdAtMs < cutoffTime) {
      console.log(`[CamCash Queue] Removing tip (${item.id}) - exceeds 7-day retention`);
      return false;
    }
    return true;
  });
}

/**
 * Submit tip to API endpoint
 */
async function submitTipToAPI(authToken, tipData) {
  const apiUrl = 'https://www.camcashgrl.com/api/live/tips';

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(tipData),
    });

    return {
      status: response.status,
      ok: response.ok,
      body: response.ok ? await response.json() : null,
      error: !response.ok ? await response.text() : null,
    };
  } catch (err) {
    // Network error (timeout, connection refused, etc.)
    console.warn('[CamCash API] Network error:', err.message);
    return {
      status: 0,
      ok: false,
      error: err.message,
      isNetworkError: true,
    };
  }
}

/**
 * Determine if HTTP status is retryable
 */
function isRetryableStatus(status) {
  if (status === 0) return true; // Network error
  if (status === 401) return true; // Token refresh needed (will retry immediately after refresh)
  if (status === 408) return true; // Request timeout
  if (status === 429) return true; // Rate limit
  if (status >= 500) return true; // Server error
  return false;
}

/**
 * Process a single tip from queue
 */
async function processTip(item, authToken) {
  // Check if retry is due
  if (item.nextRetryAt) {
    const nextRetryMs = new Date(item.nextRetryAt).getTime();
    if (nextRetryMs > Date.now()) {
      // Not yet time to retry
      return null;
    }
  }

  // Mark as syncing and submit
  item.status = 'syncing';
  item.lastAttemptAt = new Date().toISOString();

  const tipData = {
    username: item.tip.username,
    amount: item.tip.amount,
    platform: item.tip.platform,
    timestamp: item.tip.timestamp,
    clientEventId: item.tip.clientEventId, // Phase 1: immutable event ID
    detectedAt: item.tip.detectedAt, // Phase 1: preserve original timestamp
  };

  const result = await submitTipToAPI(authToken, tipData);

  if (result.ok && result.body?.success) {
    // Success
    item.status = 'synced';
    return item;
  }

  // Handle errors
  if (result.status === 401) {
    // Token invalid — in a real extension, trigger token refresh here
    console.warn('[CamCash] Token invalid, should refresh');
    item.failureReason = 'Token invalid';
    item.attemptCount += 1;
    item.nextRetryAt = getNextRetryTime(item.attemptCount);
    item.status = 'pending';
    return item;
  }

  if (isRetryableStatus(result.status)) {
    // Retryable error
    item.failureReason = `HTTP ${result.status || 'Network error'}: ${result.error || 'Failed to submit'}`;
    item.attemptCount += 1;
    item.nextRetryAt = getNextRetryTime(item.attemptCount);
    item.status = 'pending';
    return item;
  }

  // Permanent failure (4xx errors other than 401/408/429)
  item.status = 'failed';
  item.failureReason = `Permanent failure: HTTP ${result.status} - ${result.error || 'Unknown error'}`;
  console.warn(`[CamCash Queue] Permanent failure for tip ${item.id}:`, item.failureReason);
  return item;
}

/**
 * Process all tips in queue that are due for retry
 */
async function processQueue() {
  // Acquire lock to prevent concurrent processors
  if (processingLock) {
    console.log('[CamCash Queue] Already processing, skipping this cycle');
    return;
  }

  processingLock = Promise.resolve(); // Placeholder lock

  try {
    const authToken = await getAuthToken();
    if (!authToken) {
      console.warn('[CamCash Queue] No auth token, cannot process tips');
      return;
    }

    let queue = await loadQueue();
    queue = cleanOldQueue(queue);

    // Find items due for retry (status 'pending' with nextRetryAt in past)
    const itemsToProcess = queue.filter((item) => {
      if (item.status === 'synced' || item.status === 'failed') return false;
      if (item.status === 'syncing') return false; // Skip if still syncing
      if (item.status === 'pending') {
        if (item.nextRetryAt) {
          const nextRetryMs = new Date(item.nextRetryAt).getTime();
          return nextRetryMs <= Date.now();
        }
        return true; // No nextRetryAt, should retry immediately
      }
      return false;
    });

    console.log(`[CamCash Queue] Processing ${itemsToProcess.length} items out of ${queue.length} total`);

    // Process items sequentially to avoid overwhelming the API
    for (const item of itemsToProcess) {
      const result = await processTip(item, authToken);
      if (result) {
        // Update the item in the queue
        const idx = queue.findIndex((q) => q.id === result.id);
        if (idx >= 0) {
          queue[idx] = result;
        }
      }
    }

    // Save updated queue
    await saveQueue(queue);

    // Check if there are pending items and reschedule alarm if needed
    const hasPending = queue.some((item) => item.status === 'pending' || item.status === 'syncing');
    if (hasPending) {
      chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
    }
  } finally {
    processingLock = null;
  }
}

/**
 * Handle incoming message from content script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'QUEUE_TIP') {
    queueTip(message.tip).then(() => {
      sendResponse({ success: true, message: 'Tip queued' });
    }).catch((err) => {
      sendResponse({ success: false, error: err.message });
    });
    return true; // Indicate async response
  }
});

/**
 * Queue a tip for processing
 */
async function queueTip(tipData) {
  const queue = await loadQueue();

  // Check if this tip already exists (by client_event_id)
  const existingIdx = queue.findIndex((item) => item.id === tipData.clientEventId);
  if (existingIdx >= 0) {
    console.log(`[CamCash Queue] Tip already queued: ${tipData.clientEventId}`);
    return;
  }

  const queueItem = {
    id: tipData.clientEventId,
    status: 'pending',
    attemptCount: 0,
    nextRetryAt: new Date().toISOString(), // Retry immediately on first attempt
    createdAt: new Date().toISOString(),
    tip: tipData,
    failureReason: null,
    lastAttemptAt: null,
  };

  queue.push(queueItem);
  await saveQueue(queue);

  console.log(`[CamCash Queue] Tip queued: ${tipData.clientEventId}`);

  // Trigger immediate processing
  await processQueue();

  // Ensure alarm is set for future retries
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
}

/**
 * Listen for alarms to process queue periodically
 */
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    processQueue().catch((err) => {
      console.error('[CamCash Queue] Error processing queue:', err);
    });
  }
});

/**
 * Initialize on startup
 */
chrome.runtime.onStartup?.addListener?.(() => {
  console.log('[CamCash] Service worker started');
  // Set up periodic queue processing
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
  // Process any pending items immediately
  processQueue().catch((err) => {
    console.error('[CamCash Queue] Error on startup:', err);
  });
});

// Ensure alarm is set when service worker becomes available
chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
