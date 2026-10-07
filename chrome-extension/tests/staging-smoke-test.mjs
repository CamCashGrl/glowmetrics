// Staging Integration Smoke Test for Phase 2 Live Mode
//
// This test exercises the REAL extension→API→database flow end-to-end:
// - Creates a temporary staging Auth user
// - Starts/manages a live session through the API
// - POSTs tips to /api/live/tips with real authentication
// - Verifies database state (tips + live_tips rows)
// - Tests idempotency, pauses, resumes, and finalization
// - Validates final metrics
//
// Run with: npm run test:staging
// Requires staging env vars; refuses to run against production.

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ─── Configuration ──────────────────────────────────────────────────────────

const STAGING_URL = process.env.SUPABASE_STAGING_URL;
const STAGING_ANON_KEY = process.env.SUPABASE_STAGING_ANON_KEY;
const STAGING_SERVICE_ROLE_KEY = process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY;
const API_BASE = process.env.CAMCASH_STAGING_BASE_URL || 'https://staging.camcashgrl.com';

// Sanity check: refuse to run against production
if (API_BASE.includes('camcashgrl.com') && !API_BASE.includes('staging')) {
  console.error('❌ FATAL: API_BASE points to production. Set CAMCASH_STAGING_BASE_URL explicitly.');
  process.exit(1);
}

const missingEnv = [
  { name: 'SUPABASE_STAGING_URL', value: STAGING_URL },
  { name: 'SUPABASE_STAGING_ANON_KEY', value: STAGING_ANON_KEY },
  { name: 'SUPABASE_STAGING_SERVICE_ROLE_KEY', value: STAGING_SERVICE_ROLE_KEY },
].filter(({ value }) => !value);

if (missingEnv.length > 0) {
  console.error('❌ Missing required staging credentials:');
  missingEnv.forEach(({ name }) => console.error(`   ${name}`));
  process.exit(1);
}

// ─── Logging & Assertions ──────────────────────────────────────────────────

let passCount = 0;
let failCount = 0;

function pass(msg) {
  passCount++;
  console.log(`✅ ${msg}`);
}

function fail(msg) {
  failCount++;
  console.error(`❌ ${msg}`);
}

function assert(cond, msg) {
  if (cond) { pass(msg); }
  else { fail(msg); }
}

function deepEqual(a, b, msg) {
  const eq = JSON.stringify(a) === JSON.stringify(b);
  if (eq) { pass(msg); }
  else { fail(`${msg} | Expected: ${JSON.stringify(b)}, Got: ${JSON.stringify(a)}`); }
}

// ─── Test State ────────────────────────────────────────────────────────────

let tempUser = null;
let liveSession = null;
let firstTipId = null;
let secondTipId = null;
let firstClientEventId = null;
let secondClientEventId = null;

// ─── Supabase Clients ──────────────────────────────────────────────────────

const anonClient = createClient(STAGING_URL, STAGING_ANON_KEY);
const adminClient = createClient(STAGING_URL, STAGING_SERVICE_ROLE_KEY);

// ─── Helper Functions ──────────────────────────────────────────────────────

function generateUUID() {
  return crypto.randomUUID();
}

async function createTempAuthUser() {
  const RUN_ID = new Date().getTime().toString().slice(-6);
  const tempEmail = `smoke-${RUN_ID}-${crypto.randomBytes(4).toString('hex')}@staging.local`;
  const tempPassword = crypto.randomBytes(24).toString('hex');

  try {
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email: tempEmail,
      password: tempPassword,
      email_confirm: true
    });

    if (createErr) throw new Error(`Failed to create temp auth user: ${createErr.message}`);
    return { userId: created.user.id, email: tempEmail, password: tempPassword };
  } catch (e) {
    fail(`Create temp auth user: ${e.message}`);
    throw e;
  }
}

async function signInTempUser(email, password) {
  try {
    const { data: { session }, error: signInErr } = await anonClient.auth.signInWithPassword({
      email,
      password
    });
    if (signInErr) throw new Error(`Failed to sign in: ${signInErr.message}`);
    return session.access_token;
  } catch (e) {
    fail(`Sign in temp user: ${e.message}`);
    throw e;
  }
}

async function deleteTempAuthUser(userId) {
  try {
    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteErr) {
      console.warn(`⚠ Could not delete auth user ${userId}: ${deleteErr.message}`);
    } else {
      pass(`Cleanup: Deleted auth user ${userId}`);
    }
  } catch (e) {
    console.warn(`⚠ Exception deleting auth user ${userId}: ${e.message}`);
  }
}

async function cleanupUserData(userId) {
  try {
    await adminClient.from('live_tips').delete().eq('user_id', userId);
    await adminClient.from('tips').delete().eq('user_id', userId);
    await adminClient.from('live_sessions').delete().eq('user_id', userId);
    pass(`Cleanup: Deleted test data for user ${userId}`);
  } catch (e) {
    console.warn(`⚠ Error cleaning up user data: ${e.message}`);
  }
}

async function postTip(accessToken, username, tokens, platform, clientEventId, detectedAt) {
  const body = {
    username,
    amount: tokens,
    platform,
    clientEventId,
    detectedAt,
  };

  try {
    const res = await fetch(`${API_BASE}/api/live/tips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      fail(`POST /api/live/tips failed: ${res.status} ${JSON.stringify(data)}`);
      return null;
    }
    return data;
  } catch (e) {
    fail(`POST /api/live/tips error: ${e.message}`);
    return null;
  }
}

async function startLiveSession(accessToken) {
  try {
    const res = await fetch(`${API_BASE}/api/live/session/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      fail(`POST /api/live/session/start failed: ${res.status}`);
      return null;
    }
    return data.session;
  } catch (e) {
    fail(`Start live session error: ${e.message}`);
    return null;
  }
}

async function pauseLiveSession(accessToken) {
  try {
    const res = await fetch(`${API_BASE}/api/live/session/pause`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      fail(`POST /api/live/session/pause failed: ${res.status}`);
      return null;
    }
    return data.session;
  } catch (e) {
    fail(`Pause live session error: ${e.message}`);
    return null;
  }
}

async function resumeLiveSession(accessToken) {
  try {
    const res = await fetch(`${API_BASE}/api/live/session/resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      fail(`POST /api/live/session/resume failed: ${res.status}`);
      return null;
    }
    return data.session;
  } catch (e) {
    fail(`Resume live session error: ${e.message}`);
    return null;
  }
}

async function stopLiveSession(accessToken) {
  try {
    const res = await fetch(`${API_BASE}/api/live/session/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      fail(`POST /api/live/session/finalize failed: ${res.status}`);
      return null;
    }
    return data;
  } catch (e) {
    fail(`Stop live session error: ${e.message}`);
    return null;
  }
}

async function queryLiveTips(userId) {
  try {
    const { data, error } = await adminClient
      .from('live_tips')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return data || [];
  } catch (e) {
    fail(`Query live_tips error: ${e.message}`);
    return [];
  }
}

async function queryTips(userId) {
  try {
    const { data, error } = await adminClient
      .from('tips')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return data || [];
  } catch (e) {
    fail(`Query tips error: ${e.message}`);
    return [];
  }
}

// ─── Smoke Test Main ────────────────────────────────────────────────────────

async function runSmokeTest() {
  console.log('🌫️  Phase 2 Live Mode Staging Smoke Test');
  console.log(`   API Base: ${API_BASE}`);
  console.log(`   Running ${new Date().toISOString()}\n`);

  try {
    // Step 1: Create temporary staging Auth user
    console.log('Step 1: Create temporary staging Auth user');
    tempUser = await createTempAuthUser();
    assert(tempUser && tempUser.userId, 'Temp user created with userId');

    // Step 2: Sign in and get access token
    console.log('\nStep 2: Sign in temp user');
    const accessToken = await signInTempUser(tempUser.email, tempUser.password);
    assert(accessToken, 'Access token obtained');

    // Step 3: Start live session
    console.log('\nStep 3: Start live session');
    liveSession = await startLiveSession(accessToken);
    assert(liveSession && liveSession.id, 'Live session created');
    assert(liveSession.status === 'active', `Session status is 'active', got '${liveSession.status}'`);

    // Step 4: POST first tip (real event, not test)
    console.log('\nStep 4: POST first tip');
    firstClientEventId = generateUUID();
    const detectedAt1 = new Date().toISOString();
    const tipResponse1 = await postTip(accessToken, 'tipper_alice', 1000, 'twitch', firstClientEventId, detectedAt1);
    assert(tipResponse1 && tipResponse1.success === true, 'First tip POST succeeded');
    assert(tipResponse1.duplicate === false, 'First tip is not a duplicate');
    assert(tipResponse1.clientEventId === firstClientEventId, `clientEventId matches: ${firstClientEventId}`);
    assert(tipResponse1.live_session_id === liveSession.id, `liveSessionId matches session: ${liveSession.id}`);
    firstTipId = tipResponse1.tip_id;

    // Step 5: Verify exactly one live_tips + one tips row
    console.log('\nStep 5: Verify database state after first tip');
    const liveTips1 = await queryLiveTips(tempUser.userId);
    assert(liveTips1.length === 1, `Exactly 1 live_tips row, got ${liveTips1.length}`);
    const tips1 = await queryTips(tempUser.userId);
    assert(tips1.length === 1, `Exactly 1 canonical tips row, got ${tips1.length}`);

    // Step 6: Retry same clientEventId (duplicate detection)
    console.log('\nStep 6: Test idempotency - retry same clientEventId');
    const tipResponse1Retry = await postTip(accessToken, 'tipper_alice', 1000, 'twitch', firstClientEventId, detectedAt1);
    assert(tipResponse1Retry && tipResponse1Retry.success === true, 'Duplicate POST succeeded');
    assert(tipResponse1Retry.duplicate === true, 'Duplicate flag set to true');
    const liveTips1After = await queryLiveTips(tempUser.userId);
    assert(liveTips1After.length === 1, `Still exactly 1 live_tips row after duplicate, got ${liveTips1After.length}`);
    const tips1After = await queryTips(tempUser.userId);
    assert(tips1After.length === 1, `Still exactly 1 tips row after duplicate, got ${tips1After.length}`);

    // Step 7: Pause session
    console.log('\nStep 7: Pause live session');
    const pausedSession = await pauseLiveSession(accessToken);
    assert(pausedSession && pausedSession.status === 'paused', `Session paused, status: ${pausedSession.status}`);

    // Step 8: Send second tip while paused
    console.log('\nStep 8: POST second tip while paused');
    secondClientEventId = generateUUID();
    const detectedAt2 = new Date().toISOString();
    const tipResponse2 = await postTip(accessToken, 'tipper_bob', 500, 'twitch', secondClientEventId, detectedAt2);
    assert(tipResponse2 && tipResponse2.success === true, 'Second tip POST succeeded');
    assert(tipResponse2.live_session_id === liveSession.id, 'Second tip attached to same session');
    secondTipId = tipResponse2.tip_id;

    // Step 9: Verify two tips now in database
    console.log('\nStep 9: Verify both tips in database');
    const liveTips2 = await queryLiveTips(tempUser.userId);
    assert(liveTips2.length === 2, `Exactly 2 live_tips rows, got ${liveTips2.length}`);
    const tips2 = await queryTips(tempUser.userId);
    assert(tips2.length === 2, `Exactly 2 canonical tips rows, got ${tips2.length}`);

    // Step 10: Resume session
    console.log('\nStep 10: Resume live session');
    const resumedSession = await resumeLiveSession(accessToken);
    assert(resumedSession && resumedSession.status === 'active', `Session resumed, status: ${resumedSession.status}`);

    // Step 11: Stop (finalize) session
    console.log('\nStep 11: Stop (finalize) live session');
    const stoppedSession = await stopLiveSession(accessToken);
    assert(stoppedSession, 'Stop returned session data');
    assert(stoppedSession.status === 'ended', `Session finalized, status: ${stoppedSession.status}`);

    // Step 12: Verify final metrics reflect both tips
    console.log('\nStep 12: Verify final metrics');
    const finalMetrics = stoppedSession;
    assert(finalMetrics.final_tip_count === 2, `Final tip count: 2, got ${finalMetrics.final_tip_count}`);
    assert(finalMetrics.final_total_usd === 75, `Final USD (1000×0.05 + 500×0.05 = 50 + 25 = 75), got ${finalMetrics.final_total_usd}`);
    assert(finalMetrics.final_unique_tippers === 2, `Final unique tippers: 2, got ${finalMetrics.final_unique_tippers}`);
    const firstMetrics = JSON.parse(JSON.stringify(finalMetrics));
    const finalizedAt1 = finalMetrics.finalized_at;

    // Step 13: Call Stop again (idempotency)
    console.log('\nStep 13: Stop again (idempotency check)');
    const stoppedSessionAgain = await stopLiveSession(accessToken);
    assert(stoppedSessionAgain, 'Second stop returned session data');
    assert(stoppedSessionAgain.status === 'ended', `Session still ended, status: ${stoppedSessionAgain.status}`);

    // Step 14: Deep compare metrics (should be identical)
    console.log('\nStep 14: Verify metrics unchanged on second stop');
    deepEqual(
      stoppedSessionAgain.final_tip_count,
      firstMetrics.final_tip_count,
      'final_tip_count unchanged'
    );
    deepEqual(
      stoppedSessionAgain.final_total_usd,
      firstMetrics.final_total_usd,
      'final_total_usd unchanged'
    );
    deepEqual(
      stoppedSessionAgain.final_unique_tippers,
      firstMetrics.final_unique_tippers,
      'final_unique_tippers unchanged'
    );
    assert(
      stoppedSessionAgain.finalized_at === finalizedAt1,
      'finalized_at unchanged (idempotent)'
    );

  } catch (e) {
    fail(`Unhandled error: ${e.message}`);
    console.error(e);
  } finally {
    // Always cleanup, even on failure
    console.log('\n📝 Cleanup');
    if (tempUser) {
      await cleanupUserData(tempUser.userId);
      await deleteTempAuthUser(tempUser.userId);
    }
  }

  // Report results
  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passCount} passed, ${failCount} failed`);
  console.log('='.repeat(60));

  process.exit(failCount > 0 ? 1 : 0);
}

// Run the test
runSmokeTest().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
