import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Admin client — initialized lazily inside handler to avoid build-time crash
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request) {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      console.error('[save-profile] No Bearer token in Authorization header');
      return NextResponse.json({ error: 'Unauthorized – no token' }, { status: 401 });
    }

    const supabaseAdmin = getAdminClient();

    // Verify the token and get the user — works even before cookies are set (PKCE flow)
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('[save-profile] Token verification failed:', userError?.message);
      return NextResponse.json({ error: 'Unauthorized – invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const {
      chaturbate_username,
      chaturbate_api_token,
      chaturbate_stats_token,
      chaturbate_token_type,
      broadcaster_type,
    } = body;

    // Upsert profile using admin client — bypasses RLS entirely
    const { error: upsertError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: user.id,
          ...(chaturbate_username !== undefined && { chaturbate_username }),
          ...(chaturbate_api_token !== undefined && { chaturbate_api_token }),
          ...(chaturbate_stats_token !== undefined && { chaturbate_stats_token }),
          ...(chaturbate_token_type !== undefined && { chaturbate_token_type }),
          ...(broadcaster_type !== undefined && { broadcaster_type }),
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (upsertError) {
      console.error('[save-profile] Upsert error:', upsertError.message);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    console.log('[save-profile] Profile saved for user:', user.id);
    return NextResponse.json({ success: true });

  } catch (err) {
    console.error('[save-profile] Unexpected error:', err.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
