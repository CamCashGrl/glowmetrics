import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { PLATFORM_TOKEN_RATES } from '@/lib/constants';

// lib/constants.js keys its rates by capitalized platform name (e.g.
// "Chaturbate"), matching the convention every other write path into `tips`
// uses (see detectPlatform() in lib/analytics.js, app/api/chaturbate/*).
// The extension/scan payload uses lowercase platform ids instead, so map
// between the two rather than changing either source of truth.
const PLATFORM_LABELS = {
  chaturbate: 'Chaturbate',
  bongacams: 'BongaCams',
  myfreecams: 'MyFreeCams',
};

const ScanRowSchema = z.object({
  username: z.string().min(1).max(200),
  tokens: z.number().int().positive(),
  direction: z.enum(['inbound', 'outbound']),
  timestamp: z.string().datetime().nullable(),
  raw_date_text: z.string().max(200).optional(),
  platform: z.enum(['chaturbate', 'bongacams', 'myfreecams']),
});

const ScanRequestSchema = z.object({
  platform: z.enum(['chaturbate', 'bongacams', 'myfreecams']),
  rows: z.array(ScanRowSchema).min(1).max(5000), // hard ceiling — a legitimate scan shouldn't exceed this
});

export async function POST(request) {
  // Called from the extension's background service worker (see
  // background.js scanTokenHistory()), which sends the user's Supabase
  // access token as a Bearer header, not cookies — a cookie-based route
  // client (createSupabaseRouteClient) never sees a session here. Validate
  // the bearer token directly instead, the same way app/api/live/tips/route.js
  // already does for this extension's other authenticated calls.
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'You need to sign in to continue.' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(authHeader.substring(7));

  if (authError || !user) {
    return NextResponse.json({ error: 'You need to sign in to continue.' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const parsed = ScanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid scan data.' }, { status: 400 });
  }

  const { platform, rows } = parsed.data;
  const rate = PLATFORM_TOKEN_RATES[PLATFORM_LABELS[platform]];
  if (!rate) {
    return NextResponse.json({ error: 'Unsupported platform.' }, { status: 400 });
  }

  const inbound = [];
  const outboundExcluded = [];
  const needsReview = [];

  for (const row of rows) {
    if (row.platform !== platform) continue; // defensive — ignore mismatched rows

    if (row.direction === 'outbound') {
      outboundExcluded.push(row);
      continue;
    }

    if (!row.timestamp) {
      needsReview.push({ ...row, reason: 'Could not parse a valid date for this row.' });
      continue;
    }

    inbound.push({
      ...row,
      usd: Math.round(row.tokens * rate * 100) / 100,
    });
  }

  const summary = {
    inboundCount: inbound.length,
    outboundExcludedCount: outboundExcluded.length,
    needsReviewCount: needsReview.length,
    totalTokens: inbound.reduce((sum, r) => sum + r.tokens, 0),
    totalUsd: Math.round(inbound.reduce((sum, r) => sum + r.usd, 0) * 100) / 100,
  };

  return NextResponse.json({ inbound, outboundExcluded, needsReview, summary }, { status: 200 });
}
