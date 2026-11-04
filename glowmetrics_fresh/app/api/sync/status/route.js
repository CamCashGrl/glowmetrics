// ============================================================
// CamCash — Sync Status API Route
// File: app/api/sync/status/route.js
//
// GET /api/sync/status
//
// Returns sync cursor info per platform so the extension
// knows whether to do a full or incremental sync.
// ============================================================

import { NextResponse } from 'next/server';
import { createClient }  from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get cursors for all platforms
  const { data: cursors } = await supabase
    .from('sync_cursors')
    .select('platform, last_synced_at, last_tip_id, updated_at')
    .eq('user_id', user.id);

  // Get recent sync jobs
  const { data: jobs } = await supabase
    .from('sync_jobs')
    .select('platform, status, records_inserted, records_skipped, started_at, completed_at')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(10);

  // Get tip counts per platform
  const { data: counts } = await supabase
    .from('tips')
    .select('platform')
    .eq('user_id', user.id);

  const tipCounts = (counts ?? []).reduce((acc, row) => {
    acc[row.platform] = (acc[row.platform] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    cursors:   cursors ?? [],
    recentJobs: jobs ?? [],
    tipCounts,
  });
}
