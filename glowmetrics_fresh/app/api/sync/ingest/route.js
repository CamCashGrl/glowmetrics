// ============================================================
// CamCash — Sync Ingest API Route
// File: app/api/sync/ingest/route.js  (Next.js 14 App Router)
//
// POST /api/sync/ingest
//
// Called by the Chrome extension after each page of tips.
// Validates auth + HMAC signature, deduplicates, and upserts
// into the existing `tips` table using tip_ref as the dedup key.
// ============================================================

import { NextResponse } from 'next/server';
import { createClient }  from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ─── POST handler ────────────────────────────────────────────

export async function POST(request) {
  try {
    // 1. Authenticate the CamCash user via JWT
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Validate HMAC signature (prevents spoofed data injection)
    const body = await request.text();
    const signature  = request.headers.get('x-signature');
    const timestamp  = request.headers.get('x-timestamp');

    const isValid = await validateHmac({ userId, body, signature, timestamp });
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // 3. Parse and validate payload
    const { platform: rawPlatform, tips } = JSON.parse(body);
    if (!rawPlatform || !Array.isArray(tips) || tips.length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const platform = normalisePlatformName(rawPlatform);
    if (tips.length > 500) {
      return NextResponse.json({ error: 'Batch too large (max 500)' }, { status: 400 });
    }

    // 4. Normalise tips to match the existing `tips` table schema
    const rows = tips.map(t => normaliseTip(t, userId, platform));

    // 5. Upsert — skips exact duplicates via tip_ref unique index
    //    tip_ref = 'chaturbate:36767043508' — globally unique per platform
    const { data, error } = await supabase
      .from('tips')
      .upsert(rows, {
        onConflict:        'user_id,tip_ref',
        ignoreDuplicates:  true,            // ON CONFLICT DO NOTHING
      })
      .select('id');

    if (error) {
      console.error('Supabase upsert error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const inserted = data?.length ?? 0;
    const skipped  = tips.length - inserted;

    // 6. Update sync cursor (most recent tip date in this batch)
    const mostRecent = tips.reduce((a, b) =>
      new Date(a.date_time) > new Date(b.date_time) ? a : b
    );
    await updateSyncCursor(userId, platform, mostRecent);

    // 7. Log to sync_jobs (fire-and-forget, non-blocking)
    updateSyncJob(userId, platform, inserted, skipped).catch(console.error);

    return NextResponse.json({ inserted, skipped });

  } catch (err) {
    console.error('Ingest route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Auth ────────────────────────────────────────────────────

async function authenticateRequest(request) {
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  return user.id;
}

// ─── HMAC validation ─────────────────────────────────────────

async function validateHmac({ userId, body, signature, timestamp }) {
  if (!signature || !timestamp) return false;

  // Reject requests older than 5 minutes (replay attack prevention)
  const age = Date.now() - parseInt(timestamp, 10);
  if (age > 5 * 60 * 1000) return false;

  // Look up this user's extension secret from DB
  const { data } = await supabase
    .from('user_extension_secrets')
    .select('secret')
    .eq('user_id', userId)
    .single();

  if (!data?.secret) {
    // First sync — auto-register the secret from the header
    // (The extension sends X-Extension-Secret on first call)
    return true; // TODO: tighten this after secret registration is built
  }

  const expected = await hmacSign(body, data.secret);
  return expected === signature;
}

async function hmacSign(data, secretHex) {
  const keyBytes = hexToBuffer(secretHex);
  const key = await crypto.subtle.importKey(
    'raw', keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign(
    'HMAC', key,
    new TextEncoder().encode(data)
  );
  return bufferToHex(sig);
}

// ─── Platform name normaliser ─────────────────────────────────

function normalisePlatformName(raw) {
  const s = (raw || '').toLowerCase().trim();
  if (s === 'chaturbate' || s === 'cb') return 'Chaturbate';
  if (s === 'bongacams' || s === 'bc') return 'BongaCams';
  if (s === 'myfreecams' || s === 'mfc') return 'MyFreeCams';
  if (s === 'stripchat') return 'Stripchat';
  if (s === 'camsoda') return 'CamSoda';
  // Preserve original casing for unknown platforms
  return raw;
}

// ─── Normaliser ───────────────────────────────────────────────
// Maps the connector's output to your EXACT `tips` table columns.
// Column names confirmed from your live Supabase schema.

function normaliseTip(t, userId, platform) {
  // tip_ref = 'platform:nativeId' — globally unique dedup key
  const tipRef = `${platform}:${t.platform_tip_id}`;

  // CB token → USD conversion (standard rate: 1 token = $0.05)
  const usd = t.usd ?? (t.tokens * 0.05);

  return {
    user_id:        userId,
    date_time:      t.date_time,
    platform:       platform,
    username:       t.username ?? 'anonymous',
    username_lower: (t.username ?? 'anonymous').toLowerCase(),
    tip_type:       t.tip_type ?? 'tip',
    tokens:         t.tokens,
    usd:            parseFloat(usd.toFixed(4)),
    usd_rounded:    parseFloat(usd.toFixed(2)),
    tip_note:       t.tip_note ?? null,
    tip_ref:        tipRef,
    tip_seq:        0,   // not applicable for API-synced tips
    // session_id and upload_id intentionally null for synced tips
  };
}

// ─── Cursor update ───────────────────────────────────────────

async function updateSyncCursor(userId, platform, mostRecentTip) {
  await supabase
    .from('sync_cursors')
    .upsert({
      user_id:        userId,
      platform:       platform,
      last_synced_at: mostRecentTip.date_time,
      last_tip_id:    mostRecentTip.platform_tip_id,
      updated_at:     new Date().toISOString(),
    }, { onConflict: 'user_id,platform' });
}

// ─── Sync job tracking ───────────────────────────────────────

async function updateSyncJob(userId, platform, inserted, skipped) {
  // Upsert a running job record — the extension calls this repeatedly
  // so we accumulate counts across batches
  const { data: existing } = await supabase
    .from('sync_jobs')
    .select('id, records_inserted, records_skipped')
    .eq('user_id', userId)
    .eq('platform', platform)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    await supabase
      .from('sync_jobs')
      .update({
        records_inserted: (existing.records_inserted ?? 0) + inserted,
        records_skipped:  (existing.records_skipped  ?? 0) + skipped,
      })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('sync_jobs')
      .insert({
        user_id:          userId,
        platform:         platform,
        status:           'running',
        records_inserted: inserted,
        records_skipped:  skipped,
      });
  }
}

// ─── Utilities ───────────────────────────────────────────────

function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes.buffer;
}

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
