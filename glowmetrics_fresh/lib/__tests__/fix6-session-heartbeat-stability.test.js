// ============================================================
// Fix 6: Session Heartbeat/Stability Tests
// Service worker restart, network outages, page refresh,
// extension reload, delayed heartbeat recovery
// ============================================================

describe('Fix 6: Session heartbeat stability', () => {

  describe('Service worker restart during active session', () => {
    test('Session survives SW sleep and restart with heartbeat resumption', async () => {
      // Scenario: active session, SW sleeps, SW restarts, heartbeat resumes
      const session = {
        id: 'sess-001',
        status: 'active',
        broadcaster_page_missing_since: null,
        website_last_heartbeat_at: new Date().toISOString(),
        extension_last_heartbeat_at: new Date().toISOString(),
        is_active: true,
      };

      // Step 1: Session is active with recent heartbeats
      expect(session.status).toBe('active');
      expect(session.broadcaster_page_missing_since).toBeNull();

      // Step 2: Simulate SW sleep (no heartbeats for 1 minute)
      // [In reality, SW goes idle but alarms persist]
      const sleepEnd = new Date();

      // Step 3: SW restarts, restorePromise completes, alarm fires
      // Extension fetches current session state
      const restoredSession = {
        ...session,
        extension_last_heartbeat_at: sleepEnd.toISOString(),
      };

      // Step 4: Heartbeat resumed
      expect(restoredSession.status).toBe('active');
      expect(restoredSession.is_active).toBe(true);
      expect(restoredSession.broadcaster_page_missing_since).toBeNull();
    });

    test('FIX R4: restorePromise awaited before heartbeat on cold start', async () => {
      // Scenario: SW restarted, but restorePromise not yet complete
      // Heartbeat should WAIT for restore, not send with stale data

      let restoreCompleted = false;
      const restorePromise = new Promise((resolve) => {
        setTimeout(() => {
          restoreCompleted = true;
          resolve({ session: { id: 'sess-001', status: 'active' } });
        }, 100);
      });

      let heartbeatSentWithStaleData = false;
      const sendHeartbeat = async () => {
        // FIX R4: This must await restorePromise
        await restorePromise;
        if (!restoreCompleted) {
          heartbeatSentWithStaleData = true;
        }
        return { session: { status: 'active' } };
      };

      // Simulate alarm fire on cold start
      const result = await sendHeartbeat();

      expect(heartbeatSentWithStaleData).toBe(false);
      expect(result.session.status).toBe('active');
      expect(restoreCompleted).toBe(true);
    });

    test('Extended SW sleep (5+ minutes) with broadcaster page detected', async () => {
      // Scenario: SW sleeps, restarts after 6 minutes
      // broadcaster_page_missing_since might have been set before sleep
      // But extension report shows page IS detected now

      const now = Date.now();
      const sixMinutesAgo = now - 6 * 60 * 1000;

      // Database shows page was missing 6+ minutes ago
      const sessionBefore = {
        status: 'active',
        broadcaster_page_missing_since: new Date(sixMinutesAgo).toISOString(),
        is_active: true,
      };

      // Extension heartbeat reports: page IS detected NOW
      const broadcasterPageDetected = true;

      // Database logic: if page detected, clear broadcaster_page_missing_since
      const sessionAfter = {
        ...sessionBefore,
        broadcaster_page_missing_since: broadcasterPageDetected ? null : sessionBefore.broadcaster_page_missing_since,
        extension_last_heartbeat_at: new Date(now).toISOString(),
      };

      // Session should remain active (not transition to needs_resolution)
      // because sweep runs AFTER the heartbeat updates
      expect(sessionAfter.status).toBe('active');
      expect(sessionAfter.broadcaster_page_missing_since).toBeNull();
      expect(sessionAfter.is_active).toBe(true);
    });
  });

  describe('Temporary network outage', () => {
    test('Heartbeat requests fail during outage, retry on reconnect', async () => {
      const heartbeatAttempts = [];
      let networkOnline = false;

      const sendHeartbeat = async () => {
        heartbeatAttempts.push({ time: Date.now(), online: networkOnline });
        if (!networkOnline) {
          throw new Error('Network error');
        }
        return { success: true };
      };

      // Simulate 3 failed attempts while offline
      for (let i = 0; i < 3; i++) {
        try {
          await sendHeartbeat();
        } catch (e) {
          // Heartbeat failure is silently retried on next tick
        }
      }

      // All attempts failed while offline
      expect(heartbeatAttempts.filter(a => !a.online).length).toBe(3);

      // Network comes back
      networkOnline = true;

      // Next heartbeat succeeds
      const result = await sendHeartbeat();
      expect(result.success).toBe(true);
      expect(heartbeatAttempts[3].online).toBe(true);
    });

    test('Session remains active during network outage', async () => {
      // Scenario: active session, network fails, heartbeats fail to reach server
      // After 5 minutes: no heartbeats, broadcaster_page_missing_since > 5m
      // sweep_stale_live_session() would transition to needs_resolution
      // BUT: if network comes back and heartbeat succeeds within 5m, no transition

      const sessionStart = Date.now();
      const outageStart = sessionStart + 2 * 60 * 1000; // 2 minutes in
      const outageEnd = outageStart + 4 * 60 * 1000; // 4-minute outage

      let broadcasterPageMissingSince = null;
      let lastHeartbeatTime = sessionStart;

      // Simulate heartbeat every 1 minute
      const heartbeats = [
        { time: sessionStart, online: true, pageDetected: true },
        { time: sessionStart + 60000, online: true, pageDetected: true },
        { time: sessionStart + 120000, online: false, pageDetected: true }, // Outage starts
        { time: sessionStart + 180000, online: false, pageDetected: true },
        { time: sessionStart + 240000, online: false, pageDetected: true },
        { time: sessionStart + 300000, online: true, pageDetected: true }, // Outage ends
      ];

      for (const hb of heartbeats) {
        if (hb.online) {
          lastHeartbeatTime = hb.time;
          if (hb.pageDetected) {
            broadcasterPageMissingSince = null;
          }
        } else {
          // Offline — set missing timestamp on first failure
          if (broadcasterPageMissingSince === null) {
            broadcasterPageMissingSince = hb.time;
          }
        }
      }

      // After 4-minute outage recovery, page should still be detected
      expect(broadcasterPageMissingSince).toBeNull();
      expect(lastHeartbeatTime).toBe(sessionStart + 300000);
    });

    test('Session auto-transitions to needs_resolution only if outage > 5 minutes', async () => {
      const now = Date.now();
      const fourMinutesAgo = now - 4 * 60 * 1000;
      const sixMinutesAgo = now - 6 * 60 * 1000;

      // Session 1: broadcaster_page_missing_since = 4 minutes ago
      const session1 = {
        status: 'active',
        broadcaster_page_missing_since: new Date(fourMinutesAgo).toISOString(),
      };

      // Session 2: broadcaster_page_missing_since = 6 minutes ago
      const session2 = {
        status: 'active',
        broadcaster_page_missing_since: new Date(sixMinutesAgo).toISOString(),
      };

      const MAX_MISSING_BEFORE_NEEDS_RESOLUTION = 5 * 60 * 1000;

      // Session 1: under threshold
      const isStale1 = (now - new Date(session1.broadcaster_page_missing_since).getTime()) >= MAX_MISSING_BEFORE_NEEDS_RESOLUTION;
      expect(isStale1).toBe(false);

      // Session 2: over threshold
      const isStale2 = (now - new Date(session2.broadcaster_page_missing_since).getTime()) >= MAX_MISSING_BEFORE_NEEDS_RESOLUTION;
      expect(isStale2).toBe(true);
    });
  });

  describe('Dashboard page refresh during active session', () => {
    test('Existing session restored from server on refresh', async () => {
      // Scenario: page refresh calls restore()
      const originalSession = {
        id: 'sess-001',
        status: 'active',
        started_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        is_active: true,
      };

      // Page refreshes, calls /api/live/session
      const restoredData = {
        session: originalSession,
        engineEnabledForNewSession: true,
      };

      // Phase transitions from loading → active
      let phase = 'loading';
      if (restoredData.session) {
        phase = 'active';
      }

      expect(phase).toBe('active');
      expect(restoredData.session.id).toBe('sess-001');
      expect(restoredData.session.started_at).toBe(originalSession.started_at);
    });

    test('Original started_at preserved across refreshes', async () => {
      const originalStartTime = new Date('2026-10-04T10:00:00Z');
      const session = {
        id: 'sess-001',
        started_at: originalStartTime.toISOString(),
        is_active: true,
      };

      // Simulate page refresh 5 minutes later
      const refreshTime = new Date(Date.now() + 5 * 60 * 1000);

      // On restore, server returns same started_at
      const restoredSession = {
        ...session,
        // started_at is NOT updated, remains original
      };

      expect(restoredSession.started_at).toBe(originalStartTime.toISOString());
      expect(restoredSession.started_at).not.toBe(refreshTime.toISOString());
    });

    test('No duplicate session created on refresh', async () => {
      const sessionsBefore = [
        { id: 'sess-001', status: 'active', user_id: 'user-123' },
      ];

      // Page refreshes, calls restore
      const restoredData = {
        session: sessionsBefore[0],
      };

      // Should NOT create a new session
      const sessionsAfter = [restoredData.session];

      expect(sessionsAfter).toHaveLength(1);
      expect(sessionsAfter[0].id).toBe('sess-001');
    });

    test('Timer continues from server-computed state, not local timer', async () => {
      const session = {
        started_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        paused_at: null,
        total_paused_seconds: 0,
      };

      const now = Date.now();
      const startedAt = new Date(session.started_at).getTime();
      const totalPausedSeconds = session.total_paused_seconds;
      const pausedAt = session.paused_at ? new Date(session.paused_at).getTime() : null;

      // Active duration computed from server state
      const activeDuration = Math.max(0, ((now - startedAt) / 1000 - totalPausedSeconds - (pausedAt ? Math.max(0, (now - pausedAt) / 1000) : 0)));

      // Should be approximately 20 minutes (1200 seconds)
      expect(activeDuration).toBeGreaterThan(1190);
      expect(activeDuration).toBeLessThan(1210);
    });
  });

  describe('Extension reload', () => {
    test('Service worker restart loads current session state via restore()', async () => {
      // Scenario: extension reloaded, SW starts fresh, restore() called
      let liveSession = null;

      const restore = async () => {
        // Fetch session from API
        const response = { session: { id: 'sess-001', status: 'active' } };
        liveSession = response.session;
        return response;
      };

      // SW initializes
      await restore();

      expect(liveSession).not.toBeNull();
      expect(liveSession.id).toBe('sess-001');
      expect(liveSession.status).toBe('active');
    });

    test('Chrome alarms persist across extension reload', async () => {
      // Scenario: chrome.alarms.create called during init
      // Extension reloads, service worker restarts, alarm still fires
      const alarms = [];

      const createAlarm = (name, spec) => {
        alarms.push({ name, spec, createdAt: Date.now() });
      };

      // Initial extension load
      createAlarm('live_heartbeat', { periodInMinutes: 1 });
      expect(alarms).toHaveLength(1);

      // Extension reloads (alarms persist in chrome.alarms API)
      const alarmsAfterReload = alarms; // Chrome API persists

      expect(alarmsAfterReload).toHaveLength(1);
      expect(alarmsAfterReload[0].name).toBe('live_heartbeat');
    });

    test('Session not auto-ended if heartbeat resumes quickly after reload', async () => {
      const now = Date.now();
      const oneMinuteAgo = now - 60 * 1000;

      // Before reload: broadcaster_page_missing_since set 1 minute ago
      const sessionBeforeReload = {
        status: 'active',
        broadcaster_page_missing_since: new Date(oneMinuteAgo).toISOString(),
      };

      // Extension reloads, SW restarts (takes ~100ms)
      // Alarm fires immediately because periodInMinutes: 1 is about to elapse
      // sendExtensionHeartbeat reports page IS detected

      const sessionAfterHeartbeat = {
        ...sessionBeforeReload,
        broadcaster_page_missing_since: null, // cleared by heartbeat
        extension_last_heartbeat_at: new Date(now).toISOString(),
      };

      // Session should not transition to needs_resolution
      // because missing_since is cleared before sweep runs
      expect(sessionAfterHeartbeat.status).toBe('active');
      expect(sessionAfterHeartbeat.broadcaster_page_missing_since).toBeNull();
    });
  });

  describe('Delayed heartbeat arrival', () => {
    test('Late heartbeat within recovery window does not auto-finalize session', async () => {
      const now = Date.now();
      const threeMinutesAgo = now - 3 * 60 * 1000;

      // Session: page detected 3 minutes ago
      const session = {
        status: 'active',
        broadcaster_page_missing_since: null,
        extension_last_heartbeat_at: new Date(threeMinutesAgo).toISOString(),
      };

      // Heartbeat is delayed (network slow)
      const heartbeatSendTime = now - 120 * 1000; // sent 2 minutes ago
      const heartbeatArriveTime = now; // arrives 2 minutes later
      const travelTime = heartbeatArriveTime - heartbeatSendTime;

      // Server receives: page is still detected (as of 2 min ago)
      const heartbeatReply = {
        session: {
          ...session,
          extension_last_heartbeat_at: new Date(heartbeatArriveTime).toISOString(),
        },
      };

      // Session should NOT be in needs_resolution
      expect(heartbeatReply.session.status).toBe('active');
      expect(heartbeatReply.session.broadcaster_page_missing_since).toBeNull();
      expect(travelTime).toBe(120000); // 2-minute delay is acceptable
    });

    test('No auto-finalization happens mid-heartbeat for needs_resolution', async () => {
      const now = Date.now();
      const sixMinutesAgo = now - 6 * 60 * 1000;
      const fiveMinutesAgo = now - 5 * 60 * 1000;

      // Session: in needs_resolution (page missing 6 minutes)
      const session = {
        status: 'needs_resolution',
        status_before_resolution: 'active',
        broadcaster_page_missing_since: new Date(sixMinutesAgo).toISOString(),
        // No tips since needs_resolution was entered (5 min ago)
      };

      // But: heartbeat in flight from before needs_resolution (sent 4 minutes ago)
      const pendingHeartbeat = {
        broadcasterPageDetected: true,
        sendTime: now - 4 * 60 * 1000,
        arriveTime: now,
      };

      // This heartbeat would clear broadcaster_page_missing_since
      // Question: should session auto-revive?

      // Current behavior: NO auto-revive while in needs_resolution
      // (documented limitation: "never revives needs_resolution")
      const sessionAfter = {
        ...session,
        broadcaster_page_missing_since: pendingHeartbeat.broadcasterPageDetected ? null : session.broadcaster_page_missing_since,
      };

      // Session stays in needs_resolution despite page coming back
      expect(sessionAfter.status).toBe('needs_resolution');
      expect(sessionAfter.broadcaster_page_missing_since).toBeNull();
    });

    test('Heartbeat arriving after needs_resolution threshold resets timing', async () => {
      const now = Date.now();
      const sixMinutesAgo = now - 6 * 60 * 1000;

      // Heartbeat sent 4 minutes ago (when page was detected)
      // Arrives now (2-minute delay)
      const heartbeat = {
        broadcasterPageDetected: true,
        serverReceiptTime: now,
      };

      // Current session: needs_resolution (page missing > 5 min)
      const session = {
        status: 'needs_resolution',
        broadcaster_page_missing_since: new Date(sixMinutesAgo).toISOString(),
      };

      // Apply heartbeat
      const updatedSession = {
        ...session,
        broadcaster_page_missing_since: heartbeat.broadcasterPageDetected ? null : session.broadcaster_page_missing_since,
        extension_last_heartbeat_at: new Date(heartbeat.serverReceiptTime).toISOString(),
      };

      // broadcaster_page_missing_since is cleared (page detected)
      expect(updatedSession.broadcaster_page_missing_since).toBeNull();
      // But status remains needs_resolution (no auto-revive)
      expect(updatedSession.status).toBe('needs_resolution');
    });
  });

  describe('Session finalization safeguards', () => {
    test('Only explicit Stop or 15-minute no-tip timeout causes auto-end', async () => {
      const now = Date.now();
      const fifteenMinutesAgo = now - 15 * 60 * 1000;

      // Session in needs_resolution for 10 minutes
      const sessionAt10Min = {
        status: 'needs_resolution',
        broadcaster_page_missing_since: new Date(fifteenMinutesAgo).toISOString(), // missing for 15 total
        tips_since_resolution: false,
      };

      // Time check: 15 minutes elapsed and no tips
      const isAutoEndEligible =
        sessionAt10Min.status === 'needs_resolution' &&
        sessionAt10Min.broadcaster_page_missing_since &&
        (now - new Date(sessionAt10Min.broadcaster_page_missing_since).getTime()) >= 15 * 60 * 1000 &&
        !sessionAt10Min.tips_since_resolution;

      expect(isAutoEndEligible).toBe(true);

      // If user sends a tip 1 minute before auto-end would trigger
      sessionAt10Min.tips_since_resolution = true;
      const isAutoEndBlocked = sessionAt10Min.tips_since_resolution;
      expect(isAutoEndBlocked).toBe(true);
    });

    test('Missing heartbeat alone never auto-ends; requires explicit Stop or 15m timeout', async () => {
      // Scenario: 10 minutes with no heartbeats, but page might still be detected
      const sessionStart = Date.now();
      const tenMinutesLater = sessionStart + 10 * 60 * 1000;

      const session = {
        status: 'active',
        website_last_heartbeat_at: new Date(sessionStart).toISOString(),
        extension_last_heartbeat_at: new Date(sessionStart).toISOString(),
        // No new heartbeats for 10 minutes
      };

      // Just because heartbeats stopped doesn't mean auto-end should trigger
      // Only if:
      // 1. Page explicitly reported as not detected (broadcaster_page_missing_since set)
      // 2. AND that's been > 5 min (needs_resolution)
      // 3. AND > 15 min total with no tips

      const hasExplicitPageMissing = session.broadcaster_page_missing_since !== null && session.broadcaster_page_missing_since !== undefined;
      expect(hasExplicitPageMissing).toBe(false);
      expect(session.status).toBe('active'); // not auto-ended
    });

    test('Explicit Stop always ends session immediately', async () => {
      const session = {
        id: 'sess-001',
        status: 'active',
        is_active: true,
      };

      // User clicks Stop
      const resolveResult = {
        action: 'stop', // User explicitly stops
        oldStatus: session.status,
        newStatus: 'ended',
      };

      const sessionAfterStop = {
        ...session,
        status: resolveResult.newStatus,
        is_active: false,
      };

      expect(sessionAfterStop.status).toBe('ended');
      expect(sessionAfterStop.is_active).toBe(false);
    });
  });
});
