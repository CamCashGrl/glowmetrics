import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// TEMPORARY diagnostic route — added to settle whether SUPABASE_SERVICE_ROLE_KEY
// (and its neighbors) are actually present in process.env at runtime in
// Production, after repeated "Error: supabaseKey is required." crashes in
// /api/live/tips and /api/scan/import despite the var reportedly always
// being configured in the Vercel dashboard. Reports presence + length only —
// never the value — so it's safe to leave briefly reachable. Delete this
// route once the answer is confirmed; it has no other purpose.
export async function GET() {
  const report = (name) => {
    const v = process.env[name];
    return {
      present: v !== undefined,
      truthy: !!v,
      length: v ? v.length : 0,
    };
  };

  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: report('NEXT_PUBLIC_SUPABASE_URL'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: report('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: report('SUPABASE_SERVICE_ROLE_KEY'),
    VERCEL_ENV: process.env.VERCEL_ENV || null,
    region: process.env.VERCEL_REGION || null,
  });
}
