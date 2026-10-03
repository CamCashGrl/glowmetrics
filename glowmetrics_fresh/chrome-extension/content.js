/**
 * Chrome Extension Content Script for CamCash Live Mode - Phase 1
 *
 * Detects tips on streaming platforms and sends them to background.js
 * with client-generated immutable event IDs for deduplication.
 */

// Track detected tips to avoid re-sending the same notification
const processedTips = new Set();

/**
 * Generate immutable UUID v4 for this tip event
 * Used for idempotent deduplication across retries
 */
function generateClientEventId() {
  return crypto.randomUUID();
}

/**
 * Send tip to background script for persistence and queueing
 */
function sendTipToBackground(tipData) {
  // Generate immutable client event ID at detection time
  tipData.clientEventId = generateClientEventId();
  // Preserve detection timestamp (original time, not overwritten on retry)
  tipData.detectedAt = new Date().toISOString();

  chrome.runtime.sendMessage({
    action: 'QUEUE_TIP',
    tip: tipData,
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('[CamCash] Failed to queue tip:', chrome.runtime.lastError.message);
    } else {
      console.log('[CamCash] Tip queued for sync:', tipData.clientEventId);
    }
  });
}

/**
 * Detect tips on Chaturbate
 */
function detectChaturbate() {
  const tipNotifications = document.querySelectorAll('[class*="tip-notification"], [class*="tip-alert"], [data-action="tip"]');

  tipNotifications.forEach((el) => {
    const tipText = el.textContent || '';
    const tipKey = `chaturbate-${tipText}-${Date.now()}`;

    if (processedTips.has(tipKey)) return;
    processedTips.add(tipKey);

    // Parse tip amount and username from DOM
    const amountMatch = tipText.match(/(\d+)\s*token/i);
    const usernameMatch = tipText.match(/from\s+([^\s]+)/i) || tipText.match(/([^\s]+)\s+tipped/i);

    if (amountMatch && usernameMatch) {
      sendTipToBackground({
        username: usernameMatch[1],
        amount: parseInt(amountMatch[1], 10),
        platform: 'chaturbate',
        timestamp: new Date().toISOString(),
      });
    }
  });
}

/**
 * Detect tips on BongaCams
 */
function detectBongaCams() {
  const tipElements = document.querySelectorAll('[class*="gift-notification"], [class*="tip-message"]');

  tipElements.forEach((el) => {
    const tipText = el.textContent || '';
    const tipKey = `bongacams-${tipText}-${Date.now()}`;

    if (processedTips.has(tipKey)) return;
    processedTips.add(tipKey);

    const amountMatch = tipText.match(/(\d+)\s*token/i);
    const usernameMatch = tipText.match(/from\s+([^\s]+)/i) || tipText.match(/([^\s]+)\s+sent/i);

    if (amountMatch && usernameMatch) {
      sendTipToBackground({
        username: usernameMatch[1],
        amount: parseInt(amountMatch[1], 10),
        platform: 'bongacams',
        timestamp: new Date().toISOString(),
      });
    }
  });
}

/**
 * Detect tips on MyFreeCams
 */
function detectMyFreeCams() {
  const tipElements = document.querySelectorAll('[class*="tip-popup"], [class*="notification"]');

  tipElements.forEach((el) => {
    const tipText = el.textContent || '';
    const tipKey = `myfreecams-${tipText}-${Date.now()}`;

    if (processedTips.has(tipKey)) return;
    processedTips.add(tipKey);

    const amountMatch = tipText.match(/(\d+)\s*token/i);
    const usernameMatch = tipText.match(/([^\s]+)\s+tipped/i) || tipText.match(/from\s+([^\s]+)/i);

    if (amountMatch && usernameMatch) {
      sendTipToBackground({
        username: usernameMatch[1],
        amount: parseInt(amountMatch[1], 10),
        platform: 'myfreecams',
        timestamp: new Date().toISOString(),
      });
    }
  });
}

/**
 * Detect tips on Stripchat
 */
function detectStripchat() {
  const tipElements = document.querySelectorAll('[class*="tip-notification"], [class*="popup-notification"]');

  tipElements.forEach((el) => {
    const tipText = el.textContent || '';
    const tipKey = `stripchat-${tipText}-${Date.now()}`;

    if (processedTips.has(tipKey)) return;
    processedTips.add(tipKey);

    const amountMatch = tipText.match(/(\d+)\s*token/i);
    const usernameMatch = tipText.match(/from\s+([^\s]+)/i) || tipText.match(/([^\s]+)\s+tipped/i);

    if (amountMatch && usernameMatch) {
      sendTipToBackground({
        username: usernameMatch[1],
        amount: parseInt(amountMatch[1], 10),
        platform: 'stripchat',
        timestamp: new Date().toISOString(),
      });
    }
  });
}

/**
 * Detect tips on CamSoda
 */
function detectCamSoda() {
  const tipElements = document.querySelectorAll('[class*="notification"], [class*="tip-alert"]');

  tipElements.forEach((el) => {
    const tipText = el.textContent || '';
    const tipKey = `camsoda-${tipText}-${Date.now()}`;

    if (processedTips.has(tipKey)) return;
    processedTips.add(tipKey);

    const amountMatch = tipText.match(/(\d+)\s*token/i);
    const usernameMatch = tipText.match(/from\s+([^\s]+)/i) || tipText.match(/([^\s]+)\s+tipped/i);

    if (amountMatch && usernameMatch) {
      sendTipToBackground({
        username: usernameMatch[1],
        amount: parseInt(amountMatch[1], 10),
        platform: 'camsoda',
        timestamp: new Date().toISOString(),
      });
    }
  });
}

/**
 * Run all platform-specific detectors
 */
function runDetectors() {
  const url = window.location.href;

  if (url.includes('chaturbate.com')) {
    detectChaturbate();
  } else if (url.includes('bongacams.com')) {
    detectBongaCams();
  } else if (url.includes('myfreecams.com')) {
    detectMyFreeCams();
  } else if (url.includes('stripchat.com')) {
    detectStripchat();
  } else if (url.includes('camsoda.com')) {
    detectCamSoda();
  }
}

// Run detectors periodically (every 500ms)
setInterval(runDetectors, 500);

// Also run on page load
document.addEventListener('DOMContentLoaded', runDetectors);
